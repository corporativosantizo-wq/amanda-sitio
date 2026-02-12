// ============================================================================
// POST /api/admin/jurisprudencia/upload-url
// Genera una URL firmada para subir PDFs al bucket jurisprudencia
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024; // 1GB

export async function POST(req: NextRequest) {
  try {
    const { filename, filesize, carpeta_path } = await req.json();

    if (!filename || !filesize) {
      return NextResponse.json(
        { error: 'Se requiere filename y filesize.' },
        { status: 400 }
      );
    }

    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
    if (ext !== '.pdf') {
      return NextResponse.json(
        { error: 'Solo se permiten archivos PDF.' },
        { status: 400 }
      );
    }

    if (filesize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande. Máximo 1GB.' },
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

    // carpeta_path arrives already slugified from the client (e.g. "jurisprudencia/derecho-civil")
    const folder = carpeta_path || 'sin-clasificar';
    const storagePath = `${folder}/${Date.now()}_${sanitizarNombre(filename)}`;

    const { data, error } = await storage.storage
      .from('jurisprudencia')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[Jurisprudencia UploadURL] Error creating signed URL:', error);
      return NextResponse.json(
        { error: `Error al generar URL de subida: ${error?.message ?? 'desconocido'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      storage_path: storagePath,
    });
  } catch (err: any) {
    console.error('[Jurisprudencia UploadURL] Error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 }
    );
  }
}
