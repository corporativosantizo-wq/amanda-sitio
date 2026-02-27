// ============================================================================
// POST /api/admin/documentos/upload-url
// Genera una URL firmada para subir archivos directo a Supabase Storage.
// Bypasea Kong — el browser hace PUT directo al signed URL.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/api-auth';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { filename, filesize } = await req.json();

    if (!filename || !filesize) {
      return NextResponse.json(
        { error: 'Se requiere filename y filesize.' },
        { status: 400 },
      );
    }

    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Formato no permitido. Formatos aceptados: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 },
      );
    }

    if (filesize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 1GB.' },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configuración del servidor incompleta.' },
        { status: 500 },
      );
    }

    const storage = createClient(supabaseUrl, supabaseKey);
    const storagePath = `pendientes/${Date.now()}_${sanitizarNombre(filename)}`;

    const { data, error } = await storage.storage
      .from('documentos')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[UploadURL] createSignedUploadUrl error:', error?.message, error);
      return NextResponse.json(
        { error: `Error al generar URL de subida: ${error?.message ?? 'desconocido'}` },
        { status: 500 },
      );
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      storage_path: storagePath,
    });
  } catch (err: any) {
    console.error('[UploadURL] Unhandled error:', err.message, err);
    return NextResponse.json(
      { error: `Error interno: ${err.message ?? 'desconocido'}` },
      { status: 500 },
    );
  }
}
