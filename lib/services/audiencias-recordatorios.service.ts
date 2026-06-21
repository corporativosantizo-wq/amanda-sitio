// ============================================================================
// lib/services/audiencias-recordatorios.service.ts
// Motor de recordatorios de audiencia (MODO PRUEBA). Reusa sendMail.
//
// Al crear una audiencia se encolan 2 recordatorios YA aprobados y agendados:
//   · previo_2dias  : 2 días hábiles antes, respeta ventana hábil + asuetos.
//   · previo_2horas : 2 horas antes, corto, NO respeta ventana (sale cuando toca).
// El job (integrado al cron existente) los manda al llegar su fecha. Con
// config_recordatorios.test_mode=true TODO va a test_email con banner [PRUEBA].
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/services/outlook.service';
import {
  emailAudiencia, emailAudienciaCorta, logoInlineAttachment,
} from '@/lib/templates/audiencias-emails';
import { icsAttachmentAudiencia } from '@/lib/services/audiencias-ics';
import type { Audiencia } from '@/lib/types/audiencias';

const db = () => createAdminClient();

interface ConfigRecordatorios {
  dias_antes_default: number;
  ventana_inicio: string;   // 'HH:MM:SS'
  ventana_fin: string;
  dias_habiles: number[];   // ISO: 1=Lun .. 5=Vie
  test_mode: boolean;
  test_email: string | null;
}

async function getConfig(): Promise<ConfigRecordatorios> {
  const { data, error } = await db().from('config_recordatorios').select('*').eq('id', 1).single();
  if (error || !data) throw new Error('No se pudo leer legal.config_recordatorios');
  return data as ConfigRecordatorios;
}

async function getAsuetos(): Promise<Set<string>> {
  const { data } = await db().from('dias_asueto').select('fecha');
  return new Set((data ?? []).map((r: { fecha: string }) => r.fecha)); // 'YYYY-MM-DD'
}

// ── Huso Guatemala (UTC-6 fijo) ─────────────────────────────────────────────
function gtParts(instant: Date) {
  const d = new Date(instant.getTime() - 6 * 3600 * 1000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), da: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}
function gtInstant(y: number, mo: number, da: number, h: number, mi: number): Date {
  return new Date(Date.UTC(y, mo, da, h, mi, 0) + 6 * 3600 * 1000);
}
function ymd(y: number, mo: number, da: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${y}-${p(mo + 1)}-${p(da)}`;
}
function esHabil(y: number, mo: number, da: number, diasHabiles: number[], asuetos: Set<string>): boolean {
  const dow = new Date(Date.UTC(y, mo, da)).getUTCDay(); // 0=Dom..6=Sáb
  if (!diasHabiles.includes(dow)) return false;          // {1..5}=Lun..Vie
  if (asuetos.has(ymd(y, mo, da))) return false;         // asueto (incl. guatemala_ciudad)
  return true;
}

/**
 * Fecha sugerida de envío del recordatorio "previo" (N días hábiles antes),
 * respetando ventana hábil + asuetos. Nunca posterior al inicio.
 */
export function calcularFechaSugeridaEnvio(
  inicioIso: string, diasAntes: number, cfg: ConfigRecordatorios, asuetos: Set<string>,
): Date {
  const inicio = new Date(inicioIso);
  const p = gtParts(inicio);
  const [vh, vm] = cfg.ventana_inicio.split(':').map(Number);
  const [fh, fm] = cfg.ventana_fin.split(':').map(Number);

  // 1) Retroceder `diasAntes` días hábiles desde la fecha de inicio.
  let y = p.y, mo = p.mo, da = p.da, counted = 0;
  while (counted < diasAntes) {
    const prev = new Date(Date.UTC(y, mo, da) - 24 * 3600 * 1000);
    y = prev.getUTCFullYear(); mo = prev.getUTCMonth(); da = prev.getUTCDate();
    if (esHabil(y, mo, da, cfg.dias_habiles, asuetos)) counted++;
  }

  // 2) Clamp de la hora dentro de [ventana_inicio, ventana_fin].
  let h = p.h, mi = p.mi;
  const minutos = h * 60 + mi, vIni = vh * 60 + vm, vFin = fh * 60 + fm;
  if (minutos < vIni) { h = vh; mi = vm; }
  else if (minutos > vFin) {
    let d2 = new Date(Date.UTC(y, mo, da) + 24 * 3600 * 1000);
    let yy = d2.getUTCFullYear(), mm = d2.getUTCMonth(), dd = d2.getUTCDate();
    while (!esHabil(yy, mm, dd, cfg.dias_habiles, asuetos)) {
      const nx = new Date(Date.UTC(yy, mm, dd) + 24 * 3600 * 1000);
      yy = nx.getUTCFullYear(); mm = nx.getUTCMonth(); dd = nx.getUTCDate();
    }
    y = yy; mo = mm; da = dd; h = vh; mi = vm;
  }

  let candidate = gtInstant(y, mo, da, h, mi);
  // 3) Nunca después del inicio.
  if (candidate.getTime() >= inicio.getTime()) {
    candidate = new Date(inicio.getTime() - 60 * 60 * 1000);
  }
  return candidate;
}

/**
 * Próxima ventana hábil para enviar (now si estamos dentro; sino el siguiente
 * inicio de ventana en día hábil no-asueto). Para el aviso de reprogramación.
 */
export function proximaVentanaHabil(cfg: ConfigRecordatorios, asuetos: Set<string>, desde = new Date()): Date {
  const [vh, vm] = cfg.ventana_inicio.split(':').map(Number);
  const [fh, fm] = cfg.ventana_fin.split(':').map(Number);
  const vIni = vh * 60 + vm, vFin = fh * 60 + fm;
  const p = gtParts(desde);

  if (esHabil(p.y, p.mo, p.da, cfg.dias_habiles, asuetos)) {
    const min = p.h * 60 + p.mi;
    if (min >= vIni && min <= vFin) return desde;          // dentro de ventana → ya
    if (min < vIni) return gtInstant(p.y, p.mo, p.da, vh, vm); // antes → hoy a las 8
  }
  // sino: siguiente día hábil a ventana_inicio
  let y = p.y, mo = p.mo, da = p.da;
  do {
    const nx = new Date(Date.UTC(y, mo, da) + 24 * 3600 * 1000);
    y = nx.getUTCFullYear(); mo = nx.getUTCMonth(); da = nx.getUTCDate();
  } while (!esHabil(y, mo, da, cfg.dias_habiles, asuetos));
  return gtInstant(y, mo, da, vh, vm);
}

// ── Encolado automático al crear ────────────────────────────────────────────

export async function encolarRecordatoriosAudiencia(a: Audiencia): Promise<void> {
  const cfg = await getConfig();
  const asuetos = await getAsuetos();

  const destinatario = a.cliente?.email ?? null;
  const fecha2dias = calcularFechaSugeridaEnvio(a.fecha_hora_inicio, 2, cfg, asuetos);
  const fecha2horas = new Date(new Date(a.fecha_hora_inicio).getTime() - 2 * 60 * 60 * 1000);

  const full = emailAudiencia(a);
  const corto = emailAudienciaCorta(a);

  const filas = [
    {
      audiencia_id: a.id, tipo: 'recordatorio_previo', canal: 'email',
      requiere_aprobacion: false, plantilla: 'previo_2dias',
      destinatario_nombre: a.cliente?.nombre ?? null, destinatario_email: destinatario,
      asunto: full.subject, cuerpo: full.html,
      estado: 'programado', fecha_sugerida_envio: fecha2dias.toISOString(),
    },
    {
      audiencia_id: a.id, tipo: 'recordatorio_previo', canal: 'email',
      requiere_aprobacion: false, plantilla: 'previo_2horas',
      destinatario_nombre: a.cliente?.nombre ?? null, destinatario_email: destinatario,
      asunto: corto.subject, cuerpo: corto.html,
      estado: 'programado', fecha_sugerida_envio: fecha2horas.toISOString(),
    },
  ];

  const { error } = await db().from('audiencias_recordatorios').insert(filas);
  if (error) throw new Error('Error al encolar recordatorios: ' + error.message);
}

// ── Reprogramación (Fase 5) ─────────────────────────────────────────────────

/**
 * Al cambiar la fecha/hora de una audiencia: descarta los recordatorios
 * pendientes, re-encola los 2 previos con las fechas nuevas, y encola un aviso
 * de reprogramación (con el .ics de SEQUENCE incrementado → el calendario del
 * cliente ACTUALIZA, no duplica). El incremento de ics_sequence lo hace
 * actualizarAudiencia ANTES de llamar a esta función.
 */
export async function reencolarPorReprogramacion(a: Audiencia): Promise<void> {
  const cfg = await getConfig();
  const asuetos = await getAsuetos();

  // 1) Descartar lo pendiente (no enviado) de esta audiencia.
  await db().from('audiencias_recordatorios')
    .update({ estado: 'descartado' })
    .eq('audiencia_id', a.id)
    .is('fecha_enviado', null)
    .in('estado', ['programado', 'aprobado', 'pendiente_aprobacion']);

  // 2) Re-encolar los 2 previos con las fechas nuevas.
  await encolarRecordatoriosAudiencia(a);

  // 3) Aviso de reprogramación: sale en la próxima ventana hábil.
  const repro = emailAudiencia(a, { reprogramada: true });
  const { error } = await db().from('audiencias_recordatorios').insert({
    audiencia_id: a.id, tipo: 'reprogramacion', canal: 'email',
    requiere_aprobacion: false, plantilla: 'reprogramacion',
    destinatario_nombre: a.cliente?.nombre ?? null, destinatario_email: a.cliente?.email ?? null,
    asunto: repro.subject, cuerpo: repro.html,
    estado: 'programado', fecha_sugerida_envio: proximaVentanaHabil(cfg, asuetos).toISOString(),
  });
  if (error) throw new Error('Error al encolar aviso de reprogramación: ' + error.message);
}

// ── Job de envío (lo llama el cron existente) ───────────────────────────────

export async function procesarRecordatoriosAudiencias(): Promise<{
  enviados: number; fallidos: number; sin_destinatario: number;
}> {
  const cfg = await getConfig();
  const ahora = new Date().toISOString();

  const { data: pendientes, error } = await db()
    .from('audiencias_recordatorios')
    .select(`id, plantilla, destinatario_email, fecha_sugerida_envio,
      audiencia:audiencias(*, cliente:clientes(id, nombre, email, emails_cc), expediente:expedientes(id, numero_expediente))`)
    .in('estado', ['programado', 'aprobado'])
    .is('fecha_enviado', null)
    .lte('fecha_sugerida_envio', ahora);

  if (error) throw new Error('Error consultando recordatorios: ' + error.message);

  let enviados = 0, fallidos = 0, sin_destinatario = 0;

  for (const row of pendientes ?? []) {
    const a = (row as { audiencia: Audiencia }).audiencia;
    const real = a?.cliente?.email ?? null;

    // Red de seguridad: sin cliente/email → no enviar, a la bandeja (revisión).
    if (!a?.cliente_id || !real) {
      await db().from('audiencias_recordatorios').update({
        estado: 'pendiente_aprobacion',
        error: 'Audiencia sin cliente o sin email — requiere revisión manual.',
      }).eq('id', row.id);
      sin_destinatario++;
      continue;
    }

    const modoPrueba = cfg.test_mode;
    const to = modoPrueba ? (cfg.test_email ?? real) : real;
    const banner = modoPrueba ? real : undefined;
    // CC: SOLO lo explícito de la audiencia. En prueba no se copia a nadie real.
    const cc = modoPrueba ? [] : (a.emails_cc ?? []);

    const tmpl = row.plantilla === 'previo_2horas'
      ? emailAudienciaCorta(a, { bannerPruebaPara: banner })
      : row.plantilla === 'reprogramacion'
        ? emailAudiencia(a, { bannerPruebaPara: banner, reprogramada: true })
        : emailAudiencia(a, { bannerPruebaPara: banner });

    // El corto (2h) no lleva .ics; el de 2 días y el de reprogramación sí
    // (reprogramación con el SEQUENCE ya incrementado → el calendario actualiza).
    const attachments = row.plantilla === 'previo_2horas'
      ? [logoInlineAttachment()]
      : [logoInlineAttachment(), icsAttachmentAudiencia(a)];

    try {
      await sendMail({
        from: tmpl.from, to, subject: tmpl.subject, htmlBody: tmpl.html,
        ...(cc.length ? { cc } : {}),
        attachments,
      });
      await db().from('audiencias_recordatorios').update({
        estado: 'enviado',
        fecha_enviado: new Date().toISOString(),
        enviado_a_email: to,
        destinatario_email: real,
        es_prueba: modoPrueba,
        error: null,
      }).eq('id', row.id);
      enviados++;
    } catch (e: any) {
      await db().from('audiencias_recordatorios').update({
        estado: 'fallido', error: (e?.message ?? String(e)).slice(0, 500),
      }).eq('id', row.id);
      fallidos++;
    }
  }

  return { enviados, fallidos, sin_destinatario };
}
