// ============================================================================
// POST /api/pagos/checkout
// Crea una Stripe Checkout Session para pago de cita (cobra cita.costo).
//
// ⚠️ SOLO ADMIN por ahora: ningún flujo de cliente usa este endpoint todavía
// (los botones de pago en correos EN están deshabilitados). Estaba desplegado
// sin auth. Cuando la Fase 5 habilite el pago online para clientes, habrá que
// diseñar su auth propia (p. ej. token firmado como cotizacion/respuesta).
//
// ⚠️ BUG-003 PENDIENTE (no tocar sin decisión de Amanda): cobra currency 'usd'
// sobre cita.costo, que para clientes locales está en quetzales → una cita de
// Q500 se cobraría como $500 USD. La moneda se corrige en un paso aparte.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { obtenerCita, CitaError } from '@/lib/services/citas.service';
import { requireAdmin } from '@/lib/auth/api-auth';

export async function POST(req: NextRequest) {
  // Defensa en profundidad: el middleware (proxy.ts) ya exige sesión Clerk,
  // aquí además se exige rol admin activo (usuarios_admin).
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      currency: 'usd',
      line_items: [
        {
          price_data: {
            currency: 'usd',
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
