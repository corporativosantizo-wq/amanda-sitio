// ============================================================================
// POST /api/pagos/webhook
// Stripe webhook: confirma cita cuando el pago es exitoso
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { actualizarCita } from '@/lib/services/citas.service';

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

    if (citaId) {
      try {
        await actualizarCita(citaId, { estado: 'confirmada' });
        console.log(`[Stripe] Cita ${citaId} confirmada por pago`);
      } catch (err) {
        console.error(`[Stripe] Error al confirmar cita ${citaId}:`, err);
      }
    }
  }

  return NextResponse.json({ received: true });
}
