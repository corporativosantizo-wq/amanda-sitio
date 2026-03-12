// ============================================================================
// lib/services/factura-re.service.ts
// Solicitud de factura a RE Contadores — con flujo de aprobación
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/services/outlook.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';

const db = () => createAdminClient();

// Destinatarios RE Contadores
const RE_DESTINATARIOS = [
  'contabilidad@re.com.gt',
  'veronica.zoriano@re.com.gt',
  'joaquin.sandoval@re.com.gt',
];

export interface SolicitudFacturaParams {
  pago_id: string;
  cliente_nombre: string;
  cliente_nit: string | null;
  concepto: string;
  monto: number;
  fecha_pago: string;
  referencia_bancaria: string | null;
  detalle_servicios?: string[];
}

// ── Notificación (se llama automáticamente al confirmar pago) ───────────────

/**
 * Notifica a Amanda por Telegram que se registró un pago.
 *
 * Regla de factura:
 * - Si es anticipo y NO cubre el total → solo notificar anticipo, NO solicitar factura
 * - Si el monto total pagado >= total de la cotización → solicitar factura
 * - Amanda puede solicitar factura manualmente en cualquier momento
 */
export async function notificarPagoParaFactura(pagoId: string): Promise<void> {
  try {
    // Fetch pago con datos extra para decidir si solicitar factura
    const { data: pago, error } = await db()
      .from('pagos')
      .select(`
        id, monto, fecha_pago, referencia_bancaria, notas, cobro_id,
        es_anticipo, cotizacion_id,
        cliente:clientes!cliente_id (id, nombre, nit)
      `)
      .eq('id', pagoId)
      .single();

    if (error || !pago) return;

    const cliente = pago.cliente as any;
    if (!cliente) return;

    const montoFmt = `Q${pago.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

    // Check if total is covered (sum all confirmed + this new pago for the cotización)
    let totalCubierto = false;
    let saldoPendiente = 0;
    let totalCotizacion = 0;

    if (pago.cotizacion_id) {
      const { data: cot } = await db()
        .from('cotizaciones')
        .select('total')
        .eq('id', pago.cotizacion_id)
        .single();

      if (cot) {
        totalCotizacion = cot.total;
        // Sum all confirmed payments for this cotización
        const { data: pagos } = await db()
          .from('pagos')
          .select('monto')
          .eq('cotizacion_id', pago.cotizacion_id)
          .eq('estado', 'confirmado');

        const totalPagado = (pagos ?? []).reduce((s: number, p: any) => s + p.monto, 0);
        saldoPendiente = Math.max(0, totalCotizacion - totalPagado);
        totalCubierto = totalPagado >= totalCotizacion;
      }
    } else if (pago.cobro_id) {
      const { data: cobro } = await db()
        .from('cobros')
        .select('monto, monto_pagado, saldo_pendiente')
        .eq('id', pago.cobro_id)
        .single();

      if (cobro) {
        totalCotizacion = cobro.monto;
        saldoPendiente = cobro.saldo_pendiente;
        totalCubierto = cobro.saldo_pendiente <= 0;
      }
    }

    // Determine concepto
    let concepto = pago.notas || 'Servicios legales';
    if (pago.cobro_id) {
      const { data: cobro } = await db()
        .from('cobros')
        .select('concepto')
        .eq('id', pago.cobro_id)
        .single();
      if (cobro?.concepto) concepto = cobro.concepto;
    }

    const saldoFmt = `Q${saldoPendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

    if (pago.es_anticipo && !totalCubierto) {
      // Anticipo that doesn't cover total → do NOT suggest invoice
      await sendTelegramMessage(
        `💰 <b>Anticipo registrado</b>\n\n` +
        `<b>Cliente:</b> ${cliente.nombre}\n` +
        `<b>Monto:</b> ${montoFmt}\n` +
        `<b>Concepto:</b> ${concepto}\n` +
        `<b>Pendiente:</b> ${saldoFmt}\n\n` +
        `Factura se solicitará al completar el pago.`,
        { parse_mode: 'HTML' },
      );
      console.log('[FacturaRE] Anticipo notificado (sin solicitud de factura) para pago', pagoId);
    } else if (totalCubierto) {
      // Full payment → suggest invoice with inline buttons
      await sendTelegramMessage(
        `📄 <b>Pago completo registrado</b>\n\n` +
        `<b>Cliente:</b> ${cliente.nombre} — ${montoFmt}\n` +
        `<b>Concepto:</b> ${concepto}\n` +
        `<b>NIT:</b> ${cliente.nit || 'CF'}\n\n` +
        `Solicitud de factura lista para RE Contadores.`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Enviar solicitud de factura', callback_data: `factura_si:${pagoId}` },
              { text: '❌ No solicitar', callback_data: `factura_no:${pagoId}` },
            ]],
          },
        },
      );
      console.log('[FacturaRE] Telegram de solicitud de factura enviado para pago', pagoId);
    } else {
      // Partial payment (not anticipo) that doesn't cover total
      await sendTelegramMessage(
        `💰 <b>Pago parcial registrado</b>\n\n` +
        `<b>Cliente:</b> ${cliente.nombre}\n` +
        `<b>Monto:</b> ${montoFmt}\n` +
        `<b>Concepto:</b> ${concepto}\n` +
        `<b>Pendiente:</b> ${saldoFmt}\n\n` +
        `Factura se solicitará al completar el pago.`,
        { parse_mode: 'HTML' },
      );
      console.log('[FacturaRE] Pago parcial notificado (sin solicitud de factura) para pago', pagoId);
    }
  } catch (err: any) {
    console.error('[FacturaRE] Error notificando pago:', err.message);
  }
}

// ── Envío real (se llama desde el asistente contable tras aprobación) ────────

/**
 * Envía solicitud de factura a RE Contadores, registra en BD y notifica por Telegram.
 * SOLO llamar después de que Amanda apruebe el borrador.
 */
export async function solicitarFacturaRE(params: SolicitudFacturaParams): Promise<void> {
  const {
    pago_id,
    cliente_nombre,
    cliente_nit,
    concepto,
    monto,
    fecha_pago,
    referencia_bancaria,
  } = params;

  const nit = cliente_nit || 'CF';
  const montoFmt = `Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  const referenciaTexto = referencia_bancaria || 'N/A';

  const asunto = `Solicitud de factura — ${cliente_nombre} — ${concepto}`;

  const detalleHtml = params.detalle_servicios?.length
    ? `\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top;">Detalle de servicios:</td><td>${params.detalle_servicios.map(s => `&bull; ${escapeHtml(s)}`).join('<br>')}</td></tr>`
    : '';

  const htmlBody = `
<p>Estimados,</p>
<p>Por medio de la presente solicito la emisión de factura electrónica con los siguientes datos:</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Cliente:</td><td>${escapeHtml(cliente_nombre)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">NIT:</td><td>${escapeHtml(nit)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Concepto:</td><td>${escapeHtml(concepto)}</td></tr>${detalleHtml}
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Monto:</td><td>${montoFmt}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Fecha de pago:</td><td>${fecha_pago}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Referencia:</td><td>${escapeHtml(referenciaTexto)}</td></tr>
</table>
<p>Agradezco su pronta gestión.</p>
<br>
<p><strong>Daniel Herrera</strong><br>
Departamento Contable<br>
Despacho Jurídico Amanda Santizo<br>
Tel. 2335-3613</p>
`.trim();

  // 1. Enviar email a RE Contadores
  await sendMail({
    from: 'contador@papeleo.legal',
    to: RE_DESTINATARIOS.join(', '),
    subject: asunto,
    htmlBody,
  });
  console.log('[FacturaRE] Email enviado a RE Contadores para pago', pago_id);

  // 2. Marcar factura_solicitada en cobro asociado (pagos no tiene este campo)
  try {
    // Buscar cobro_id del pago
    const { data: pagoData } = await db()
      .from('pagos')
      .select('cobro_id, cotizacion_id')
      .eq('id', pago_id)
      .single();

    let cobroId = pagoData?.cobro_id;

    // Si no tiene cobro directo, buscar cobro por cotizacion_id
    if (!cobroId && pagoData?.cotizacion_id) {
      const { data: cobro } = await db()
        .from('cobros')
        .select('id')
        .eq('cotizacion_id', pagoData.cotizacion_id)
        .limit(1)
        .maybeSingle();
      cobroId = cobro?.id;
    }

    if (cobroId) {
      await db()
        .from('cobros')
        .update({
          factura_solicitada: true,
          factura_solicitada_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', cobroId);
      console.log('[FacturaRE] BD actualizada: factura_solicitada=true para cobro', cobroId);
    } else {
      console.log('[FacturaRE] Pago sin cobro asociado, email enviado sin marcar BD', pago_id);
    }
  } catch (err: any) {
    console.error('[FacturaRE] Error actualizando BD:', err.message);
  }

  // 3. Confirmar a Amanda por Telegram
  try {
    await sendTelegramMessage(
      `✅ Factura solicitada a RE por pago de ${cliente_nombre} — ${montoFmt}`,
    );
  } catch (err: any) {
    console.error('[FacturaRE] Error enviando Telegram:', err.message);
  }
}

// ── Helper: obtener datos de pago para borrador ─────────────────────────────

export async function obtenerDatosPago(pagoId: string): Promise<SolicitudFacturaParams | null> {
  const { data: pago, error } = await db()
    .from('pagos')
    .select(`
      id, monto, fecha_pago, referencia_bancaria, notas, cobro_id, cotizacion_id,
      cliente:clientes!cliente_id (id, nombre, nit)
    `)
    .eq('id', pagoId)
    .single();

  if (error || !pago) {
    console.error('[FacturaRE] Pago no encontrado:', pagoId);
    return null;
  }

  const cliente = pago.cliente as any;
  if (!cliente) return null;

  // Determinar concepto
  let concepto = pago.notas || 'Servicios legales';
  if (pago.cobro_id) {
    const { data: cobro } = await db()
      .from('cobros')
      .select('concepto')
      .eq('id', pago.cobro_id)
      .single();
    if (cobro?.concepto) concepto = cobro.concepto;
  }

  // Obtener detalle de servicios de la cotización vinculada
  let detalle_servicios: string[] | undefined;
  let cotizacionId = pago.cotizacion_id;

  if (!cotizacionId && pago.cobro_id) {
    const { data: cobro } = await db()
      .from('cobros')
      .select('cotizacion_id')
      .eq('id', pago.cobro_id)
      .single();
    cotizacionId = cobro?.cotizacion_id;
  }

  if (cotizacionId) {
    const { data: items } = await db()
      .from('cotizacion_items')
      .select('descripcion, cantidad, precio_unitario, total')
      .eq('cotizacion_id', cotizacionId)
      .order('orden', { ascending: true });

    if (items && items.length > 0) {
      detalle_servicios = items.map((item: any) => {
        const totalFmt = `Q${item.total.toLocaleString('es-GT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
        return `${item.descripcion} (${totalFmt})`;
      });
    }
  }

  return {
    pago_id: pagoId,
    cliente_nombre: cliente.nombre,
    cliente_nit: cliente.nit,
    concepto,
    monto: pago.monto,
    fecha_pago: pago.fecha_pago,
    referencia_bancaria: pago.referencia_bancaria,
    detalle_servicios,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
