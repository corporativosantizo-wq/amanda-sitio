// ============================================================================
// scripts/aplicar-firma-plantillas-bd.ts
// Aplica a legal.plantillas_correo (BD de PRODUCCIÓN) la unificación de firma:
// "Lic. Amanda Santizo" (+ opcional "Despacho Jurídico") → "Amanda Santizo\n
// Abogada y Notaria". Mismo efecto que la migración
// supabase/migrations/20260706_firma_unificada_plantillas_correo.sql.
//
// ⚠️ SOLO ejecutar tras el OK de Amanda (toca datos de producción, no pasa
// por el deploy de Vercel). Idempotente: correrlo dos veces no duplica nada.
//
// Uso:
//   pnpm dlx tsx scripts/aplicar-firma-plantillas-bd.ts           → dry-run (muestra qué cambiaría)
//   pnpm dlx tsx scripts/aplicar-firma-plantillas-bd.ts --aplicar → aplica los cambios
// ============================================================================

process.loadEnvFile('.env.local');

const APLICAR = process.argv.includes('--aplicar');

function unificarFirma(cuerpo: string): string {
  return cuerpo
    .replace(/Lic\. Amanda Santizo\r?\nDespacho Jurídico/g, 'Amanda Santizo\nAbogada y Notaria')
    .replace(/Lic\. Amanda Santizo/g, 'Amanda Santizo\nAbogada y Notaria');
}

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin');
  const db = createAdminClient();

  const { data: plantillas, error } = await db
    .from('plantillas_correo')
    .select('id, nombre, slug, cuerpo_template');
  if (error) throw new Error(error.message);

  let cambiadas = 0;
  for (const p of plantillas ?? []) {
    const nuevo = unificarFirma(p.cuerpo_template ?? '');
    if (nuevo === p.cuerpo_template) continue;
    cambiadas++;
    console.log(`${APLICAR ? '✏️  Actualizando' : '👀 Cambiaría'}: ${p.nombre} (${p.slug})`);
    if (APLICAR) {
      const { error: upErr } = await db
        .from('plantillas_correo')
        .update({ cuerpo_template: nuevo, updated_at: new Date().toISOString() })
        .eq('id', p.id);
      if (upErr) throw new Error(`Error en ${p.slug}: ${upErr.message}`);
    }
  }

  console.log(`\n${APLICAR ? 'Actualizadas' : 'Se actualizarían'}: ${cambiadas} plantilla(s).`);
  if (!APLICAR) console.log('Dry-run — nada se modificó. Ejecutar con --aplicar tras el OK.');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });

export {}; // módulo aislado — evita colisiones de scope global entre scripts
