// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/reenviar/route.ts
// POST → Envía el recibo por email con campos editables (Para, CC, Asunto, Mensaje).
// El PDF se descarga de storage y se adjunta automáticamente.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarEmailReciboPersonalizado, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    if (!to) {
      return NextResponse.json({ error: 'El campo "Para" es obligatorio' }, { status: 400 });
    }
    if (!EMAIL_RE.test(to)) {
      return NextResponse.json({ error: `Email destinatario inválido: ${to}` }, { status: 400 });
    }
    if (!asunto) {
      return NextResponse.json({ error: 'El asunto es obligatorio' }, { status: 400 });
    }
    if (!mensaje) {
      return NextResponse.json({ error: 'El mensaje es obligatorio' }, { status: 400 });
    }

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

    await enviarEmailReciboPersonalizado(id, { to, cc: ccUnico, asunto, mensaje });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja/[id]/reenviar');
  }
}
