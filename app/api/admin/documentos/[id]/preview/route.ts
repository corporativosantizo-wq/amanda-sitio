// ============================================================================
// GET /api/admin/documentos/[id]/preview
// Proxy endpoint: streams the file from Supabase Storage through our domain
// so PDFs/images render in iframes without CSP/CORS blocks.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDocumento, generarSignedUrl, DocumentoError } from '@/lib/services/documentos.service';

type RouteParams = { params: Promise<{ id: string }> };

const MIME_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
};

function getExtension(filename: string): string {
  return (filename?.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const doc = await obtenerDocumento(id);

    if (!doc.archivo_url) {
      return NextResponse.json({ error: 'Documento sin archivo' }, { status: 404 });
    }

    // Generate a signed URL (10 min)
    const signedUrl = await generarSignedUrl(doc.archivo_url, 600);

    // Fetch the file from Supabase Storage
    const upstream = await fetch(signedUrl);
    if (!upstream.ok) {
      console.error(`[Preview] Upstream fetch failed: ${upstream.status} for doc ${id}`);
      return NextResponse.json({ error: 'Error al obtener archivo' }, { status: 502 });
    }

    const ext = getExtension(doc.nombre_archivo ?? '');
    const contentType = MIME_TYPES[ext] ?? upstream.headers.get('content-type') ?? 'application/octet-stream';

    // Stream the response body through without buffering in memory
    const body = upstream.body;
    if (!body) {
      return NextResponse.json({ error: 'Respuesta vacía del storage' }, { status: 502 });
    }

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
    const msg = err instanceof DocumentoError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    console.error(`[Preview] Error:`, err?.message ?? err);
    return NextResponse.json({ error: msg }, { status });
  }
}
