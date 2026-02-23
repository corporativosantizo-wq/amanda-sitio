// ============================================================================
// POST /api/admin/documentos/upload-url
// Genera una URL firmada para subir archivos directo a Supabase Storage
// Soporta: PDF, DOCX, DOC, XLSX, XLS, JPG, JPEG, PNG
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 150 * 1024 * 1024; // 150MB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];

export async function POST(req: NextRequest) {
  try {
    const { filename, filesize } = await req.json();

    if (!filename || !filesize) {
      return NextResponse.json(
        { error: 'Se requiere filename y filesize.' },
        { status: 400 }
      );
    }

    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Formato no permitido. Formatos aceptados: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      );
    }

    if (filesize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 150MB.' },
        { status: 400 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta.' },
        { status: 500 }
      );
    }

    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const storagePath = `pendientes/${Date.now()}_${sanitizarNombre(filename)}`;

    const { data, error } = await storage.storage
      .from('documentos')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[UploadURL] Error creating signed URL:', error);
      return NextResponse.json(
        { error: 'Error al generar URL de subida' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      storage_path: storagePath,
    });
  } catch (err: any) {
    console.error('[UploadURL] Error:', err);
    return NextResponse.json(
      { error: 'Error interno' },
      { status: 500 }
    );
  }
}
