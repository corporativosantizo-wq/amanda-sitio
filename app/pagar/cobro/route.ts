// ============================================================================
// GET /pagar/cobro?token=...
// Landing de pago con tarjeta para COBROS de clientes internacionales
// (Fase B pagos — monto variable en USD).
//
// El correo EN (solicitud de pago / recordatorios) lleva un link ESTABLE a
// esta ruta. Al clic: se revalida TODO en servidor y se crea la sesión de
// Stripe por el SALDO PENDIENTE ACTUAL del cobro — el monto sale SIEMPRE de
// la base, nunca del correo ni del request.
//
// Blindaje anti-cliente-local (3 capas, espejo de /pagar/cita):
//   1. El botón solo existe en el bloque de pago EN.
//   2. token_pago solo se genera al enviar el correo si cliente idioma='en'
//      y moneda='USD', cobro en USD y saldo > 0 (asegurarTokenPagoCobro).
//   3. Esta ruta revalida cliente/moneda/estado/saldo — si algo no cumple,
//      rechaza sin tocar Stripe.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';

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
    const { data: cobro, error } = await db
      .from('cobros')
      .select('id, numero_cobro, concepto, monto, monto_pagado, saldo_pendiente, moneda, estado, cliente:clientes(id, nombre, email, idioma, moneda)')
      .eq('token_pago', token)
      .maybeSingle();

    if (error) throw error;
    if (!cobro) {
      return paginaHtml('Payment link not found', `This payment link is invalid or no longer exists. ${CONTACT_NOTE}`, 404);
    }

    const saldo = Number(cobro.saldo_pendiente ?? 0);

    if (cobro.estado === 'pagado' || saldo <= 0) {
      return paginaHtml('Already paid — thank you!', 'This invoice has already been paid in full. No further payment is needed.', 200);
    }

    if (cobro.estado === 'cancelado') {
      return paginaHtml('No payment due', `This invoice was cancelled, so no payment is due. ${CONTACT_NOTE}`, 410);
    }

    const cliente = cobro.cliente as any;
    // Capa 3: solo cobros USD de clientes EN/USD, en estado cobrable.
    const elegible =
      cliente?.idioma === 'en' &&
      cliente?.moneda === 'USD' &&
      cobro.moneda === 'USD' &&
      ['pendiente', 'parcial', 'vencido'].includes(cobro.estado);

    if (!elegible) {
      console.warn('[pagar/cobro] Rechazado por blindaje:', {
        cobro: cobro.id, estado: cobro.estado, moneda: cobro.moneda,
        idioma: cliente?.idioma, monedaCliente: cliente?.moneda,
      });
      return paginaHtml('Card payment not available', `Online card payment is not enabled for this invoice. Please use the bank transfer details from your email. ${CONTACT_NOTE}`, 403);
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
              name: `Legal services — Invoice #${cobro.numero_cobro}`,
              description: `${String(cobro.concepto).substring(0, 200)} | Amanda Santizo Law Firm`,
            },
            // Monto SIEMPRE el saldo pendiente actual, desde la base.
            unit_amount: Math.round(saldo * 100),
          },
          quantity: 1,
        },
      ],
      customer_email: cliente?.email ?? undefined,
      metadata: { cobro_id: cobro.id },
      success_url: 'https://amandasantizo.com/pagar/gracias',
      cancel_url: 'https://amandasantizo.com/pagar/cancelado',
    });

    if (!session.url) throw new Error('Stripe no devolvió URL de sesión');

    console.log('[pagar/cobro] Sesión creada para cobro', cobro.id, `(#${cobro.numero_cobro})`, '—', `$${saldo} USD`);
    return NextResponse.redirect(session.url, 303);
  } catch (err: any) {
    console.error('[pagar/cobro] Error:', err?.message ?? err);
    return paginaHtml('Something went wrong', `We could not start the payment process. Please try again in a few minutes. ${CONTACT_NOTE}`, 500);
  }
}
