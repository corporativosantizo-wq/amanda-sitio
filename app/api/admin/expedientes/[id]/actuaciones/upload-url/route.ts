// ============================================================================
// POST /api/admin/expedientes/[id]/actuaciones/upload-url
// Genera URL firmada para subir el documento adjunto de una actuación.
// Ruta: actuaciones/{expediente_id}/{timestamp}_{filename}
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/api-auth';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.jpg', '.jpeg', '.png'];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id: expedienteId } = await ctx.params;
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
    const storagePath = `actuaciones/${expedienteId}/${Date.now()}_${sanitizarNombre(filename)}`;

    const { data, error } = await storage.storage
      .from('documentos')
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error('[ActuacionUploadURL] createSignedUploadUrl error:', error?.message);
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
    console.error('[ActuacionUploadURL] Unhandled error:', err.message);
    return NextResponse.json(
      { error: `Error interno: ${err.message ?? 'desconocido'}` },
      { status: 500 },
    );
  }
}
