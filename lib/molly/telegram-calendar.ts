// ============================================================================
// lib/molly/telegram-calendar.ts
// Flujos conversacionales de calendario para Telegram bot
// /crear — crear evento con botones inline (7 pasos)
// /cancelar — cancelar evento del día
// ============================================================================

import { sendTelegramMessage } from './telegram';
import {
  getCalendarEvents,
  findFreeSlots,
  getDayBounds,
  getNextBusinessDays,
  formatDateSpanish,
  gtDateStr,
} from './calendar';
import type { CalendarEvent } from './calendar';
import { createCalendarEvent, deleteCalendarEvent } from '@/lib/services/outlook.service';
import { HORARIOS } from '@/lib/types';
import type { TipoCita } from '@/lib/types';

// ── Conversation state (in-memory, single user) ────────────────────────────

interface CreateState {
  flow: 'crear';
  step: 'type' | 'day' | 'slot' | 'custom_time' | 'duration' | 'title' | 'client' | 'confirm';
  tipo?: TipoCita;
  tipoLabel?: string;
  tipoEmoji?: string;
  date?: Date;
  dateLabel?: string;
  horaInicio?: string;
  horaFin?: string;
  duracion?: number;
  titulo?: string;
  cliente?: string;
  isOnlineMeeting?: boolean;
  costo?: number;
  _nextDays?: Date[];
}

interface CancelState {
  flow: 'cancelar';
  step: 'select' | 'confirm';
  events?: CalendarEvent[];
  selectedEvent?: CalendarEvent;
}

type ConversationState = CreateState | CancelState | null;

let conversation: ConversationState = null;

export function getConversation(): ConversationState {
  return conversation;
}

export function clearConversation(): void {
  conversation = null;
}

// ── /crear flow ─────────────────────────────────────────────────────────────

const CREAR_TIPOS: Array<{
  id: TipoCita;
  label: string;
  emoji: string;
  duracion: number;
  teams: boolean;
  costo: number;
}> = [
  { id: 'consulta_nueva', label: 'Consulta', emoji: '\u2696\uFE0F', duracion: 60, teams: true, costo: 500 },
  { id: 'seguimiento', label: 'Seguimiento', emoji: '\uD83D\uDD04', duracion: 15, teams: true, costo: 0 },
  { id: 'audiencia', label: 'Audiencia', emoji: '\uD83C\uDFDB\uFE0F', duracion: 120, teams: false, costo: 0 },
  { id: 'reunion', label: 'Reuni\u00F3n', emoji: '\uD83D\uDC65', duracion: 60, teams: true, costo: 0 },
  { id: 'bloqueo_personal', label: 'Bloqueo', emoji: '\u25FC', duracion: 60, teams: false, costo: 0 },
  { id: 'evento_libre', label: 'Evento', emoji: '\u2726', duracion: 60, teams: false, costo: 0 },
];

const DEEP_WORK_END = 14;

const DURATION_OPTIONS = [
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 hora' },
  { min: 120, label: '2 horas' },
];

export async function startCreateFlow(): Promise<void> {
  conversation = { flow: 'crear', step: 'type' };

  const buttons = CREAR_TIPOS.map((t) => ({
    text: `${t.emoji} ${t.label}`,
    callback_data: `cal_type:${t.id}`,
  }));

  await sendTelegramMessage(
    '\uD83D\uDCC5 <b>Crear evento</b>\n\n\u00BFQu\u00E9 tipo de evento?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [buttons.slice(0, 2), buttons.slice(2, 4), buttons.slice(4, 6)],
      },
    },
  );
}

export async function handleCreateCallback(data: string): Promise<void> {
  if (!conversation || conversation.flow !== 'crear') return;
  const state = conversation;

  // ── Step 1: Type selected → Day
  if (data.startsWith('cal_type:')) {
    const tipoId = data.split(':')[1] as TipoCita;
    const tipoInfo = CREAR_TIPOS.find((t) => t.id === tipoId);
    if (!tipoInfo) return;

    state.tipo = tipoId;
    state.tipoLabel = tipoInfo.label;
    state.tipoEmoji = tipoInfo.emoji;
    state.duracion = tipoInfo.duracion;
    state.isOnlineMeeting = tipoInfo.teams;
    state.costo = tipoInfo.costo;
    state.step = 'day';

    const now = new Date();
    const nextDays = getNextBusinessDays(now, 5);
    state._nextDays = nextDays;

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mi\u00E9', 'Jue', 'Vie', 'S\u00E1b'];
    const row1 = [
      { text: 'Hoy', callback_data: 'cal_day:0' },
      { text: 'Ma\u00F1ana', callback_data: 'cal_day:1' },
    ];
    const row2 = nextDays.slice(0, 3).map((d: Date, i: number) => ({
      text: `${dayNames[d.getDay()]} ${d.getDate()}`,
      callback_data: `cal_day:bd_${i}`,
    }));
    const row3 = nextDays.slice(3, 5).map((d: Date, i: number) => ({
      text: `${dayNames[d.getDay()]} ${d.getDate()}`,
      callback_data: `cal_day:bd_${i + 3}`,
    }));

    const keyboard = [row1, row2];
    if (row3.length > 0) keyboard.push(row3);

    await sendTelegramMessage(
      `${tipoInfo.emoji} <b>${tipoInfo.label}</b>\n\n\u00BFQu\u00E9 d\u00EDa?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } },
    );
    return;
  }

  // ── Step 2: Day selected → Slot
  if (data.startsWith('cal_day:')) {
    const dayArg = data.split(':')[1];
    const now = new Date();

    let selectedDate: Date;
    if (dayArg === '0') {
      selectedDate = now;
    } else if (dayArg === '1') {
      selectedDate = new Date(now);
      selectedDate.setDate(selectedDate.getDate() + 1);
    } else if (dayArg.startsWith('bd_')) {
      const idx = parseInt(dayArg.slice(3), 10);
      const nextDays = state._nextDays as Date[];
      selectedDate = nextDays[idx];
    } else {
      return;
    }

    state.date = selectedDate;
    state.dateLabel = formatDateSpanish(selectedDate);
    state.step = 'slot';

    const isFreeType = state.tipo === 'audiencia' || state.tipo === 'bloqueo_personal';

    if (isFreeType) {
      state.step = 'custom_time';
      await sendTelegramMessage(
        `\uD83D\uDCC5 <b>${state.tipoLabel}</b> \u2014 ${state.dateLabel}\n\n` +
        'Escribe la hora de inicio (ej: <code>10:30</code> o <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const freeSlots = await findFreeSlots(selectedDate, state.duracion ?? 30);

    if (freeSlots.length === 0) {
      state.step = 'custom_time';
      await sendTelegramMessage(
        `\uD83D\uDCC5 <b>${state.tipoLabel}</b> \u2014 ${state.dateLabel}\n\n` +
        'No hay slots sugeridos. Escribe la hora (ej: <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    const slotButtons = freeSlots.slice(0, 6).map((s: any) => {
      const time = s.start.substring(11, 16);
      const label = `${formatHora12(time)}${s.preferred ? ' \u2B50' : ''}`;
      return { text: label, callback_data: `cal_slot:${time}` };
    });

    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < slotButtons.length; i += 3) {
      rows.push(slotButtons.slice(i, i + 3));
    }
    rows.push([{ text: '\u270F\uFE0F Personalizado', callback_data: 'cal_slot:custom' }]);

    await sendTelegramMessage(
      `\uD83D\uDCC5 <b>${state.tipoLabel}</b> \u2014 ${state.dateLabel}\n\n` +
      `Selecciona horario:\n\u2B50 = horario preferido (tarde)`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
    );
    return;
  }

  // ── Step 3: Slot selected → Duration
  if (data.startsWith('cal_slot:')) {
    const slotArg = data.split(':').slice(1).join(':');

    if (slotArg === 'custom') {
      state.step = 'custom_time';
      await sendTelegramMessage(
        'Escribe la hora de inicio (ej: <code>10:30</code> o <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    state.horaInicio = slotArg;
    await showDurationStep(state);
    return;
  }

  // ── Step 4: Duration selected → Title
  if (data.startsWith('cal_dur:')) {
    const min = parseInt(data.split(':')[1], 10);
    state.duracion = min;

    const [h, m] = (state.horaInicio ?? '09:00').split(':').map(Number);
    const endTotal = h * 60 + m + min;
    state.horaFin = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

    state.step = 'title';
    await sendTelegramMessage(
      `\u23F0 ${formatHora12(state.horaInicio!)} \u2014 ${formatHora12(state.horaFin)} (${min} min)\n\nEscribe el t\u00EDtulo del evento:`,
    );
    return;
  }

  // ── Step 6b: Client skip → Confirm
  if (data === 'cal_client_skip') {
    state.cliente = undefined;
    await showConfirmation(state);
    return;
  }

  // ── Step 7: Confirm
  if (data.startsWith('cal_confirm:')) {
    const answer = data.split(':')[1];

    if (answer === 'no') {
      await sendTelegramMessage('\u274C Evento descartado.');
      conversation = null;
      return;
    }

    if (answer === 'yes') {
      await createEventFromState(state);
      return;
    }
  }
}

export async function handleCreateText(text: string): Promise<void> {
  if (!conversation || conversation.flow !== 'crear') return;
  const state = conversation;

  // ── Custom time input → Duration
  if (state.step === 'custom_time') {
    const match = text.trim().match(/^(\d{1,2}):?(\d{2})$/);
    if (!match) {
      await sendTelegramMessage('Formato no v\u00E1lido. Escribe la hora como <code>14:00</code> o <code>1030</code>', { parse_mode: 'HTML' });
      return;
    }

    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      await sendTelegramMessage('Hora no v\u00E1lida. Intenta de nuevo (ej: <code>14:00</code>)', { parse_mode: 'HTML' });
      return;
    }

    state.horaInicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    await showDurationStep(state);
    return;
  }

  // ── Title input → Client
  if (state.step === 'title') {
    const titulo = text.trim();
    if (!titulo) {
      await sendTelegramMessage('El t\u00EDtulo no puede estar vac\u00EDo. Escribe el t\u00EDtulo:');
      return;
    }

    state.titulo = titulo;
    state.step = 'client';

    await sendTelegramMessage(
      `\u270D\uFE0F <b>${esc(titulo)}</b>\n\n\u00BFNombre del cliente? (o presiona Omitir)`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[{ text: '\u23ED Omitir', callback_data: 'cal_client_skip' }]],
        },
      },
    );
    return;
  }

  // ── Client input → Confirm
  if (state.step === 'client') {
    const cliente = text.trim();
    if (!cliente) {
      await sendTelegramMessage('\u00BFNombre del cliente?', {
        reply_markup: {
          inline_keyboard: [[{ text: '\u23ED Omitir', callback_data: 'cal_client_skip' }]],
        },
      });
      return;
    }

    state.cliente = cliente;
    await showConfirmation(state);
    return;
  }
}

// ── /crear helpers ──────────────────────────────────────────────────────────

async function showDurationStep(state: CreateState): Promise<void> {
  const hora = state.horaInicio ?? '09:00';
  const h = parseInt(hora.split(':')[0], 10);

  let warning = '';
  if (h < DEEP_WORK_END) {
    warning = '\n\u26A0\uFE0F <i>Este horario cae en Deep Work (8\u201414h)</i>\n';
  }

  state.step = 'duration';

  const defaultDur = state.duracion ?? 60;
  const buttons = DURATION_OPTIONS.map((opt) => ({
    text: `${opt.label}${opt.min === defaultDur ? ' \u2B50' : ''}`,
    callback_data: `cal_dur:${opt.min}`,
  }));

  await sendTelegramMessage(
    `\u23F0 Inicio: <b>${formatHora12(hora)}</b>${warning}\n\n\u00BFDuraci\u00F3n? (\u2B50 = sugerido)`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [buttons.slice(0, 2), buttons.slice(2, 4)] },
    },
  );
}

async function showConfirmation(state: CreateState): Promise<void> {
  state.step = 'confirm';

  const lines = [
    `\uD83D\uDCCB <b>Confirmar evento</b>\n`,
    `${state.tipoEmoji} <b>${state.tipoLabel}</b>`,
    `\uD83D\uDCC5 ${state.dateLabel}`,
    `\u23F0 ${formatHora12(state.horaInicio!)} \u2014 ${formatHora12(state.horaFin!)} (${state.duracion} min)`,
    `\u270D\uFE0F ${esc(state.titulo ?? '')}`,
  ];

  if (state.cliente) {
    lines.push(`\uD83D\uDC64 ${esc(state.cliente)}`);
  }
  if (state.isOnlineMeeting) {
    lines.push(`\uD83D\uDCBB Teams: S\u00ED`);
  }
  if (state.costo && state.costo > 0) {
    lines.push(`\uD83D\uDCB0 Q${state.costo.toLocaleString('es-GT')}`);
  }

  await sendTelegramMessage(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [[
        { text: '\u2705 Crear', callback_data: 'cal_confirm:yes' },
        { text: '\u274C Cancelar', callback_data: 'cal_confirm:no' },
      ]],
    },
  });
}

async function createEventFromState(state: CreateState): Promise<void> {
  const fechaStr = gtDateStr(state.date!);
  const config = HORARIOS[state.tipo!];

  let subject = state.titulo ?? state.tipoLabel ?? 'Evento';
  if (state.cliente) {
    subject = state.titulo
      ? `${state.titulo} \u2014 ${state.cliente}`
      : `${state.tipoLabel} \u2014 ${state.cliente}`;
  }

  const bodyParts = [
    `<p>Tipo: ${state.tipoLabel}</p>`,
    state.cliente ? `<p>Cliente: ${state.cliente}</p>` : '',
    state.costo && state.costo > 0 ? `<p>Honorario: Q${state.costo.toLocaleString('es-GT')}</p>` : '',
  ];
  const body = bodyParts.filter(Boolean).join('');

  try {
    await createCalendarEvent({
      subject,
      startDateTime: `${fechaStr}T${state.horaInicio}:00`,
      endDateTime: `${fechaStr}T${state.horaFin}:00`,
      attendees: [],
      isOnlineMeeting: state.isOnlineMeeting ?? false,
      categories: [config?.categoria_outlook ?? 'P\u00FArpura'],
      body,
    });

    let msg = `\u2705 <b>Evento creado</b>\n\n`;
    msg += `<b>${esc(subject)}</b>\n`;
    msg += `\uD83D\uDCC5 ${state.dateLabel}\n`;
    msg += `\u23F0 ${formatHora12(state.horaInicio!)} \u2014 ${formatHora12(state.horaFin!)}\n`;
    msg += `\uD83C\uDFF7 ${state.tipoEmoji} ${state.tipoLabel}`;
    if (state.isOnlineMeeting) msg += `\n\uD83D\uDCBB Link de Teams incluido`;
    if (state.costo && state.costo > 0) msg += `\n\uD83D\uDCB0 Q${state.costo.toLocaleString('es-GT')}`;

    await sendTelegramMessage(msg, { parse_mode: 'HTML' });
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error al crear evento: ${err.message}`);
  }

  conversation = null;
}

// ── /cancelar flow ──────────────────────────────────────────────────────────

export async function startCancelFlow(): Promise<void> {
  const now = new Date();
  const { start, end } = getDayBounds(now);
  const events = await getCalendarEvents(start, end);

  // Filter out all-day events
  const timed = events.filter((e) => !e.isAllDay);

  if (timed.length === 0) {
    await sendTelegramMessage('\uD83D\uDCC5 No hay eventos programados para hoy.');
    conversation = null;
    return;
  }

  conversation = { flow: 'cancelar', step: 'select', events: timed };

  const buttons = timed.map((e, i) => {
    const time = e.start.substring(11, 16);
    const label = `${formatHora12(time)} ${e.subject.substring(0, 20)}`;
    return [{ text: label, callback_data: `cal_cancel:${i}` }];
  });

  await sendTelegramMessage(
    '\u274C <b>Cancelar evento</b>\n\n\u00BFCu\u00E1l evento deseas cancelar?',
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons.slice(0, 8) } },
  );
}

export async function handleCancelCallback(data: string): Promise<void> {
  if (!conversation || conversation.flow !== 'cancelar') return;
  const state = conversation;

  // ── Select event
  if (data.startsWith('cal_cancel:')) {
    const idx = parseInt(data.split(':')[1], 10);
    const event = state.events?.[idx];
    if (!event) return;

    state.selectedEvent = event;
    state.step = 'confirm';

    const time = event.start.substring(11, 16);

    await sendTelegramMessage(
      `\u00BFCancelar <b>${esc(event.subject)}</b> a las ${formatHora12(time)}?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '\u2705 S\u00ED, cancelar', callback_data: 'cal_confirm_cancel:yes' },
              { text: '\u274C No', callback_data: 'cal_confirm_cancel:no' },
            ],
          ],
        },
      },
    );
    return;
  }

  // ── Confirm cancel
  if (data.startsWith('cal_confirm_cancel:')) {
    const answer = data.split(':')[1];

    if (answer === 'no') {
      await sendTelegramMessage('Cancelaci\u00F3n descartada.');
      conversation = null;
      return;
    }

    const event = state.selectedEvent;
    if (!event) return;

    try {
      await deleteCalendarEvent(event.id);
      await sendTelegramMessage(
        `\u274C <b>Evento cancelado:</b> ${esc(event.subject)}`,
        { parse_mode: 'HTML' },
      );
    } catch (err: any) {
      await sendTelegramMessage(`Error al cancelar: ${err.message}`);
    }

    conversation = null;
    return;
  }
}

// ── University class reminders ────────────────────────────────────────────

const UNIVERSITY_TEAMS_LINK =
  'https://teams.microsoft.com/dl/launcher/launcher.html?url=%2F_%23%2Fl%2Fmeetup-join%2F19%3Ameeting_NWE3MDA2Y2ItNmRiNC00ZGI2LWI0OTItZTg2NzQwZjU2MzJi%40thread.v2%2F0%3Fcontext%3D%257b%2522Tid%2522%253a%252266f22055-85d8-4984-a4d8-2dd3ac2060b1%2522%252c%2522Oid%2522%253a%2522158e7702-4050-4943-8b04-c5a070024c29%2522%257d%26anon%3Dtrue&type=meetup-join&deeplinkId=973e7d8a-0c9d-4ca2-98c4-b09fb636e19e&directDl=true&msLaunch=true&enableMobilePage=true&suppressPrompt=true';
const UNIVERSITY_AULA_URL = 'https://cursos.amandasantizo.com';

/** Format Date as Guatemala ISO string for Graph API queries */
function toGtISO(date: Date): string {
  const ds = gtDateStr(date);
  const ts = date.toLocaleTimeString('en-GB', { timeZone: 'America/Guatemala', hour12: false });
  return `${ds}T${ts}`;
}

/**
 * Check for upcoming [CLASE] events and send Telegram reminder 15 min before.
 * Window: events starting in 10-20 min from now (10-min wide, no overlap with 15-min cron).
 */
export async function checkClassReminders(): Promise<number> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 10 * 60_000);
  const windowEnd = new Date(now.getTime() + 20 * 60_000);

  const events = await getCalendarEvents(toGtISO(windowStart), toGtISO(windowEnd));
  const clases = events.filter(
    (e: CalendarEvent) => !e.isAllDay && e.subject.toUpperCase().includes('[CLASE]'),
  );

  if (clases.length === 0) return 0;

  let sent = 0;
  for (const clase of clases) {
    const isVirtual = clase.subject.toUpperCase().includes('[VIRTUAL]');

    const displayName = clase.subject
      .replace(/\[CLASE\]/gi, '')
      .replace(/\[VIRTUAL\]/gi, '')
      .replace(/\[PRESENCIAL\]/gi, '')
      .trim();

    const time = clase.start.substring(11, 16);

    let msg = `\uD83C\uDF93 <b>Clase en 15 min</b>\n\n`;
    msg += `\uD83D\uDCDA ${esc(displayName)}\n`;
    msg += `\u23F0 ${formatHora12(time)}\n`;

    const buttons: Array<{ text: string; url: string }> = [];

    if (isVirtual) {
      msg += `\uD83D\uDCBB Virtual \u2014 Teams\n`;
      buttons.push({ text: '\uD83D\uDD17 Unirse a Teams', url: UNIVERSITY_TEAMS_LINK });
      buttons.push({ text: '\uD83D\uDCDA Aula Virtual', url: UNIVERSITY_AULA_URL });
    } else {
      msg += `\uD83D\uDCCD Presencial\n`;
      buttons.push({ text: '\uD83D\uDCDA Aula Virtual', url: UNIVERSITY_AULA_URL });
    }

    if (clase.location) {
      msg += `\uD83D\uDCCD ${esc(clase.location)}\n`;
    }

    await sendTelegramMessage(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [buttons],
      },
    });
    sent++;
  }

  console.log(`[telegram-calendar] ${sent} recordatorio(s) de clase enviado(s)`);
  return sent;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
