// ============================================================================
// lib/services/comprobantes-email.ts
// Helper genérico para enviar comprobantes (factura, recibo de caja, etc.)
// con PDF adjunto vía Microsoft Graph. Reusa sendMail() de outlook.service.
// ============================================================================

import { sendMail, type MailboxAlias } from './outlook.service';

export type TipoComprobante = 'factura' | 'recibo_caja' | 'cotizacion';

export interface EnviarComprobanteParams {
  tipo: TipoComprobante;
  destinatario: string;          // email principal del cliente
  asunto: string;
  cuerpoHtml: string;            // ya envuelto en emailWrapper si se desea
  pdfBuffer: Buffer;
  nombreArchivo: string;         // ej. 'RC-0001.pdf'
  cc?: string | string[];        // CC visible (puede ser array de emails ya validados)
  bcc?: string | string[];
  from?: MailboxAlias;           // default según tipo
}

// Regex práctico para validar formato de email (no exhaustivo, suficiente para UI)
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_REGEX.test(s.trim());
}

/** Normaliza una lista de emails: trim, dedupe (case-insensitive), descarta inválidos. */
export function normalizarEmails(input: string[] | string | undefined | null): string[] {
  if (!input) return [];
  const list = Array.isArray(input) ? input : input.split(',');
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const e = raw.trim();
    const k = e.toLowerCase();
    if (e && isValidEmail(e) && !seen.has(k)) {
      seen.add(k);
      out.push(e);
    }
  }
  return out;
}

/**
 * Default mailbox por tipo de comprobante.
 * - factura / recibo_caja: contador@ (cuentas y comprobantes)
 * - cotizacion: asistente@ (front-office)
 */
function defaultFrom(tipo: TipoComprobante): MailboxAlias {
  switch (tipo) {
    case 'cotizacion':   return 'asistente@papeleo.legal';
    case 'factura':
    case 'recibo_caja':
    default:             return 'contador@papeleo.legal';
  }
}

/**
 * Envía un comprobante por email con el PDF como adjunto.
 *
 * IMPORTANTE: si el envío falla, esta función LANZA OutlookError. El caller
 * decide cómo manejarlo — para recibos de caja, el flujo de pago debe seguir
 * adelante y registrar el error en `recibos_caja.email_error` para reintento
 * manual posterior.
 */
export async function enviarComprobantePorEmail(params: EnviarComprobanteParams): Promise<void> {
  if (!params.destinatario) {
    throw new Error('enviarComprobantePorEmail: falta destinatario');
  }
  if (!params.pdfBuffer || params.pdfBuffer.length === 0) {
    throw new Error('enviarComprobantePorEmail: pdfBuffer vacío');
  }

  const from = params.from ?? defaultFrom(params.tipo);

  await sendMail({
    from,
    to: params.destinatario,
    subject: params.asunto,
    htmlBody: params.cuerpoHtml,
    cc: params.cc,
    bcc: params.bcc,
    attachments: [{
      name: params.nombreArchivo,
      contentType: 'application/pdf',
      contentBytes: params.pdfBuffer.toString('base64'),
    }],
  });
}
