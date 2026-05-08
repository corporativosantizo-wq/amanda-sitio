// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/informar-avance/route.ts
// GET  → genera el borrador del email (asunto + cuerpo) con avances pendientes
// POST → envía el email vía Microsoft Graph y marca avances como notificados
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  generarBorradorInforme,
  informarAvanceAlCliente,
  TramiteError,
} from '@/lib/services/tramites.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const borrador = await generarBorradorInforme(id);
    return NextResponse.json(borrador);
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'cotizaciones/[id]/informar-avance GET');
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const to = typeof body.to === 'string' ? body.to.trim() : '';
    const ccRaw = typeof body.cc === 'string' ? body.cc : '';
    const asunto = typeof body.asunto === 'string' ? body.asunto.trim() : '';
    const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';

    if (!to)      return NextResponse.json({ error: 'El campo "Para" es obligatorio' }, { status: 400 });
    if (!EMAIL_RE.test(to)) return NextResponse.json({ error: `Email destinatario inválido: ${to}` }, { status: 400 });
    if (!asunto)  return NextResponse.json({ error: 'El asunto es obligatorio' }, { status: 400 });
    if (!mensaje) return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });

    const cc: string[] = ccRaw
      .split(/[,;\n]/)
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
    for (const e of cc) {
      if (!EMAIL_RE.test(e)) {
        return NextResponse.json({ error: `Email CC inválido: ${e}` }, { status: 400 });
      }
    }
    const ccUnico: string[] = Array.from(new Set<string>(cc));

    const result = await informarAvanceAlCliente({
      cotizacionId: id,
      to,
      cc: ccUnico,
      asunto,
      mensaje,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'cotizaciones/[id]/informar-avance POST');
  }
}
