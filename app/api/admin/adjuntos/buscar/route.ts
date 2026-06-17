// ============================================================================
// POST /api/admin/adjuntos/buscar
// Busca correos con adjuntos de un remitente en una cuenta del despacho.
// Devuelve solo metadatos (no descarga el contenido).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { buscarCorreosConAdjuntos, AdjuntoError } from '@/lib/services/adjuntos.service';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const data = await buscarCorreosConAdjuntos({
      account: body.account,
      remitente: body.remitente,
      desde: body.desde ?? null,
      hasta: body.hasta ?? null,
      incluirInline: body.incluirInline === true,
    });
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof AdjuntoError) {
      const status = err.code === 'permiso' ? 403 : err.code === 'validacion' ? 400 : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    const msg = err instanceof Error ? err.message : 'Error al buscar correos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
