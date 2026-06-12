// ============================================================================
// lib/services/mensajes-telegram.service.ts
// CRUD + dispatch de mensajes programados al bot de Telegram.
// Tabla: legal.mensajes_programados_telegram
// ============================================================================

import type Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { bloqueDatosAstronomicos } from '@/lib/services/astro';

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

// Elige una frase al azar. Si se pasa un pool propio con valores, usa ese;
// si no, cae al array genérico.
function fraseAleatoria(pool?: string[] | null): string {
  const frases = pool && pool.length > 0 ? pool : FRASES_MOTIVANTES;
  return frases[Math.floor(Math.random() * frases.length)];
}

// ── Types ──────────────────────────────────────────────────────────────────

export type DestinoMensaje = 'grupo' | 'privado';

export interface MensajeProgramado {
  id: string;
  nombre: string;
  destino: DestinoMensaje;
  telegram_chat_id: string | null; // si tiene valor, destino directo (ignora `destino`)
  hora_envio: string;          // 'HH:MM:SS'
  dias_semana: number[];       // 1=lun .. 7=dom
  dia_mes: number | null;      // 1-31; si tiene valor, mensual (ignora dias_semana)
  mensaje_template: string;
  usar_frase_motivante: boolean;
  frases_personalizadas: string[] | null; // pool propio de frases; NULL/vacío = genérico
  activo: boolean;
  ultima_enviada: string | null; // 'YYYY-MM-DD'
  created_at: string;
  updated_at: string;
}

export interface MensajeInput {
  nombre: string;
  destino: DestinoMensaje;
  telegram_chat_id?: string | null;
  hora_envio: string;          // 'HH:MM' o 'HH:MM:SS'
  dias_semana: number[];
  dia_mes?: number | null;
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

function gtNowParts(): { fecha: string; minutosTotales: number; weekdayIso: number; diaMes: number } {
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
  const diaMes = parseInt(
    new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric' }).format(now),
    10,
  );
  // Intl weekday short: Mon=1 .. Sun=7 (we want ISO 1=lun..7=dom)
  const wkShort = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    fecha,
    minutosTotales: hora * 60 + minuto,
    weekdayIso: map[wkShort] ?? 1,
    diaMes,
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

export function renderTemplate(
  template: string,
  opts: { usarFrase: boolean; frasesPersonalizadas?: string[] | null },
): string {
  let out = template;
  if (opts.usarFrase) {
    out = out.replace(/\{frase_motivante\}/g, fraseAleatoria(opts.frasesPersonalizadas));
  }
  out = out.replace(/\{nombre_asistente\}/g, NOMBRE_ASISTENTE);
  out = out.replace(/\{fecha_hoy\}/g, fechaHoyEspanol());
  return out;
}

// ── Reporte astrológico ({reporte_astrologico}) ─────────────────────────────
// Genera un reporte semanal de astrología con la API de Anthropic + web_search
// para las efemérides reales de la semana. Cache en memoria por día.

const TELEGRAM_MAX_CHARS = 4096;

// Configuración por persona del reporte astrológico. La variable del template
// determina qué config se usa: {reporte_astrologico} → Anita,
// {reporte_astrologico_amanda} → Amanda.
interface ReporteAstroConfig {
  key: string;
  variable: string;
  nombre: string;
  signo: string;
  simbolo: string;
  ascendente: string;
  simboloAsc: string;
  promptExtra?: string;
  maxChars: number;
  incluyeDoceSignos: boolean;
  fallback: string;
}

const REPORTE_CONFIG_ANITA: ReporteAstroConfig = {
  key: 'anita',
  variable: '{reporte_astrologico}',
  nombre: 'Anita',
  signo: 'Cáncer',
  simbolo: '♋',
  ascendente: 'Acuario',
  simboloAsc: '♒',
  maxChars: 3500,
  incluyeDoceSignos: true,
  fallback:
    '🔮 Los astros están en silencio esta semana, pero tu energía Cáncer con ascendente Acuario sigue brillando. ¡Hermosa semana! ❤️',
};

const REPORTE_CONFIG_AMANDA: ReporteAstroConfig = {
  key: 'amanda',
  variable: '{reporte_astrologico_amanda}',
  nombre: 'Amanda',
  signo: 'Capricornio',
  simbolo: '♑',
  ascendente: 'Escorpio',
  simboloAsc: '♏',
  promptExtra:
    'Amanda nació el 12 de enero de 1986 a la 1:25 AM. Su reporte debe ser más íntimo y personal, enfocado en trabajo, finanzas y energía personal. NO incluir los 12 signos — solo su sección personalizada, tránsitos principales, luna y consejo.',
  maxChars: 2000,
  incluyeDoceSignos: false,
  fallback:
    '🌟 Los astros están en pausa esta semana, pero tu energía Capricornio con ascendente Escorpio sigue imparable. ¡Hermosa semana! ✨',
};

// Orden de evaluación. La variable de Amanda contiene literalmente la cadena de
// Anita como prefijo, pero al exigir la llave de cierre `}` en includes() no hay
// colisión: '{reporte_astrologico}' ≠ '{reporte_astrologico_amanda}'.
const REPORTE_CONFIGS: ReporteAstroConfig[] = [REPORTE_CONFIG_ANITA, REPORTE_CONFIG_AMANDA];

// Símbolos de los 12 signos (orden zodiacal). Se usan para truncar sin partir
// un signo a la mitad si el mensaje excede el límite de Telegram.
const SIGNOS_ZODIACO = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

// Cache en memoria por persona: si ya se generó el reporte hoy (en este
// proceso), se reusa para no llamar a la API dos veces el mismo día.
const reporteCache = new Map<string, { fecha: string; texto: string }>();

// El reporte del sábado cubre del sábado actual al viernes siguiente.
function semanaReporte(): { inicio: string; fin: string; inicioDate: Date } {
  const hoyStr = new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  // Mediodía local para evitar saltos por DST / medianoche al sumar días.
  const inicioDate = new Date(`${hoyStr}T12:00:00`);
  const fin = new Date(inicioDate);
  fin.setDate(fin.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('es-GT', { day: 'numeric', month: 'long' });
  return { inicio: fmt(inicioDate), fin: fmt(fin), inicioDate };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Si el texto excede el límite de Telegram, trunca en el último signo completo
// que quepa (corta justo antes del símbolo del signo que se desbordaría).
function truncarParaTelegram(text: string, limite = TELEGRAM_MAX_CHARS): string {
  if (text.length <= limite) return text;
  const recortado = text.slice(0, limite);
  let corte = -1;
  for (const s of SIGNOS_ZODIACO) {
    const idx = recortado.lastIndexOf(s);
    if (idx > corte) corte = idx;
  }
  return corte > 0 ? text.slice(0, corte).trimEnd() : recortado;
}

function systemPromptReporte(config: ReporteAstroConfig, inicio: string, fin: string): string {
  const NOMBRE_UP = config.nombre.toUpperCase();
  const extra = config.promptExtra ? `\n\n${config.promptExtra}` : '';

  // La sección de los 12 signos (y la numeración del consejo) varía según la
  // persona: el reporte de Amanda es más íntimo y omite los 12 signos.
  const seccionFinal = config.incluyeDoceSignos
    ? `4. ⭐ LOS 12 SIGNOS:
Para cada signo (♈♉♊♋♌♍♎♏♐♑♒♓) una predicción de 1-2 líneas.

5. 💫 CONSEJO DE LA SEMANA:
Un consejo basado en la energía planetaria predominante.`
    : `4. 💫 CONSEJO DE LA SEMANA:
Un consejo personalizado para ${config.signo}/${config.ascendente} basado en la energía planetaria predominante.`;

  return `Eres una astróloga profesional experta en tránsitos planetarios, aspectos y casas astrológicas. Escribes reportes semanales detallados con conocimiento real de efemérides.

Genera un reporte astrológico para la semana del ${inicio} al ${fin} de 2026.

REGLAS ABSOLUTAS:
- Usa ÚNICAMENTE las posiciones planetarias y aspectos proporcionados en DATOS ASTRONÓMICOS REALES
- NO inventes posiciones de planetas
- NO inventes aspectos que no estén en la lista proporcionada
- Si un aspecto no está en los datos, NO lo menciones
- Los signos de cada planeta son EXACTOS y no deben cambiarse
- La fase lunar es EXACTA y no debe cambiarse
- Puedes interpretar los significados astrológicos de los datos reales, pero NO cambiar los datos mismos
- Si no estás seguro de algo, omítelo en vez de inventarlo

IMPORTANTE: El reporte es para ${config.nombre}, Sol en ${config.signo} (${config.simbolo}) con Ascendente en ${config.ascendente} (${config.simboloAsc}). Personaliza la primera sección para ${config.nombre}.${extra}

Estructura del reporte:

1. ${config.simbolo} TU SEMANA, ${NOMBRE_UP} (${config.signo} ☀️ · ${config.ascendente} ↑):
Predicción personalizada de 4-5 líneas basada en los tránsitos que afectan a ${config.signo} y cómo su ascendente ${config.ascendente} modifica la energía. Menciona qué planetas transitan sus casas solares y del ascendente.

2. 🪐 TRÁNSITOS PRINCIPALES:
Los 3-4 aspectos planetarios más importantes de la semana. Usa símbolos: cuadraturas □, trígonos △, oposiciones ☍, conjunciones ☌, sextiles ⚹. Símbolos planetarios: ☿☀♂♃♄♅♆♇♀☽. Explica brevemente el efecto de cada aspecto.

3. 🌙 LUNA:
Fase lunar (usa los datos lunares reales proporcionados), en qué signo transita y qué energía trae.

${seccionFinal}

Formato: texto plano para Telegram con emojis. NO uses markdown, NO uses asteriscos para negritas. Máximo ${config.maxChars} caracteres.
Empieza directamente con: ${config.simbolo} TU SEMANA, ${NOMBRE_UP}
No repitas el título del reporte (ya está en el template).`;
}

// Deadline total para la generación. DEBE ser menor que el maxDuration de las
// rutas para convertir un timeout duro de Vercel (504) en un fallback elegante:
// si Anthropic tarda demasiado, abortamos, se captura el error y se envía
// el fallback de la config en vez de matar la función. Sin web_search ni thinking la
// respuesta debería llegar en 10-15s, así que 30s es holgado.
const REPORTE_DEADLINE_MS = 30_000;

// Llama a la API de Anthropic (llamada directa, SIN tools ni thinking) para que
// sea rápida: Claude genera el reporte con su conocimiento de astrología y los
// datos lunares reales. Parametrizada por persona (config). Devuelve texto
// plano, o el fallback de la config si algo falla.
async function generarReporteAstro(config: ReporteAstroConfig): Promise<string> {
  const t0 = Date.now();
  const { inicio, fin, inicioDate } = semanaReporte();
  // Datos astronómicos reales (posiciones planetarias + luna + aspectos,
  // calculados sin red) para que el modelo no invente posiciones ni signos.
  const datosAstro = bloqueDatosAstronomicos(inicioDate);
  const tieneKey = !!process.env.ANTHROPIC_API_KEY;
  console.log(
    `[reporte-astro:${config.key}] Iniciando generación | semana ${inicio} → ${fin} | ANTHROPIC_API_KEY presente=${tieneKey}`,
  );
  console.log(`[reporte-astro:${config.key}] Datos astronómicos reales:\n${datosAstro}`);

  if (!tieneKey) {
    console.error(`[reporte-astro:${config.key}] ANTHROPIC_API_KEY NO está en el entorno → fallback`);
    return config.fallback;
  }

  // Tiempo restante antes del deadline, que pasamos como timeout al request.
  const restante = () => REPORTE_DEADLINE_MS - (Date.now() - t0);

  try {
    const client = getAnthropicClient();

    console.log(`[reporte-astro:${config.key}] Llamando a Anthropic | model=claude-sonnet-4-6 | sin tools, sin thinking`);
    // Llamada directa: sin tools (web_search) ni thinking → rápida (~10-15s).
    // timeout = deadline restante; maxRetries: 0 para que el backoff del SDK no
    // consuma el presupuesto de tiempo.
    const response = await client.messages.create(
      {
        model: 'claude-sonnet-4-6',
        // El reporte cabe en ~3000 caracteres; 1500 tokens son suficientes.
        max_tokens: 1500,
        system: systemPromptReporte(config, inicio, fin),
        messages: [
          {
            role: 'user',
            content:
              `Genera el reporte astrológico para la semana del ${inicio} al ${fin} de 2026 para ${config.nombre}.\n\n` +
              `${datosAstro}`,
          },
        ],
      },
      { timeout: restante(), maxRetries: 0 },
    );

    const texto = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();

    console.log(
      `[reporte-astro:${config.key}] Respuesta Anthropic | stop_reason=${response.stop_reason} | ` +
      `bloques=${response.content.length} | textoLen=${texto.length} | ${Date.now() - t0}ms`,
    );

    if (!texto) throw new Error('Respuesta vacía del modelo (sin bloques de texto)');
    return texto;
  } catch (err) {
    console.error(
      `[reporte-astro:${config.key}] Error generando reporte (${Date.now() - t0}ms) → fallback:`,
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    return config.fallback;
  }
}

// Wrapper con cache diario por persona: no regenera si ya se produjo hoy.
async function obtenerReporteAstro(config: ReporteAstroConfig): Promise<string> {
  const hoy = gtToday();
  const cached = reporteCache.get(config.key);
  if (cached && cached.fecha === hoy) return cached.texto;

  const texto = await generarReporteAstro(config);
  if (texto !== config.fallback) {
    reporteCache.set(config.key, { fecha: hoy, texto });
  }
  return texto;
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

// Resuelve el chat destino de un mensaje:
//  - si telegram_chat_id tiene valor → se usa directamente
//  - si es NULL → mapeo por destino (grupo = TELEGRAM_GROUP_CHAT_ID, privado = default)
function resolveChatId(m: MensajeProgramado): string | undefined {
  if (m.telegram_chat_id && m.telegram_chat_id.trim()) return m.telegram_chat_id.trim();
  return chatIdFor(m.destino);
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
  // Mensaje mensual: dia_mes 1-31. Cuando es mensual, dias_semana se ignora y
  // no se exige.
  const esMensual = input.dia_mes != null;
  if (input.dia_mes != null) {
    if (typeof input.dia_mes !== 'number' || !Number.isInteger(input.dia_mes) || input.dia_mes < 1 || input.dia_mes > 31) {
      throw new MensajeTelegramError('dia_mes debe ser un entero entre 1 y 31');
    }
  }
  if (input.dias_semana !== undefined && !esMensual) {
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
      telegram_chat_id: input.telegram_chat_id?.trim() || null,
      hora_envio: normalizarHora(input.hora_envio),
      dias_semana: input.dias_semana,
      dia_mes: input.dia_mes ?? null,
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
  if (input.telegram_chat_id !== undefined) update.telegram_chat_id = input.telegram_chat_id?.trim() || null;
  if (input.hora_envio !== undefined) update.hora_envio = normalizarHora(input.hora_envio);
  if (input.dias_semana !== undefined) update.dias_semana = input.dias_semana;
  if (input.dia_mes !== undefined) update.dia_mes = input.dia_mes ?? null;
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

  const { fecha, minutosTotales, weekdayIso, diaMes } = gtNowParts();

  let enviados = 0;
  let evaluados = 0;
  const errores: Array<{ id: string; nombre: string; error: string }> = [];

  for (const m of activos) {
    // Programación: mensual (dia_mes) vs semanal (dias_semana).
    if (m.dia_mes != null) {
      // Mensual: solo el día del mes indicado; dias_semana se ignora.
      if (diaMes !== m.dia_mes) continue;
    } else {
      // Semanal: día de la semana (ISO 1=lun..7=dom).
      if (!m.dias_semana.includes(weekdayIso)) continue;
    }

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
export async function enviarMensaje(m: MensajeProgramado): Promise<string> {
  let text = renderTemplate(m.mensaje_template, {
    usarFrase: m.usar_frase_motivante,
    frasesPersonalizadas: m.frases_personalizadas,
  });

  // Reportes astrológicos: {reporte_astrologico} (Anita) y
  // {reporte_astrologico_amanda} (Amanda). Cada uno se genera vía Anthropic con
  // su propia config. Se escapa el HTML (texto plano) y se trunca al final.
  let usoReporte = false;
  for (const config of REPORTE_CONFIGS) {
    if (!text.includes(config.variable)) continue;
    usoReporte = true;
    console.log(`[reporte-astro:${config.key}] "${m.nombre}" usa ${config.variable} (templateLen=${m.mensaje_template.length})`);
    const reporteRaw = await obtenerReporteAstro(config);
    const esFallback = reporteRaw === config.fallback;
    text = text.split(config.variable).join(escapeHtml(reporteRaw));
    console.log(`[reporte-astro:${config.key}] Reemplazado | esFallback=${esFallback}`);
  }
  if (usoReporte) {
    text = truncarParaTelegram(text);
    console.log(`[reporte-astro] Texto final para Telegram | len=${text.length}`);
  }

  const chatId = resolveChatId(m);
  await sendTelegramMessage(text, { parse_mode: 'HTML', chatId });
  return text;
}

/**
 * Envía un mensaje específico ahora (botón "Enviar ahora" del admin).
 * Marca ultima_enviada=hoy para evitar doble envío del cron.
 */
export async function enviarAhora(id: string): Promise<{ ok: true; preview: string }> {
  const m = await obtenerMensaje(id);
  const preview = await enviarMensaje(m);

  await db()
    .from('mensajes_programados_telegram')
    .update({ ultima_enviada: gtToday(), updated_at: new Date().toISOString() })
    .eq('id', id);

  return { ok: true, preview };
}
