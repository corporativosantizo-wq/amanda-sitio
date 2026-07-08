// ============================================================================
// GET /pagar/cita?token=...
// Landing de pago con tarjeta de la consulta internacional (Fase A pagos).
//
// El correo de confirmación EN lleva un link ESTABLE a esta ruta (los links
// directos de Stripe Checkout expiran en 24 h). Al clic: se revalida TODO en
// servidor (capa 3 del blindaje) y recién entonces se crea la sesión de
// Stripe con el monto desde la base (USD) y se redirige.
//
// Blindaje anti-cliente-local (3 capas):
//   1. El botón solo existe en el bloque de pago EN (las plantillas ES solo
//      muestran transferencia a Banco Industrial).
//   2. token_pago solo se genera en crearCita para cliente idioma='en' y
//      moneda='USD' (consulta_nueva con costo).
//   3. Esta ruta revalida idioma/moneda/tipo/costo/estado/no-pagada — si algo
//      no cumple, rechaza sin tocar Stripe.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';

// Página mínima de marca para errores/estados (en inglés: la audiencia de
// este link son clientes internacionales).
function paginaHtml(titulo: string, mensaje: string, status: number): NextResponse {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo} — Amanda Santizo Law Firm</title></head>
<body style="margin:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:520px;margin:64px auto;background:#fff;border-radius:12px;border-top:4px solid ${NAVY};box-shadow:0 4px 6px rgba(0,0,0,0.07);padding:40px 32px;text-align:center;">
    <h1 style="margin:0 0 8px;color:#0f172a;font-size:22px;">${titulo}</h1>
    <div style="height:3px;width:64px;background:${GOLD};margin:12px auto 20px;border-radius:2px;"></div>
    <p style="color:#475569;font-size:15px;line-height:1.6;">${mensaje}</p>
    <p style="color:#94a3b8;font-size:13px;margin-top:24px;">Amanda Santizo — Law Firm · <a href="https://amandasantizo.com" style="color:${NAVY};">amandasantizo.com</a></p>
  </div>
</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store' },
  });
}

const CONTACT_NOTE = 'If you believe this is an error, please contact us at <strong>contador@papeleo.legal</strong>.';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? '';
  if (!token || token.length > 100) {
    return paginaHtml('Payment link not found', `This payment link is invalid. ${CONTACT_NOTE}`, 404);
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return paginaHtml('Payments unavailable', `Online payment is temporarily unavailable. ${CONTACT_NOTE}`, 503);
  }

  try {
    const db = createAdminClient();
    const { data: cita, error } = await db
      .from('citas')
      .select('id, tipo, titulo, fecha, hora_inicio, costo, estado, pago_recibido_at, cliente:clientes(id, nombre, email, idioma, moneda)')
      .eq('token_pago', token)
      .maybeSingle();

    if (error) throw error;
    if (!cita) {
      return paginaHtml('Payment link not found', `This payment link is invalid or no longer exists. ${CONTACT_NOTE}`, 404);
    }

    if (cita.pago_recibido_at) {
      return paginaHtml('Already paid — thank you!', 'This consultation has already been paid. No further payment is needed. We look forward to meeting you.', 200);
    }

    if (cita.estado === 'cancelada') {
      return paginaHtml('Appointment cancelled', `This appointment was cancelled, so no payment is due. ${CONTACT_NOTE}`, 410);
    }

    const cliente = cita.cliente as any;
    // Capa 3: solo consulta internacional de cliente EN/USD llega a Stripe.
    const elegible =
      cita.tipo === 'consulta_nueva' &&
      Number(cita.costo) > 0 &&
      cliente?.idioma === 'en' &&
      cliente?.moneda === 'USD';

    if (!elegible) {
      console.warn('[pagar/cita] Rechazado por blindaje:', {
        cita: cita.id, tipo: cita.tipo, costo: cita.costo,
        idioma: cliente?.idioma, moneda: cliente?.moneda,
      });
      return paginaHtml('Card payment not available', `Online card payment is not enabled for this appointment. Please use the bank transfer details from your confirmation email. ${CONTACT_NOTE}`, 403);
    }

    const stripe = new Stripe(stripeKey);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      currency: 'usd',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Legal Consultation — ${cita.fecha}`,
              description: `International consultation | ${cita.fecha} ${String(cita.hora_inicio).substring(0, 5)} (Guatemala time) | Amanda Santizo Law Firm`,
            },
            // Monto SIEMPRE desde la base (USD $150 para consulta internacional).
            unit_amount: Math.round(Number(cita.costo) * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: cliente?.email ?? undefined,
      metadata: { cita_id: cita.id },
      success_url: 'https://amandasantizo.com/pagar/gracias',
      cancel_url: 'https://amandasantizo.com/pagar/cancelado',
    });

    if (!session.url) throw new Error('Stripe no devolvió URL de sesión');

    console.log('[pagar/cita] Sesión creada para cita', cita.id, '—', `$${cita.costo} USD`);
    return NextResponse.redirect(session.url, 303);
  } catch (err: any) {
    console.error('[pagar/cita] Error:', err?.message ?? err);
    return paginaHtml('Something went wrong', `We could not start the payment process. Please try again in a few minutes. ${CONTACT_NOTE}`, 500);
  }
}
