// ============================================================================
// lib/molly/telegram-calendar.ts
// Flujos conversacionales de calendario para Telegram bot
// /crear — crear evento con botones inline
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
  step: 'type' | 'day' | 'slot' | 'custom_time' | 'title';
  tipo?: TipoCita;
  tipoLabel?: string;
  date?: Date;
  dateLabel?: string;
  horaInicio?: string;
  horaFin?: string;
  duracion?: number;
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

const CREAR_TIPOS: Array<{ id: TipoCita; label: string; emoji: string }> = [
  { id: 'audiencia', label: 'Audiencia', emoji: '\u2696\uFE0F' },
  { id: 'reunion', label: 'Reunión', emoji: '\uD83E\uDD1D' },
  { id: 'bloqueo_personal', label: 'Bloqueo', emoji: '\uD83D\uDEAB' },
  { id: 'evento_libre', label: 'Evento', emoji: '\uD83D\uDCC6' },
];

export async function startCreateFlow(): Promise<void> {
  conversation = { flow: 'crear', step: 'type' };

  const buttons = CREAR_TIPOS.map((t) => ({
    text: `${t.emoji} ${t.label}`,
    callback_data: `cal_type:${t.id}`,
  }));

  await sendTelegramMessage(
    '\uD83D\uDCC5 <b>Crear evento</b>\n\n¿Qué tipo de evento?',
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [buttons.slice(0, 2), buttons.slice(2, 4)],
      },
    },
  );
}

export async function handleCreateCallback(data: string): Promise<void> {
  if (!conversation || conversation.flow !== 'crear') return;
  const state = conversation;

  // ── Step 1: Type selected
  if (data.startsWith('cal_type:')) {
    const tipoId = data.split(':')[1] as TipoCita;
    const tipoInfo = CREAR_TIPOS.find((t) => t.id === tipoId);
    if (!tipoInfo) return;

    state.tipo = tipoId;
    state.tipoLabel = tipoInfo.label;
    state.step = 'day';

    // Build day buttons: Hoy, Mañana, next 5 business days
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextDays = getNextBusinessDays(now, 5);

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const row1 = [
      { text: 'Hoy', callback_data: 'cal_day:0' },
      { text: 'Mañana', callback_data: 'cal_day:1' },
    ];

    const row2 = nextDays.slice(0, 3).map((d, i) => ({
      text: `${dayNames[d.getDay()]} ${d.getDate()}`,
      callback_data: `cal_day:bd_${i}`,
    }));

    const row3 = nextDays.slice(3, 5).map((d, i) => ({
      text: `${dayNames[d.getDay()]} ${d.getDate()}`,
      callback_data: `cal_day:bd_${i + 3}`,
    }));

    // Store nextDays in a way we can retrieve them
    (state as any)._nextDays = nextDays;

    const keyboard = [row1, row2];
    if (row3.length > 0) keyboard.push(row3);

    await sendTelegramMessage(
      `${tipoInfo.emoji} <b>${tipoInfo.label}</b>\n\n¿Qué día?`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } },
    );
    return;
  }

  // ── Step 2: Day selected
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
      const nextDays = (state as any)._nextDays as Date[];
      selectedDate = nextDays[idx];
    } else {
      return;
    }

    state.date = selectedDate;
    state.dateLabel = formatDateSpanish(selectedDate);
    state.step = 'slot';

    // Get free slots
    const duracion = state.tipo === 'audiencia' ? 60 : 30;
    state.duracion = duracion;

    const isFreeType = state.tipo === 'audiencia' || state.tipo === 'bloqueo_personal';

    if (isFreeType) {
      // Free types: go straight to custom time
      state.step = 'custom_time';
      await sendTelegramMessage(
        `\uD83D\uDCC5 <b>${state.tipoLabel}</b> — ${state.dateLabel}\n\n` +
        'Escribe la hora de inicio (ej: <code>10:30</code> o <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Smart types: show findFreeSlots suggestions
    const freeSlots = await findFreeSlots(selectedDate, duracion);

    if (freeSlots.length === 0) {
      state.step = 'custom_time';
      await sendTelegramMessage(
        `\uD83D\uDCC5 <b>${state.tipoLabel}</b> — ${state.dateLabel}\n\n` +
        'No hay slots sugeridos. Escribe la hora (ej: <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Build slot buttons
    const slotButtons = freeSlots.slice(0, 6).map((s) => {
      const time = s.start.substring(11, 16); // HH:mm from ISO
      const h = parseInt(time.split(':')[0], 10);
      const m = time.split(':')[1];
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const label = `${h12}:${m} ${ampm}${s.preferred ? ' \u2B50' : ''}`;
      return { text: label, callback_data: `cal_slot:${time}` };
    });

    // Arrange in rows of 3
    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < slotButtons.length; i += 3) {
      rows.push(slotButtons.slice(i, i + 3));
    }
    rows.push([{ text: '\u270F\uFE0F Personalizado', callback_data: 'cal_slot:custom' }]);

    await sendTelegramMessage(
      `\uD83D\uDCC5 <b>${state.tipoLabel}</b> — ${state.dateLabel}\n\n` +
      `Selecciona horario (${duracion} min):\n\u2B50 = horario preferido (tarde)`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } },
    );
    return;
  }

  // ── Step 3: Slot selected
  if (data.startsWith('cal_slot:')) {
    const slotArg = data.split(':').slice(1).join(':'); // handle HH:MM with colon

    if (slotArg === 'custom') {
      state.step = 'custom_time';
      await sendTelegramMessage(
        'Escribe la hora de inicio (ej: <code>10:30</code> o <code>14:00</code>)',
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Parse HH:MM
    const dur = state.duracion ?? 30;
    const [h, m] = slotArg.split(':').map(Number);
    const endTotal = h * 60 + m + dur;
    const endH = String(Math.floor(endTotal / 60)).padStart(2, '0');
    const endM = String(endTotal % 60).padStart(2, '0');

    state.horaInicio = slotArg;
    state.horaFin = `${endH}:${endM}`;
    state.step = 'title';

    await sendTelegramMessage(
      `\u23F0 ${formatHora12(slotArg)} — ${formatHora12(state.horaFin)}\n\nEscribe el título del evento:`,
    );
    return;
  }
}

export async function handleCreateText(text: string): Promise<void> {
  if (!conversation || conversation.flow !== 'crear') return;
  const state = conversation;

  // ── Custom time input
  if (state.step === 'custom_time') {
    const match = text.trim().match(/^(\d{1,2}):?(\d{2})$/);
    if (!match) {
      await sendTelegramMessage('Formato no válido. Escribe la hora como <code>14:00</code> o <code>1030</code>', { parse_mode: 'HTML' });
      return;
    }

    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) {
      await sendTelegramMessage('Hora no válida. Intenta de nuevo (ej: <code>14:00</code>)', { parse_mode: 'HTML' });
      return;
    }

    const horaInicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const dur = state.duracion ?? 30;
    const endTotal = h * 60 + m + dur;
    const endH = String(Math.floor(endTotal / 60)).padStart(2, '0');
    const endM = String(endTotal % 60).padStart(2, '0');

    state.horaInicio = horaInicio;
    state.horaFin = `${endH}:${endM}`;
    state.step = 'title';

    await sendTelegramMessage(
      `\u23F0 ${formatHora12(horaInicio)} — ${formatHora12(state.horaFin)}\n\nEscribe el título del evento:`,
    );
    return;
  }

  // ── Title input
  if (state.step === 'title') {
    const titulo = text.trim();
    if (!titulo) {
      await sendTelegramMessage('El título no puede estar vacío. Escribe el título:');
      return;
    }

    // Build date string YYYY-MM-DD
    const d = state.date!;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const fechaStr = `${yyyy}-${mm}-${dd}`;

    const config = HORARIOS[state.tipo!];

    try {
      const { eventId } = await createCalendarEvent({
        subject: titulo,
        startDateTime: `${fechaStr}T${state.horaInicio}:00`,
        endDateTime: `${fechaStr}T${state.horaFin}:00`,
        attendees: [],
        isOnlineMeeting: false,
        categories: [config?.categoria_outlook ?? 'Púrpura'],
        body: `<p>Tipo: ${state.tipoLabel}</p>`,
      });

      await sendTelegramMessage(
        `\u2705 <b>Evento creado</b>\n\n` +
        `<b>${esc(titulo)}</b>\n` +
        `\uD83D\uDCC5 ${state.dateLabel}\n` +
        `\u23F0 ${formatHora12(state.horaInicio!)} — ${formatHora12(state.horaFin!)}\n` +
        `\uD83C\uDFF7 ${state.tipoLabel}`,
        { parse_mode: 'HTML' },
      );
    } catch (err: any) {
      await sendTelegramMessage(`\u274C Error al crear evento: ${err.message}`);
    }

    conversation = null;
    return;
  }
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
    const h = parseInt(time.split(':')[0], 10);
    const m = time.split(':')[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const label = `${h12}:${m} ${ampm} ${e.subject.substring(0, 20)}`;
    return [{ text: label, callback_data: `cal_cancel:${i}` }];
  });

  await sendTelegramMessage(
    '\u274C <b>Cancelar evento</b>\n\n¿Cuál evento deseas cancelar?',
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
      `¿Cancelar <b>${esc(event.subject)}</b> a las ${formatHora12(time)}?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '\u2705 Sí, cancelar', callback_data: 'cal_confirm_cancel:yes' },
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
      await sendTelegramMessage('Cancelación descartada.');
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
      msg += `\uD83D\uDCBB Virtual — Teams\n`;
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
