// ============================================================================
// GET /api/admin/plantillas/preview            → índice con links
// GET /api/admin/plantillas/preview?tpl=X&lang=es|en → render HTML de la plantilla
//
// Herramienta de REVISIÓN (Fase 1 comunicaciones EN): renderiza las plantillas
// de email con datos ficticios directamente en el navegador. NO envía nada.
// El logo CID se sustituye por data-URI para que se vea fuera de un correo.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import * as ES from '@/lib/templates/emails';
import * as EN from '@/lib/templates/emails-en';
import type { EmailTemplate } from '@/lib/templates/emails';
import { LOGO_AUDIENCIA_BASE64 } from '@/lib/assets/logo-audiencia-base64';

export const dynamic = 'force-dynamic';

type Lang = 'es' | 'en';

// ── Datos ficticios ─────────────────────────────────────────────────────────

function citaDemo(lang: Lang, overrides: Record<string, any> = {}) {
  return {
    tipo: 'consulta_nueva',
    titulo: lang === 'en' ? 'Legal Consultation — John Smith' : 'Consulta Legal — Juan Pérez',
    fecha: '2026-07-20',
    hora_inicio: '10:00',
    hora_fin: '11:00',
    duracion_minutos: 60,
    modalidad: 'virtual',
    // ES: Q500 (precio local actual) · EN: USD $150 (consulta internacional)
    costo: lang === 'en' ? EN.CONSULTA_INTERNACIONAL_USD : 500,
    teams_link: 'https://teams.microsoft.com/l/meetup-join/demo',
    cliente: { nombre: lang === 'en' ? 'John Smith' : 'Juan Pérez', email: 'demo@example.com' },
    ...overrides,
  };
}

const firmaDemo = (lang: Lang) => citaDemo(lang, {
  tipo: 'seguimiento',
  modalidad: 'firma_documentos',
  costo: 0,
  teams_link: null,
  fecha_solicitada: '2026-07-18',
  hora_solicitada: '15:00',
  documentos_entrega: lang === 'en' ? 'Power of attorney (2 originals)' : 'Poder especial (2 originales)',
});

// key → { label, es(), en() } — en() ausente = aún sin versión EN (fallback ES)
const DEMOS: Record<string, { label: string; es: () => EmailTemplate; en?: () => EmailTemplate }> = {
  confirmacion_cita: {
    label: 'Confirmación de cita (Consulta Legal, con recuadro de pago)',
    es: () => ES.emailConfirmacionCita(citaDemo('es')),
    en: () => EN.emailConfirmacionCita(citaDemo('en')),
  },
  confirmacion_cita_firma: {
    label: 'Confirmación de cita (firma de documentos, sin pago)',
    es: () => ES.emailConfirmacionCita(firmaDemo('es')),
    en: () => EN.emailConfirmacionCita(firmaDemo('en')),
  },
  recordatorio_24h: {
    label: 'Recordatorio 24 horas',
    es: () => ES.emailRecordatorio24h(citaDemo('es')),
    en: () => EN.emailRecordatorio24h(citaDemo('en')),
  },
  recordatorio_1h: {
    label: 'Recordatorio 1 hora',
    es: () => ES.emailRecordatorio1h(citaDemo('es')),
    en: () => EN.emailRecordatorio1h(citaDemo('en')),
  },
  cancelacion_cita: {
    label: 'Cancelación de cita',
    es: () => ES.emailCancelacionCita(citaDemo('es')),
    en: () => EN.emailCancelacionCita(citaDemo('en')),
  },
  solicitud_confirmada: {
    label: 'Solicitud de firma/entrega confirmada',
    es: () => ES.emailSolicitudConfirmada(firmaDemo('es'), 'Mensaje opcional de Amanda.'),
    en: () => EN.emailSolicitudConfirmada(firmaDemo('en'), 'Optional note from Amanda.'),
  },
  firma_multiple: {
    label: 'Firma confirmada — múltiples firmantes',
    es: () => ES.emailFirmaConfirmadaMultiple(firmaDemo('es'), 'Juan Pérez', [{ nombre: 'Juan Pérez' }, { nombre: 'María López' }]),
    en: () => EN.emailFirmaConfirmadaMultiple(firmaDemo('en'), 'John Smith', [{ nombre: 'John Smith' }, { nombre: 'Mary Johnson' }]),
  },
  propuesta_fecha: {
    label: 'Propuesta de nueva fecha',
    es: () => ES.emailSolicitudPropuestaFecha(firmaDemo('es')),
    en: () => EN.emailSolicitudPropuestaFecha(firmaDemo('en')),
  },
  solicitud_rechazada: {
    label: 'Solicitud rechazada / documentos en preparación',
    es: () => ES.emailSolicitudRechazada(firmaDemo('es')),
    en: () => EN.emailSolicitudRechazada(firmaDemo('en')),
  },
  confirmacion_llamada: {
    label: 'Confirmación de llamada',
    es: () => ES.emailConfirmacionLlamada({ nombre: 'Juan Pérez', fecha: '2026-07-20', hora: '14:30', duracion: 20, asunto: 'Avance del expediente', telefono: '+502 5555 1234' }),
    en: () => EN.emailConfirmacionLlamada({ nombre: 'John Smith', fecha: '2026-07-20', hora: '14:30', duracion: 20, asunto: 'Case progress update', telefono: '+1 (305) 555-0134' }),
  },
  recordatorio_llamada: {
    label: 'Recordatorio de llamada (día de la llamada)',
    es: () => ES.emailRecordatorioLlamadaCliente({ nombre: 'Juan Pérez', hora: '14:30', asunto: 'Avance del expediente' }),
    en: () => EN.emailRecordatorioLlamadaCliente({ nombre: 'John Smith', hora: '14:30', asunto: 'Case progress update' }),
  },
  solicitud_pago: {
    label: 'Recordatorio de pago pendiente',
    es: () => ES.emailSolicitudPago({ clienteNombre: 'Juan Pérez', concepto: 'Honorarios — constitución de sociedad', monto: 8500, numeroCotizacion: 'COT-0042' }),
    en: () => EN.emailSolicitudPago({ clienteNombre: 'John Smith', concepto: 'Legal fees — company incorporation', monto: 1200, numeroCotizacion: 'COT-0042' }),
  },
  pago_recibido: {
    label: 'Pago recibido',
    es: () => ES.emailPagoRecibido({ clienteNombre: 'Juan Pérez', concepto: 'Anticipo constitución de sociedad', monto: 5000, fechaPago: '2026-07-05' }),
    en: () => EN.emailPagoRecibido({ clienteNombre: 'John Smith', concepto: 'Retainer — company incorporation', monto: 720, fechaPago: '2026-07-05' }),
  },
  estado_cuenta: {
    label: 'Estado de cuenta',
    es: () => ES.emailEstadoCuenta({ clienteNombre: 'Juan Pérez', movimientos: [
      { fecha: '2026-06-01', concepto: 'Honorarios fase 1', cargo: 5000, abono: 0 },
      { fecha: '2026-06-15', concepto: 'Pago recibido', cargo: 0, abono: 3000 },
    ], saldo: 2000 }),
    en: () => EN.emailEstadoCuenta({ clienteNombre: 'John Smith', movimientos: [
      { fecha: '2026-06-01', concepto: 'Legal fees — phase 1', cargo: 700, abono: 0 },
      { fecha: '2026-06-15', concepto: 'Payment received', cargo: 0, abono: 400 },
    ], saldo: 300 }),
  },
  recordatorio_cobro: {
    label: 'Recordatorio de cobro (2º aviso)',
    es: () => ES.emailRecordatorioCobro({ clienteNombre: 'Juan Pérez', concepto: 'Honorarios fase 2', monto: 4000, saldoPendiente: 4000, fechaVencimiento: '2026-07-10', tipo: 'segundo_aviso', numeroCobro: 87 }),
    en: () => EN.emailRecordatorioCobro({ clienteNombre: 'John Smith', concepto: 'Legal fees — phase 2', monto: 550, saldoPendiente: 550, fechaVencimiento: '2026-07-10', tipo: 'segundo_aviso', numeroCobro: 87 }),
  },
  cotizacion: {
    label: 'Cotización de servicios',
    es: () => ES.emailCotizacion({ clienteNombre: 'Juan Pérez', numeroCotizacion: 'COT-0099', fechaEmision: '2026-07-05', servicios: [
      { descripcion: 'Constitución de sociedad anónima', monto: 12000 },
      { descripcion: 'Inscripción en Registro Mercantil', monto: 3500 },
    ], anticipo: 9300, anticipoPorcentaje: 60, condiciones: 'Anticipo del 60% para iniciar.\nSaldo contra entrega.', tokenRespuesta: 'demo-token' }),
    en: () => EN.emailCotizacion({ clienteNombre: 'John Smith', numeroCotizacion: 'COT-0099', fechaEmision: '2026-07-05', servicios: [
      { descripcion: 'Incorporation of a Guatemalan corporation (S.A.)', monto: 1600 },
      { descripcion: 'Commercial Registry filing', monto: 450 },
    ], anticipo: 1230, anticipoPorcentaje: 60, condiciones: '60% retainer to begin.\nBalance due upon completion.', tokenRespuesta: 'demo-token' }),
  },
  documentos_disponibles: {
    label: 'Documentos disponibles en portal',
    es: () => ES.emailDocumentosDisponibles({ clienteNombre: 'Juan Pérez' }),
    en: () => EN.emailDocumentosDisponibles({ clienteNombre: 'John Smith' }),
  },
  actualizacion_expediente: {
    label: 'Actualización de expediente (reporte)',
    es: () => ES.emailActualizacionExpediente({ clienteNombre: 'Juan Pérez', expediente: '01077-2025-00270', novedad: 'El juzgado admitió la demanda y fijó audiencia.' }),
    en: () => EN.emailActualizacionExpediente({ clienteNombre: 'John Smith', expediente: '01077-2025-00270', novedad: 'The court admitted the claim and scheduled a hearing.' }),
  },
  bienvenida: {
    label: 'Bienvenida cliente nuevo',
    es: () => ES.emailBienvenidaCliente({ clienteNombre: 'Juan Pérez' }),
    en: () => EN.emailBienvenidaCliente({ clienteNombre: 'John Smith' }),
  },
  solicitud_documentos: {
    label: 'Solicitud de documentos al cliente',
    es: () => ES.emailSolicitudDocumentos({ clienteNombre: 'Juan Pérez', documentos: ['DPI (copia legalizada)', 'Recibo de servicios'], plazo: '10 días' }),
    en: () => EN.emailSolicitudDocumentos({ clienteNombre: 'John Smith', documentos: ['Passport (certified copy)', 'Proof of address'], plazo: '10 days' }),
  },
  aviso_audiencia: {
    label: 'Aviso de audiencia programada',
    es: () => ES.emailAvisoAudiencia({ clienteNombre: 'Juan Pérez', fecha: '2026-07-25', hora: '09:00', juzgado: 'Juzgado Primero de Primera Instancia Civil', presenciaRequerida: true, instrucciones: 'Presentarse 30 minutos antes.', documentosLlevar: ['DPI original'] }),
    en: () => EN.emailAvisoAudiencia({ clienteNombre: 'John Smith', fecha: '2026-07-25', hora: '09:00', juzgado: 'First Civil Court of First Instance, Guatemala City', presenciaRequerida: true, instrucciones: 'Please arrive 30 minutes early.', documentosLlevar: ['Original passport or ID'] }),
  },
  recordatorio_audiencia: {
    label: 'Recordatorio de audiencia judicial (solo ES por ahora — trámite local)',
    es: () => ES.emailRecordatorioAudiencia(citaDemo('es', { audiencia_materia: 'Civil', audiencia_expediente: '01077-2025-00270', audiencia_diligencia: 'Audiencia de conciliación', audiencia_juzgado: 'Juzgado Primero Civil' })),
  },
};

// ── Render ──────────────────────────────────────────────────────────────────

const LOGO_DATA_URI = `data:image/png;base64,${LOGO_AUDIENCIA_BASE64}`;

function indexHTML(): string {
  const rows = Object.entries(DEMOS).map(([key, d]) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${d.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;"><a href="?tpl=${key}&lang=es">ES</a></td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${d.en ? `<a href="?tpl=${key}&lang=en"><strong>EN</strong></a>` : '<span style="color:#9ca3af;">—</span>'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Preview de plantillas</title></head>
  <body style="font-family:'Segoe UI',sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#0f172a;">
    <h1 style="font-size:22px;">📧 Preview de plantillas de email</h1>
    <p style="color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;font-size:14px;">
      ⚠️ Las versiones EN son <strong>BORRADOR</strong> pendiente de revisión de Amanda. Nada de esto envía correos — solo renderiza.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f8fafc;"><th style="padding:8px 12px;text-align:left;">Plantilla</th><th style="padding:8px 12px;">Español</th><th style="padding:8px 12px;">English</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="color:#64748b;font-size:12px;margin-top:16px;">Facturas: sin versión EN (las emite el SAT). Correos internos: siempre ES.</p>
  </body></html>`;
}

export async function GET(req: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const tpl = req.nextUrl.searchParams.get('tpl');
  const lang = (req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'es') as Lang;

  if (!tpl) {
    return new NextResponse(indexHTML(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const demo = DEMOS[tpl];
  if (!demo) {
    return NextResponse.json({ error: `Plantilla desconocida: ${tpl}`, disponibles: Object.keys(DEMOS) }, { status: 404 });
  }

  const builder = lang === 'en' ? demo.en : demo.es;
  if (!builder) {
    return NextResponse.json({ error: `"${tpl}" no tiene versión ${lang} (fallback: ES)` }, { status: 404 });
  }

  const t = builder();
  // El logo va por CID en correos reales; en navegador lo sustituimos inline.
  const html = t.html.replace(/cid:[A-Za-z0-9_-]+/g, LOGO_DATA_URI);

  const banner = `
    <div style="position:sticky;top:0;background:#1e2a5a;color:#fff;padding:10px 16px;font-family:'Segoe UI',sans-serif;font-size:13px;z-index:9;">
      <a href="/api/admin/plantillas/preview" style="color:#c2a05a;text-decoration:none;font-weight:600;">← Índice</a>
      &nbsp;·&nbsp; <strong>${tpl}</strong> [${lang.toUpperCase()}]${lang === 'en' ? ' — BORRADOR pendiente de revisión' : ''}
      &nbsp;·&nbsp; Asunto: <em>${t.subject.replace(/</g, '&lt;')}</em>
      &nbsp;·&nbsp; From: ${t.from}
    </div>`;

  return new NextResponse(banner + html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
