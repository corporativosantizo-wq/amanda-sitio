// Lectura (solo SELECT) de legal.plantillas_correo y pie_confidencialidad para
// inventariar firmas. No modifica nada.
process.loadEnvFile('.env.local');

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin');
  const db = createAdminClient();

  const { data: plantillas } = await db
    .from('plantillas_correo')
    .select('nombre, slug, activo, cuerpo_template')
    .order('orden');

  for (const p of plantillas ?? []) {
    const firma = (p.cuerpo_template ?? '')
      .split('\n')
      .filter((l: string) => /Lic|Lcda|Licda|Amanda|Atentamente|Cordialmente|Colegiado|Magaly/i.test(l));
    console.log(`\n── ${p.nombre} (slug=${p.slug}, activo=${p.activo})`);
    console.log(firma.length ? firma.map((l: string) => '   | ' + l).join('\n') : '   (sin líneas de firma)');
  }

  const { data: pies } = await db.from('pie_confidencialidad').select('cuenta_email, activo, texto');
  console.log('\n══ PIES DE CONFIDENCIALIDAD ══');
  for (const pie of pies ?? []) {
    console.log(`\n── ${pie.cuenta_email} (activo=${pie.activo})`);
    const lineas = (pie.texto ?? '').split('\n').filter((l: string) => /Lic|Lcda|Licda|Amanda|Colegiado/i.test(l));
    console.log(lineas.length ? lineas.map((l: string) => '   | ' + l).join('\n') : '   (sin menciones de firma)');
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

export {}; // módulo aislado — evita colisiones de scope global entre scripts
