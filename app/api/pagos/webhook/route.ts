// ============================================================================
// POST /api/pagos/webhook
// Stripe webhook: maneja pagos de citas y productos de la tienda
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { actualizarCita } from '@/lib/services/citas.service';
import { createClient } from '@supabase/supabase-js';

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
    if (citaId) {
      try {
        await actualizarCita(citaId, { estado: 'confirmada' });
        console.log('[Stripe] Cita', citaId, 'confirmada por pago');
      } catch (err) {
        console.error('[Stripe] Error al confirmar cita', citaId + ':', err);
      }
    }

    // ── Compra de producto ────────────────────────────────────────────
    if (productId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        await supabase.from('orders').insert({
          product_id: productId,
          stripe_session_id: session.id,
          stripe_payment_intent: typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
          customer_email: session.customer_details?.email ?? null,
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency ?? 'gtq',
          status: 'completed',
          product_type: session.metadata?.product_type ?? 'digital',
        });

        console.log('[Stripe] Orden creada para producto', productId);
      } catch (err) {
        console.error('[Stripe] Error al registrar orden de producto', productId + ':', err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
