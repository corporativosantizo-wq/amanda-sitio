// ============================================================================
// lib/templates/audiencias-emails.ts
// Plantillas de correo de recordatorio de audiencia, por modalidad
// (presencial / virtual / híbrida). Reutiliza el wrapper de marca de
// lib/templates/emails.ts. El .ics se ADJUNTA aparte (vía sendMail attachments);
// aquí va el botón "Agregar a mi calendario" (Google Calendar) + la mención del
// adjunto.
//
// Emisor: asistente@papeleo.legal (mantiene el auto-BCC a amanda@ de sendMail).
// El CC visible (solo audiencias.emails_cc explícito) y la redirección de modo
// prueba se resuelven en la capa de ENVÍO (Fase 3c), no aquí.
// ============================================================================

import type { MailboxAlias } from '@/lib/services/outlook.service';
import { escEmail, type EmailTemplate } from '@/lib/templates/emails';
import { googleCalendarUrl } from '@/lib/services/audiencias-ics';
import { LOGO_AUDIENCIA_BASE64 } from '@/lib/assets/logo-audiencia-base64';
import type { Audiencia } from '@/lib/types/audiencias';

const FROM_AUDIENCIAS: MailboxAlias = 'asistente@papeleo.legal';

// Paleta del despacho (colores del logo).
const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';
const AZUL_CLARO = '#eef2f9'; // recuadros de info (en vez de verde)

// CID del logo embebido inline (lo adjunta el motor de envío).
export const LOGO_CID = 'logoAudiencia';

// Wrapper de marca para audiencias: header blanco con el logo (CID inline),
// acento navy arriba y línea dorada. NO toca el emailWrapper compartido.
function wrapperAudiencia(content: string): string {
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr><td style="background:#ffffff;border-top:4px solid ${NAVY};padding:28px 32px 22px;text-align:center;border-bottom:1px solid #eef0f4;">
          <img src="cid:${LOGO_CID}" alt="Amanda Santizo — Abogada y Consultora" width="240" style="display:block;margin:0 auto;width:240px;max-width:70%;height:auto;">
          <div style="height:3px;width:64px;background:${GOLD};margin:16px auto 0;border-radius:2px;"></div>
        </td></tr>
        <tr><td style="padding:32px;">${content}</td></tr>
        <tr><td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;">Amanda Santizo — Despacho Jurídico — amandasantizo.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function fechaLargaGT(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function botonCalendario(href: string): string {
  return `
    <table cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0;">
      <a href="${href}" target="_blank" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">
        📅 Agregar a mi calendario
      </a>
    </td></tr></table>`;
}

function filaDato(label: string, valor: string): string {
  return `<tr>
    <td style="padding:6px 12px 6px 0;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top;">${escEmail(label)}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${valor}</td>
  </tr>`;
}

// Banner de modo prueba (Fase 3c). Si se pasa `bannerPruebaPara`, se antepone.
function bannerPrueba(destinatarioReal: string): string {
  return `
    <table width="100%" style="margin:0 0 20px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;">
      <tr><td style="padding:12px 16px;color:#92400e;font-size:13px;">
        <strong>[PRUEBA]</strong> Este correo se habría enviado a:
        <strong>${escEmail(destinatarioReal)}</strong>
      </td></tr>
    </table>`;
}

function bloqueLugar(a: Audiencia): string {
  const lugar = [a.juzgado, a.sala, a.ubicacion].filter(Boolean).map(escEmail).join('<br>');
  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border-left:3px solid ${NAVY};border-radius:8px;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.5px;">📍 Lugar (presencial)</p>
        <p style="margin:0;font-size:14px;color:#111827;line-height:1.6;">${lugar || '—'}</p>
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Le recomendamos llegar <strong>15 minutos antes</strong>.</p>
      </td></tr>
    </table>`;
}

function bloqueConexion(a: Audiencia): string {
  const enlace = a.enlace_virtual ? escEmail(a.enlace_virtual) : '';
  const plataforma = a.plataforma ? escEmail(a.plataforma) : 'la plataforma indicada';
  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border-left:3px solid ${NAVY};border-radius:8px;">
      <tr><td style="padding:16px;">
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:${NAVY};text-transform:uppercase;letter-spacing:.5px;">💻 Conexión virtual</p>
        ${enlace ? `<p style="margin:0 0 10px;"><a href="${enlace}" style="display:inline-block;background:${NAVY};color:#fff;padding:10px 22px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">Unirse a la audiencia</a></p>
        <p style="margin:0 0 6px;font-size:12px;color:${NAVY};word-break:break-all;">${enlace}</p>` : `<p style="margin:0;font-size:14px;color:#6b7280;">El enlace de conexión se enviará por este medio.</p>`}
        <p style="margin:10px 0 0;font-size:13px;color:#6b7280;">Plataforma: <strong>${plataforma}</strong>. Pruebe su <strong>audio y cámara</strong> con anticipación.</p>
      </td></tr>
    </table>`;
}

/**
 * Recordatorio de audiencia. La modalidad ramifica el cuerpo.
 * opts.bannerPruebaPara: si viene, antepone el banner [PRUEBA] (modo prueba).
 */
export function emailAudiencia(
  a: Audiencia,
  opts: { bannerPruebaPara?: string } = {},
): EmailTemplate {
  const empresa = a.cliente?.nombre ?? 'Cliente';
  const exp = a.expediente?.numero_expediente ?? '';
  const subject = `Recordatorio de audiencia · ${empresa}${exp ? ` · ${exp}` : ''}`;

  const datos = `
    <table width="100%" style="margin:8px 0 4px;">
      ${filaDato('Fecha y hora', escEmail(fechaLargaGT(a.fecha_hora_inicio)))}
      ${exp ? filaDato('Expediente', escEmail(exp)) : ''}
      ${a.tipo_audiencia ? filaDato('Tipo', escEmail(a.tipo_audiencia)) : ''}
      ${a.juzgado && (a.modalidad !== 'virtual') ? filaDato('Juzgado', escEmail(a.juzgado)) : ''}
    </table>`;

  let bloqueModalidad = '';
  if (a.modalidad === 'presencial') {
    bloqueModalidad = bloqueLugar(a);
  } else if (a.modalidad === 'virtual') {
    bloqueModalidad = bloqueConexion(a);
  } else {
    bloqueModalidad = `
      <p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Esta audiencia es <strong>híbrida</strong>: puede asistir de forma presencial o conectarse por el enlace.</p>
      ${bloqueLugar(a)}
      ${bloqueConexion(a)}`;
  }

  const instrucciones = a.instrucciones
    ? `<table width="100%" style="margin:8px 0;"><tr><td style="padding:12px 16px;background:#f9fafb;border-left:3px solid ${GOLD};border-radius:4px;">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#374151;">Indicaciones</p>
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap;">${escEmail(a.instrucciones)}</p>
      </td></tr></table>`
    : '';

  const content = `
    ${opts.bannerPruebaPara ? bannerPrueba(opts.bannerPruebaPara) : ''}
    <p style="margin:0 0 12px;font-size:16px;color:#111827;">Estimado/a <strong>${escEmail(empresa)}</strong>,</p>
    <p style="margin:0 0 4px;font-size:14px;color:#374151;line-height:1.6;">Le recordamos su próxima audiencia:</p>
    ${datos}
    ${bloqueModalidad}
    ${instrucciones}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="margin:0 0 4px;font-size:14px;color:#374151;">Puede agregar esta audiencia a su calendario:</p>
    ${botonCalendario(googleCalendarUrl(a))}
    <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">También adjuntamos un archivo <strong>.ics</strong> (Apple Calendar, Outlook). Ábralo para agregar la cita.</p>`;

  return { from: FROM_AUDIENCIAS, subject, html: wrapperAudiencia(content) };
}

function horaGT(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

/**
 * Recordatorio CORTO (2 horas antes). Directo: "su audiencia es hoy a las…".
 * Sin .ics ni botón de calendario (ya es hoy).
 */
export function emailAudienciaCorta(
  a: Audiencia,
  opts: { bannerPruebaPara?: string } = {},
): EmailTemplate {
  const empresa = a.cliente?.nombre ?? 'Cliente';
  const exp = a.expediente?.numero_expediente ?? '';
  const subject = `Su audiencia es hoy · ${empresa}${exp ? ` · ${exp}` : ''}`;

  let dondeLinea = '';
  if (a.modalidad === 'presencial') {
    const lugar = [a.juzgado, a.sala, a.ubicacion].filter(Boolean).map(escEmail).join(', ');
    dondeLinea = lugar ? `en <strong>${lugar}</strong>` : '';
  } else if (a.modalidad === 'virtual') {
    dondeLinea = a.enlace_virtual
      ? `de forma <strong>virtual</strong>`
      : `de forma <strong>virtual</strong>`;
  } else {
    const lugar = [a.juzgado, a.sala, a.ubicacion].filter(Boolean).map(escEmail).join(', ');
    dondeLinea = lugar ? `en <strong>${lugar}</strong> (o por el enlace)` : `de forma <strong>híbrida</strong>`;
  }

  const botonVirtual = (a.modalidad !== 'presencial' && a.enlace_virtual)
    ? `<table cellpadding="0" cellspacing="0"><tr><td style="padding:10px 0;">
        <a href="${escEmail(a.enlace_virtual)}" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">Unirse a la audiencia</a>
      </td></tr></table>`
    : '';

  const content = `
    ${opts.bannerPruebaPara ? bannerPrueba(opts.bannerPruebaPara) : ''}
    <p style="margin:0 0 12px;font-size:16px;color:#111827;">Estimado/a <strong>${escEmail(empresa)}</strong>,</p>
    <p style="margin:0 0 8px;font-size:18px;color:${NAVY};font-weight:700;">Su audiencia es <u>hoy a las ${escEmail(horaGT(a.fecha_hora_inicio))}</u>${dondeLinea ? ` ${dondeLinea}` : ''}.</p>
    ${exp ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;">Expediente: <strong>${escEmail(exp)}</strong></p>` : ''}
    ${botonVirtual}`;

  return { from: FROM_AUDIENCIAS, subject, html: wrapperAudiencia(content) };
}

/** Adjunto inline del logo (CID) para el header de los correos de audiencia. */
export function logoInlineAttachment(): {
  name: string; contentType: string; contentBytes: string; contentId: string; isInline: boolean;
} {
  return { name: 'logo.png', contentType: 'image/png', contentBytes: LOGO_AUDIENCIA_BASE64, contentId: LOGO_CID, isInline: true };
}
