// ============================================================================
// GET /api/admin/expedientes/[id]/descargar-todos
// Empaqueta todos los documentos del expediente en un ZIP numerado y ordenado
// cronológicamente por fecha_documento. Usa streaming de JSZip para soportar
// archivos grandes sin agotar la memoria del serverless.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { requireAdmin } from '@/lib/auth/api-auth';

export const maxDuration = 300; // 5 min (Vercel Pro)
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

interface DocumentoRow {
  id: string;
  titulo: string | null;
  tipo: string | null;
  nombre_archivo: string | null;
  nombre_original: string | null;
  fecha_documento: string | null;
  archivo_url: string | null;
  archivo_tamano: number | null;
  created_at: string | null;
}

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function getExtension(name: string | null | undefined): string {
  if (!name) return '';
  const m = name.match(/\.([^.\/]+)$/);
  return m ? `.${m[1].toLowerCase()}` : '';
}

function sanitizeFilenameSegment(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')        // strip diacritics (combining marks)
    .replace(/[\/\\:*?"<>|]/g, '')          // strip illegal FS chars
    .replace(/[\x00-\x1F\x7F]/g, '')        // strip control chars
    .replace(/\s+/g, '_')                   // spaces -> underscore
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120) || 'documento';
}

function pickNumeroExpediente(exp: {
  numero_expediente: string | null;
  numero_mp: string | null;
  numero_administrativo: string | null;
}): string {
  return (
    exp.numero_expediente ??
    exp.numero_mp ??
    exp.numero_administrativo ??
    'SN'
  );
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const db = createAdminClient();

    // 1. Expediente (para nombrar el ZIP)
    const { data: expediente, error: expErr } = await db
      .from('expedientes')
      .select('id, numero_expediente, numero_mp, numero_administrativo')
      .eq('id', id)
      .single();

    if (expErr || !expediente) {
      return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
    }

    // 2. Documentos ordenados cronológicamente (fecha_documento ASC, fallback created_at)
    const { data: docs, error: docsErr } = await db
      .from('documentos')
      .select('id, titulo, tipo, nombre_archivo, nombre_original, fecha_documento, archivo_url, archivo_tamano, created_at')
      .eq('expediente_id', id)
      .order('fecha_documento', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true });

    if (docsErr) {
      console.error('[descargar-todos] Supabase error:', docsErr.message);
      return NextResponse.json({ error: 'Error al obtener documentos' }, { status: 500 });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ error: 'El expediente no tiene documentos' }, { status: 404 });
    }

    const rows = docs as unknown as DocumentoRow[];

    // Cap total size para no reventar memoria/disco temporal
    const totalBytes = rows.reduce((s, d) => s + (d.archivo_tamano ?? 0), 0);
    if (totalBytes > 500 * 1024 * 1024) {
      return NextResponse.json({
        error: `El expediente pesa ${(totalBytes / 1024 / 1024).toFixed(0)} MB. El máximo es 500 MB por descarga.`,
      }, { status: 413 });
    }

    // 3. Construir ZIP descargando archivo por archivo
    const zip = new JSZip();
    const storage = storageClient().storage.from('documentos');
    const usedNames = new Set<string>();
    let added = 0;
    const errors: string[] = [];
    const padWidth = String(rows.length).length;

    for (let i = 0; i < rows.length; i++) {
      const doc = rows[i];
      const displayName = doc.titulo ?? doc.nombre_archivo ?? doc.id;

      if (!doc.archivo_url) {
        errors.push(`${displayName}: sin archivo en storage`);
        continue;
      }

      try {
        const { data: fileData, error: dlError } = await storage.download(doc.archivo_url);
        if (dlError || !fileData) {
          errors.push(`${displayName}: error al descargar`);
          continue;
        }

        const index = String(i + 1).padStart(padWidth, '0');
        const fecha = doc.fecha_documento ?? (doc.created_at ? doc.created_at.slice(0, 10) : 'sin-fecha');
        const ext = getExtension(doc.nombre_original ?? doc.nombre_archivo);
        const baseRaw = doc.titulo?.trim() || doc.nombre_original?.replace(/\.[^.]+$/, '') || doc.nombre_archivo?.replace(/\.[^.]+$/, '') || 'documento';
        const base = sanitizeFilenameSegment(baseRaw);

        let candidate = `${index}_${fecha}_${base}${ext}`;
        let dedupe = 1;
        while (usedNames.has(candidate)) {
          candidate = `${index}_${fecha}_${base}_(${dedupe})${ext}`;
          dedupe++;
        }
        usedNames.add(candidate);

        const buffer = await fileData.arrayBuffer();
        zip.file(candidate, buffer);
        added++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'error';
        errors.push(`${displayName}: ${msg}`);
      }
    }

    if (added === 0) {
      return NextResponse.json({
        error: 'No se pudo descargar ningún archivo',
        detalles: errors,
      }, { status: 500 });
    }

    if (errors.length > 0) {
      console.warn(`[descargar-todos] ${errors.length} errores:`, errors);
    }

    const numero = pickNumeroExpediente(expediente);
    const zipName = `Expediente_${sanitizeFilenameSegment(numero)}_documentos.zip`;

    // 4. Streaming response — JSZip emite chunks vía internal stream
    const internalStream = zip.generateInternalStream({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true,
    });

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        internalStream.on('data', (chunk: Uint8Array) => {
          controller.enqueue(chunk);
        });
        internalStream.on('end', () => {
          controller.close();
        });
        internalStream.on('error', (err: Error) => {
          console.error('[descargar-todos] Stream error:', err);
          controller.error(err);
        });
        internalStream.resume();
      },
      cancel() {
        try { internalStream.pause(); } catch { /* noop */ }
      },
    });

    return new NextResponse(readable as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(zipName)}"`,
        'Cache-Control': 'no-store',
        'X-Documents-Included': String(added),
        'X-Documents-Skipped': String(errors.length),
      },
    });
  } catch (err) {
    console.error('[descargar-todos] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
