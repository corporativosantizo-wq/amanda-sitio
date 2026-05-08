// ============================================================================
// lib/services/mensajes-telegram.service.ts
// CRUD + dispatch de mensajes programados al bot de Telegram.
// Tabla: legal.mensajes_programados_telegram
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/molly/telegram';

const db = () => createAdminClient();
const TZ = 'America/Guatemala';

const NOMBRE_ASISTENTE = 'Mariano';

// ── Frases motivantes (rotación aleatoria) ─────────────────────────────────

export const FRASES_MOTIVANTES: string[] = [
  'Cada trámite resuelto hoy es un cliente más tranquilo mañana.',
  'La constancia en los detalles es lo que distingue a los grandes profesionales.',
  'Un día bien organizado vale por tres días corriendo.',
  'La excelencia es un hábito, no un acto aislado.',
  'Tu trabajo silencioso sostiene victorias visibles.',
  'Hoy es un buen día para sorprender con eficiencia.',
  'La disciplina de la mañana define los resultados de la tarde.',
  'Cada notificación revisada a tiempo es un riesgo evitado.',
  'Lo que se mide se mejora; lo que se atiende se resuelve.',
  'El profesionalismo se construye un caso a la vez.',
  'La diligencia de hoy es la reputación de mañana.',
  'Un buen abogado nunca improvisa; siempre verifica.',
  'La puntualidad es la cortesía silenciosa de los expedientes.',
  'Los detalles que otros pasan por alto son los que tú dominas.',
  'El éxito es la suma de pequeños esfuerzos repetidos cada día.',
  'Hoy tienes la oportunidad de ser mejor que ayer.',
  'La paciencia y la precisión son aliadas inseparables del derecho.',
  'No hay tarea pequeña cuando se hace con responsabilidad.',
  'La organización es la antesala de la tranquilidad.',
  'Cada plazo cumplido es una promesa honrada.',
  'El ritmo lo marcas tú; la calidad la define tu enfoque.',
  'La preparación silenciosa vence a la prisa ruidosa.',
  'Un proceso bien llevado habla por sí solo.',
  'La integridad se nota en lo que haces cuando nadie está mirando.',
  'Hoy es buen día para dejar todo un paso adelante.',
];

function fraseAleatoria(): string {
  return FRASES_MOTIVANTES[Math.floor(Math.random() * FRASES_MOTIVANTES.length)];
}

// ── Types ──────────────────────────────────────────────────────────────────

export type DestinoMensaje = 'grupo' | 'privado';

export interface MensajeProgramado {
  id: string;
  nombre: string;
  destino: DestinoMensaje;
  hora_envio: string;          // 'HH:MM:SS'
  dias_semana: number[];       // 1=lun .. 7=dom
  mensaje_template: string;
  usar_frase_motivante: boolean;
  activo: boolean;
  ultima_enviada: string | null; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
}

export interface MensajeInput {
  nombre: string;
  destino: DestinoMensaje;
  hora_envio: string;          // 'HH:MM' o 'HH:MM:SS'
  dias_semana: number[];
  mensaje_template: string;
  usar_frase_motivante?: boolean;
  activo?: boolean;
}

export class MensajeTelegramError extends Error {
  constructor(msg: string, public details?: unknown) {
    super(msg);
    this.name = 'MensajeTelegramError';
  }
}

// ── GT helpers ─────────────────────────────────────────────────────────────

function gtToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function gtNowParts(): { fecha: string; minutosTotales: number; weekdayIso: number } {
  const now = new Date();
  const fecha = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const hora = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(now),
    10,
  );
  const minuto = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, minute: 'numeric' }).format(now),
    10,
  );
  // Intl weekday short: Mon=1 .. Sun=7 (we want ISO 1=lun..7=dom)
  const wkShort = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    fecha,
    minutosTotales: hora * 60 + minuto,
    weekdayIso: map[wkShort] ?? 1,
  };
}

function fechaHoyEspanol(): string {
  return new Date().toLocaleDateString('es-GT', {
    timeZone: TZ,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ── Template rendering ─────────────────────────────────────────────────────

export function renderTemplate(template: string, opts: { usarFrase: boolean }): string {
  let out = template;
  if (opts.usarFrase) {
    out = out.replace(/\{frase_motivante\}/g, fraseAleatoria());
  }
  out = out.replace(/\{nombre_asistente\}/g, NOMBRE_ASISTENTE);
  out = out.replace(/\{fecha_hoy\}/g, fechaHoyEspanol());
  return out;
}

function chatIdFor(destino: DestinoMensaje): string | undefined {
  if (destino === 'grupo') {
    const groupId = process.env.TELEGRAM_GROUP_CHAT_ID;
    if (!groupId) {
      throw new MensajeTelegramError('TELEGRAM_GROUP_CHAT_ID no está configurado');
    }
    return groupId;
  }
  // privado: undefined = sendTelegramMessage usa TELEGRAM_CHAT_ID por defecto
  return undefined;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function listarMensajes(): Promise<MensajeProgramado[]> {
  const { data, error } = await db()
    .from('mensajes_programados_telegram')
    .select('*')
    .order('hora_envio', { ascending: true });

  if (error) throw new MensajeTelegramError('Error al listar mensajes', error);
  return data ?? [];
}

export async function obtenerMensaje(id: string): Promise<MensajeProgramado> {
  const { data, error } = await db()
    .from('mensajes_programados_telegram')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new MensajeTelegramError('Mensaje no encontrado', error);
  return data;
}

function validarInput(input: Partial<MensajeInput>): void {
  if (input.destino && !['grupo', 'privado'].includes(input.destino)) {
    throw new MensajeTelegramError('destino debe ser "grupo" o "privado"');
  }
  if (input.dias_semana !== undefined) {
    if (!Array.isArray(input.dias_semana) || input.dias_semana.length === 0) {
      throw new MensajeTelegramError('Selecciona al menos un día de la semana');
    }
    for (const d of input.dias_semana) {
      if (typeof d !== 'number' || d < 1 || d > 7) {
        throw new MensajeTelegramError('días_semana inválido (debe ser 1-7)');
      }
    }
  }
  if (input.hora_envio !== undefined) {
    if (!/^\d{2}:\d{2}(:\d{2})?$/.test(input.hora_envio)) {
      throw new MensajeTelegramError('hora_envio debe tener formato HH:MM');
    }
  }
  if (input.nombre !== undefined && !input.nombre.trim()) {
    throw new MensajeTelegramError('El nombre es obligatorio');
  }
  if (input.mensaje_template !== undefined && !input.mensaje_template.trim()) {
    throw new MensajeTelegramError('El mensaje no puede estar vacío');
  }
}

function normalizarHora(h: string): string {
  return h.length === 5 ? `${h}:00` : h;
}

export async function crearMensaje(input: MensajeInput): Promise<MensajeProgramado> {
  validarInput(input);

  const { data, error } = await db()
    .from('mensajes_programados_telegram')
    .insert({
      nombre: input.nombre.trim(),
      destino: input.destino,
      hora_envio: normalizarHora(input.hora_envio),
      dias_semana: input.dias_semana,
      mensaje_template: input.mensaje_template,
      usar_frase_motivante: input.usar_frase_motivante ?? false,
      activo: input.activo ?? true,
    })
    .select('*')
    .single();

  if (error || !data) throw new MensajeTelegramError('Error al crear mensaje', error);
  return data;
}

export async function actualizarMensaje(
  id: string,
  input: Partial<MensajeInput>,
): Promise<MensajeProgramado> {
  validarInput(input);

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.nombre !== undefined) update.nombre = input.nombre.trim();
  if (input.destino !== undefined) update.destino = input.destino;
  if (input.hora_envio !== undefined) update.hora_envio = normalizarHora(input.hora_envio);
  if (input.dias_semana !== undefined) update.dias_semana = input.dias_semana;
  if (input.mensaje_template !== undefined) update.mensaje_template = input.mensaje_template;
  if (input.usar_frase_motivante !== undefined) update.usar_frase_motivante = input.usar_frase_motivante;
  if (input.activo !== undefined) update.activo = input.activo;

  const { data, error } = await db()
    .from('mensajes_programados_telegram')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !data) throw new MensajeTelegramError('Error al actualizar mensaje', error);
  return data;
}

export async function eliminarMensaje(id: string): Promise<void> {
  const { error } = await db()
    .from('mensajes_programados_telegram')
    .delete()
    .eq('id', id);

  if (error) throw new MensajeTelegramError('Error al eliminar mensaje', error);
}

// ── Dispatch ───────────────────────────────────────────────────────────────

/**
 * Procesa todos los mensajes activos. Para cada uno:
 *  - chequea día de la semana (ISO: 1=lun..7=dom) en GT
 *  - chequea ventana de ±7 minutos vs hora_envio
 *  - dedup vía ultima_enviada = hoy
 * Devuelve el resumen de envíos.
 */
export async function processScheduledMessages(): Promise<{
  total: number;
  evaluados: number;
  enviados: number;
  errores: Array<{ id: string; nombre: string; error: string }>;
}> {
  const mensajes = await listarMensajes();
  const activos = mensajes.filter(m => m.activo);

  const { fecha, minutosTotales, weekdayIso } = gtNowParts();

  let enviados = 0;
  let evaluados = 0;
  const errores: Array<{ id: string; nombre: string; error: string }> = [];

  for (const m of activos) {
    // Día de la semana
    if (!m.dias_semana.includes(weekdayIso)) continue;

    // Dedup: ya se envió hoy
    if (m.ultima_enviada === fecha) continue;

    // Ventana ±7 min
    const [h, min] = m.hora_envio.split(':').map(Number);
    const targetMin = h * 60 + min;
    if (Math.abs(minutosTotales - targetMin) > 7) continue;

    evaluados++;
    try {
      await enviarMensaje(m);
      await db()
        .from('mensajes_programados_telegram')
        .update({ ultima_enviada: fecha, updated_at: new Date().toISOString() })
        .eq('id', m.id);
      enviados++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      errores.push({ id: m.id, nombre: m.nombre, error: msg });
      console.error(`[mensajes-telegram] Error enviando "${m.nombre}":`, msg);
    }
  }

  return { total: activos.length, evaluados, enviados, errores };
}

/**
 * Renderiza y envía un mensaje a su destino. No actualiza ultima_enviada (eso
 * lo hace processScheduledMessages para el flujo automático).
 */
export async function enviarMensaje(m: MensajeProgramado): Promise<void> {
  const text = renderTemplate(m.mensaje_template, { usarFrase: m.usar_frase_motivante });
  const chatId = chatIdFor(m.destino);
  await sendTelegramMessage(text, { parse_mode: 'HTML', chatId });
}

/**
 * Envía un mensaje específico ahora (botón "Enviar ahora" del admin).
 * Marca ultima_enviada=hoy para evitar doble envío del cron.
 */
export async function enviarAhora(id: string): Promise<{ ok: true; preview: string }> {
  const m = await obtenerMensaje(id);
  await enviarMensaje(m);

  await db()
    .from('mensajes_programados_telegram')
    .update({ ultima_enviada: gtToday(), updated_at: new Date().toISOString() })
    .eq('id', id);

  const preview = renderTemplate(m.mensaje_template, { usarFrase: m.usar_frase_motivante });
  return { ok: true, preview };
}
