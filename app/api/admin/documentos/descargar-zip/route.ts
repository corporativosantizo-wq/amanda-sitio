// ============================================================================
// POST /api/admin/documentos/descargar-zip
// Descarga múltiples documentos en un ZIP organizado por tipo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { requireAdmin } from '@/lib/auth/api-auth';

export const maxDuration = 300; // 5 min — Vercel Pro

const TIPO_FOLDER: Record<string, string> = {
  demanda_memorial: 'Demandas y Memoriales',
  memorial: 'Demandas y Memoriales',
  resolucion_judicial: 'Resoluciones',
  contrato_comercial: 'Contratos',
  contrato_laboral: 'Contratos',
  escritura_publica: 'Escrituras',
  testimonio: 'Testimonios',
  acta_notarial: 'Actas Notariales',
  poder: 'Poderes',
  otro: 'Otros',
};

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { documento_ids, zip_name } = body as {
      documento_ids: string[];
      zip_name?: string;
    };

    if (!Array.isArray(documento_ids) || documento_ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un documento' }, { status: 400 });
    }

    if (documento_ids.length > 200) {
      return NextResponse.json({ error: 'Máximo 200 documentos por descarga' }, { status: 400 });
    }

    // Fetch document metadata
    const db = createAdminClient();
    const { data: docs, error } = await db
      .from('documentos')
      .select('id, archivo_url, nombre_archivo, nombre_original, tipo, titulo')
      .in('id', documento_ids);

    if (error) {
      console.error('[descargar-zip] Error fetching docs:', error);
      return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: 'No se encontraron documentos' }, { status: 404 });
    }

    // Check total size
    const { data: sizeData } = await db
      .from('documentos')
      .select('archivo_tamano')
      .in('id', documento_ids);

    const totalBytes = (sizeData ?? []).reduce((s: number, d: any) => s + (d.archivo_tamano ?? 0), 0);

    if (totalBytes > 500 * 1024 * 1024) {
      return NextResponse.json({
        error: `Los archivos seleccionados pesan ${(totalBytes / 1024 / 1024).toFixed(0)} MB. El máximo es 500 MB.`,
      }, { status: 413 });
    }

    // Build ZIP
    const zip = new JSZip();
    const storage = storageClient().storage.from('documentos');
    const usedNames = new Map<string, number>();

    let downloaded = 0;
    const errors: string[] = [];

    for (const doc of docs) {
      if (!doc.archivo_url) {
        errors.push(`${doc.nombre_archivo}: sin archivo en storage`);
        continue;
      }

      try {
        const { data: fileData, error: dlError } = await storage.download(doc.archivo_url);
        if (dlError || !fileData) {
          errors.push(`${doc.nombre_archivo}: error al descargar`);
          continue;
        }

        const folder = TIPO_FOLDER[doc.tipo ?? ''] ?? TIPO_FOLDER.otro;
        const fileName = doc.nombre_original ?? doc.nombre_archivo;

        // Deduplicate file names within the same folder
        const fullPath = `${folder}/${fileName}`;
        const count = usedNames.get(fullPath) ?? 0;
        usedNames.set(fullPath, count + 1);

        const finalName = count > 0
          ? fileName.replace(/(\.[^.]+)$/, ` (${count})$1`)
          : fileName;

        const buffer = await fileData.arrayBuffer();
        zip.file(`${folder}/${finalName}`, buffer);
        downloaded++;
      } catch (err: any) {
        errors.push(`${doc.nombre_archivo}: ${err.message ?? 'error desconocido'}`);
      }
    }

    if (downloaded === 0) {
      return NextResponse.json({
        error: 'No se pudo descargar ningún archivo',
        detalles: errors,
      }, { status: 500 });
    }

    if (errors.length > 0) {
      console.warn(`[descargar-zip] ${errors.length} errores:`, errors);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const finalName = zip_name
      ? `${zip_name}.zip`
      : `Documentos_${new Date().toISOString().slice(0, 10)}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalName)}"`,
        'Content-Length': String(zipBuffer.byteLength),
      },
    });
  } catch (err: any) {
    console.error('[descargar-zip] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
