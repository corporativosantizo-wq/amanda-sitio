// ============================================================================
// POST /api/admin/adjuntos/descargar-zip
// Descarga el contenido real de todos los adjuntos del remitente y los empaqueta
// en un ZIP en memoria (no se persiste en el servidor). Devuelve el ZIP.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { descargarAdjuntosZip, AdjuntoError } from '@/lib/services/adjuntos.service';

export const maxDuration = 60;

function nombreArchivo(remitente: string): string {
  const slug = remitente.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
  const fecha = new Date().toISOString().substring(0, 10);
  return `adjuntos_${slug}_${fecha}.zip`;
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const remitente = String(body.remitente ?? '').trim().toLowerCase();
    const { buffer, totalAdjuntos, incluidos, fallidos } = await descargarAdjuntosZip({
      account: body.account,
      remitente,
      desde: body.desde ?? null,
      hasta: body.hasta ?? null,
      incluirInline: body.incluirInline === true,
    });

    if (incluidos === 0) {
      return NextResponse.json(
        { error: 'No se pudo incluir ningún adjunto en el ZIP.', totalAdjuntos, fallidos },
        { status: 404 },
      );
    }

    // Resumen en cabeceras para que el cliente reporte fallos sin romper la descarga.
    const resumen = encodeURIComponent(JSON.stringify({ totalAdjuntos, incluidos, fallidos }).substring(0, 4000));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${nombreArchivo(remitente)}"`,
        'Content-Length': String(buffer.length),
        'X-Adjuntos-Resumen': resumen,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err instanceof AdjuntoError) {
      const status = err.code === 'permiso' ? 403 : err.code === 'validacion' ? 400 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Error al generar el ZIP';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
