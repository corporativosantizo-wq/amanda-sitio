// ============================================================================
// app/api/cotizacion/respuesta/route.ts
// API pública para procesar respuestas de cotización (aceptar / dudas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/services/outlook.service';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { db: { schema: 'legal' } }
  );
}

// GET — Obtiene datos de la cotización para mostrar en la página
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }

  const db = adminClient();

  const { data: cotizacion, error } = await db
    .from('cotizaciones')
    .select(`
      id, numero, estado, total, subtotal, iva_monto, fecha_emision, fecha_vencimiento,
      respondida_at,
      items:cotizacion_items (descripcion, cantidad, precio_unitario, total, orden),
      cliente:clientes!cliente_id (nombre)
    `)
    .eq('token_respuesta', token)
    .order('orden', { referencedTable: 'cotizacion_items', ascending: true })
    .single();

  if (error || !cotizacion) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 });
  }

  // Solo devolver datos seguros (no datos sensibles del cliente)
  return NextResponse.json({
    numero: cotizacion.numero,
    estado: cotizacion.estado,
    total: cotizacion.total,
    subtotal: cotizacion.subtotal,
    iva_monto: cotizacion.iva_monto,
    fecha_emision: cotizacion.fecha_emision,
    fecha_vencimiento: cotizacion.fecha_vencimiento,
    respondida_at: cotizacion.respondida_at,
    clienteNombre: (cotizacion.cliente as any)?.nombre ?? '',
    items: (cotizacion.items ?? []).map((item: any) => ({
      descripcion: item.descripcion,
      total: item.total,
    })),
  });
}

// POST — Procesa la acción (aceptar o dudas)
export async function POST(req: NextRequest) {
  try {
    const { token, accion, mensaje } = await req.json();

    if (!token || !accion) {
      return NextResponse.json({ error: 'Token y acción requeridos' }, { status: 400 });
    }

    if (!['aceptar', 'dudas'].includes(accion)) {
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
    }

    const db = adminClient();

    // Buscar cotización por token
    const { data: cotizacion, error: fetchError } = await db
      .from('cotizaciones')
      .select(`
        id, numero, estado, total, respondida_at,
        cliente:clientes!cliente_id (nombre, email)
      `)
      .eq('token_respuesta', token)
      .single();

    if (fetchError || !cotizacion) {
      return NextResponse.json({ error: 'Token inválido o cotización no encontrada' }, { status: 404 });
    }

    const cliente = cotizacion.cliente as any;
    const clienteNombre = cliente?.nombre ?? 'Cliente';

    // Validar estado
    if (cotizacion.estado !== 'enviada') {
      // Si ya fue aceptada, no error — solo informar
      if (cotizacion.estado === 'aceptada' && accion === 'aceptar') {
        return NextResponse.json({ ok: true, mensaje: 'Esta cotización ya fue aceptada anteriormente.' });
      }
      return NextResponse.json(
        { error: `Esta cotización tiene estado "${cotizacion.estado}" y no puede ser procesada.` },
        { status: 400 }
      );
    }

    if (accion === 'aceptar') {
      // Actualizar estado a aceptada
      const { error: updateError } = await db
        .from('cotizaciones')
        .update({
          estado: 'aceptada',
          aceptada_at: new Date().toISOString(),
          respondida_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cotizacion.id);

      if (updateError) {
        return NextResponse.json({ error: 'Error al procesar la aceptación' }, { status: 500 });
      }

      // Notificar a Amanda
      try {
        const fmtQ = (n: number) => `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
        await sendMail({
          from: 'asistente@papeleo.legal',
          to: 'amanda@papeleo.legal',
          subject: `Cotización ${cotizacion.numero} ACEPTADA por ${clienteNombre}`,
          htmlBody: `
            <h2>Cotización Aceptada</h2>
            <p>El cliente <strong>${clienteNombre}</strong> ha aceptado la cotización <strong>${cotizacion.numero}</strong> por <strong>${fmtQ(cotizacion.total)}</strong>.</p>
            <p>Fecha: ${new Date().toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', dateStyle: 'full' })}</p>
          `,
        });
      } catch (e) {
        console.error('Error enviando notificación de aceptación:', e);
      }

      return NextResponse.json({ ok: true, mensaje: '¡Gracias! Hemos recibido su confirmación.' });
    }

    if (accion === 'dudas') {
      if (!mensaje?.trim()) {
        return NextResponse.json({ error: 'Por favor escriba su consulta' }, { status: 400 });
      }

      // Guardar notas de respuesta
      const { error: updateError } = await db
        .from('cotizaciones')
        .update({
          respuesta_notas: mensaje.trim(),
          respondida_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cotizacion.id);

      if (updateError) {
        return NextResponse.json({ error: 'Error al guardar su consulta' }, { status: 500 });
      }

      // Notificar a Amanda
      try {
        await sendMail({
          from: 'asistente@papeleo.legal',
          to: 'amanda@papeleo.legal',
          subject: `Dudas sobre cotización ${cotizacion.numero} — ${clienteNombre}`,
          htmlBody: `
            <h2>Consulta sobre Cotización</h2>
            <p>El cliente <strong>${clienteNombre}</strong> tiene dudas sobre la cotización <strong>${cotizacion.numero}</strong>.</p>
            <blockquote style="border-left:3px solid #2563EB;padding:12px 16px;background:#f8fafc;margin:16px 0;">
              ${mensaje.trim().replace(/\n/g, '<br/>')}
            </blockquote>
            <p>Responder a: <strong>${cliente?.email ?? 'sin email'}</strong></p>
          `,
        });
      } catch (e) {
        console.error('Error enviando notificación de dudas:', e);
      }

      return NextResponse.json({ ok: true, mensaje: '¡Gracias! Hemos recibido su consulta.' });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en /api/cotizacion/respuesta:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
