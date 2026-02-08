// ============================================================================
// lib/templates/emails.ts
// Email templates for citas, contabilidad, and shared infrastructure
// ============================================================================

import type { MailboxAlias } from '@/lib/services/outlook.service';

// ── Types ───────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  from: MailboxAlias;
  subject: string;
  html: string;
}

// ── Bank Account Constants ──────────────────────────────────────────────────

const CUENTAS_BANCARIAS = [
  {
    banco: 'Banco G&T Continental',
    cuenta: '024-0024518-5',
    titular: 'Invest & Jure-Advisor, S.A.',
  },
  {
    banco: 'Banco Industrial',
    cuenta: '455-008846-4',
    titular: 'Invest & Jure-Advisor, S.A.',
  },
];

// ── Shared Infrastructure ───────────────────────────────────────────────────

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
          <td style="background:linear-gradient(135deg,#0d9488,#06b6d4);padding:24px 32px;text-align:center;">
            <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px;">AS</span>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Amanda Santizo \u2014 Despacho Jur\u00eddico</p>
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

function tealButton(label: string, href: string): string {
  return `
    <table><tr><td style="padding:16px 0;">
      <a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        ${label}
      </a>
    </td></tr></table>`;
}

function instruccionesPortal(): string {
  return `
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">C\u00f3mo acceder:</p>
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
      <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
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

export function emailConfirmacionCita(cita: any): EmailTemplate {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  let teamsBtn = '';
  if (cita.teams_link) {
    teamsBtn = teamsButton(cita.teams_link);
  }

  let costoSection = '';
  if (cita.costo > 0) {
    costoSection = `<p style="margin:8px 0;font-size:14px;"><strong>Costo:</strong> Q${Number(cita.costo).toLocaleString('es-GT')}</p>`;
  }

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita Confirmada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita ha sido agendada exitosamente.</p>
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        ${costoSection}
      </td></tr>
    </table>
    <table>${teamsBtn}</table>
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

  let teamsBtn = '';
  if (cita.teams_link) {
    teamsBtn = teamsButton(cita.teams_link);
  }

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Recordatorio: su cita es ma\u00f1ana</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Le recordamos que tiene una cita programada para ma\u00f1ana.</p>
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <table>${teamsBtn}</table>
  `);

  return {
    from: 'asistente@papeleo.legal',
    subject: `Recordatorio: su cita es ma\u00f1ana \u2014 ${cita.titulo}`,
    html,
  };
}

export function emailRecordatorio1h(cita: any): EmailTemplate {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  let teamsBtn = '';
  if (cita.teams_link) {
    teamsBtn = teamsButton(cita.teams_link);
  }

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">\u00a1Su cita es en 1 hora!</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita est\u00e1 por comenzar. Por favor prep\u00e1rese para conectarse.</p>
    <table width="100%" style="margin:16px 0;background:#fef3c7;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <table>${teamsBtn}</table>
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

// ── Contador Templates ──────────────────────────────────────────────────────

export function emailSolicitudPago(params: {
  clienteNombre: string;
  concepto: string;
  monto: number;
  fechaLimite?: string;
}): EmailTemplate {
  const montoFmt = `Q${params.monto.toLocaleString('es-GT')}`;
  const fechaLimite = params.fechaLimite ? `<p style="margin:8px 0;font-size:14px;"><strong>Fecha l\u00edmite:</strong> ${formatearFechaGT(params.fechaLimite)}</p>` : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Solicitud de Pago</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, le enviamos los detalles para realizar su pago.</p>
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Concepto:</strong> ${params.concepto}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Monto:</strong> ${montoFmt}</p>
        ${fechaLimite}
      </td></tr>
    </table>
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Cuentas para dep\u00f3sito:</p>
        ${cuentasBancariasHTML()}
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Por favor env\u00ede comprobante de pago a este correo.</p>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Solicitud de pago \u2014 ${params.concepto} \u2014 ${montoFmt}`,
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
    <table width="100%" style="margin:16px 0;background:#f0fdf4;border-radius:8px;padding:16px;">
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

export function emailCotizacion(params: {
  clienteNombre: string;
  servicios: { descripcion: string; monto: number }[];
  vigencia?: string;
}): EmailTemplate {
  const total = params.servicios.reduce((sum: number, s: { descripcion: string; monto: number }) => sum + s.monto, 0);
  const totalFmt = `Q${total.toLocaleString('es-GT')}`;

  const filasServicios = params.servicios
    .map(
      (s) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;">${s.descripcion}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;text-align:right;">Q${s.monto.toLocaleString('es-GT')}</td>
        </tr>`
    )
    .join('');

  const vigenciaLine = params.vigencia
    ? `<p style="color:#64748b;font-size:13px;margin-top:8px;">Esta cotizaci\u00f3n es v\u00e1lida hasta el ${formatearFechaGT(params.vigencia)}.</p>`
    : '';

  const html = emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cotizaci\u00f3n de Servicios</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Estimado/a ${params.clienteNombre}, adjuntamos la cotizaci\u00f3n solicitada.</p>
    <table width="100%" style="margin:16px 0;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Servicio</th>
          <th style="padding:10px 12px;text-align:right;font-size:13px;color:#6b7280;border-bottom:2px solid #e5e7eb;">Monto</th>
        </tr>
      </thead>
      <tbody>
        ${filasServicios}
        <tr style="background:#f0fdfa;">
          <td style="padding:10px 12px;font-size:14px;font-weight:700;">Total</td>
          <td style="padding:10px 12px;font-size:14px;font-weight:700;text-align:right;">${totalFmt}</td>
        </tr>
      </tbody>
    </table>
    ${vigenciaLine}
    <table width="100%" style="margin:16px 0;background:#eff6ff;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;">Cuentas para dep\u00f3sito:</p>
        ${cuentasBancariasHTML()}
      </td></tr>
    </table>
  `);

  return {
    from: 'contador@papeleo.legal',
    subject: `Cotizaci\u00f3n \u2014 ${totalFmt}`,
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
    <table width="100%" style="margin:16px 0;background:${params.saldo > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:16px;">
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
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
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
        <tr style="background:#f0fdfa;">
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
    ${tealButton('Ir al portal de cliente', 'https://amandasantizo.com/portal')}
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
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Expediente:</strong> ${params.expediente}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Novedad:</strong> ${params.novedad}</p>
      </td></tr>
    </table>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Si tiene consultas sobre esta actualizaci\u00f3n, puede responder a este correo o agendar un seguimiento.</p>
    ${tealButton('Agendar seguimiento', 'https://amandasantizo.com/agendar')}
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
    ${tealButton('Acceder al portal', 'https://amandasantizo.com/portal')}
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
    ${tealButton('Ir al portal', 'https://amandasantizo.com/portal')}
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
  const presenciaBg = params.presenciaRequerida ? '#fef2f2' : '#f0fdf4';

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
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
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
