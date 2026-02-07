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
    const formData = await req.formData();
    const archivos = formData.getAll('archivos') as File[];

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

    const documentos: any[] = [];
    const errores: string[] = [];

    for (const archivo of archivos) {
      // Validar tipo
      if (archivo.type !== 'application/pdf') {
        errores.push(`${archivo.name}: No es un PDF.`);
        continue;
      }

      // Validar tamaño
      if (archivo.size > MAX_FILE_SIZE) {
        errores.push(
          `${archivo.name}: Excede 20MB (${(archivo.size / 1024 / 1024).toFixed(1)}MB).`
        );
        continue;
      }

      try {
        const buffer = Buffer.from(await archivo.arrayBuffer());
        const storagePath = `pendientes/${Date.now()}_${sanitizarNombre(archivo.name)}`;

        const { error: uploadError } = await storage.storage
          .from('documentos')
          .upload(storagePath, buffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          errores.push(`${archivo.name}: Error al subir — ${uploadError.message}`);
          continue;
        }

        // Crear registro en BD
        const doc = await crearDocumento({
          storage_path: storagePath,
          nombre_archivo: archivo.name,
          tamano_bytes: archivo.size,
        });

        documentos.push(doc);
      } catch (err: any) {
        errores.push(`${archivo.name}: ${err.message ?? 'Error desconocido'}`);
      }
    }

    return NextResponse.json({ documentos, errores });
  } catch (error: any) {
    console.error('[Documentos Upload] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al subir archivos.' },
      { status: 500 }
    );
  }
}
