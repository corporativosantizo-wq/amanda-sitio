// ============================================================================
// POST /api/pagos/webhook
// Stripe webhook: maneja pagos de citas y productos de la tienda
//
// Fase 0 pagos (jul-2026): la tienda cobraba "a ciegas" — STRIPE_WEBHOOK_SECRET
// no estaba en Vercel y, aunque hubiera estado, el insert de la orden apuntaba
// al schema legal (la tabla orders vive en PUBLIC) y su error se ignoraba.
// Ahora: cliente al schema correcto, error verificado con 500 → Stripe
// REINTENTA el evento (hasta ~3 días), idempotencia por stripe_session_id
// (UNIQUE), y aviso por Telegram al registrar la orden (o si falla).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { actualizarCita } from '@/lib/services/citas.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';

// La tabla orders (y products) están en PUBLIC — no usar createAdminClient,
// que está fijado al schema legal (bug original de este webhook).
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'Falta stripe-signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Firma inválida:', err.message);
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const citaId = session.metadata?.cita_id;
    const productId = session.metadata?.product_id;

    // ── Pago de cita ──────────────────────────────────────────────────
    // (Se rediseña en Fase A — consulta internacional. Sin cambios aquí.)
    if (citaId) {
      try {
        await actualizarCita(citaId, { estado: 'confirmada' });
        console.log('[Stripe] Cita', citaId, 'confirmada por pago');
      } catch (err) {
        console.error('[Stripe] Error al confirmar cita', citaId + ':', err);
      }
    }

    // ── Compra de producto (tienda) ───────────────────────────────────
    if (productId) {
      const montoFmt = `$${((session.amount_total ?? 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${(session.currency ?? 'usd').toUpperCase()}`;
      const emailCliente = session.customer_details?.email ?? 'sin email';

      try {
        const supabase = publicClient();

        // Idempotencia: Stripe reintenta eventos (y este endpoint devuelve 500
        // si el registro falla, para provocar justo ese reintento). La sesión
        // ya registrada no se duplica: stripe_session_id es UNIQUE.
        const { data: existente, error: checkErr } = await supabase
          .from('orders')
          .select('id')
          .eq('stripe_session_id', session.id)
          .maybeSingle();

        if (checkErr) throw new Error(`consultando orden existente: ${checkErr.message}`);

        if (existente) {
          console.log('[Stripe] Orden ya registrada para sesión', session.id, '— evento duplicado, OK');
        } else {
          const { data: orden, error: insertErr } = await supabase
            .from('orders')
            .insert({
              product_id: productId,
              stripe_session_id: session.id,
              stripe_payment_intent: typeof session.payment_intent === 'string'
                ? session.payment_intent
                : session.payment_intent?.id ?? null,
              customer_email: session.customer_details?.email ?? null,
              amount: (session.amount_total ?? 0) / 100,
              currency: session.currency ?? 'usd',
              status: 'completed',
              product_type: session.metadata?.product_type ?? 'digital',
            })
            .select('id')
            .single();

          // Antes este error se ignoraba: el cliente pagaba y la orden no
          // quedaba en ningún lado. Ahora lanza → 500 → Stripe reintenta.
          if (insertErr || !orden) {
            throw new Error(`insertando orden: ${insertErr?.message ?? 'insert devolvió vacío'}`);
          }

          console.log('[Stripe] Orden', orden.id, 'creada para producto', productId, '—', montoFmt);

          // Aviso a Amanda — best-effort: la orden YA está registrada; si
          // Telegram falla no devolvemos 500 (Stripe reintentaría y el
          // duplicado se detectaría, pero el aviso igual no saldría).
          try {
            const { data: producto } = await supabase
              .from('products')
              .select('name')
              .eq('id', productId)
              .maybeSingle();
            const nombreProducto = producto?.name ?? session.metadata?.product_slug ?? productId;

            await sendTelegramMessage(
              `🛒 <b>Nueva orden en la tienda</b>\n\n` +
              `<b>Producto:</b> ${escapeHtml(nombreProducto)}\n` +
              `<b>Monto:</b> ${montoFmt}\n` +
              `<b>Cliente:</b> ${escapeHtml(emailCliente)}\n` +
              `<b>Tipo:</b> ${session.metadata?.product_type ?? 'digital'}`,
              { parse_mode: 'HTML' },
            );
          } catch (tgErr: any) {
            console.error('[Stripe] Orden registrada pero falló el aviso Telegram:', tgErr?.message);
          }
        }
      } catch (err: any) {
        console.error('[Stripe] ERROR registrando orden de producto', productId + ':', err?.message ?? err);

        // Alerta best-effort: hay DINERO cobrado sin orden registrada.
        try {
          await sendTelegramMessage(
            `🚨 <b>Pago de tienda SIN registrar</b>\n\n` +
            `Stripe cobró ${montoFmt} (${escapeHtml(emailCliente)}) pero la orden no se pudo guardar: ${escapeHtml(err?.message ?? 'error desconocido')}.\n` +
            `Stripe va a reintentar el evento automáticamente. Sesión: <code>${escapeHtml(session.id)}</code>`,
            { parse_mode: 'HTML' },
          );
        } catch { /* el 500 de abajo ya provoca el reintento */ }

        // 500 → Stripe reintenta la entrega del evento (backoff, hasta ~3 días).
        return NextResponse.json({ error: 'Error registrando la orden' }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
