// ============================================================================
// GET /api/admin/expedientes/[id]/actuaciones/[actuacionId]/preview
// Proxy: streams the actuación's documento file from Supabase Storage.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerActuacion, ExpedienteError } from '@/lib/services/expedientes.service';
import { generarSignedUrl } from '@/lib/services/documentos.service';
import { requireAdmin } from '@/lib/auth/api-auth';

type Ctx = { params: Promise<{ id: string; actuacionId: string }> };

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

function getExtension(filename: string): string {
  return (filename?.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { actuacionId } = await ctx.params;
    const actuacion = await obtenerActuacion(actuacionId);

    if (!actuacion.documento_url) {
      return NextResponse.json({ error: 'Actuación sin documento adjunto' }, { status: 404 });
    }

    const signedUrl = await generarSignedUrl(actuacion.documento_url, 600);
    const upstream = await fetch(signedUrl);

    if (!upstream.ok) {
      console.error(`[ActuacionPreview] Upstream fetch failed: ${upstream.status} para actuación ${actuacionId}`);
      return NextResponse.json({ error: 'Error al obtener archivo' }, { status: 502 });
    }

    const ext = getExtension(actuacion.documento_url);
    const contentType = MIME_TYPES[ext] ?? upstream.headers.get('content-type') ?? 'application/octet-stream';

    const body = upstream.body;
    if (!body) return NextResponse.json({ error: 'Respuesta vacía del storage' }, { status: 502 });

    return new NextResponse(body as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err: any) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error interno';
    const status = msg.includes('no encontrada') ? 404 : 500;
    console.error('[ActuacionPreview] Error:', err?.message ?? err);
    return NextResponse.json({ error: msg }, { status });
  }
}
