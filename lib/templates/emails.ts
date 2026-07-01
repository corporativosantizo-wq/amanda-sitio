// ============================================================================
// lib/templates/emails.ts
// Email templates for citas, contabilidad, and shared infrastructure
// ============================================================================

import type { MailboxAlias } from '@/lib/services/outlook.service';
import { MODALIDAD_INFO, DIRECCION_OFICINA, type ModalidadCita } from '@/lib/types/citas';
import { LOGO_MARCA_CID } from '@/lib/assets/brand-logo';

// ── Paleta de marca (colores del logo) ──────────────────────────────────────
// Unificada con audiencias-emails.ts y el reporte de avance. El logo del header
// se embebe inline vía CID (lo adjunta sendMail al detectar `cid:logoMarca`).
const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';
const AZUL_CLARO = '#eef2f9'; // recuadros de info (en vez de teal/verde)
const AZUL_BORDE = '#c3cde4';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  from: MailboxAlias;
  subject: string;
  html: string;
}

// ── Bank Account Constants ──────────────────────────────────────────────────

const CUENTAS_BANCARIAS = [
  {
    banco: 'Banco Industrial',
    cuenta: '455-008846-4',
    titular: 'Invest & Jure-Advisor, S.A.',
  },
];

// ── Shared Infrastructure ───────────────────────────────────────────────────

// Wrapper de marca compartido: header blanco con el logo (CID inline), borde
// superior navy y l\u00ednea dorada; footer gris. El logo se adjunta en el env\u00edo.
export function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;border-top:4px solid ${NAVY};padding:28px 32px 22px;text-align:center;border-bottom:1px solid #eef0f4;">
            <img src="cid:${LOGO_MARCA_CID}" alt="Amanda Santizo \u2014 Despacho Jur\u00eddico" width="240" style="display:block;margin:0 auto;width:240px;max-width:70%;height:auto;">
            <div style="height:3px;width:64px;background:${GOLD};margin:16px auto 0;border-radius:2px;"></div>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Amanda Santizo \u2014 Despacho Jur\u00eddico \u2014 amandasantizo.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function formatearFechaGT(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-GT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

export function formatearHora(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Escapa texto controlado por el usuario antes de inlinearlo en HTML de email
// (defensa contra inyección de HTML; algunos valores provienen de la página
// pública /agendar sin autenticación).
export function escEmail(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Bot\u00f3n de marca: navy con borde inferior dorado (sin gradiente teal).
function botonMarca(label: string, href: string): string {
  return `
    <table><tr><td style="padding:16px 0;">
      <a href="${href}" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">
        ${label}
      </a>
    </td></tr></table>`;
}

function instruccionesPortal(): string {
  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border-left:3px solid ${NAVY};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${NAVY};">C\u00f3mo acceder:</p>
        <ol style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:1.8;">
          <li>Ingrese a <strong>amandasantizo.com/portal</strong></li>
          <li>Escriba su correo electr\u00f3nico y haga click en \u201cSolicitar acceso\u201d</li>
          <li>Revise su bandeja de entrada y haga click en el enlace de acceso</li>
          <li>En la secci\u00f3n <strong>\u201cDocumentos\u201d</strong> encontrar\u00e1 sus archivos disponibles para descarga</li>
        </ol>
      </td></tr>
    </table>`;
}

function teamsButton(link: string): string {
  return `
    <tr><td style="padding:16px 0;">
      <a href="${link}" style="display:inline-block;background:${NAVY};color:#fff;padding:12px 28px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:600;font-size:14px;">
        Unirse a la reuni\u00f3n
      </a>
    </td></tr>`;
}

function cuentasBancariasHTML(): string {
  return CUENTAS_BANCARIAS.map(
    (c) => `<p style="margin:4px 0;font-size:14px;"><strong>${c.banco}:</strong> ${c.cuenta}<br/>A nombre de: ${c.titular}</p>`
  ).join('');
}

// ── Cita Templates ──────────────────────────────────────────────────────────

// Resuelve la modalidad de una cita (default 'virtual' por compatibilidad).
function modalidadDeCita(cita: any): ModalidadCita {
  const m = cita.modalidad as ModalidadCita | undefined;
  return m && MODALIDAD_INFO[m] ? m : 'virtual';
}

// Botón "Unirse a Teams" (solo si hay link).
function teamsSeccionHTML(cita: any): string {
  if (!cita.teams_link) return '';
  return `
    <table width="100%" style="margin:16px 0;"><tr><td align="center" style="padding:8px 0;">
      <a href="${cita.teams_link}" style="display:inline-block;background:${NAVY};color:#fff;padding:14px 36px;border-radius:8px;border-bottom:3px solid ${GOLD};text-decoration:none;font-weight:700;font-size:15px;">
        Unirse a la reunión por Teams
      </a>
    </td></tr></table>`;
}

// Bloque con dirección de la oficina + documentos / requisitos de firma
// (modalidades presenciales: entrega y firma de documentos).
function oficinaSeccionHTML(cita: any): string {
  const modalidad = modalidadDeCita(cita);
  const esFirma = modalidad === 'firma_documentos';
  const docs = escEmail((cita.documentos_entrega ?? '').toString().trim());
  const lugarLabel = esFirma ? 'Lugar' : 'Dirección';

  const requisitosFirma = esFirma ? `
        <p style="margin:12px 0 4px;font-size:14px;"><strong>📋 Importante para la firma:</strong></p>
        <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7;">
          <li>Presentarse con DPI original vigente</li>
          <li>Si firma como representante legal, traer nombramiento vigente y DPI</li>
          <li>Si envía a un mandatario, debe presentar mandato con facultades suficientes y DPI del mandatario</li>
        </ul>` : '';

  return `
    <table width="100%" style="margin:16px 0;background:${AZUL_CLARO};border:1px solid ${AZUL_BORDE};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;"><strong>📍 ${lugarLabel}:</strong> ${DIRECCION_OFICINA}</p>
        ${docs && !esFirma ? `<p style="margin:8px 0 0;font-size:14px;"><strong>📋 Documentos:</strong> ${docs}</p>` : ''}
        ${requisitosFirma}
      </td></tr>
    </table>`;
}

export function emailConfirmacionCita(cita: any): EmailTemplate {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;
  const duracion = cita.duracion_minutos ? `${cita.duracion_minutos} minutos` : (cita.tipo === 'consulta_nueva' ? '60 minutos' : '15 minutos');
  const clienteNombre = cita.cliente?.nombre ?? '';

  // Modalidad \u2014 adapta la l\u00ednea, las secciones (Teams / oficina) y el cierre.
  const modalidad = modalidadDeCita(cita);
  const info = MODALIDAD_INFO[modalidad];
  const modalidadLabel = `${info.icono} ${info.label}`;

  const teamsSectionHTML = info.usaTeams ? teamsSeccionHTML(cita) : '';
  const oficinaSectionHTML = info.usaOficina ? oficinaSeccionHTML(cita) : '';

  let cierreModalidad: string;
  if (modalidad === 'entrega_documentos') {
    cierreModalidad = 'Le esperamos en nuestras oficinas para la entrega/recepci\u00f3n de su documentaci\u00f3n.';
  } else if (modalidad === 'firma_documentos') {
    cierreModalidad = 'Le esperamos en nuestras oficinas para la firma de su documentaci\u00f3n.';
  } else if (modalidad === 'virtual_y_entrega') {
    cierreModalidad = 'Recibir\u00e1 la invitaci\u00f3n de Teams en su calendario. La documentaci\u00f3n podr\u00e1 entregarla/recogerla en nuestra oficina.';
  } else {
    cierreModalidad = 'Tambi\u00e9n recibir\u00e1 la invitaci\u00f3n en su calendario.';
  }
  const cierreModalidadHTML = `<p style="margin:12px 0 0;color:#64748b;font-size:13px;">${cierreModalidad}</p>`;

  // Payment section for consulta_nueva
  let pagoSection = '';
  if (cita.tipo === 'consulta_nueva' && cita.costo > 0) {
    pagoSection = `
    <table width="100%" style="margin:16px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#92400e;">Costo: Q${Number(cita.costo).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p style="margin:0 0 12px;font-size:13px;color:#78350f;">Pago previo a la consulta. Puede realizar la transferencia a cualquiera de las siguientes cuentas:</p>
        ${CUENTAS_BANCARIAS.map((c) => `
          <p style="margin:4px 0;font-size:13px;color:#334155;">
            <strong>${c.banco}:</strong> ${c.cuenta}<br/>
            A nombre de: ${c.titular}
          </p>
        `).join('')}
        <p style="margin:8px 0 0;font-size:12px;color:#92400e;">Env\u00ede su comprobante de pago a <strong>contador@papeleo.legal</strong> antes de la cita.</p>
      </td></tr>
    </table>`;
  }

  const saludo = clienteNombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a <strong>${escEmail(clienteNombre)}</strong>,</p>` : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita Confirmada</h2>
    ${saludo}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita ha sido agendada exitosamente. A continuaci\u00f3n los detalles:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Duraci\u00f3n:</strong> ${duracion}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Modalidad:</strong> ${modalidadLabel}</p>
      </td></tr>
    </table>
    ${teamsSectionHTML}
    ${oficinaSectionHTML}
    ${cierreModalidadHTML}
    ${pagoSection}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si necesita cancelar o reprogramar, cont\u00e1ctenos con anticipaci\u00f3n.</p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Cita confirmada \u2014 ${tipo} \u2014 ${fechaFmt}`,
    html,
  };
}

export function emailRecordatorio24h(cita: any): EmailTemplate {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  const info = MODALIDAD_INFO[modalidadDeCita(cita)];
  const teamsBtn = info.usaTeams && cita.teams_link ? `<table>${teamsButton(cita.teams_link)}</table>` : '';
  const oficinaSec = info.usaOficina ? oficinaSeccionHTML(cita) : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Recordatorio: su cita es ma\u00f1ana</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le recordamos que tiene una cita programada para ma\u00f1ana.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Modalidad:</strong> ${info.icono} ${info.label}</p>
      </td></tr>
    </table>
    ${oficinaSec}
    ${teamsBtn}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Recordatorio: su cita es ma\u00f1ana \u2014 ${cita.titulo}`,
    html,
  };
}

// Recordatorio de AUDIENCIA judicial (un día antes). Va firmado por Magaly y
// menciona materia, expediente, diligencia y (si hay) juzgado.
export function emailRecordatorioAudiencia(cita: any): EmailTemplate {
  const fechaFmt = cita.fecha ? formatearFechaGT(cita.fecha) : '';
  const horaFmt = formatearHora(cita.hora_inicio);
  const materia = (cita.audiencia_materia ?? '').trim();
  const expediente = (cita.audiencia_expediente ?? '').trim();
  const diligencia = (cita.audiencia_diligencia ?? '').trim();
  const juzgado = (cita.audiencia_juzgado ?? '').trim();

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">⚖️ Recordatorio de Audiencia</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimados señores,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Reciban un cordial saludo de parte del Despacho Jurídico Amanda Santizo.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Les recordamos que tienen programada una audiencia judicial:</p>
    <table width="100%" style="margin:16px 0;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Hora:</strong> ${horaFmt}</p>
        ${materia ? `<p style="margin:8px 0;font-size:14px;"><strong>📋 Materia:</strong> ${escEmail(materia)}</p>` : ''}
        ${expediente ? `<p style="margin:8px 0;font-size:14px;"><strong>📂 Expediente/Juicio:</strong> ${escEmail(expediente)}</p>` : ''}
        ${diligencia ? `<p style="margin:8px 0;font-size:14px;"><strong>📝 Diligencia:</strong> ${escEmail(diligencia)}</p>` : ''}
        ${juzgado ? `<p style="margin:8px 0;font-size:14px;"><strong>🏛️ Juzgado:</strong> ${escEmail(juzgado)}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le recomendamos estar preparado y presente con la debida anticipación.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Quedamos atentos a cualquier consulta.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:20px;">
      Atentamente,<br/>
      <strong>Magaly Estrada</strong><br/>
      Asistente de Procesos<br/>
      Despacho Jurídico Amanda Santizo
    </p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Recordatorio de Audiencia — Expediente ${expediente || '(sin número)'}`,
    html,
  };
}

export function emailRecordatorio1h(cita: any): EmailTemplate {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  const info = MODALIDAD_INFO[modalidadDeCita(cita)];
  const teamsBtn = info.usaTeams && cita.teams_link ? `<table>${teamsButton(cita.teams_link)}</table>` : '';
  const oficinaSec = info.usaOficina ? oficinaSeccionHTML(cita) : '';
  const intro = info.usaOficina && !info.usaTeams
    ? 'Su cita est\u00e1 pr\u00f3xima. Le esperamos en nuestras oficinas.'
    : 'Su cita est\u00e1 por comenzar. Por favor prep\u00e1rese para conectarse.';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">\u00a1Su cita es en 1 hora!</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Modalidad:</strong> ${info.icono} ${info.label}</p>
      </td></tr>
    </table>
    ${oficinaSec}
    ${teamsBtn}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `\u00a1Su cita es en 1 hora! \u2014 ${cita.titulo}`,
    html,
  };
}

export function emailCancelacionCita(cita: any): EmailTemplate {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita Cancelada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita ha sido cancelada.</p>
    <table width="100%" style="margin:16px 0;background:#fef2f2;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si desea reagendar, no dude en contactarnos.</p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Cita cancelada \u2014 ${cita.titulo}`,
    html,
  };
}

// ── Solicitudes de entrega / firma de documentos ────────────────────────────
//
// Flujo: el cliente envía una solicitud con su fecha/hora preferida (la cita
// nace como estado='pendiente'). Amanda confirma esa fecha, propone otra, o la
// rechaza desde el panel admin. Estos correos van firmados por Magaly Estrada.

// 'firma' | 'entrega' según la modalidad de la cita.
function accionSolicitud(cita: any): 'firma' | 'entrega' {
  return modalidadDeCita(cita) === 'firma_documentos' ? 'firma' : 'entrega';
}

function firmaMagalyHTML(): string {
  return `
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:20px;">
      Atentamente,<br/>
      <strong>Magaly Estrada</strong> — Asistente de Procesos<br/>
      Despacho Jurídico Amanda Santizo
    </p>`;
}

// Mensaje personalizado opcional que Amanda escribe en el panel.
function mensajePersonalizadoHTML(mensaje?: string): string {
  const m = (mensaje ?? '').trim();
  if (!m) return '';
  return `<p style="color:#475569;font-size:14px;line-height:1.6;white-space:pre-line;">${escEmail(m)}</p>`;
}

// Cita CONFIRMADA por Amanda (con la fecha del cliente o una nueva).
export function emailSolicitudConfirmada(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'firma';
  const accionLabel = esFirma ? 'firma' : 'entrega';
  const nombre = cita.cliente?.nombre ?? '';
  const fechaFmt = cita.fecha ? formatearFechaGT(cita.fecha) : '';
  const horaFmt = formatearHora(cita.hora_inicio);

  const dpiAviso = esFirma
    ? `<p style="margin:8px 0;font-size:14px;color:#b45309;"><strong>⚠️ Presentarse con DPI original vigente.</strong></p>`
    : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita confirmada</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le confirmamos su cita de ${accionLabel} de documentos:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 Lugar:</strong> ${DIRECCION_OFICINA}</p>
        ${dpiAviso}
      </td></tr>
    </table>
    ${mensajePersonalizadoHTML(mensaje)}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si necesita reprogramar, contáctenos con anticipación.</p>
    ${firmaMagalyHTML()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Cita confirmada — ${esFirma ? 'Firma' : 'Entrega'} de documentos${fechaFmt ? ` — ${fechaFmt}` : ''}`,
    html,
  };
}

// Cita de firma CONFIRMADA con MÚLTIPLES firmantes. Cada firmante (contacto
// principal + cada parte adicional) recibe su propio correo dirigido a su
// nombre, mencionando a TODAS las partes con quienes va a firmar. `firmantes`
// es la lista completa de todos los que firman en la cita.
export function emailFirmaConfirmadaMultiple(
  cita: any,
  destinatarioNombre: string,
  firmantes: Array<{ nombre: string }>,
  mensaje?: string,
): EmailTemplate {
  const fechaFmt = cita.fecha ? formatearFechaGT(cita.fecha) : '';
  const horaFmt = formatearHora(cita.hora_inicio);

  const listaFirmantes = firmantes
    .filter((f) => (f.nombre ?? '').trim())
    .map((f) => `<li style="margin:4px 0;font-size:14px;color:#0f172a;">${escEmail(f.nombre)}</li>`)
    .join('');

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita confirmada</h2>
    ${destinatarioNombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a <strong>${escEmail(destinatarioNombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le confirmamos su cita para la firma de documentos:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 Lugar:</strong> ${DIRECCION_OFICINA}</p>
      </td></tr>
    </table>
    <div style="margin:16px 0;">
      <p style="margin:0 0 6px;font-size:14px;color:#475569;"><strong>👥 En esta firma participan:</strong></p>
      <ul style="margin:0;padding-left:20px;">${listaFirmantes}</ul>
    </div>
    <p style="margin:8px 0;font-size:14px;color:#b45309;"><strong>⚠️ Importante: Presentarse con DPI original vigente.</strong></p>
    ${mensajePersonalizadoHTML(mensaje)}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si necesita reprogramar, contáctenos con anticipación.</p>
    ${firmaMagalyHTML()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Cita confirmada — Firma de documentos${fechaFmt ? ` — ${fechaFmt}` : ''}`,
    html,
  };
}

// Amanda PROPONE otra fecha (la cita sigue como pendiente hasta que el cliente
// confirme). `cita.fecha`/`hora_inicio` son la nueva propuesta; `fecha_solicitada`
// es la que el cliente había pedido originalmente.
export function emailSolicitudPropuestaFecha(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'firma';
  const accionLabel = esFirma ? 'firma' : 'entrega';
  const nombre = cita.cliente?.nombre ?? '';
  const solicitadaFmt = cita.fecha_solicitada ? formatearFechaGT(cita.fecha_solicitada) : 'la fecha solicitada';
  const nuevaFechaFmt = cita.fecha ? formatearFechaGT(cita.fecha) : '';
  const nuevaHoraFmt = formatearHora(cita.hora_inicio);

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Propuesta de nueva fecha</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Gracias por su solicitud de ${accionLabel} de documentos.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Lamentablemente la fecha que seleccionó (<strong>${solicitadaFmt}</strong>) no se encuentra disponible.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">La fecha disponible que tenemos es:</p>
    <table width="100%" style="margin:16px 0;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 ${nuevaFechaFmt}</strong></p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 ${nuevaHoraFmt}</strong></p>
        <p style="margin:8px 0;font-size:14px;"><strong>📍 ${DIRECCION_OFICINA}</strong></p>
      </td></tr>
    </table>
    ${mensajePersonalizadoHTML(mensaje)}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Por favor confírmenos si esta fecha le conviene respondiendo a este correo.</p>
    ${firmaMagalyHTML()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Nueva fecha para su ${esFirma ? 'firma' : 'entrega'} de documentos`,
    html,
  };
}

// Amanda RECHAZA la solicitud (mensaje por defecto = documentos en preparación).
export function emailSolicitudRechazada(cita: any, mensaje?: string): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'firma';
  const nombre = cita.cliente?.nombre ?? '';
  const cuerpo = (mensaje ?? '').trim()
    || 'Sus documentos se encuentran en preparación. Le contactaremos cuando estén listos.';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Sobre su solicitud</h2>
    ${nombre ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a <strong>${escEmail(nombre)}</strong>,</p>` : ''}
    <p style="color:#475569;font-size:14px;line-height:1.6;white-space:pre-line;">${escEmail(cuerpo)}</p>
    ${firmaMagalyHTML()}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Sobre su solicitud de ${esFirma ? 'firma' : 'entrega'} de documentos`,
    html,
  };
}

// Aviso INTERNO al despacho (amanda@ + asistente@) de una nueva solicitud.
export function emailNuevaSolicitudInterno(cita: any): EmailTemplate {
  const accion = accionSolicitud(cita);
  const esFirma = accion === 'firma';
  const nombre = cita.cliente?.nombre ?? 'Cliente';
  const email = cita.cliente?.email ?? '';
  const fechaFmt = cita.fecha_solicitada ? formatearFechaGT(cita.fecha_solicitada) : (cita.fecha ? formatearFechaGT(cita.fecha) : '—');
  const horaFmt = cita.hora_solicitada ? formatearHora(cita.hora_solicitada) : (cita.hora_inicio ? formatearHora(cita.hora_inicio) : '—');
  const comentarios = (cita.comentarios_cliente ?? '').trim();

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">📋 Nueva solicitud de ${esFirma ? 'firma' : 'entrega'} de documentos</h2>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Cliente:</strong> ${escEmail(nombre)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Email:</strong> ${escEmail(email)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha solicitada:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora solicitada:</strong> ${horaFmt}</p>
        ${comentarios ? `<p style="margin:8px 0;font-size:14px;"><strong>Comentarios:</strong> ${escEmail(comentarios)}</p>` : ''}
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Pendiente de confirmar fecha desde el panel:</p>
    ${botonMarca('Ir al calendario', 'https://amandasantizo.com/admin/calendario')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `📋 Nueva solicitud de ${esFirma ? 'firma' : 'entrega'} — ${nombre}`,
    html,
  };
}

// ── Llamadas programadas ────────────────────────────────────────────────────

// Confirmación al cliente de una llamada agendada (from asistente@, CC amanda@ +
// los CC indicados — el CC se agrega al enviar, no aquí).
export function emailConfirmacionLlamada(params: {
  nombre: string;
  fecha: string;
  hora: string;
  duracion: number;
  asunto: string;
  telefono?: string | null;
}): EmailTemplate {
  const fechaFmt = formatearFechaGT(params.fecha);
  const horaFmt = formatearHora(params.hora);
  const tel = (params.telefono ?? '').trim();

  const html = emailWrapper(`
    <p style="color:#475569;font-size:15px;line-height:1.6;">Estimado/a <strong>${escEmail(params.nombre)}</strong>, 👋</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">¡Esperamos que se encuentre muy bien! 🌟</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le confirmamos que se ha agendado una llamada telefónica con la <strong>Licda. Amanda Santizo</strong>:</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:#0f172a;">📞 Llamada programada</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📅 Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>⏱️ Duración estimada:</strong> ${params.duracion} minutos</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📌 Asunto:</strong> ${escEmail(params.asunto)}</p>
      </td></tr>
    </table>
    ${tel ? `<p style="color:#475569;font-size:14px;line-height:1.6;">Por favor asegúrese de estar disponible en el número <strong>${escEmail(tel)}</strong> a la hora indicada.</p>` : `<p style="color:#475569;font-size:14px;line-height:1.6;">Por favor asegúrese de estar disponible a la hora indicada.</p>`}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Si necesita reprogramar, responda a este correo. 📩</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">¡Que tenga un excelente día! ☀️</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:20px;">
      Atentamente,<br/>
      <strong>Magaly Estrada</strong> ✨<br/>
      Asistente de Procesos<br/>
      Despacho Jurídico Amanda Santizo
    </p>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `📞 Llamada agendada — ${fechaFmt} a las ${horaFmt}`,
    html,
  };
}

// Recordatorio al cliente el día de la llamada.
export function emailRecordatorioLlamadaCliente(params: {
  nombre: string;
  hora: string;
  asunto: string;
}): EmailTemplate {
  const horaFmt = formatearHora(params.hora);
  const html = emailWrapper(`
    <p style="color:#475569;font-size:15px;line-height:1.6;">👋 Estimado/a <strong>${escEmail(params.nombre)}</strong>,</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le recordamos su llamada <strong>hoy</strong> con la Licda. Amanda Santizo.</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>📞 Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📌 Asunto:</strong> ${escEmail(params.asunto)}</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">¡Que tenga un excelente día! ☀️</p>
  `);
  return {
    from: 'asistente@papeleo.legal',
    subject: `📞 Recordatorio: su llamada es hoy a las ${horaFmt}`,
    html,
  };
}

// Recordatorio interno a Amanda (email) el día de la llamada.
export function emailRecordatorioLlamadaInterno(params: {
  nombre: string;
  hora: string;
  asunto: string;
  telefono?: string | null;
}): EmailTemplate {
  const horaFmt = formatearHora(params.hora);
  const tel = (params.telefono ?? '').trim() || '—';
  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">📞 Llamada hoy</h2>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Contacto:</strong> ${escEmail(params.nombre)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>🕐 Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📌 Asunto:</strong> ${escEmail(params.asunto)}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>📱 Tel:</strong> ${escEmail(tel)}</p>
      </td></tr>
    </table>
  `);
  return {
    from: 'asistente@papeleo.legal',
    subject: `📞 Llamada hoy: ${params.nombre} — ${horaFmt}`,
    html,
  };
}

// ── Contador Templates ──────────────────────────────────────────────────────

export function emailSolicitudPago(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  fechaLimite?: string;
  numeroCotizacion?: string;
}): EmailTemplate {
  const montoFmt = `Q${params.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  const subjectRef = params.numeroCotizacion
    ? `Cotización ${params.numeroCotizacion}`
    : (params.concepto?.trim() ? params.concepto : 'Cotización pendiente');

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Recordatorio de pago pendiente</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre},</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">En nuestros registros figura como pendiente de cancelación el siguiente monto correspondiente a los servicios prestados. Le hacemos llegar este recordatorio con los datos para que pueda realizar el pago a su conveniencia.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Concepto:</strong> ${params.concepto}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Monto:</strong> ${montoFmt}</p>
      </td></tr>
    </table>
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Cuentas para depósito:</p>
        <p style="margin:4px 0;font-size:14px;"><strong>Banco Industrial:</strong> 455-008846-4<br/>A nombre de: Invest &amp; Jure-Advisor, S.A.</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Una vez realizado el pago, le agradecemos enviar el comprobante a este mismo correo para confirmar la recepción y proceder con el cierre del expediente correspondiente.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Si ya realizó el pago, por favor desestime este mensaje.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Quedamos atentos a cualquier consulta.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin-top:16px;">Cordialmente,<br/><strong>Amanda Santizo</strong> — Despacho Jurídico<br/><a href="https://amandasantizo.com" style="color:#1e2a5a;text-decoration:none;">amandasantizo.com</a></p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Recordatorio de pago pendiente — ${subjectRef}`,
    html,
  };
}

export function emailPagoRecibido(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  fechaPago: string;
}): EmailTemplate {
  const montoFmt = `Q${params.monto.toLocaleString('es-GT')}`;

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Pago Recibido</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, confirmamos la recepci\u00f3n de su pago.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Concepto:</strong> ${params.concepto}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Monto:</strong> ${montoFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha de pago:</strong> ${formatearFechaGT(params.fechaPago)}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Gracias por su pago.</p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Pago recibido \u2014 ${params.concepto} \u2014 ${montoFmt}`,
    html,
  };
}

// ── Wrapper especializado para cotizaciones (paleta blue/slate) ──────────────

// Mismo dise\u00f1o de marca que emailWrapper (header blanco + logo inline CID +
// borde navy y l\u00ednea dorada), a 640px para que la tabla de servicios respire.
// logoBase64 se conserva por compatibilidad de firma; el logo va inline por CID.
function emailCotizacionWrapper(content: string, _logoBase64?: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr>
          <td style="background:#ffffff;border-top:4px solid ${NAVY};padding:28px 32px 22px;text-align:center;border-bottom:1px solid #eef0f4;">
            <img src="cid:${LOGO_MARCA_CID}" alt="Amanda Santizo — Despacho Jurídico" width="240" style="display:block;margin:0 auto;width:240px;max-width:70%;height:auto;">
            <div style="height:3px;width:64px;background:${GOLD};margin:16px auto 0;border-radius:2px;"></div>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#F8FAFC;border-top:1px solid #CBD5E1;text-align:center;">
            <p style="margin:0;color:#94A3B8;font-size:12px;">Amanda Santizo \u2014 Despacho Jur\u00eddico \u2014 Ciudad de Guatemala</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function emailCotizacion(params: {
  clienteNombre: string;
  servicios: { descripcion: string; monto: number }[];
  subtotal?: number;
  iva?: number;
  total?: number;
  anticipo?: number;
  vigencia?: string;
  numeroCotizacion?: string;
  fechaEmision?: string;
  anticipoPorcentaje?: number;
  condiciones?: string;
  notas_cliente?: string;
  logoBase64?: string;
  configuracion?: Record<string, any>;
  tokenRespuesta?: string;
}): EmailTemplate {
  const subtotalCalc = params.subtotal ?? params.servicios.reduce((sum, s) => sum + s.monto, 0);
  const ivaCalc = params.iva ?? subtotalCalc * 0.12;
  const totalCalc = params.total ?? subtotalCalc + ivaCalc;
  const anticipoCalc = params.anticipo ?? 0;
  const antPct = params.anticipoPorcentaje ?? 60;

  const fmtQ = (n: number) => `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Header info (cotizacion number + date)
  let headerInfo = '';
  if (params.numeroCotizacion || params.fechaEmision) {
    const numHtml = params.numeroCotizacion ? `<span style="display:inline-block;background:#eef2f9;color:#1e2a5a;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:600;">${params.numeroCotizacion}</span>` : '';
    const fechaHtml = params.fechaEmision ? `<span style="font-size:12px;color:#94A3B8;margin-left:8px;">${formatearFechaGT(params.fechaEmision)}</span>` : '';
    headerInfo = `<p style="margin:0 0 16px;text-align:right;">${numHtml}${fechaHtml}</p>`;
  }

  // Validity badge
  const badgeHtml = `<p style="margin:16px 0;"><span style="display:inline-block;background:#eef2f9;color:#1e2a5a;padding:4px 14px;border-radius:4px;font-size:12px;font-weight:600;">V\u00e1lida por 30 d\u00edas</span></p>`;

  // Services table — 4 columns
  const filasServicios = params.servicios
    .map(
      (s, i) =>
        `<tr style="background:${i % 2 === 0 ? '#F8FAFC' : '#ffffff'};">
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#64748B;text-align:center;width:36px;">${i + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#334155;">${s.descripcion}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#334155;text-align:right;width:50px;">1</td>
          <td style="padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:13px;color:#0F172A;text-align:right;width:110px;">${fmtQ(s.monto)}</td>
        </tr>`
    )
    .join('');

  // Anticipo row
  const anticipoRow = anticipoCalc > 0
    ? `<tr>
        <td style="padding:8px 12px;font-size:13px;color:#1e2a5a;">Anticipo (${antPct}%)</td>
        <td style="padding:8px 12px;font-size:13px;color:#1e2a5a;font-weight:600;text-align:right;">${fmtQ(anticipoCalc)}</td>
      </tr>`
    : '';

  // Conditions box
  let conditionsHtml = '';
  if (params.condiciones) {
    const condLines = params.condiciones.split('\n').map(l => l.trim()).filter(Boolean);
    const condContent = condLines.map(l => `<p style="margin:4px 0;font-size:13px;color:#334155;line-height:1.5;">${l}</p>`).join('');
    conditionsHtml = `
    <table width="100%" style="margin:20px 0;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#eef2f9;border-left:3px solid #1e2a5a;padding:16px 18px;border-radius:0 6px 6px 0;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#1e2a5a;text-transform:uppercase;letter-spacing:0.5px;">Condiciones de pago</p>
          ${condContent}
        </td>
      </tr>
    </table>`;
  }

  // Bank info box
  const banco = params.configuracion?.banco ?? 'Banco Industrial';
  const cuenta = params.configuracion?.numero_cuenta ?? '455-008846-4';
  const titularCuenta = params.configuracion?.cuenta_nombre ?? 'Invest & Jure-Advisor, S.A.';
  const emailCont = params.configuracion?.email_contador ?? 'contador@papeleo.legal';

  const bankHtml = `
    <table width="100%" style="margin:16px 0;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border:1px solid #CBD5E1;padding:16px 18px;border-radius:6px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#0F172A;text-transform:uppercase;letter-spacing:0.5px;">\uD83C\uDFE6 Datos bancarios</p>
          <p style="margin:4px 0;font-size:13px;color:#334155;"><strong>${banco}</strong> \u2014 Cuenta No. ${cuenta}</p>
          <p style="margin:4px 0;font-size:13px;color:#64748B;">A nombre de: ${titularCuenta}</p>
          <p style="margin:4px 0;font-size:13px;color:#64748B;">Enviar comprobante a: ${emailCont}</p>
        </td>
      </tr>
    </table>`;

  const html = emailCotizacionWrapper(`
    ${headerInfo}
    <h2 style="margin:0 0 8px;color:#0F172A;font-size:20px;font-weight:700;">Cotizaci\u00f3n de Servicios</h2>
    <p style="color:#334155;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, adjuntamos la cotizaci\u00f3n solicitada.</p>
    ${badgeHtml}
    <table width="100%" style="margin:16px 0;border-collapse:collapse;">
      <thead>
        <tr style="background:#F8FAFC;">
          <th style="padding:10px 8px;text-align:center;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:36px;">No.</th>
          <th style="padding:10px 8px;text-align:left;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;">Servicio</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:50px;">Cant.</th>
          <th style="padding:10px 8px;text-align:right;font-size:11px;color:#64748B;font-weight:600;border-bottom:1px solid #F1F5F9;width:110px;">Total (Q)</th>
        </tr>
      </thead>
      <tbody>
        ${filasServicios}
      </tbody>
    </table>
    <table width="100%" style="margin:8px 0;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#64748B;">Subtotal</td>
        <td style="padding:8px 12px;font-size:13px;color:#334155;text-align:right;">${fmtQ(subtotalCalc)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#64748B;">IVA (12%)</td>
        <td style="padding:8px 12px;font-size:13px;color:#334155;text-align:right;">${fmtQ(ivaCalc)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:0 12px;"><hr style="border:none;border-top:1px solid #CBD5E1;margin:4px 0;" /></td>
      </tr>
      <tr>
        <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#0F172A;">TOTAL</td>
        <td style="padding:10px 12px;font-size:16px;font-weight:700;color:#0F172A;text-align:right;">${fmtQ(totalCalc)}</td>
      </tr>
      ${anticipoRow}
    </table>
    ${params.notas_cliente ? `
    <table width="100%" style="margin:20px 0;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:#FFFBEB;border-left:4px solid #F59E0B;padding:16px 18px;border-radius:0 6px 6px 0;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#92400E;text-transform:uppercase;letter-spacing:0.5px;">⚠️ Nota importante</p>
          <p style="margin:0;font-size:13px;color:#92400E;line-height:1.5;font-weight:600;">${params.notas_cliente.replace(/\n/g, '<br>')}</p>
        </td>
      </tr>
    </table>` : ''}
    ${params.tokenRespuesta ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center">
        <p style="font-size:14px;color:#64748B;margin:0 0 16px;">¿Desea proceder con los servicios cotizados?</p>
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="padding:0 6px;">
            <a href="https://amandasantizo.com/cotizacion/respuesta?token=${params.tokenRespuesta}&accion=aceptar"
               style="display:inline-block;background-color:#1e2a5a;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;border-bottom:3px solid #c2a05a;font-weight:bold;font-size:15px;">
              ✓ Aceptar Cotización
            </a>
          </td>
          <td style="padding:0 6px;">
            <a href="https://amandasantizo.com/cotizacion/respuesta?token=${params.tokenRespuesta}&accion=dudas"
               style="display:inline-block;background-color:#ffffff;color:#1e2a5a;padding:13px 31px;text-decoration:none;border-radius:8px;border:1px solid #1e2a5a;font-weight:bold;font-size:15px;">
              ? Tengo Dudas
            </a>
          </td>
        </tr></table>
        <p style="font-size:11px;color:#94A3B8;margin:12px 0 0;">También puede responder directamente a este correo.</p>
      </td></tr>
    </table>` : ''}
    ${conditionsHtml}
    ${bankHtml}
  `, params.logoBase64);

  return {
    from: 'contador@papeleo.legal',
    subject: params.numeroCotizacion
      ? `Cotizaci\u00f3n ${params.numeroCotizacion} \u2014 ${fmtQ(totalCalc)}`
      : `Cotizaci\u00f3n \u2014 ${fmtQ(totalCalc)}`,
    html,
  };
}

export function emailEstadoCuenta(params: {
  clienteNombre: string;
  movimientos: { fecha: string; concepto: string; cargo: number; abono: number }[];
  saldo: number;
}): EmailTemplate {
  const saldoFmt = `Q${params.saldo.toLocaleString('es-GT')}`;

  const filasMovimientos = params.movimientos
    .map(
      (m) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.fecha}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;">${m.concepto}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.cargo > 0 ? `Q${m.cargo.toLocaleString('es-GT')}` : '-'}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:right;">${m.abono > 0 ? `Q${m.abono.toLocaleString('es-GT')}` : '-'}</td>
        </tr>`
    )
    .join('');

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Estado de Cuenta</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, a continuaci\u00f3n su estado de cuenta.</p>
    <table width="100%" style="margin:16px 0;border-collapse:collapse;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Fecha</th>
          <th style="padding:8px 10px;text-align:left;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Concepto</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Cargo</th>
          <th style="padding:8px 10px;text-align:right;font-size:12px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Abono</th>
        </tr>
      </thead>
      <tbody>
        ${filasMovimientos}
      </tbody>
    </table>
    <table width="100%" style="margin:16px 0;background:${params.saldo > 0 ? '#fef2f2' : '#eef2f9'};border-radius:8px;padding:16px;">
      <tr><td style="text-align:right;">
        <p style="margin:0;font-size:16px;font-weight:700;">Saldo: ${saldoFmt}</p>
      </td></tr>
    </table>
    ${params.saldo > 0 ? `
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Cuentas para dep\u00f3sito:</p>
        ${cuentasBancariasHTML()}
      </td></tr>
    </table>` : ''}
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Estado de cuenta \u2014 Saldo: ${saldoFmt}`,
    html,
  };
}

export function emailFactura(params: {
  clienteNombre: string;
  nit: string;
  numero: string;
  conceptos: { descripcion: string; monto: number }[];
  total: number;
}): EmailTemplate {
  const totalFmt = `Q${params.total.toLocaleString('es-GT')}`;

  const filasConceptos = params.conceptos
    .map(
      (c) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${c.descripcion}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">Q${c.monto.toLocaleString('es-GT')}</td>
        </tr>`
    )
    .join('');

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Factura ${params.numero}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, adjuntamos su factura.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:4px 0;font-size:14px;"><strong>No. Factura:</strong> ${params.numero}</p>
        <p style="margin:4px 0;font-size:14px;"><strong>NIT:</strong> ${params.nit}</p>
      </td></tr>
    </table>
    <table width="100%" style="margin:16px 0;border-collapse:collapse;border:1px solid #e5e7eb;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Concepto</th>
          <th style="padding:10px 12px;text-align:right;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${filasConceptos}
        <tr style="background:#eef2f9;">
          <td style="padding:10px 12px;font-size:14px;font-weight:700;">Total</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:700;text-align:right;">${totalFmt}</td>
        </tr>
      </tbody>
    </table>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Factura ${params.numero} \u2014 ${totalFmt}`,
    html,
  };
}

// ── Asistente Templates ─────────────────────────────────────────────────────

export function emailDocumentosDisponibles(params: {
  clienteNombre: string;
}): EmailTemplate {
  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Sus documentos est\u00e1n disponibles</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, las copias solicitadas de su expediente ya est\u00e1n disponibles en su portal de cliente.</p>
    ${instruccionesPortal()}
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Sus documentos estar\u00e1n disponibles por 30 d\u00edas. Si necesita acceso posterior, sol\u00edcitelo a este correo.</p>
    ${botonMarca('Ir al portal de cliente', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Sus documentos est\u00e1n disponibles \u2014 Amanda Santizo \u2014 Despacho Jur\u00eddico',
    html,
  };
}

export function emailActualizacionExpediente(params: {
  clienteNombre: string;
  expediente: string;
  novedad: string;
}): EmailTemplate {
  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Actualizaci\u00f3n de su caso</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, le informamos sobre una novedad en su expediente.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Expediente:</strong> ${params.expediente}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Novedad:</strong> ${params.novedad}</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Si tiene consultas sobre esta actualizaci\u00f3n, puede responder a este correo o agendar un seguimiento.</p>
    ${botonMarca('Agendar seguimiento', 'https://amandasantizo.com/agendar')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Actualizaci\u00f3n de su caso \u2014 Amanda Santizo \u2014 Despacho Jur\u00eddico',
    html,
  };
}

export function emailBienvenidaCliente(params: {
  clienteNombre: string;
}): EmailTemplate {
  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Bienvenido/a</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, gracias por confiar en nuestro despacho para su asunto legal.</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Hemos creado su portal de cliente donde podr\u00e1 consultar el estado de su caso, descargar documentos y comunicarse con nosotros.</p>
    ${instruccionesPortal()}
    <table width="100%" style="margin:16px 0;background:#f9fafb;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;">Datos de contacto</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">Correo: asistente@papeleo.legal</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">Web: amandasantizo.com</p>
      </td></tr>
    </table>
    ${botonMarca('Acceder al portal', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Bienvenido/a \u2014 Amanda Santizo \u2014 Despacho Jur\u00eddico',
    html,
  };
}

export function emailSolicitudDocumentos(params: {
  clienteNombre: string;
  documentos: string[];
  plazo?: string;
}): EmailTemplate {
  const listaDocumentos = params.documentos
    .map((d: string) => `<li style="margin:4px 0;font-size:14px;">${d}</li>`)
    .join('');

  const plazoLine = params.plazo
    ? `<p style="color:#475569;font-size:14px;line-height:1.6;"><strong>Plazo sugerido:</strong> ${params.plazo}</p>`
    : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Documentos requeridos para su caso</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, para continuar con su tr\u00e1mite necesitamos que nos haga llegar la siguiente documentaci\u00f3n:</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <ul style="margin:0;padding-left:20px;color:#475569;">
          ${listaDocumentos}
        </ul>
      </td></tr>
    </table>
    ${plazoLine}
    <p style="color:#475569;font-size:14px;line-height:1.6;">Puede enviarlos respondiendo a este correo o subi\u00e9ndolos directamente en su portal de cliente.</p>
    ${botonMarca('Ir al portal', 'https://amandasantizo.com/portal')}
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: 'Documentos requeridos para su caso \u2014 Amanda Santizo \u2014 Despacho Jur\u00eddico',
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
  const fechaFmt = formatearFechaGT(params.fecha);
  const horaFmt = formatearHora(params.hora);
  const presencia = params.presenciaRequerida ? 'Su presencia es requerida' : 'Su presencia no es requerida';
  const presenciaBg = params.presenciaRequerida ? '#fef2f2' : '#eef2f9';

  let direccionLine = '';
  if (params.direccion) {
    direccionLine = `<p style="margin:8px 0;font-size:14px;"><strong>Direcci\u00f3n:</strong> ${params.direccion}</p>`;
  }

  let instruccionesSection = '';
  if (params.presenciaRequerida && params.instrucciones) {
    instruccionesSection = `
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;">Instrucciones:</p>
        <p style="margin:4px 0;font-size:14px;color:#475569;">${params.instrucciones}</p>
      </td></tr>
    </table>`;
  }

  let documentosSection = '';
  if (params.documentosLlevar && params.documentosLlevar.length > 0) {
    const lista = params.documentosLlevar
      .map((d: string) => `<li style="margin:4px 0;font-size:14px;">${d}</li>`)
      .join('');
    documentosSection = `
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Documentos que debe llevar:</p>
        <ul style="margin:0;padding-left:20px;color:#475569;">
          ${lista}
        </ul>
      </td></tr>
    </table>`;
  }

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Aviso importante: audiencia programada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, le informamos sobre una audiencia programada en su caso.</p>
    <table width="100%" style="margin:16px 0;background:#eef2f9;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Juzgado/Tribunal:</strong> ${params.juzgado}</p>
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
    subject: 'Aviso importante: audiencia programada \u2014 Amanda Santizo \u2014 Despacho Jur\u00eddico',
    html,
  };
}

// ── Recordatorios de Cobro (desde contador@) ────────────────────────────────

export function emailRecordatorioCobro(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  saldoPendiente: number;
  fechaVencimiento?: string;
  tipo: 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | 'urgente';
  numeroCobro: number;
}): EmailTemplate {
  const montoFmt = `Q${params.saldoPendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  const vencimiento = params.fechaVencimiento ? formatearFechaGT(params.fechaVencimiento) : 'por confirmar';

  let titulo: string;
  let intro: string;
  let tono: string;

  switch (params.tipo) {
    case 'primer_aviso':
      titulo = 'Recordatorio de pago';
      intro = `Le recordamos amablemente que tiene un saldo pendiente por el concepto indicado a continuaci\u00f3n.`;
      tono = 'Agradecemos su pronta atenci\u00f3n.';
      break;
    case 'segundo_aviso':
      titulo = 'Segundo aviso de pago';
      intro = `Le notificamos por segunda vez que a\u00fan se encuentra pendiente el siguiente pago. Le solicitamos regularizar su situaci\u00f3n a la brevedad.`;
      tono = 'Su pago oportuno nos permite continuar brind\u00e1ndole un servicio de calidad.';
      break;
    case 'tercer_aviso':
    case 'urgente':
      titulo = 'Aviso de pago vencido';
      intro = `Le comunicamos que el siguiente cobro se encuentra <strong>vencido</strong>. Le instamos a realizar el pago de forma inmediata para evitar acciones adicionales.`;
      tono = 'De no recibir su pago en los pr\u00f3ximos d\u00edas, nos veremos en la necesidad de tomar medidas correspondientes.';
      break;
  }

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${titulo}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre},</p>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${intro}</p>
    <table width="100%" style="margin:16px 0;background:${params.tipo === 'tercer_aviso' || params.tipo === 'urgente' ? '#fef2f2' : '#eef2f9'};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Cobro:</strong> COB-${String(params.numeroCobro).padStart(3, '0')}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Concepto:</strong> ${params.concepto}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Saldo pendiente:</strong> <span style="font-size:18px;font-weight:700;color:#0f172a;">${montoFmt}</span></p>
        <p style="margin:8px 0;font-size:14px;"><strong>Vencimiento:</strong> ${vencimiento}</p>
      </td></tr>
    </table>
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Cuentas para dep\u00f3sito:</p>
        ${cuentasBancariasHTML()}
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${tono}</p>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Por favor env\u00ede comprobante de pago a este correo.</p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `${titulo} \u2014 COB-${String(params.numeroCobro).padStart(3, '0')} \u2014 ${montoFmt}`,
    html,
  };
}
