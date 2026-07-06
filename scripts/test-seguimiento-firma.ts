// ============================================================================
// scripts/test-seguimiento-firma.ts
// Prueba de la rama feat/seguimiento-rediseno-y-firma. Envía 6 correos de
// PRUEBA a contador@papeleo.legal:
//   1-4. "Seguimiento de cotización" rediseñado, uno por estado (el de
//        "En espera" incluye la lista de documentos faltantes).
//   5.   Solicitud de pago ES — firma unificada "Amanda Santizo / Abogada y Notaria".
//   6.   Payment reminder EN — firma "Amanda Santizo / Attorney and Notary".
// Solo datos demo; no toca la BD.
//
// Uso:  pnpm dlx tsx scripts/test-seguimiento-firma.ts
// ============================================================================

process.loadEnvFile('.env.local');

const DESTINO = 'contador@papeleo.legal';

async function main() {
  const { sendMail } = await import('../lib/services/outlook.service');
  const {
    generarHtmlSeguimientoCotizacion,
    asuntoSeguimientoCotizacion,
    ESTADO_SEGUIMIENTO_INFO,
  } = await import('../lib/templates/seguimiento-cotizacion-email');
  const ES = await import('../lib/templates/emails');
  const EN = await import('../lib/templates/emails-en');

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const estados = Object.keys(ESTADO_SEGUIMIENTO_INFO) as Array<keyof typeof ESTADO_SEGUIMIENTO_INFO>;

  const DETALLES: Record<string, string> = {
    finalizado:
      'Estimado don Juan:\n\nNos complace informarle que su trámite de constitución de sociedad quedó completamente finalizado. La razón de inscripción fue emitida por el Registro Mercantil y sus documentos originales ya están disponibles para entrega en nuestra oficina.',
    en_avance:
      'Estimado don Juan:\n\nSu expediente avanza con normalidad. Esta semana quedó firmada la escritura de constitución y estamos preparando el expediente para su ingreso al Registro Mercantil.',
    revision_autoridad:
      'Estimado don Juan:\n\nSu expediente fue ingresado al Registro Mercantil el pasado 2 de julio y se encuentra en revisión por parte del registrador. El plazo estimado de la institución es de 8 a 10 días hábiles; le avisaremos en cuanto tengamos resolución.',
    espera_documentos:
      'Estimado don Juan:\n\nSu expediente fue ingresado al Registro Mercantil y la razón de inscripción avanza con normalidad. Para completar la siguiente etapa necesitamos los documentos que se detallan a continuación; en cuanto los recibamos, retomamos el trámite el mismo día.',
  };

  let n = 0;
  for (const estado of estados) {
    n++;
    const html = generarHtmlSeguimientoCotizacion({
      numeroCotizacion: 'COT-0042',
      clienteNombre: 'Juan Pérez',
      asuntoCotizacion: 'Constitución de sociedad anónima',
      fechaReporte: hoy,
      estado,
      detalleAvance: DETALLES[estado],
      documentosFaltantes: estado === 'espera_documentos'
        ? [
            'Fotocopia legalizada del DPI del representante legal',
            'Recibo de agua, luz o teléfono de la sede social',
            'Boleta de pago del arancel del Registro (Q275.00)',
          ]
        : undefined,
    });
    const asunto = asuntoSeguimientoCotizacion(estado, 'COT-0042');
    await sendMail({
      from: 'amanda@papeleo.legal',
      to: DESTINO,
      subject: `[PRUEBA ${n}/6] ${asunto}`,
      htmlBody: html,
    });
    console.log(`✅ ${n}/6 — seguimiento estado=${estado}`);
  }

  // 5. Solicitud de pago ES — firma unificada
  const solicitudES = ES.emailSolicitudPago({
    clienteNombre: 'Juan Pérez',
    concepto: 'Honorarios — constitución de sociedad',
    monto: 8500,
    numeroCotizacion: 'COT-0042',
  });
  await sendMail({
    from: 'contador@papeleo.legal',
    to: DESTINO,
    subject: `[PRUEBA 5/6 · firma ES] ${solicitudES.subject}`,
    htmlBody: solicitudES.html,
  });
  console.log('✅ 5/6 — solicitud de pago ES (firma "Amanda Santizo / Abogada y Notaria")');

  // 6. Payment reminder EN — firma unificada EN
  const solicitudEN = EN.emailSolicitudPago({
    clienteNombre: 'John Smith',
    concepto: 'Legal fees — company incorporation',
    monto: 1200,
    numeroCotizacion: 'COT-0042',
  });
  await sendMail({
    from: 'contador@papeleo.legal',
    to: DESTINO,
    subject: `[PRUEBA 6/6 · firma EN] ${solicitudEN.subject}`,
    htmlBody: solicitudEN.html,
  });
  console.log('✅ 6/6 — payment reminder EN (firma "Amanda Santizo / Attorney and Notary")');

  console.log(`\nListo — revisá la bandeja de ${DESTINO}.`);
}

main().catch((err) => {
  console.error('\n❌ Error en la prueba:', err.message ?? err);
  process.exit(1);
});

export {}; // módulo aislado — evita colisiones de scope global entre scripts
