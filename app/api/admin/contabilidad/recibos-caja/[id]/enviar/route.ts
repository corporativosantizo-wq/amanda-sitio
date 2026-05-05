// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/enviar/route.ts
// POST → Envía el email del recibo con CC, asunto y cuerpo personalizables.
// Body: { to: string; cc?: string[]; asunto?: string; cuerpo_html?: string }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarEmailRecibo, obtenerRecibo, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { isValidEmail, normalizarEmails } from '@/lib/services/comprobantes-email';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const to = String(body.to ?? '').trim();
    if (!to || !isValidEmail(to)) {
      return NextResponse.json({ error: 'Email destinatario (to) inválido' }, { status: 400 });
    }

    const cc = Array.isArray(body.cc) ? normalizarEmails(body.cc) : [];

    // Si el caller pasa cc explícito y trae elementos inválidos, los filtramos sin error
    // (normalizarEmails ya descarta inválidos). Si vino lista NO vacía pero quedó vacía,
    // significa que todos eran inválidos.
    if (Array.isArray(body.cc) && body.cc.length > 0 && cc.length === 0) {
      return NextResponse.json({ error: 'Todos los emails de CC son inválidos' }, { status: 400 });
    }

    // Validación opcional: el recibo existe (mejor error que el del servicio)
    await obtenerRecibo(id);

    await enviarEmailRecibo({
      reciboId: id,
      to,
      cc,
      asunto:     body.asunto      ? String(body.asunto)      : undefined,
      cuerpoHtml: body.cuerpo_html ? String(body.cuerpo_html) : undefined,
      enviadoPor: session.email || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return handleApiError(error, 'recibos-caja/[id]/enviar');
  }
}
