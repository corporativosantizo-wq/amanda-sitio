// ============================================================================
// POST /api/admin/comunicaciones/adjuntos/upload-url
// Genera una URL firmada para subir un adjunto de correo directo a Supabase
// Storage (bucket adjuntos-correo). El browser hace PUT directo al signed URL,
// así el archivo nunca pasa por la función de Vercel (límite de 4.5 MB de body
// que devolvía 413 antes de llegar al código). Mismo patrón que
// /api/admin/documentos/upload-url.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ADJUNTOS_BUCKET, safeStorageName, validarAdjunto } from '@/lib/adjuntos-correo';
import { handleApiError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { filename, filesize, contentType } = await req.json();

    if (!filename || typeof filesize !== 'number') {
      return NextResponse.json(
        { error: 'Se requiere filename y filesize.' },
        { status: 400 }
      );
    }

    const invalido = validarAdjunto({ name: filename, size: filesize, type: contentType ?? '' });
    if (invalido) {
      return NextResponse.json({ error: invalido }, { status: 400 });
    }

    const path = `correos/${randomUUID()}/${safeStorageName(filename)}`;

    const { data, error } = await createAdminClient()
      .storage.from(ADJUNTOS_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('[adjuntos/upload-url] createSignedUploadUrl error:', error?.message);
      return NextResponse.json(
        { error: `Error al generar URL de subida: ${error?.message ?? 'desconocido'}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      token: data.token,
      path,
    });
  } catch (err) {
    return handleApiError(err, 'comunicaciones/adjuntos/upload-url');
  }
}
