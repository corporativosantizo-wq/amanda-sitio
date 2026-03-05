// ============================================================================
// lib/services/factura-re.service.ts
// Solicitud automática de factura a RE Contadores
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

interface SolicitudFacturaParams {
  pago_id: string;
  cliente_nombre: string;
  cliente_nit: string | null;
  concepto: string;
  monto: number;
  fecha_pago: string;
  referencia_bancaria: string | null;
}

/**
 * Envía solicitud de factura a RE Contadores, registra en BD y notifica por Telegram.
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
  const referenciaLinea = referencia_bancaria
    ? `Referencia: ${referencia_bancaria}`
    : 'Referencia: N/A';

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
  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">${referenciaLinea.split(':')[0]}:</td><td>${escapeHtml(referenciaLinea.split(':').slice(1).join(':').trim())}</td></tr>
</table>
<p>Agradezco su pronta gestión.</p>
<br>
<p><strong>Daniel Herrera</strong><br>
Departamento Contable<br>
Despacho Jurídico Amanda Santizo<br>
Tel. 2335-3613</p>
`.trim();

  // 1. Enviar email a RE Contadores
  try {
    await sendMail({
      from: 'contador@papeleo.legal',
      to: RE_DESTINATARIOS.join(', '),
      subject: asunto,
      htmlBody,
    });
    console.log('[FacturaRE] Email enviado a RE Contadores para pago', pago_id);
  } catch (err: any) {
    console.error('[FacturaRE] Error enviando email:', err.message);
    // No lanzar — registrar que falló pero no bloquear el flujo de pago
  }

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

  // 3. Notificar a Amanda por Telegram
  try {
    await sendTelegramMessage(
      `📄 Factura solicitada a RE por pago de ${cliente_nombre} — ${montoFmt}`,
    );
    console.log('[FacturaRE] Telegram enviado');
  } catch (err: any) {
    console.error('[FacturaRE] Error enviando Telegram:', err.message);
  }
}

/**
 * Solicita factura dado un pago_id — busca los datos del pago y cliente.
 */
export async function solicitarFacturaPorPagoId(pagoId: string): Promise<string> {
  const { data: pago, error } = await db()
    .from('pagos')
    .select(`
      id, monto, fecha_pago, referencia_bancaria, notas,
      cliente:clientes!cliente_id (id, nombre, nit)
    `)
    .eq('id', pagoId)
    .single();

  if (error || !pago) {
    throw new Error(`Pago no encontrado: ${pagoId}`);
  }

  const cliente = pago.cliente as any;
  if (!cliente) {
    throw new Error('El pago no tiene cliente asociado');
  }

  // Determinar concepto del pago
  let concepto = pago.notas || 'Servicios legales';

  // Si tiene cobro asociado, usar concepto del cobro
  const { data: pagoCompleto } = await db()
    .from('pagos')
    .select('cobro_id')
    .eq('id', pagoId)
    .single();

  if (pagoCompleto?.cobro_id) {
    const { data: cobro } = await db()
      .from('cobros')
      .select('concepto')
      .eq('id', pagoCompleto.cobro_id)
      .single();
    if (cobro?.concepto) concepto = cobro.concepto;
  }

  await solicitarFacturaRE({
    pago_id: pagoId,
    cliente_nombre: cliente.nombre,
    cliente_nit: cliente.nit,
    concepto,
    monto: pago.monto,
    fecha_pago: pago.fecha_pago,
    referencia_bancaria: pago.referencia_bancaria,
  });

  return `Factura solicitada a RE Contadores para ${cliente.nombre} — Q${pago.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
