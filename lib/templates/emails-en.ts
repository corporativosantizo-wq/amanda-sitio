// ============================================================================
// lib/templates/emails-en.ts
// ENGLISH email templates for international clients — mirror of emails.ts.
//
// ⚠️ DRAFT TRANSLATIONS — pending Amanda's review (Fase 1). Not wired to any
// send path yet: plantillas() (seleccionar.ts) still returns Spanish always.
// Preview: /api/admin/plantillas/preview?lang=en
//
// Reglas de esta fase:
//   - Facturas NO tienen versión EN (las emite el SAT).
//   - Montos en USD ($). Único precio definido: consulta internacional USD $150
//     (CONSULTA_INTERNACIONAL_USD — Fase 2 lo asignará a cita.costo).
//   - Bloque de pago EN: Credit card (Stripe) y Bank transfer (Mercury Bank),
//     ambos DESHABILITADOS hasta que existan las cuentas.
//   - Todas las plantillas EN llevan aviso de confidencialidad en inglés.
//   - REGLA DE AMANDA: NUNCA incluir el número de colegiado en plantillas ni
//     firmas en inglés (aplica también a futuras fases: Molly EN, PDFs EN).
// ============================================================================

import type { EmailTemplate } from './emails';
import { emailWrapper, escEmail, formatearHora } from './emails';
import { MODALIDAD_INFO, DIRECCION_OFICINA, type ModalidadCita } from '@/lib/types/citas';

const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';
const AZUL_CLARO = '#eef2f9';
const AZUL_BORDE = '#c3cde4';

// Precio definido por Amanda para consulta legal internacional (Fase 2 lo
// asigna a cita.costo al crear la cita de un cliente EN).
export const CONSULTA_INTERNACIONAL_USD = 150;

// ── Shared helpers (EN) ─────────────────────────────────────────────────────

export function formatDateEN(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

// Misma convención 12h AM/PM que el flujo ES.
export const formatTimeEN = formatearHora;

export function fmtUSD(n: number): string {
  return `USD $${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MODALIDAD_LABEL_EN: Record<string, string> = {
  virtual: 'Virtual meeting (Microsoft Teams)',
  entrega_documentos: 'Document delivery/pickup (at our office)',
  firma_documentos: 'Document signing (at our office)',
  virtual_y_entrega: 'Virtual meeting + document delivery',
};

function modalidadDeCita(cita: any): ModalidadCita {
  const m = cita.modalidad as ModalidadCita | undefined;
  return m && MODALIDAD_INFO[m] ? m : 'virtual';
}

function modalidadLabelEN(cita: any): string {
  const m = modalidadDeCita(cita);
  const info = MODALIDAD_INFO[m];
  return `${info.icono} ${MODALIDAD_LABEL_EN[m] ?? info.label}`;
}

// ── Confidentiality notice (EN) — DRAFT for review ──────────────────────────

export const CONFIDENTIALITY_NOTICE_EN = `CONFIDENTIALITY NOTICE: This message and any attachments are confidential and intended solely for the named addressee. The information contained herein is protected by attorney-client privilege and the professional secrecy obligations applicable to attorneys and notaries under Guatemalan law. If you are not the intended recipient, please notify the sender immediately and delete this message; any unauthorized disclosure, copying, or distribution is strictly prohibited.`;

const confidentialityHTML = `
    <table width="100%" style="margin:24px 0 0;border-top:1px solid #e5e7eb;">
      <tr><td style="padding-top:12px;">
        <p style="margin:0;color:#9ca3af;font-size:11px;line-height:1.5;">${CONFIDENTIALITY_NOTICE_EN}</p>
      </td></tr>
    </table>`;

// Wrapper EN = wrapper de marca compartido + aviso de confidencialidad.
function wrapEN(content: string): string {
  return emailWrapper(content + confidentialityHTML);
}

// ── Payment options block (EN) — both methods DISABLED for now ──────────────
// Los "botones" son spans grises sin href a propósito: Stripe y Mercury Bank
// aún no están habilitados. Fase 5 los convierte en links reales.

function paymentOptionsEN(): string {
  const disabledBtn = (label: string) => `
      <td style="padding:0 6px;">
        <span style="display:inline-block;background:#e5e7eb;color:#9ca3af;padding:12px 24px;border-radius:8px;font-weight:600;font-size:13px;cursor:not-allowed;">
          ${label}
        </span>
      </td>`;
  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border:1px solid ${AZUL_BORDE};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:0.5px;">Payment options</p>
        <table cellpadding="0" cellspacing="0"><tr>
          ${disabledBtn('💳 Credit card (Stripe) — coming soon')}
          ${disabledBtn('🏦 Bank transfer (Mercury Bank) — coming soon')}
        </tr></table>
        <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Online payment is coming soon. For now, payment instructions will be provided separately by our accounting team (<strong>contador@papeleo.legal</strong>).</p>
      </td></tr>
    </table>`;
}

// ── Shared sections (EN) ────────────────────────────────────────────────────

function teamsSectionEN(cita: any): string {
  if (!cita.teams_link) return '';
  return `
    <table width="100%" style="margin:16px 0;"><tr><td align="center" style="padding:8px 0;">
      <a href="${cita.teams_link}" style="display:inline-block;background:${NAVY};color:#fff;padding:14px 36px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:700;font-size:15px;">
        Join the Teams meeting
      </a>
    </td></tr></table>`;
}

function officeSectionEN(cita: any): string {
  const modalidad = modalidadDeCita(cita);
  const esFirma = modalidad === 'firma_documentos';
  const docs = escEmail((cita.documentos_entrega ?? '').toString().trim());
  const lugarLabel = esFirma ? 'Location' : 'Address';

  const signingRequirements = esFirma ? `
        <p style="margin:12px 0 4px;font-size:14px;"><strong>📋 Important for the signing:</strong></p>
        <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7;">
          <li>Please bring a valid, original government-issued ID (passport or Guatemalan DPI)</li>
          <li>If signing as a legal representative, bring your current appointment deed and ID</li>
          <li>If sending an attorney-in-fact, they must present a power of attorney with sufficient authority and their ID</li>
        </ul>` : '';

  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border:1px solid ${AZUL_BORDE};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;"><strong>📍 ${lugarLabel}:</strong> ${DIRECCION_OFICINA}</p>
        ${docs && !esFirma ? `<p style="margin:8px 0 0;font-size:14px;"><strong>📋 Documents:</strong> ${docs}</p>` : ''}
        ${signingRequirements}
      </td></tr>
    </table>`;
}

function brandButtonEN(label: string, href: string): string {
  return `
    <table><tr><td style="padding:16px 0;">
      <a href="${href}" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">
        ${label}
      </a>
    </td></tr></table>`;
}

function portalInstructionsEN(): string {
  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border-left:3px solid ${NAVY};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${NAVY};">How to access:</p>
        <ol style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Go to <strong>amandasantizo.com/portal</strong></li>
          <li>Enter your email address and click "Request access"</li>
          <li>Check your inbox and click the access link</li>
          <li>You will find your files available for download under <strong>"Documents"</strong></li>
        </ol>
      </td></tr>
    </table>`;
}

function magalySignatureEN(): string {
  return `
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:20px;">
      Kind regards,<br/>
      <strong>Magaly Estrada</strong> — Process Assistant<br/>
      Amanda Santizo Law Firm
    </p>`;
}

function customMessageEN(mensaje?: string): string {
  const m = (mensaje ?? '').trim();
  if (!m) return '';
  return `<p style="color:#475569;font-size:14px;line-height:1.6;white-space:pre-line;">${escEmail(m)}</p>`;
}

function accionSolicitud(cita: any): 'signing' | 'delivery' {
  return modalidadDeCita(cita) === 'firma_documentos' ? 'signing' : 'delivery';
}

// ── Appointment templates (EN) ──────────────────────────────────────────────

export function emailConfirmacionCita(cita: any): EmailTemplate {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Legal Consultation' : 'Case Follow-up';
  const fechaFmt = formatDateEN(cita.fecha);
  const horaFmt = `${formatTimeEN(cita.hora_inicio)} - ${formatTimeEN(cita.hora_fin)}`;
  const duracion = cita.duracion_minutos ? `${cita.duracion_minutos} minutes` : (cita.tipo === 'consulta_nueva' ? '60 minutes' : '15 minutes');
  const clienteNombre = cita.cliente?.nombre ?? '';

  const info = MODALIDAD_INFO[modalidadDeCita(cita)];
  const teamsHTML = info.usaTeams ? teamsSectionEN(cita) : '';
  const officeHTML = info.usaOficina ? officeSectionEN(cita) : '';

  const modalidad = modalidadDeCita(cita);
  let closing: string;
  if (modalidad === 'entrega_documentos') {
    closing = 'We look forward to seeing you at our office for the delivery/pickup of your documents.';
  } else if (modalidad === 'firma_documentos') {
    closing = 'We look forward to seeing you at our office for the signing of your documents.';
  } else if (modalidad === 'virtual_y_entrega') {
    closing = 'You will receive the Teams invitation in your calendar. Documents may be delivered/picked up at our office.';
  } else {
    closing = 'You will also receive the invitation in your calendar.';
  }

  // Payment box: only Legal Consultation with a fee (mirror de la regla ES).
  // Para clientes internacionales, Fase 2 asigna cita.costo = 150 (USD).
  let paymentSection = '';
  if (cita.tipo === 'consulta_nueva' && cita.costo > 0) {
    paymentSection = `
    <table width="100%" style="margin:16px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#92400e;">Consultation fee: ${fmtUSD(cita.costo)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#78350f;">Payment is due prior to the consultation.</p>
      </td></tr>
    </table>
    ${paymentOptionsEN()}`;
  }

  const saludo = clienteNombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Dear <strong>${escEmail(clienteNombre)}</strong>,</p>` : '';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Appointment Confirmed</h2>
    ${saludo}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Your appointment has been successfully scheduled. Details below:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Type:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Duration:</strong> ${duracion}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Format:</strong> ${modalidadLabelEN(cita)}</p>
      </td></tr>
    </table>
    ${teamsHTML}
    ${officeHTML}
    <p style="margin:12px 0 0;color:#64748b;font-size:13px;">${closing}</p>
    ${paymentSection}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">If you need to cancel or reschedule, please contact us in advance.</p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Appointment confirmed — ${tipo} — ${fechaFmt}`,
    html,
  };
}

export function emailRecordatorio24h(cita: any): EmailTemplate {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Legal Consultation' : 'Case Follow-up';
  const fechaFmt = formatDateEN(cita.fecha);
  const horaFmt = `${formatTimeEN(cita.hora_inicio)} - ${formatTimeEN(cita.hora_fin)}`;

  const info = MODALIDAD_INFO[modalidadDeCita(cita)];
  const teamsBtn = info.usaTeams ? teamsSectionEN(cita) : '';
  const officeSec = info.usaOficina ? officeSectionEN(cita) : '';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Reminder: your appointment is tomorrow</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">This is a friendly reminder that you have an appointment scheduled for tomorrow.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Type:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Format:</strong> ${modalidadLabelEN(cita)}</p>
      </td></tr>
    </table>
    ${officeSec}
    ${teamsBtn}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Reminder: your appointment is tomorrow — ${cita.titulo}`,
    html,
  };
}

export function emailRecordatorio1h(cita: any): EmailTemplate {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Legal Consultation' : 'Case Follow-up';
  const fechaFmt = formatDateEN(cita.fecha);
  const horaFmt = `${formatTimeEN(cita.hora_inicio)} - ${formatTimeEN(cita.hora_fin)}`;

  const info = MODALIDAD_INFO[modalidadDeCita(cita)];
  const teamsBtn = info.usaTeams ? teamsSectionEN(cita) : '';
  const officeSec = info.usaOficina ? officeSectionEN(cita) : '';
  const intro = info.usaOficina && !info.usaTeams
    ? 'Your appointment is coming up. We look forward to seeing you at our office.'
    : 'Your appointment is about to start. Please get ready to join.';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Your appointment is in 1 hour!</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Type:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Format:</strong> ${modalidadLabelEN(cita)}</p>
      </td></tr>
    </table>
    ${officeSec}
    ${teamsBtn}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Your appointment is in 1 hour! — ${cita.titulo}`,
    html,
  };
}

export function emailCancelacionCita(cita: any): EmailTemplate {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Legal Consultation' : 'Case Follow-up';
  const fechaFmt = formatDateEN(cita.fecha);
  const horaFmt = `${formatTimeEN(cita.hora_inicio)} - ${formatTimeEN(cita.hora_fin)}`;

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Appointment Cancelled</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Your appointment has been cancelled.</p>
    <table width="100%" style="margin:16px 0;background:#fef2f2;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Type:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Time:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">If you would like to reschedule, please don't hesitate to contact us.</p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Appointment cancelled — ${cita.titulo}`,
    html,
  };
}

export function emailSolicitudConfirmada(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'signing';
  const nombre = cita.cliente?.nombre ?? '';
  const fechaFmt = cita.fecha ? formatDateEN(cita.fecha) : '';
  const horaFmt = formatTimeEN(cita.hora_inicio);

  const idNotice = esFirma
    ? `<p style="margin:8px 0;font-size:14px;color:#b45309;"><strong>⚠️ Please bring a valid, original government-issued ID (passport or DPI).</strong></p>`
    : '';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Appointment confirmed</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Dear <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">We confirm your document ${accion} appointment:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 Location:</strong> ${DIRECCION_OFICINA}</p>
        ${idNotice}
      </td></tr>
    </table>
    ${customMessageEN(mensaje)}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">If you need to reschedule, please contact us in advance.</p>
    ${magalySignatureEN()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Appointment confirmed — Document ${esFirma ? 'signing' : 'delivery'}${fechaFmt ? ` — ${fechaFmt}` : ''}`,
    html,
  };
}

export function emailFirmaConfirmadaMultiple(
  cita: any,
  destinatarioNombre: string,
  firmantes: Array<{ nombre: string }>,
  mensaje?: string,
): EmailTemplate {
  const fechaFmt = cita.fecha ? formatDateEN(cita.fecha) : '';
  const horaFmt = formatTimeEN(cita.hora_inicio);

  const listaFirmantes = firmantes
    .filter((f) => (f.nombre ?? '').trim())
    .map((f) => `<li style="margin:4px 0;font-size:14px;color:#0f172a;">${escEmail(f.nombre)}</li>`)
    .join('');

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Appointment confirmed</h2>
    ${destinatarioNombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Dear <strong>${escEmail(destinatarioNombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">We confirm your appointment for the signing of documents:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 Location:</strong> ${DIRECCION_OFICINA}</p>
      </td></tr>
    </table>
    <div style="margin:16px 0;">
      <p style="margin:0 0 6px;font-size:14px;color:#475569;"><strong>👥 Signing parties:</strong></p>
      <ul style="margin:0;padding-left:20px;">${listaFirmantes}</ul>
    </div>
    <p style="margin:8px 0;font-size:14px;color:#b45309;"><strong>⚠️ Important: please bring a valid, original government-issued ID.</strong></p>
    ${customMessageEN(mensaje)}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">If you need to reschedule, please contact us in advance.</p>
    ${magalySignatureEN()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Appointment confirmed — Document signing${fechaFmt ? ` — ${fechaFmt}` : ''}`,
    html,
  };
}

export function emailSolicitudPropuestaFecha(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'signing';
  const nombre = cita.cliente?.nombre ?? '';
  const solicitadaFmt = cita.fecha_solicitada ? formatDateEN(cita.fecha_solicitada) : 'the requested date';
  const nuevaFechaFmt = cita.fecha ? formatDateEN(cita.fecha) : '';
  const nuevaHoraFmt = formatTimeEN(cita.hora_inicio);

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Alternative date proposed</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Dear <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Thank you for your document ${accion} request.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Unfortunately, the date you selected (<strong>${solicitadaFmt}</strong>) is not available.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">The next available date is:</p>
    <table width="100%" style="margin:16px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 ${nuevaFechaFmt}</strong></p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 ${nuevaHoraFmt} (Guatemala time, GMT-6)</strong></p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 ${DIRECCION_OFICINA}</strong></p>
      </td></tr>
    </table>
    ${customMessageEN(mensaje)}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Please reply to this email to confirm whether this date works for you.</p>
    ${magalySignatureEN()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `New date for your document ${esFirma ? 'signing' : 'delivery'}`,
    html,
  };
}

export function emailSolicitudRechazada(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'signing';
  const nombre = cita.cliente?.nombre ?? '';
  const cuerpo = (mensaje ?? '').trim()
    || 'Your documents are currently being prepared. We will contact you as soon as they are ready.';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">About your request</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Dear <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;white-space:pre-line;">${escEmail(cuerpo)}</p>
    ${magalySignatureEN()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `About your document ${esFirma ? 'signing' : 'delivery'} request`,
    html,
  };
}

// ── Scheduled calls (EN) ────────────────────────────────────────────────────

export function emailConfirmacionLlamada(params: {
  nombre: string;
  fecha: string;
  hora: string;
  duracion: number;
  asunto: string;
  telefono?: string | null;
}): EmailTemplate {
  const fechaFmt = formatDateEN(params.fecha);
  const horaFmt = formatTimeEN(params.hora);
  const tel = (params.telefono ?? '').trim();

  const html = wrapEN(`
    <p style="color:#475569;font-size:15px;line-height:1.6;">Dear <strong>${escEmail(params.nombre)}</strong>, 👋</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">We hope this message finds you well! 🌟</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">We confirm that a phone call has been scheduled with <strong>Amanda Santizo, Attorney at Law</strong>:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">📞 Scheduled call</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>⏱️ Estimated duration:</strong> ${params.duracion} minutes</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📌 Subject:</strong> ${escEmail(params.asunto)}</p>
      </td></tr>
    </table>
    ${tel ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Please make sure you are available at <strong>${escEmail(tel)}</strong> at the scheduled time.</p>` : `<p style="color:#475569;font-size:14px;line-height:1.6;">Please make sure you are available at the scheduled time.</p>`}
    <p style="color:#475569;font-size:14px;line-height:1.6;">If you need to reschedule, simply reply to this email. 📩</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Have a great day! ☀️</p>
    ${magalySignatureEN()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `📞 Call scheduled — ${fechaFmt} at ${horaFmt}`,
    html,
  };
}

export function emailRecordatorioLlamadaCliente(params: {
  nombre: string;
  hora: string;
  asunto: string;
}): EmailTemplate {
  const horaFmt = formatTimeEN(params.hora);
  const html = wrapEN(`
    <p style="color:#475569;font-size:15px;line-height:1.6;">👋 Dear <strong>${escEmail(params.nombre)}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">This is a reminder of your call <strong>today</strong> with Amanda Santizo, Attorney at Law.</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📞 Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📌 Subject:</strong> ${escEmail(params.asunto)}</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Have a great day! ☀️</p>
  `);
  return {
    from: 'asistente@papeleo.legal',
    subject: `📞 Reminder: your call is today at ${horaFmt}`,
    html,
  };
}

// ── Accounting templates (EN) — montos en USD, pago Stripe/Mercury off ──────

export function emailSolicitudPago(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  fechaLimite?: string;
  numeroCotizacion?: string;
}): EmailTemplate {
  const montoFmt = fmtUSD(params.monto);
  const subjectRef = params.numeroCotizacion
    ? `Quote ${params.numeroCotizacion}`
    : (params.concepto?.trim() ? params.concepto : 'Pending quote');

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Payment reminder</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)},</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">According to our records, the following amount for legal services rendered remains outstanding. We are sending this friendly reminder with the details so you can arrange payment at your convenience.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Description:</strong> ${escEmail(params.concepto)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Amount:</strong> ${montoFmt}</p>
      </td></tr>
    </table>
    ${paymentOptionsEN()}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Once the payment has been made, we would appreciate it if you could send the receipt to this email so we can confirm it.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">If you have already made this payment, please disregard this message.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">We remain at your disposal for any questions.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:16px;">Kind regards,<br/><strong>Amanda Santizo</strong><br/>Attorney and Notary<br/><a href="https://amandasantizo.com" style="color:#1e2a5a;text-decoration:none;">amandasantizo.com</a></p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Payment reminder — ${subjectRef}`,
    html,
  };
}

export function emailPagoRecibido(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  fechaPago: string;
}): EmailTemplate {
  const montoFmt = fmtUSD(params.monto);

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Payment Received</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, we confirm that your payment has been received.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Description:</strong> ${escEmail(params.concepto)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Amount:</strong> ${montoFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Payment date:</strong> ${formatDateEN(params.fechaPago)}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Thank you for your payment.</p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Payment received — ${params.concepto} — ${montoFmt}`,
    html,
  };
}

export function emailEstadoCuenta(params: {
  clienteNombre: string;
  movimientos: { fecha: string; concepto: string; cargo: number; abono: number }[];
  saldo: number;
}): EmailTemplate {
  const saldoFmt = fmtUSD(params.saldo);

  const filas = params.movimientos
    .map(
      (m) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.fecha}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${escEmail(m.concepto)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.cargo > 0 ? fmtUSD(m.cargo) : '-'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.abono > 0 ? fmtUSD(m.abono) : '-'}</td>
        </tr>`
    )
    .join('');

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Account Statement</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, please find your account statement below.</p>
    <table width="100%" style="margin:16px 0;border-collapse:collapse;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Date</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Description</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Charge</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Payment</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
    <table width="100%" style="margin:16px 0;background:${params.saldo > 0 ? '#fef2f2' : '#eef2f9'};border-radius:8px;padding:16px;">
      <tr><td style="text-align:right;">
        <p style="margin:0;font-size:16px;font-weight:700;">Balance due: ${saldoFmt}</p>
      </td></tr>
    </table>
    ${params.saldo > 0 ? paymentOptionsEN() : ''}
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Account statement — Balance: ${saldoFmt}`,
    html,
  };
}

export function emailRecordatorioCobro(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  saldoPendiente: number;
  fechaVencimiento?: string;
  tipo: 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | 'urgente';
  numeroCobro: number;
}): EmailTemplate {
  const montoFmt = fmtUSD(params.saldoPendiente);
  const vencimiento = params.fechaVencimiento ? formatDateEN(params.fechaVencimiento) : 'to be confirmed';

  let titulo: string;
  let intro: string;
  let tono: string;

  switch (params.tipo) {
    case 'primer_aviso':
      titulo = 'Payment reminder';
      intro = `This is a friendly reminder that you have an outstanding balance for the item detailed below.`;
      tono = 'Thank you for your prompt attention.';
      break;
    case 'segundo_aviso':
      titulo = 'Second payment notice';
      intro = `This is our second notice regarding the following outstanding payment. We kindly ask you to settle it as soon as possible.`;
      tono = 'Your timely payment allows us to continue providing you with quality service.';
      break;
    case 'tercer_aviso':
    case 'urgente':
      titulo = 'Overdue payment notice';
      intro = `Please be advised that the following payment is <strong>overdue</strong>. We urge you to make the payment immediately to avoid further action.`;
      tono = 'If payment is not received within the next few days, we will be compelled to take the corresponding measures.';
      break;
  }

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${titulo}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)},</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
    <table width="100%" style="margin:16px 0;background:${params.tipo === 'tercer_aviso' || params.tipo === 'urgente' ? '#fef2f2' : '#eef2f9'};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Reference:</strong> COB-${String(params.numeroCobro).padStart(3, '0')}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Description:</strong> ${escEmail(params.concepto)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Balance due:</strong> <span style="font-size:18px;font-weight:700;color:#0f172a;">${montoFmt}</span></p>
        <p style="margin:8px 0;font-size:14px;"><strong>Due date:</strong> ${vencimiento}</p>
      </td></tr>
    </table>
    ${paymentOptionsEN()}
    <p style="color:#475569;font-size:14px;line-height:1.6;">${tono}</p>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Please send your payment receipt to this email.</p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `${titulo} — COB-${String(params.numeroCobro).padStart(3, '0')} — ${montoFmt}`,
    html,
  };
}

export function emailCotizacion(params: {
  clienteNombre: string;
  servicios: { descripcion: string; monto: number; cantidad?: number }[];
  subtotal?: number;
  iva?: number;
  total?: number;
  anticipo?: number;
  vigencia?: string;
  vigenciaDias?: number;
  numeroCotizacion?: string;
  fechaEmision?: string;
  anticipoPorcentaje?: number;
  condiciones?: string;
  notas_cliente?: string;
  logoBase64?: string;
  configuracion?: Record<string, any>;
  tokenRespuesta?: string;
  // Resends: Amanda's personal note replaces the standard greeting and goes
  // above the services table (the full quote travels below it).
  mensajePersonal?: string;
}): EmailTemplate {
  // NOTA (borrador): el tratamiento fiscal (IVA) para clientes internacionales
  // lo define Amanda; se mantiene la misma aritmética que la versión ES.
  const subtotalCalc = params.subtotal ?? params.servicios.reduce((sum, s) => sum + s.monto, 0);
  const ivaCalc = params.iva ?? subtotalCalc * 0.12;
  const totalCalc = params.total ?? subtotalCalc + ivaCalc;
  const anticipoCalc = params.anticipo ?? 0;
  const antPct = params.anticipoPorcentaje ?? 60;

  const headerInfo = (params.numeroCotizacion || params.fechaEmision)
    ? `<p style="margin:0 0 16px;text-align:right;">${params.numeroCotizacion ? `<span style="display:inline-block;background:#eef2f9;color:#1e2a5a;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">${params.numeroCotizacion}</span>` : ''}${params.fechaEmision ? `<span style="font-size:12px;color:#94A3B8;margin-left:8px;">${formatDateEN(params.fechaEmision)}</span>` : ''}</p>`
    : '';

  const filasServicios = params.servicios
    .map(
      (s, i) =>
        `<tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#ffffff'};">
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#64748B;text-align:center;width:36px;">${i + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#334155;">${s.descripcion}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#334155;text-align:right;width:50px;">${s.cantidad ?? 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#0F172A;text-align:right;width:120px;">${fmtUSD(s.monto)}</td>
        </tr>`
    )
    .join('');

  const anticipoRow = anticipoCalc > 0
    ? `<tr>
        <td style="padding:8px 12px;font-size:13px;color:#1e2a5a;">Retainer (${antPct}%)</td>
        <td style="padding:8px 12px;font-size:13px;color:#1e2a5a;font-weight:600;text-align:right;">${fmtUSD(anticipoCalc)}</td>
      </tr>`
    : '';

  let conditionsHtml = '';
  if (params.condiciones) {
    const condLines = params.condiciones.split('\n').map(l => l.trim()).filter(Boolean);
    const condContent = condLines.map(l => `<p style="margin:4px 0;font-size:13px;color:#334155;line-height:1.5;">${l}</p>`).join('');
    conditionsHtml = `
    <table width="100%" style="margin:20px 0;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#eef2f9;border-left:3px solid #1e2a5a;padding:16px 18px;border-radius:0 6px 6px 0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1e2a5a;text-transform:uppercase;letter-spacing:0.5px;">General Terms and Conditions</p>
          ${condContent}
        </td>
      </tr>
    </table>`;
  }

  // Validity badge mirrors the real config value (validez_cotizacion_dias).
  const vigenciaDias = params.vigenciaDias ?? 30;
  const introHtml = (params.mensajePersonal ?? '').trim()
    ? `<p style="color:#334155;font-size:14px;line-height:1.6;white-space:pre-line;">${escEmail(params.mensajePersonal!.trim())}</p>`
    : `<p style="color:#334155;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, please find below the quote you requested.</p>`;

  const html = wrapEN(`
    ${headerInfo}
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Quote for Legal Services</h2>
    ${introHtml}
    <p style="margin:16px 0;"><span style="display:inline-block;background:#eef2f9;color:#1e2a5a;padding:4px 14px;border-radius:4px;font-size:12px;font-weight:600;">Valid for ${vigenciaDias} days</span></p>
    <table width="100%" style="margin:16px 0;border-collapse:collapse;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:36px;">No.</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">Service</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:50px;">Qty</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:120px;">Total (USD)</th>
        </tr>
      </thead>
      <tbody>${filasServicios}</tbody>
    </table>
    <table width="100%" style="margin:8px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#64748B;">Subtotal</td>
        <td style="padding:8px 12px;font-size:13px;color:#334155;text-align:right;">${fmtUSD(subtotalCalc)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#64748B;">VAT (12%)</td>
        <td style="padding:8px 12px;font-size:13px;color:#334155;text-align:right;">${fmtUSD(ivaCalc)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 12px;"><hr style="border:none;border-top:1px solid #CBD5E1;margin:4px 0;" /></td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#0F172A;">TOTAL</td>
        <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#0F172A;text-align:right;">${fmtUSD(totalCalc)}</td>
      </tr>
      ${anticipoRow}
    </table>
    ${params.notas_cliente ? `
    <table width="100%" style="margin:20px 0;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#FFFBEB;border-left:4px solid #F59E0B;padding:16px 18px;border-radius:0 6px 6px 0;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;">⚠️ Important note</p>
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;font-weight:600;">${params.notas_cliente.replace(/\n/g, '<br>')}</p>
        </td>
      </tr>
    </table>` : ''}
    ${params.tokenRespuesta ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center">
        <p style="font-size:14px;color:#64748B;margin:0 0 16px;">Would you like to proceed with the services quoted?</p>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding:0 6px;">
            <a href="https://amandasantizo.com/cotizacion/respuesta?token=${params.tokenRespuesta}&accion=aceptar"
               style="display:inline-block;background-color:#1e2a5a;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;border-bottom:3px solid #c2a05a;font-weight:bold;font-size:15px;">
              ✓ Accept Quote
            </a>
          </td>
          <td style="padding:0 6px;">
            <a href="https://amandasantizo.com/cotizacion/respuesta?token=${params.tokenRespuesta}&accion=dudas"
               style="display:inline-block;background-color:#ffffff;color:#1e2a5a;padding:13px 31px;text-decoration:none;border-radius:8px;border:1px solid #1e2a5a;font-weight:bold;font-size:15px;">
              ? I Have Questions
            </a>
          </td>
        </tr></table>
        <p style="font-size:11px;color:#94A3B8;margin:12px 0 0;">You may also simply reply to this email.</p>
      </td></tr>
    </table>` : ''}
    ${conditionsHtml}
    ${paymentOptionsEN()}
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: params.numeroCotizacion
      ? `Quote ${params.numeroCotizacion} — ${fmtUSD(totalCalc)}`
      : `Quote — ${fmtUSD(totalCalc)}`,
    html,
  };
}

// ── Case / documents templates (EN) ─────────────────────────────────────────

export function emailDocumentosDisponibles(params: {
  clienteNombre: string;
}): EmailTemplate {
  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Your documents are ready</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, the requested copies from your case file are now available in your client portal.</p>
    ${portalInstructionsEN()}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Your documents will remain available for 30 days. If you need access after that, please request it by replying to this email.</p>
    ${brandButtonEN('Go to the client portal', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Your documents are ready — Amanda Santizo Law Firm',
    html,
  };
}

export function emailActualizacionExpediente(params: {
  clienteNombre: string;
  expediente: string;
  novedad: string;
}): EmailTemplate {
  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Update on your case</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, we would like to inform you of a development in your case.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Case file:</strong> ${escEmail(params.expediente)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Update:</strong> ${escEmail(params.novedad)}</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">If you have any questions about this update, you can reply to this email or schedule a follow-up meeting.</p>
    ${brandButtonEN('Schedule a follow-up', 'https://amandasantizo.com/agendar')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Update on your case — Amanda Santizo Law Firm',
    html,
  };
}

export function emailBienvenidaCliente(params: {
  clienteNombre: string;
}): EmailTemplate {
  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Welcome</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, thank you for entrusting our firm with your legal matter.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">We have created your client portal, where you can check the status of your case, download documents, and communicate with us.</p>
    ${portalInstructionsEN()}
    <table width="100%" style="margin:16px 0;background:#f9fafb;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;">Contact information</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">Email: asistente@papeleo.legal</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">Web: amandasantizo.com</p>
      </td></tr>
    </table>
    ${brandButtonEN('Access the portal', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Welcome — Amanda Santizo Law Firm',
    html,
  };
}

export function emailSolicitudDocumentos(params: {
  clienteNombre: string;
  documentos: string[];
  plazo?: string;
}): EmailTemplate {
  const lista = params.documentos
    .map((d: string) => `<li style="margin:4px 0;font-size:14px;">${escEmail(d)}</li>`)
    .join('');

  const plazoLine = params.plazo
    ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Suggested deadline:</strong> ${escEmail(params.plazo)}</p>`
    : '';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Documents needed for your case</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, in order to move forward with your matter, we need you to send us the following documents:</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <ul style="margin:0;padding-left:20px;color:#475569;">${lista}</ul>
      </td></tr>
    </table>
    ${plazoLine}
    <p style="color:#475569;font-size:14px;line-height:1.6;">You can send them by replying to this email or by uploading them directly to your client portal.</p>
    ${brandButtonEN('Go to the portal', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Documents needed for your case — Amanda Santizo Law Firm',
    html,
  };
}

export function emailAvisoAudiencia(params: {
  clienteNombre: string;
  fecha: string;
  hora: string;
  juzgado: string;
  direccion?: string;
  presenciaRequerida: boolean;
  instrucciones?: string;
  documentosLlevar?: string[];
}): EmailTemplate {
  const fechaFmt = formatDateEN(params.fecha);
  const horaFmt = formatTimeEN(params.hora);
  const presencia = params.presenciaRequerida ? 'Your attendance is required' : 'Your attendance is not required';
  const presenciaBg = params.presenciaRequerida ? '#fef2f2' : '#eef2f9';

  const direccionLine = params.direccion
    ? `<p style="margin:8px 0;font-size:14px;"><strong>Address:</strong> ${escEmail(params.direccion)}</p>`
    : '';

  const instruccionesSection = (params.presenciaRequerida && params.instrucciones) ? `
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;">Instructions:</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">${escEmail(params.instrucciones)}</p>
      </td></tr>
    </table>` : '';

  const documentosSection = (params.documentosLlevar && params.documentosLlevar.length > 0) ? `
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Documents you should bring:</p>
        <ul style="margin:0;padding-left:20px;color:#475569;">
          ${params.documentosLlevar.map((d: string) => `<li style="margin:4px 0;font-size:14px;">${escEmail(d)}</li>`).join('')}
        </ul>
      </td></tr>
    </table>` : '';

  const html = wrapEN(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Important notice: court hearing scheduled</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Dear ${escEmail(params.clienteNombre)}, we would like to inform you of a court hearing scheduled in your case.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Date:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Time:</strong> ${horaFmt} (Guatemala time, GMT-6)</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Court:</strong> ${escEmail(params.juzgado)}</p>
        ${direccionLine}
      </td></tr>
    </table>
    <table width="100%" style="margin:16px 0;background:${presenciaBg};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0;font-size:14px;font-weight:600;">${presencia}</p>
      </td></tr>
    </table>
    ${instruccionesSection}
    ${documentosSection}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Important notice: court hearing scheduled — Amanda Santizo Law Firm',
    html,
  };
}
