// ============================================================================
// POST /api/admin/documentos/upload
// Registra documentos ya subidos a Storage (recibe solo metadata, no archivos)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearDocumento, DocumentoError } from '@/lib/services/documentos.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const files: { storage_path: string; filename: string; filesize: number }[] = body.files;

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere un array de files con storage_path, filename y filesize.' },
        { status: 400 }
      );
    }

    if (files.length > 20) {
      return NextResponse.json(
        { error: 'Máximo 20 archivos por carga.' },
        { status: 400 }
      );
    }

    const documentos: any[] = [];
    const errores: string[] = [];

    for (const f of files) {
      if (!f.storage_path || !f.filename) {
        errores.push(`${f.filename ?? 'desconocido'}: faltan datos (storage_path o filename).`);
        continue;
      }

      try {
        const doc = await crearDocumento({
          archivo_url: f.storage_path,
          nombre_archivo: f.filename,
          archivo_tamano: f.filesize ?? 0,
        });
        documentos.push(doc);
      } catch (err: any) {
        const detail = err instanceof DocumentoError
          ? `${err.message} — ${JSON.stringify(err.details)}`
          : (err.message ?? 'Error desconocido');
        errores.push(`${f.filename}: ${detail}`);
      }
    }

    return NextResponse.json({ documentos, errores });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: `Error al registrar archivos: ${error.message ?? 'desconocido'}` },
      { status: 500 }
    );
  }
}
