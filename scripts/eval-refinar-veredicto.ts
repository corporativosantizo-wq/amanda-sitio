// ============================================================================
// scripts/eval-refinar-veredicto.ts
// Recalcula la matriz antes/después con un veredicto por-mensaje más honesto:
// 'ameritaba' solo si (a) el borrador de ESE mensaje se envió, o (b) el mensaje
// fue el ÚLTIMO entrante del hilo antes de una respuesta del despacho. Los
// intermedios de una ráfaga (respondidos "en bloque" al final) pasan a
// sin_veredicto. Solo lectura; reusa eval-clasificador-resultado.json.
// ============================================================================

process.loadEnvFile('.env.local');

async function main() {
  const fs = await import('fs');
  const filas = JSON.parse(fs.readFileSync('scripts/eval-clasificador-resultado.json', 'utf8'));

  const { createAdminClient } = await import('../lib/supabase/admin');
  const db = createAdminClient();
  const desde = new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString();

  const { data: mensajes } = await db
    .from('email_messages')
    .select('id, thread_id, subject, from_email, received_at, direction')
    .gte('received_at', desde)
    .order('received_at', { ascending: true });

  const { data: drafts } = await db.from('email_drafts').select('message_id, status');
  const enviadoPorMsg = new Set((drafts ?? []).filter((d: any) => d.status === 'enviado').map((d: any) => d.message_id));
  const rechazadoPorMsg = new Set((drafts ?? []).filter((d: any) => d.status === 'rechazado').map((d: any) => d.message_id));

  // Por hilo: para cada outbound, el último inbound anterior es "el que se respondió"
  const porHilo = new Map<string, any[]>();
  for (const m of mensajes ?? []) {
    const arr = porHilo.get(m.thread_id) ?? [];
    arr.push(m);
    porHilo.set(m.thread_id, arr);
  }
  const respondidoDirecto = new Set<string>();
  for (const arr of porHilo.values()) {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].direction === 'outbound') {
        for (let j = i - 1; j >= 0; j--) {
          if (arr[j].direction === 'inbound') { respondidoDirecto.add(arr[j].id); break; }
        }
      }
    }
  }

  // Mapear filas del eval (por subject+from truncados) a ids
  const clave = (s: string, f: string) => `${(s ?? '').substring(0, 60)}|${f}`;
  const idPorClave = new Map<string, string[]>();
  for (const m of mensajes ?? []) {
    if (m.direction !== 'inbound') continue;
    const k = clave(m.subject ?? '', m.from_email);
    const arr = idPorClave.get(k) ?? [];
    arr.push(m.id);
    idPorClave.set(k, arr);
  }

  // Asignar ids en orden (filas están en orden received_at asc del eval)
  const usados = new Set<string>();
  for (const f of filas) {
    const cand = (idPorClave.get(clave(f.subject, f.from)) ?? []).filter((id: string) => !usados.has(id));
    f.msg_id = cand[0] ?? null;
    if (f.msg_id) usados.add(f.msg_id);
  }

  for (const f of filas) {
    if (!f.msg_id) { f.veredicto_fino = 'sin_mapeo'; continue; }
    if (enviadoPorMsg.has(f.msg_id) || respondidoDirecto.has(f.msg_id)) f.veredicto_fino = 'ameritaba';
    else if (rechazadoPorMsg.has(f.msg_id)) f.veredicto_fino = 'no_ameritaba';
    else f.veredicto_fino = 'sin_veredicto';
  }

  function matriz(decCol: 'antes' | 'despues') {
    let aciertoSi = 0, falsoSi = 0, falsoNo = 0, aciertoNo = 0, fuera = 0;
    for (const f of filas) {
      const v = f.veredicto_fino;
      if (v !== 'ameritaba' && v !== 'no_ameritaba') { fuera++; continue; }
      const dec = f[decCol];
      if (dec === 'true' && v === 'ameritaba') aciertoSi++;
      else if (dec === 'true' && v === 'no_ameritaba') falsoSi++;
      else if (dec === 'false' && v === 'ameritaba') falsoNo++;
      else if (dec === 'false' && v === 'no_ameritaba') aciertoNo++;
    }
    return { aciertoSi, aciertoNo, falsoSi, falsoNo, fuera_del_conteo: fuera };
  }

  console.log('===== MATRIZ CON VEREDICTO FINO (por-mensaje) =====');
  console.log('ANTES  :', JSON.stringify(matriz('antes')));
  console.log('DESPUÉS:', JSON.stringify(matriz('despues')));

  console.log('\n===== FALSOS NO del DESPUÉS (veredicto fino) =====');
  for (const f of filas.filter((x: any) => x.despues === 'false' && x.veredicto_fino === 'ameritaba')) {
    console.log(`- ${f.subject} | ${f.from} | antes=${f.antes}`);
  }
  console.log('\n===== FALSOS SÍ del DESPUÉS (veredicto fino) =====');
  for (const f of filas.filter((x: any) => x.despues === 'true' && x.veredicto_fino === 'no_ameritaba')) {
    console.log(`- ${f.subject} | ${f.from} | antes=${f.antes}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
