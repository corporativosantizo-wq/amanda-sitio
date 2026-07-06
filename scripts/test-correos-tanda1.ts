// ============================================================================
// scripts/test-correos-tanda1.ts
// Prueba de la tanda 1 de fixes de correos (rama feat/correos-branding-tanda1).
// Envía 3 correos de PRUEBA a contador@papeleo.legal ejercitando los caminos
// REALES de producción:
//   1. Centro de Comunicaciones → enviarCorreoAhora con cuerpo de texto plano
//      (debe llegar con branding: logo + navy/dorado + pie dentro del wrapper).
//      La fila temporal en correos_programados se borra al final.
//   2. Reenviar cotización → reenviarCotizacion con una cotización REAL
//      (debe llegar la cotización completa con marca + mensaje personal arriba).
//      Solo toca updated_at de la cotización.
//   3. Plantilla emailCotizacion con cantidad real (1 y 3) y vigencia desde
//      configuración (validez_cotizacion_dias) — datos demo, no toca la BD.
//
// Uso:  pnpm dlx tsx scripts/test-correos-tanda1.ts
// ============================================================================

process.loadEnvFile('.env.local');

const DESTINO = 'contador@papeleo.legal';

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin');
  const { sendMail } = await import('../lib/services/outlook.service');
  const { emailCotizacion } = await import('../lib/templates/emails');
  const { enviarCorreoAhora } = await import('../lib/services/comunicaciones.service');
  const { reenviarCotizacion, obtenerConfiguracion } = await import('../lib/services/cotizaciones.service');

  const db = createAdminClient();
  const resultados: string[] = [];

  // ── PRUEBA 1: Centro de Comunicaciones (texto plano → wrapper de marca) ───
  console.log('\n[1/3] Centro de Comunicaciones — texto plano con branding...');
  const cuerpoPlano =
    `Estimado/a cliente,\n\n` +
    `PRUEBA: este es el cuerpo de una plantilla del Centro de Comunicaciones ` +
    `(texto plano, como "Envío de documento" o "Seguimiento a proveedor").\n\n` +
    `Antes salía en Arial sin logo; ahora debe llegar con el header de marca ` +
    `(logo + línea navy/dorada) y el pie de confidencialidad dentro de la tarjeta.\n\n` +
    `Caracteres especiales de control: á é í ó ú ñ & < > "comillas"\n\n` +
    `Amanda Santizo\nAbogada y Notaria\nTel. 2335-3613 | amandasantizo.com`;

  const { data: correoTmp, error: insErr } = await db
    .from('correos_programados')
    .insert({
      destinatario_email: DESTINO,
      destinatario_nombre: 'Prueba Tanda 1',
      cuenta_envio: 'asistente@papeleo.legal',
      asunto: '[PRUEBA 1/3] Centro de Comunicaciones con branding',
      cuerpo: cuerpoPlano,
      estado: 'borrador',
    })
    .select('id')
    .single();
  if (insErr || !correoTmp) throw new Error('No se pudo crear correo temporal: ' + insErr?.message);

  try {
    await enviarCorreoAhora(correoTmp.id);
    resultados.push('✅ PRUEBA 1 enviada (Centro de Comunicaciones, texto plano → branded)');
  } finally {
    // Limpieza: no dejar la fila de prueba en el historial de "Enviados"
    await db.from('correos_programados').delete().eq('id', correoTmp.id);
  }

  // ── PRUEBA 2: Reenviar cotización real ────────────────────────────────────
  console.log('[2/3] Reenvío de cotización real...');
  const { data: cots } = await db
    .from('cotizaciones')
    .select('id, numero, total, cliente:clientes!cliente_id(nombre), items:cotizacion_items(id)')
    .order('created_at', { ascending: false })
    .limit(10);

  const cot = (cots ?? []).find((c: any) => (c.items ?? []).length > 0);
  if (!cot) throw new Error('No se encontró ninguna cotización con items para la prueba');

  const nombreCliente = (cot as any).cliente?.nombre ?? '';
  await reenviarCotizacion(cot.id, {
    to: DESTINO,
    subject: `[PRUEBA 2/3] Reenvío — Cotización ${cot.numero} (debe incluir la cotización completa)`,
    mensaje:
      `Estimado/a${nombreCliente ? ` ${nombreCliente}` : ''},\n\n` +
      `PRUEBA: le reenvío la cotización ${cot.numero}, que encontrará a continuación.\n\n` +
      `Quedamos a sus órdenes.\n\n` +
      `Amanda Santizo\nAbogada y Notaria\nTel. 2335-3613 | amandasantizo.com`,
    from: 'contador@papeleo.legal',
  });
  resultados.push(`✅ PRUEBA 2 enviada (reenvío de ${cot.numero} con cotización completa y mensaje arriba)`);

  // ── PRUEBA 3: Cotización demo — cantidad real + vigencia de configuración ─
  console.log('[3/3] Cotización demo con cantidad y vigencia reales...');
  const config = await obtenerConfiguracion();
  const vigenciaDias = config.validez_cotizacion_dias ?? 30;

  const demo = emailCotizacion({
    clienteNombre: 'Amanda Santizo (prueba)',
    numeroCotizacion: 'COT-PRUEBA',
    fechaEmision: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }),
    servicios: [
      { descripcion: 'Constitución de sociedad anónima', monto: 12000, cantidad: 1 },
      { descripcion: 'Inscripción de nombramiento (3 nombramientos)', monto: 4500, cantidad: 3 },
    ],
    subtotal: 16500,
    iva: 1980,
    total: 18480,
    anticipo: 11088,
    anticipoPorcentaje: 60,
    vigenciaDias,
    condiciones: 'PRUEBA — Condiciones de ejemplo.\nLa fila 2 debe mostrar Cant. 3 y el badge debe decir "Válida por ' + vigenciaDias + ' días".',
    configuracion: config,
  });

  await sendMail({
    from: 'contador@papeleo.legal',
    to: DESTINO,
    subject: `[PRUEBA 3/3] ${demo.subject} — Cant. real + vigencia ${vigenciaDias} días`,
    htmlBody: demo.html,
  });
  resultados.push(`✅ PRUEBA 3 enviada (cantidad 1 y 3 en tabla, badge "Válida por ${vigenciaDias} días")`);

  console.log('\n════════════════════════════════════');
  for (const r of resultados) console.log(r);
  console.log(`\nRevisá la bandeja de ${DESTINO}. Config validez_cotizacion_dias = ${vigenciaDias}`);
}

main().catch((err) => {
  console.error('\n❌ Error en la prueba:', err.message ?? err);
  process.exit(1);
});

export {}; // módulo aislado — evita colisiones de scope global entre scripts
