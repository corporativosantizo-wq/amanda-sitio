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
}

// ── Notificación (se llama automáticamente al confirmar pago) ───────────────

/**
 * Notifica a Amanda por Telegram que se registró un pago y hay solicitud
 * de factura pendiente de aprobación. NO envía el email a RE.
 */
export async function notificarPagoParaFactura(pagoId: string): Promise<void> {
  try {
    const datos = await obtenerDatosPago(pagoId);
    if (!datos) return;

    const montoFmt = `Q${datos.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

    await sendTelegramMessage(
      `📄 Pago registrado: ${datos.cliente_nombre} — ${montoFmt}\n` +
      `Concepto: ${datos.concepto}\n` +
      `NIT: ${datos.cliente_nit || 'CF'}\n\n` +
      `Preparé solicitud de factura para RE. Aprueba desde el asistente contable.`,
    );
    console.log('[FacturaRE] Telegram de notificación enviado para pago', pagoId);
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

  const htmlBody = `
<p>Estimados,</p>
<p>Por medio de la presente solicito la emisión de factura electrónica con los siguientes datos:</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Cliente:</td><td>${escapeHtml(cliente_nombre)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">NIT:</td><td>${escapeHtml(nit)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Concepto:</td><td>${escapeHtml(concepto)}</td></tr>
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

  // 2. Registrar en BD
  try {
    await db()
      .from('pagos')
      .update({
        factura_solicitada: true,
        factura_solicitada_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pago_id);
    console.log('[FacturaRE] BD actualizada: factura_solicitada=true para pago', pago_id);
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
      id, monto, fecha_pago, referencia_bancaria, notas, cobro_id,
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

  return {
    pago_id: pagoId,
    cliente_nombre: cliente.nombre,
    cliente_nit: cliente.nit,
    concepto,
    monto: pago.monto,
    fecha_pago: pago.fecha_pago,
    referencia_bancaria: pago.referencia_bancaria,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
