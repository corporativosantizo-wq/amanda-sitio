// ============================================================================
// POST /api/pagos/checkout
// Crea una Stripe Checkout Session para pago de cita (Q500 consulta nueva)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { obtenerCita, CitaError } from '@/lib/services/citas.service';

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: 'Stripe no está configurado. Configura STRIPE_SECRET_KEY en las variables de entorno.' },
      { status: 503 }
    );
  }

  try {
    const { cita_id } = await req.json();
    if (!cita_id) {
      return NextResponse.json({ error: 'cita_id es requerido' }, { status: 400 });
    }

    const cita = await obtenerCita(cita_id);
    if (cita.costo <= 0) {
      return NextResponse.json({ error: 'Esta cita no tiene costo' }, { status: 400 });
    }

    const stripe = new Stripe(stripeKey);
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      currency: 'gtq',
      line_items: [
        {
          price_data: {
            currency: 'gtq',
            product_data: {
              name: `Cita — ${cita.titulo}`,
              description: `${cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento'} | ${cita.fecha}`,
            },
            unit_amount: Math.round(cita.costo * 100), // Stripe uses cents
          },
          quantity: 1,
        },
      ],
      metadata: { cita_id: cita.id },
      success_url: `${baseUrl}/portal?pago=exitoso`,
      cancel_url: `${baseUrl}/portal?pago=cancelado`,
    });

    return NextResponse.json({ url: session.url, session_id: session.id });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al crear sesión de pago';
    console.error('[Stripe Checkout]', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
