// ============================================================================
// lib/templates/seguimiento-cotizacion-email.ts
// HTML email profesional para la plantilla "Seguimiento de cotización".
// Diseñado para ser email-safe (tablas, inline styles, sin flexbox).
// ============================================================================

export type EstadoTramiteEmail = 'pendiente' | 'en_proceso' | 'completado' | 'suspendido';

export interface AvanceEmail {
  fecha: string;        // YYYY-MM-DD
  descripcion: string;
  completado?: boolean; // si true → ✓, si false → →
}

export interface TramiteEmail {
  nombre: string;
  estado: EstadoTramiteEmail;
  avances: AvanceEmail[];
}

export interface SeguimientoCotizacionData {
  numeroCotizacion: string;
  clienteNombre: string;
  asuntoCotizacion: string;
  fechaReporte: string;     // YYYY-MM-DD
  detalleAvance: string;    // texto libre del usuario
  tramites: TramiteEmail[];
}

const ESTADO_LABEL: Record<EstadoTramiteEmail, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  suspendido: 'Suspendido',
};

const ESTADO_BADGE: Record<EstadoTramiteEmail, { bg: string; color: string; border: string }> = {
  pendiente:  { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  en_proceso: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  completado: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  suspendido: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
};

function escapeHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(s: string): string {
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function formatearFechaCorta(yyyymmdd: string): string {
  if (!yyyymmdd) return '';
  const d = new Date(`${yyyymmdd}T12:00:00-06:00`);
  return d.toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
  });
}

function formatearFechaLarga(yyyymmdd: string): string {
  if (!yyyymmdd) return '';
  const d = new Date(`${yyyymmdd}T12:00:00-06:00`);
  return d.toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

function badgeEstado(estado: EstadoTramiteEmail): string {
  const c = ESTADO_BADGE[estado];
  return `<span style="display:inline-block;padding:3px 10px;font-size:11px;font-weight:600;letter-spacing:0.3px;text-transform:uppercase;color:${c.color};background:${c.bg};border:1px solid ${c.border};border-radius:999px;">${ESTADO_LABEL[estado]}</span>`;
}

function renderAvances(avances: AvanceEmail[]): string {
  if (avances.length === 0) {
    return `<p style="margin:8px 0 0;color:#94a3b8;font-size:13px;font-style:italic;">Sin avances registrados aún.</p>`;
  }
  const ordenados = [...avances].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:10px;">
      ${ordenados.map(a => {
        const completado = a.completado !== false;
        const marker = completado ? '✓' : '→';
        const markerColor = completado ? '#0d9488' : '#1e40af';
        const markerBg = completado ? '#d1fae5' : '#dbeafe';
        const textColor = completado ? '#334155' : '#1e293b';
        const weight = completado ? '400' : '600';
        return `
          <tr>
            <td style="padding:4px 0;width:28px;vertical-align:top;">
              <span style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;font-size:12px;font-weight:700;color:${markerColor};background:${markerBg};border-radius:50%;">${marker}</span>
            </td>
            <td style="padding:4px 0 4px 4px;vertical-align:top;">
              <span style="font-size:12px;color:#64748b;font-weight:600;">${escapeHtml(formatearFechaCorta(a.fecha))}</span>
              <span style="font-size:13px;color:${textColor};font-weight:${weight};margin-left:6px;">— ${escapeHtml(a.descripcion)}</span>
            </td>
          </tr>
        `;
      }).join('')}
    </table>
  `;
}

function renderTramite(t: TramiteEmail): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:16px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
          <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
            <tr>
              <td style="vertical-align:middle;">
                <span style="font-size:14px;font-weight:600;color:#0f172a;">${escapeHtml(t.nombre)}</span>
              </td>
              <td style="vertical-align:middle;text-align:right;white-space:nowrap;">
                ${badgeEstado(t.estado)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:10px 18px 14px;">
          ${renderAvances(t.avances)}
        </td>
      </tr>
    </table>
  `;
}

export function asuntoSeguimientoCotizacion(numero: string, clienteNombre: string): string {
  return `Reporte de avance — Cotización ${numero} — ${clienteNombre}`;
}

export function generarHtmlSeguimientoCotizacion(data: SeguimientoCotizacionData): string {
  const fechaLarga = formatearFechaLarga(data.fechaReporte);
  const tramitesHtml = data.tramites.length > 0
    ? data.tramites.map(renderTramite).join('')
    : `<p style="margin:0;color:#94a3b8;font-size:13px;font-style:italic;">Esta cotización aún no tiene trámites registrados.</p>`;

  const comentariosHtml = data.detalleAvance.trim()
    ? `
      <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-top:24px;background:#f0fdfa;border-left:4px solid #0d9488;border-radius:6px;">
        <tr>
          <td style="padding:14px 18px;">
            <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.5px;">Comentarios adicionales</p>
            <div style="font-size:14px;color:#0f172a;line-height:1.6;">${nl2br(data.detalleAvance)}</div>
          </td>
        </tr>
      </table>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de avance</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 12px rgba(15,23,42,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="padding:28px 32px 16px;background:linear-gradient(135deg,#0f766e 0%,#0d9488 50%,#0891b2 100%);">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
              <tr>
                <td>
                  <p style="margin:0;color:#ffffff;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:600;opacity:0.85;">Despacho Jurídico</p>
                  <h1 style="margin:4px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.3px;">Amanda Santizo</h1>
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="display:inline-block;padding:6px 14px;font-size:11px;font-weight:700;color:#ffffff;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.35);border-radius:999px;letter-spacing:0.5px;text-transform:uppercase;">Reporte</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:4px;background:#1e3a8a;line-height:4px;font-size:0;">&nbsp;</td></tr>

        <!-- DATOS DEL CASO -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Reporte de avance</p>
            <p style="margin:14px 0 16px;color:#334155;font-size:15px;line-height:1.6;">Estimado/a <strong style="color:#0f172a;">${escapeHtml(data.clienteNombre)}</strong>, le informamos sobre el avance del trámite vinculado a la cotización indicada a continuación.</p>

            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                      <td style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;width:38%;">Cotización</td>
                      <td style="font-size:14px;color:#0f172a;font-weight:600;font-family:'Courier New',monospace;">${escapeHtml(data.numeroCotizacion)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                      <td style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;width:38%;">Cliente</td>
                      <td style="font-size:14px;color:#0f172a;font-weight:600;">${escapeHtml(data.clienteNombre)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                      <td style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;width:38%;">Servicio</td>
                      <td style="font-size:14px;color:#0f172a;">${escapeHtml(data.asuntoCotizacion || 'Servicios profesionales')}</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 18px;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                    <tr>
                      <td style="font-size:11px;color:#64748b;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;width:38%;">Fecha del reporte</td>
                      <td style="font-size:14px;color:#0f172a;text-transform:capitalize;">${escapeHtml(fechaLarga)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- TRÁMITES -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <h2 style="margin:0 0 14px;font-size:13px;font-weight:700;color:#0f766e;letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid #0d9488;padding-bottom:8px;">Estado de los trámites</h2>
            ${tramitesHtml}
          </td>
        </tr>

        <!-- COMENTARIOS -->
        ${comentariosHtml ? `<tr><td style="padding:0 32px 8px;">${comentariosHtml}</td></tr>` : ''}

        <!-- CIERRE -->
        <tr>
          <td style="padding:20px 32px 8px;">
            <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">Quedamos atentos a sus comentarios y agradecemos su tiempo y confianza.</p>
          </td>
        </tr>

        <!-- FIRMA + FOOTER -->
        <tr>
          <td style="padding:24px 32px 28px;border-top:1px solid #e2e8f0;background:#fafbfc;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#0f172a;">Lcda. Amanda Santizo</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Colegiado No. 19565 · Abogada y Notaria</p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
              <tr>
                <td style="padding-right:14px;font-size:12px;color:#475569;">📞 2335-3613</td>
                <td style="padding-right:14px;font-size:12px;color:#475569;">✉ asistente@papeleo.legal</td>
                <td style="font-size:12px;color:#475569;">🌐 amandasantizo.com</td>
              </tr>
            </table>
            <p style="margin:18px 0 0;padding-top:14px;border-top:1px dashed #cbd5e1;font-size:10px;color:#94a3b8;line-height:1.5;font-style:italic;">Este correo es confidencial y está dirigido únicamente a su destinatario. Si usted no es el destinatario, por favor notifique al remitente y elimine este mensaje.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
