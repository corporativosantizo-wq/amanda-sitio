// ============================================================================
// lib/templates/seguimiento-cotizacion-email.ts
// HTML email para la plantilla "Seguimiento de cotización" (Reporte de avance).
// Email-safe (tablas, inline styles, sin flexbox).
//
// Rediseño jul-2026 (aprobado por Amanda): el correo comunica UN estado del
// trámite que Amanda elige (banner dominante bajo el logo), seguido del
// mensaje de detalle y — solo en "espera_documentos" — la lista de documentos
// que el cliente debe entregar. El bloque de "trámites registrados" y su
// heurística ✓/→ se eliminaron: el cliente que no lee con atención debe
// entender el punto del trámite de un vistazo.
//
// Diseño de marca unificado: header blanco con logo inline (CID) + borde navy
// y línea dorada. El logo se adjunta en la capa de ENVÍO (sendMail detecta el
// CID — ver lib/assets/brand-logo.ts).
// ============================================================================

import { LOGO_AUDIENCIA_BASE64 } from '@/lib/assets/logo-audiencia-base64';

// Paleta del despacho (colores del logo), idéntica a emails.ts / audiencias.
const NAVY = '#1e2a5a';
const GOLD = '#c2a05a';
const AZUL_CLARO = '#eef2f9'; // recuadros de info
const AZUL_BORDE = '#c3cde4'; // borde navy-claro para recuadros azules

// CID del logo embebido inline (lo adjunta el motor de envío cuando detecta
// esta referencia en el cuerpo). Reutiliza el mismo asset base64 de audiencias.
export const LOGO_REPORTE_CID = 'logoReporte';

/** Adjunto inline del logo (CID) para el header del reporte de avance. */
export function logoReporteInlineAttachment(): {
  name: string; contentType: string; contentBytes: string; contentId: string; isInline: boolean;
} {
  return { name: 'logo.png', contentType: 'image/png', contentBytes: LOGO_AUDIENCIA_BASE64, contentId: LOGO_REPORTE_CID, isInline: true };
}

// ── Estados del trámite ─────────────────────────────────────────────────────

export type EstadoSeguimiento =
  | 'finalizado'
  | 'en_avance'
  | 'revision_autoridad'
  | 'espera_documentos';

interface EstadoInfo {
  icono: string;
  label: string;
  /** Subtítulo del banner: qué significa para el cliente. */
  sub: string;
  /** Pista corta para el panel admin. */
  hint: string;
  /** Colores del banner (email-safe, inline). */
  bg: string;
  border: string;      // valor CSS completo, p.ej. '1px solid #c3cde4'
  labelColor: string;
  kickerColor: string;
  subColor: string;
}

export const ESTADO_SEGUIMIENTO_INFO: Record<EstadoSeguimiento, EstadoInfo> = {
  finalizado: {
    icono: '✅', label: 'Trámite finalizado',
    sub: 'Su trámite ha concluido. No se requiere ninguna acción de su parte.',
    hint: 'Cierre del servicio',
    bg: NAVY, border: `1px solid ${NAVY}`,
    labelColor: '#ffffff', kickerColor: GOLD, subColor: '#c9d2ec',
  },
  en_avance: {
    icono: '🔄', label: 'En avance',
    sub: 'Estamos trabajando en su trámite. No se requiere ninguna acción de su parte.',
    hint: 'Trabajo en curso',
    bg: AZUL_CLARO, border: `1px solid ${AZUL_BORDE}`,
    labelColor: NAVY, kickerColor: '#64748b', subColor: '#475569',
  },
  revision_autoridad: {
    icono: '🏛️', label: 'En revisión de la autoridad',
    sub: 'El expediente está en manos de la institución correspondiente; el plazo de respuesta depende de ella.',
    hint: 'Registro, juzgado, etc.',
    bg: '#ffffff', border: `2px solid ${NAVY}`,
    labelColor: NAVY, kickerColor: '#64748b', subColor: '#475569',
  },
  espera_documentos: {
    icono: '⏳', label: 'En espera — faltan documentos',
    sub: 'Necesitamos documentos de su parte para poder continuar. Vea la lista más abajo.',
    hint: 'Requiere acción del cliente',
    bg: '#fef3c7', border: '1px solid #fcd34d',
    labelColor: '#92400e', kickerColor: '#b45309', subColor: '#78350f',
  },
};

// ── Datos del correo ────────────────────────────────────────────────────────

export interface SeguimientoCotizacionData {
  numeroCotizacion: string;
  clienteNombre: string;
  asuntoCotizacion: string;
  fechaReporte: string;            // YYYY-MM-DD
  estado: EstadoSeguimiento;
  detalleAvance: string;           // mensaje libre de Amanda (protagonista)
  /** Solo se muestra con estado 'espera_documentos'. Uno por entrada. */
  documentosFaltantes?: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function formatearFechaLarga(yyyymmdd: string): string {
  if (!yyyymmdd) return '';
  const d = new Date(`${yyyymmdd}T12:00:00-06:00`);
  return d.toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

// ── Asunto ──────────────────────────────────────────────────────────────────

/** El asunto lleva el estado para que se entienda desde la bandeja de entrada. */
export function asuntoSeguimientoCotizacion(estado: EstadoSeguimiento, numero: string): string {
  const e = ESTADO_SEGUIMIENTO_INFO[estado];
  return `${e.icono} ${e.label} · Cotización ${numero} — Reporte de avance`;
}

// ── HTML ────────────────────────────────────────────────────────────────────

function bannerEstado(estado: EstadoSeguimiento): string {
  const e = ESTADO_SEGUIMIENTO_INFO[estado];
  return `
        <tr>
          <td style="padding:18px 28px 0;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${e.bg};border:${e.border};border-radius:12px;">
              <tr>
                <td style="padding:20px 12px 20px 22px;width:46px;vertical-align:middle;font-size:34px;line-height:1;">${e.icono}</td>
                <td style="padding:20px 22px 20px 6px;vertical-align:middle;">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${e.kickerColor};">Estado de su trámite</p>
                  <p style="margin:0;font-size:21px;font-weight:800;line-height:1.25;color:${e.labelColor};">${e.label}</p>
                  <p style="margin:5px 0 0;font-size:13px;line-height:1.5;color:${e.subColor};">${e.sub}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function docsFaltantes(documentos: string[]): string {
  const items = documentos
    .map(d => d.trim())
    .filter(Boolean)
    .map((d, i) => `
              <tr>
                <td style="padding:5px 10px 5px 0;width:24px;vertical-align:top;">
                  <span style="display:inline-block;width:21px;height:21px;line-height:21px;text-align:center;border-radius:50%;background:#92400e;color:#ffffff;font-size:11px;font-weight:700;">${i + 1}</span>
                </td>
                <td style="padding:5px 0;vertical-align:top;font-size:14px;font-weight:600;color:#1f2937;line-height:1.45;">${escapeHtml(d)}</td>
              </tr>`)
    .join('');
  if (!items) return '';
  return `
        <tr>
          <td style="padding:20px 32px 0;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;">
              <tr><td style="padding:16px 18px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:800;color:#92400e;letter-spacing:0.3px;">📋 Documentos que necesitamos de usted</p>
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">${items}
                </table>
                <p style="margin:12px 0 0;font-size:12px;color:#92400e;">Puede enviarlos respondiendo a este correo o entregarlos en nuestra oficina.</p>
              </td></tr>
            </table>
          </td>
        </tr>`;
}

export function generarHtmlSeguimientoCotizacion(data: SeguimientoCotizacionData): string {
  const fechaLarga = formatearFechaLarga(data.fechaReporte);
  const esEspera = data.estado === 'espera_documentos';
  const docsHtml = esEspera ? docsFaltantes(data.documentosFaltantes ?? []) : '';
  const detalle = data.detalleAvance.trim();

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reporte de avance</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">

        <!-- HEADER: blanco + logo inline (CID) + borde navy y línea dorada -->
        <tr>
          <td style="background:#ffffff;border-top:4px solid ${NAVY};padding:28px 32px 22px;text-align:center;border-bottom:1px solid #eef0f4;">
            <img src="cid:${LOGO_REPORTE_CID}" alt="Amanda Santizo — Abogada y Notaria" width="240" style="display:block;margin:0 auto;width:240px;max-width:70%;height:auto;">
            <div style="height:3px;width:64px;background:${GOLD};margin:16px auto 0;border-radius:2px;"></div>
          </td>
        </tr>

        <!-- BANNER DE ESTADO (dominante) -->
        ${bannerEstado(data.estado)}

        <!-- REFERENCIA COMPACTA -->
        <tr>
          <td style="padding:18px 32px 0;">
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;background:${AZUL_CLARO};border:1px solid ${AZUL_BORDE};border-radius:8px;">
              <tr><td style="padding:10px 14px;font-size:12.5px;color:#475569;line-height:1.5;">
                Cotización <span style="color:${NAVY};font-weight:700;font-family:'Courier New',monospace;font-size:13px;">${escapeHtml(data.numeroCotizacion)}</span>
                &nbsp;·&nbsp; ${escapeHtml(data.asuntoCotizacion || 'Servicios profesionales')}
                &nbsp;·&nbsp; <span style="text-transform:capitalize;">${escapeHtml(fechaLarga)}</span>
              </td></tr>
            </table>
          </td>
        </tr>

        <!-- DETALLE DEL AVANCE (mensaje de Amanda, protagonista) -->
        <tr>
          <td style="padding:22px 32px 0;">
            <h2 style="margin:0 0 12px;font-size:12px;font-weight:700;color:${NAVY};letter-spacing:1px;text-transform:uppercase;border-bottom:2px solid ${GOLD};padding-bottom:7px;">Detalle del avance</h2>
            <p style="margin:0;font-size:15px;line-height:1.7;color:#0f172a;">${detalle ? nl2br(detalle) : `<span style="color:#94a3b8;font-style:italic;">Estimado/a ${escapeHtml(data.clienteNombre)}, le informamos sobre el avance de su trámite.</span>`}</p>
          </td>
        </tr>

        <!-- DOCUMENTOS FALTANTES (solo estado "espera_documentos") -->
        ${docsHtml}

        <!-- CIERRE -->
        <tr>
          <td style="padding:20px 32px 8px;">
            <p style="margin:0;color:#334155;font-size:14px;line-height:1.6;">Quedamos atentos a sus comentarios y agradecemos su tiempo y confianza.</p>
          </td>
        </tr>

        <!-- FIRMA + FOOTER -->
        <tr>
          <td style="padding:24px 32px 28px;border-top:1px solid #e2e8f0;background:#f9fafb;">
            <p style="margin:0;font-size:14px;font-weight:700;color:${NAVY};">Amanda Santizo</p>
            <p style="margin:2px 0 0;font-size:12px;color:#64748b;">Abogada y Notaria</p>
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
