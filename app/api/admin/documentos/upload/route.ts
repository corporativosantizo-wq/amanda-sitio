// ============================================================================
// POST /api/admin/documentos/upload
// Subida masiva de PDFs a Supabase Storage
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { crearDocumento, sanitizarNombre, DocumentoError } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_FILES = 20;

export async function POST(req: NextRequest) {
  try {
    console.log('[Upload] Iniciando subida de archivos...');

    // Verificar env vars
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Upload] FALTAN variables de entorno: NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta. Faltan variables de entorno de Supabase.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const archivos = formData.getAll('archivos') as File[];

    console.log(`[Upload] Archivos recibidos: ${archivos.length}`);

    if (!archivos || archivos.length === 0) {
      return NextResponse.json(
        { error: 'No se recibieron archivos.' },
        { status: 400 }
      );
    }

    if (archivos.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Máximo ${MAX_FILES} archivos por carga.` },
        { status: 400 }
      );
    }

    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verificar que el bucket existe
    const { data: buckets, error: bucketsErr } = await storage.storage.listBuckets();
    if (bucketsErr) {
      console.error('[Upload] Error listando buckets:', bucketsErr);
      return NextResponse.json(
        { error: `Error de Storage: no se pudo listar buckets — ${bucketsErr.message}` },
        { status: 500 }
      );
    }

    const bucketExists = (buckets ?? []).some((b: any) => b.name === 'documentos');
    if (!bucketExists) {
      console.error('[Upload] Bucket "documentos" NO existe. Buckets disponibles:', (buckets ?? []).map((b: any) => b.name));
      return NextResponse.json(
        { error: 'El bucket "documentos" no existe en Supabase Storage. Créelo manualmente en el dashboard.' },
        { status: 500 }
      );
    }

    console.log('[Upload] Bucket "documentos" verificado OK');

    const documentos: any[] = [];
    const errores: string[] = [];

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      console.log(`[Upload] [${i + 1}/${archivos.length}] Procesando: ${archivo.name} (${(archivo.size / 1024).toFixed(0)} KB, type: ${archivo.type})`);

      // Validar tipo
      if (archivo.type !== 'application/pdf') {
        const msg = `${archivo.name}: No es un PDF (tipo: ${archivo.type}).`;
        console.warn(`[Upload] ${msg}`);
        errores.push(msg);
        continue;
      }

      // Validar tamaño
      if (archivo.size > MAX_FILE_SIZE) {
        const msg = `${archivo.name}: Excede 20MB (${(archivo.size / 1024 / 1024).toFixed(1)}MB).`;
        console.warn(`[Upload] ${msg}`);
        errores.push(msg);
        continue;
      }

      try {
        // Paso A: Leer archivo a buffer
        console.log(`[Upload] [${i + 1}] Leyendo archivo a buffer...`);
        const buffer = Buffer.from(await archivo.arrayBuffer());
        const storagePath = `pendientes/${Date.now()}_${sanitizarNombre(archivo.name)}`;
        console.log(`[Upload] [${i + 1}] Storage path: ${storagePath}`);

        // Paso B: Subir a Storage
        console.log(`[Upload] [${i + 1}] Subiendo a Storage...`);
        const { error: uploadError } = await storage.storage
          .from('documentos')
          .upload(storagePath, buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          const msg = `${archivo.name}: Error al subir a Storage — ${uploadError.message}`;
          console.error(`[Upload] [${i + 1}] ${msg}`, uploadError);
          errores.push(msg);
          continue;
        }

        console.log(`[Upload] [${i + 1}] Subido a Storage OK`);

        // Paso C: Crear registro en BD
        console.log(`[Upload] [${i + 1}] Creando registro en BD...`);
        const doc = await crearDocumento({
          storage_path: storagePath,
          nombre_archivo: archivo.name,
          tamano_bytes: archivo.size,
        });

        console.log(`[Upload] [${i + 1}] Registro creado OK: id=${doc.id}`);
        documentos.push(doc);
      } catch (err: any) {
        const detail = err instanceof DocumentoError
          ? `${err.message} — ${JSON.stringify(err.details)}`
          : (err.message ?? 'Error desconocido');
        const msg = `${archivo.name}: ${detail}`;
        console.error(`[Upload] [${i + 1}] ERROR:`, msg, err);
        errores.push(msg);
      }
    }

    console.log(`[Upload] Resultado: ${documentos.length} subidos, ${errores.length} errores`);
    return NextResponse.json({ documentos, errores });
  } catch (error: any) {
    console.error('[Upload] Error general:', error);
    return NextResponse.json(
      { error: `Error al subir archivos: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
