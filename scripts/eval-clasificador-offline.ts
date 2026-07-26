// ============================================================================
// scripts/eval-clasificador-offline.ts
// Corre el clasificador NUEVO (temperature 0 + contexto de hilo + reglas
// financiero) contra el set de referencia de 45 días y lo compara con la
// decisión histórica ("antes", la que quedó en la base) contra el veredicto
// real (borrador aprobado/rechazado, respuesta en el hilo).
//
// SOLO LECTURA: no escribe en la base, no envía nada, no toca borradores.
// Uso:  pnpm dlx tsx scripts/eval-clasificador-offline.ts
// ============================================================================

export {}; // módulo aislado: evita colisión de scope global con otros scripts

process.loadEnvFile('.env.local');

type Veredicto = 'ameritaba' | 'no_ameritaba' | 'sin_veredicto';

async function main() {
  const { createAdminClient } = await import('../lib/supabase/admin');
  const { classifyEmail } = await import('../lib/molly/brain');
  const db = createAdminClient();

  const desde = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();

  const { data: mensajes, error } = await db
    .from('email_messages')
    .select('id, thread_id, subject, from_email, body_text, received_at, clasificacion, requiere_respuesta, email_threads!inner(account)')
    .eq('direction', 'inbound')
    .gte('received_at', desde)
    .order('received_at', { ascending: true });
  if (error) throw error;

  const set = (mensajes ?? []).filter(
    (m: any) => !['publicidad', 'notificacion_sistema', 'spam'].includes(m.clasificacion ?? ''),
  );

  // Señales de desenlace
  const ids = set.map((m: any) => m.id);
  const { data: drafts } = await db
    .from('email_drafts')
    .select('message_id, status')
    .in('message_id', ids);
  const draftsPorMsg = new Map<string, string[]>();
  for (const d of drafts ?? []) {
    const arr = draftsPorMsg.get(d.message_id) ?? [];
    arr.push(d.status);
    draftsPorMsg.set(d.message_id, arr);
  }

  const threadIds = [...new Set(set.map((m: any) => m.thread_id))];
  const { data: salientes } = await db
    .from('email_messages')
    .select('thread_id, received_at')
    .in('thread_id', threadIds)
    .eq('direction', 'outbound');

  const isOur = (e: string) => e.toLowerCase().endsWith('@papeleo.legal');

  function veredictoDe(m: any): Veredicto {
    const st = draftsPorMsg.get(m.id) ?? [];
    const respondido = (salientes ?? []).some(
      (s: any) => s.thread_id === m.thread_id && s.received_at > m.received_at,
    );
    if (st.includes('enviado') || respondido) return 'ameritaba';
    if (st.includes('rechazado') && !respondido) return 'no_ameritaba';
    return 'sin_veredicto';
  }

  function decisionAntes(m: any): 'true' | 'false' | 'desconocida' {
    if (m.requiere_respuesta !== null) return m.requiere_respuesta ? 'true' : 'false';
    if ((draftsPorMsg.get(m.id) ?? []).length > 0) return 'true';
    return 'desconocida';
  }

  // Set evaluable: veredicto claro + decisión "antes" conocida
  const evaluables = set.filter(
    (m: any) => veredictoDe(m) !== 'sin_veredicto' && decisionAntes(m) !== 'desconocida',
  );
  console.log(`Set total 45d: ${set.length} | evaluables (veredicto + decisión conocida): ${evaluables.length}\n`);

  // Contacto conocido (misma lógica que producción: nombre en email_contacts)
  const { data: contactos } = await db
    .from('email_contacts')
    .select('email, nombre')
    .in('email', [...new Set(evaluables.map((m: any) => m.from_email.toLowerCase()))]);
  const nombrePorEmail = new Map<string, string | null>(
    (contactos ?? []).map((c: any) => [c.email as string, (c.nombre ?? null) as string | null]),
  );

  const filas: any[] = [];
  let i = 0;
  for (const m of evaluables) {
    i++;
    // Hilo previo AS-OF el momento de clasificar: solo mensajes anteriores
    const { data: prev } = await db
      .from('email_messages')
      .select('from_email, body_text, received_at')
      .eq('thread_id', m.thread_id)
      .lt('received_at', m.received_at)
      .order('received_at', { ascending: false })
      .limit(3);
    const hiloPrevio = (prev ?? [])
      .reverse()
      .map((p: any) => ({ from: p.from_email, body: p.body_text || '', esNuestro: isOur(p.from_email) }));

    const account = (m as any).email_threads?.account;
    const known = nombrePorEmail.get(m.from_email.toLowerCase()) ?? null;

    let nuevo: any = null;
    let err: string | null = null;
    for (let intento = 0; intento < 3 && !nuevo; intento++) {
      try {
        nuevo = await classifyEmail(m.from_email, m.subject ?? '', m.body_text ?? '', known, account, hiloPrevio);
      } catch (e: any) {
        err = e?.message ?? String(e);
        await new Promise((r) => setTimeout(r, 2000 * (intento + 1)));
      }
    }

    filas.push({
      subject: (m.subject ?? '').substring(0, 60),
      from: m.from_email,
      veredicto: veredictoDe(m),
      antes: decisionAntes(m),
      despues: nuevo ? String(nuevo.requiere_respuesta) : `ERROR: ${err}`,
      tipo_antes: m.clasificacion,
      tipo_despues: nuevo?.tipo ?? null,
      hilo_previo: hiloPrevio.length,
    });
    console.log(`[${i}/${evaluables.length}] ${decisionAntes(m)} -> ${nuevo ? nuevo.requiere_respuesta : 'ERR'} | ${veredictoDe(m)} | ${(m.subject ?? '').substring(0, 50)}`);
  }

  function matriz(decCol: 'antes' | 'despues') {
    let aciertoSi = 0, falsoSi = 0, falsoNo = 0, aciertoNo = 0, errores = 0;
    for (const f of filas) {
      const dec = f[decCol];
      if (dec !== 'true' && dec !== 'false') { errores++; continue; }
      if (dec === 'true' && f.veredicto === 'ameritaba') aciertoSi++;
      else if (dec === 'true' && f.veredicto === 'no_ameritaba') falsoSi++;
      else if (dec === 'false' && f.veredicto === 'ameritaba') falsoNo++;
      else if (dec === 'false' && f.veredicto === 'no_ameritaba') aciertoNo++;
    }
    return { aciertoSi, aciertoNo, falsoSi, falsoNo, errores };
  }

  console.log('\n===== COMPARACIÓN =====');
  console.log('ANTES  :', JSON.stringify(matriz('antes')));
  console.log('DESPUÉS:', JSON.stringify(matriz('despues')));

  console.log('\n===== CAMBIOS DE DECISIÓN =====');
  for (const f of filas.filter((x) => x.antes !== x.despues)) {
    console.log(`${f.antes} -> ${f.despues} | veredicto=${f.veredicto} | ${f.subject} | ${f.from}`);
  }

  const fs = await import('fs');
  fs.writeFileSync('scripts/eval-clasificador-resultado.json', JSON.stringify(filas, null, 2));
  console.log('\nDetalle completo: scripts/eval-clasificador-resultado.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
