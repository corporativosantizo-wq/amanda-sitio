// ============================================================================
// lib/molly/calendar.ts
// Microsoft Calendar integration for Molly Mail
// Graph API via client_credentials (getAppToken)
// ============================================================================

import { getAppToken } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  subject: string;
  start: string;     // ISO datetime
  end: string;       // ISO datetime
  isAllDay: boolean;
  location: string | null;
}

interface BusySlot {
  start: string;
  end: string;
  status: string;    // busy | tentative | oof
}

export interface FreeSlot {
  start: string;     // ISO datetime
  end: string;       // ISO datetime
  durationMin: number;
  preferred: boolean; // true = afternoon (14-18h), ideal for consultations
}

// ── Constants ──────────────────────────────────────────────────────────────

const CALENDAR_ACCOUNT: MailboxAlias = 'amanda@papeleo.legal';
const TZ = 'America/Guatemala';
const UTC_OFFSET = -6; // Guatemala is UTC-6 year-round (no DST)

// Bullet Journal working hours
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 18;
const AFTERNOON_START = 14; // Consultations preferred from 2 PM

// Scheduling rules
const DEFAULT_DURATION_MIN = 30;
const BUFFER_MIN = 15;
const MIN_USABLE_GAP_MIN = 45; // 30 min meeting + 15 min buffer

// ── Get calendar events (calendarView) ─────────────────────────────────────

export async function getCalendarEvents(
  startDateTime: string,
  endDateTime: string,
  account: MailboxAlias = CALENDAR_ACCOUNT,
): Promise<CalendarEvent[]> {
  const token = await getAppToken();

  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/calendarView` +
    `?startDateTime=${encodeURIComponent(startDateTime)}` +
    `&endDateTime=${encodeURIComponent(endDateTime)}` +
    `&$select=id,subject,start,end,isAllDay,location` +
    `&$orderby=start/dateTime asc` +
    `&$top=50`;

  console.log(`[calendar] GET calendarView ${account} ${startDateTime} → ${endDateTime}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: `outlook.timezone="${TZ}"`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[calendar] ERROR ${res.status}:`, errText.substring(0, 500));
    throw new Error(`Calendar API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const events: CalendarEvent[] = (data.value ?? []).map((e: any) => ({
    id: e.id,
    subject: e.subject || '(Sin título)',
    start: e.start.dateTime,
    end: e.end.dateTime,
    isAllDay: e.isAllDay ?? false,
    location: e.location?.displayName || null,
  }));

  console.log(`[calendar] ${events.length} eventos encontrados`);
  return events;
}

// ── Get schedule (busy/free status) ────────────────────────────────────────

async function getSchedule(
  startDateTime: string,
  endDateTime: string,
  account: MailboxAlias = CALENDAR_ACCOUNT,
): Promise<BusySlot[]> {
  const token = await getAppToken();

  const url = `https://graph.microsoft.com/v1.0/users/${account}/calendar/getSchedule`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: `outlook.timezone="${TZ}"`,
    },
    body: JSON.stringify({
      schedules: [account],
      startTime: { dateTime: startDateTime, timeZone: TZ },
      endTime: { dateTime: endDateTime, timeZone: TZ },
      availabilityViewInterval: 15,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[calendar] getSchedule ERROR ${res.status}:`, errText.substring(0, 500));
    throw new Error(`Schedule API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const schedule = data.value?.[0];
  if (!schedule?.scheduleItems) return [];

  return schedule.scheduleItems
    .filter((item: any) => item.status !== 'free')
    .map((item: any) => ({
      start: item.start.dateTime,
      end: item.end.dateTime,
      status: item.status,
    }));
}

// ── Find free slots (Bullet Journal rules) ─────────────────────────────────

export async function findFreeSlots(
  date: Date,
  durationMinutes: number = DEFAULT_DURATION_MIN,
  account: MailboxAlias = CALENDAR_ACCOUNT,
): Promise<FreeSlot[]> {
  const dayOfWeek = date.getDay();
  // Skip weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) return [];

  // Build day boundaries in Guatemala time
  const dateStr = formatDateLocal(date);
  const dayStart = `${dateStr}T${pad(WORK_START_HOUR)}:00:00`;
  const dayEnd = `${dateStr}T${pad(WORK_END_HOUR)}:00:00`;

  const busySlots = await getSchedule(dayStart, dayEnd, account);

  // Sort busy slots by start time
  busySlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Add 15 min buffer after each busy block
  const expandedBusy = busySlots.map((slot) => ({
    start: new Date(slot.start).getTime(),
    end: new Date(slot.end).getTime() + BUFFER_MIN * 60_000,
  }));

  // Merge overlapping busy blocks
  const merged: Array<{ start: number; end: number }> = [];
  for (const block of expandedBusy) {
    if (merged.length > 0 && block.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, block.end);
    } else {
      merged.push({ ...block });
    }
  }

  // Find gaps between busy blocks within working hours
  const workStart = new Date(dayStart).getTime();
  const workEnd = new Date(dayEnd).getTime();
  const neededMs = durationMinutes * 60_000;
  const minGapMs = MIN_USABLE_GAP_MIN * 60_000;

  const freeSlots: FreeSlot[] = [];
  let cursor = workStart;

  for (const block of merged) {
    const gapStart = cursor;
    const gapEnd = Math.min(block.start, workEnd);

    if (gapEnd - gapStart >= minGapMs && gapEnd - gapStart >= neededMs) {
      addSlot(freeSlots, gapStart, gapEnd, durationMinutes, date);
    }
    cursor = Math.max(cursor, block.end);
  }

  // Gap after last busy block until end of day
  if (cursor < workEnd && workEnd - cursor >= minGapMs && workEnd - cursor >= neededMs) {
    addSlot(freeSlots, cursor, workEnd, durationMinutes, date);
  }

  // Sort: preferred (afternoon) first, then by time
  freeSlots.sort((a, b) => {
    if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  console.log(`[calendar] ${freeSlots.length} slots libres para ${dateStr}`);
  return freeSlots;
}

function addSlot(
  slots: FreeSlot[],
  gapStartMs: number,
  gapEndMs: number,
  durationMin: number,
  date: Date,
): void {
  const slotStart = new Date(gapStartMs);
  const slotEnd = new Date(Math.min(gapStartMs + durationMin * 60_000, gapEndMs));
  const hour = slotStart.getHours();
  const isAfternoon = hour >= AFTERNOON_START;

  slots.push({
    start: slotStart.toISOString(),
    end: slotEnd.toISOString(),
    durationMin: Math.round((slotEnd.getTime() - slotStart.getTime()) / 60_000),
    preferred: isAfternoon,
  });

  // If the gap is large enough for multiple slots, add another at the end of the gap
  const remainingMs = gapEndMs - slotEnd.getTime() - BUFFER_MIN * 60_000;
  if (remainingMs >= durationMin * 60_000) {
    const nextStart = new Date(slotEnd.getTime() + BUFFER_MIN * 60_000);
    const nextEnd = new Date(nextStart.getTime() + durationMin * 60_000);
    const nextHour = nextStart.getHours();

    slots.push({
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
      durationMin,
      preferred: nextHour >= AFTERNOON_START,
    });
  }
}

// ── Format for Telegram ────────────────────────────────────────────────────

export function formatAgendaForTelegram(
  events: CalendarEvent[],
  dateLabel: string,
): string {
  if (events.length === 0) {
    return `\uD83D\uDCC5 <b>Agenda — ${esc(dateLabel)}</b>\n\nNo hay eventos programados.`;
  }

  let msg = `\uD83D\uDCC5 <b>Agenda — ${esc(dateLabel)}</b>\n`;

  const morning: CalendarEvent[] = [];
  const afternoon: CalendarEvent[] = [];

  for (const e of events) {
    if (e.isAllDay) {
      msg += `\n\uD83D\uDD35 <b>Todo el día:</b> ${esc(e.subject)}`;
      if (e.location) msg += ` (${esc(e.location)})`;
      continue;
    }
    const hour = new Date(e.start).getHours();
    if (hour < AFTERNOON_START) {
      morning.push(e);
    } else {
      afternoon.push(e);
    }
  }

  if (morning.length > 0) {
    msg += `\n\n<b>Ma\u00F1ana</b>`;
    for (const e of morning) {
      msg += `\n  ${formatTime(e.start)} - ${formatTime(e.end)}  ${esc(e.subject)}`;
      if (e.location) msg += ` \uD83D\uDCCD ${esc(e.location)}`;
    }
  }

  if (afternoon.length > 0) {
    msg += `\n\n<b>Tarde</b>`;
    for (const e of afternoon) {
      msg += `\n  ${formatTime(e.start)} - ${formatTime(e.end)}  ${esc(e.subject)}`;
      if (e.location) msg += ` \uD83D\uDCCD ${esc(e.location)}`;
    }
  }

  return msg;
}

export function formatAvailabilityForTelegram(
  freeSlots: FreeSlot[],
  dateLabel: string,
): string {
  if (freeSlots.length === 0) {
    return `\uD83D\uDCC6 <b>Disponibilidad — ${esc(dateLabel)}</b>\n\nNo hay slots libres este d\u00EDa.`;
  }

  let msg = `\uD83D\uDCC6 <b>Disponibilidad — ${esc(dateLabel)}</b>\n`;

  for (const slot of freeSlots) {
    const star = slot.preferred ? ' \u2B50' : '';
    msg += `\n  ${formatTime(slot.start)} - ${formatTime(slot.end)}  (${slot.durationMin} min)${star}`;
  }

  msg += `\n\n\u2B50 = horario preferido (tarde)`;
  return msg;
}

// ── Date/time helpers ──────────────────────────────────────────────────────

/** Format Date as YYYY-MM-DD in Guatemala timezone */
function formatDateLocal(date: Date): string {
  // Shift to Guatemala time (UTC-6)
  const gt = new Date(date.getTime() + UTC_OFFSET * 3600_000);
  return gt.toISOString().substring(0, 10);
}

/** Format ISO datetime as HH:MM AM/PM */
function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ampm}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Public helpers ─────────────────────────────────────────────────────────

/** Get next N business days starting from a date */
export function getNextBusinessDays(from: Date, count: number): Date[] {
  const days: Date[] = [];
  const d = new Date(from);
  while (days.length < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(d));
    }
  }
  return days;
}

/** Build ISO start/end for a full day in Guatemala time */
export function getDayBounds(date: Date): { start: string; end: string } {
  const dateStr = formatDateLocal(date);
  return {
    start: `${dateStr}T00:00:00`,
    end: `${dateStr}T23:59:59`,
  };
}

/** Format a date as "lunes 3 de marzo" in Spanish */
export function formatDateSpanish(date: Date): string {
  const days = ['domingo', 'lunes', 'martes', 'mi\u00E9rcoles', 'jueves', 'viernes', 's\u00E1bado'];
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${days[date.getDay()]} ${date.getDate()} de ${months[date.getMonth()]}`;
}

const DAY_NAMES_UPPER = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const DAY_ABBR = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTH_NAMES_UPPER = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** Emoji for event based on subject keywords */
function eventEmoji(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('[clase]')) return '🟡';
  if (s.includes('audiencia') || s.includes('diligencia')) return '🏛️';
  if (s.includes('consulta')) return '⚖️';
  if (s.includes('seguimiento')) return '🔄';
  if (s.includes('capacita')) return '✦';
  if (s.includes('reunión') || s.includes('reunion')) return '🤝';
  if (s.includes('bloqueo') || s.includes('personal') || s.includes('mover') || s.includes('almuerzo')) return '◼';
  return '📌';
}

/** Format HH:MM (24h compact) from ISO */
function fmtHHMM(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Enhanced day view for /hoy and /mañana ──────────────────────────────

export function formatDayViewForTelegram(
  events: CalendarEvent[],
  date: Date,
  freeSlotCount: number,
): string {
  const dayName = DAY_NAMES_UPPER[date.getDay()];
  const dayNum = date.getDate();
  const monthName = MONTH_NAMES_UPPER[date.getMonth()];
  const year = date.getFullYear();

  let msg = `📅 <b>${dayName} ${dayNum} ${monthName} ${year}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;

  // Deep work block indicator (8:00-14:00 on weekdays)
  const dow = date.getDay();
  if (dow >= 1 && dow <= 5) {
    msg += `☀ 8:00–14:00 Trabajo profundo\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  }

  const timed = events.filter((e: CalendarEvent) => !e.isAllDay);
  const allDay = events.filter((e: CalendarEvent) => e.isAllDay);

  if (allDay.length > 0) {
    for (const e of allDay) {
      msg += `🔵 <b>Todo el día:</b> ${esc(e.subject)}\n`;
    }
  }

  if (timed.length === 0 && allDay.length === 0) {
    msg += `\nSin eventos programados ✨\n`;
  } else {
    for (const e of timed) {
      const emoji = eventEmoji(e.subject);
      const cost = e.subject.toLowerCase().includes('consulta') ? ' (Q500)' : '';
      msg += `${emoji} ${fmtHHMM(e.start)} ${esc(e.subject)}${cost}\n`;
    }
  }

  // Footer stats
  const totalBilling = timed.filter((e: CalendarEvent) => e.subject.toLowerCase().includes('consulta')).length * 500;
  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 ${timed.length} evento${timed.length !== 1 ? 's' : ''}`;
  if (totalBilling > 0) msg += ` | Q${totalBilling.toLocaleString('es-GT')} facturación`;
  msg += ` | ${freeSlotCount} slot${freeSlotCount !== 1 ? 's' : ''} libre${freeSlotCount !== 1 ? 's' : ''}`;

  return msg;
}

// ── Compact week view for /semana ───────────────────────────────────────

export function formatWeekViewForTelegram(
  eventsByDay: Map<string, CalendarEvent[]>,
  weekStart: Date,
  weekEnd: Date,
): string {
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const startMonth = MONTH_NAMES_UPPER[weekStart.getMonth()].substring(0, 3);
  const endMonth = MONTH_NAMES_UPPER[weekEnd.getMonth()].substring(0, 3);
  const dateRange = weekStart.getMonth() === weekEnd.getMonth()
    ? `${startDay} — ${endDay} ${startMonth}`
    : `${startDay} ${startMonth} — ${endDay} ${endMonth}`;

  let msg = `📅 <b>SEMANA ${dateRange}</b>\n`;

  let totalEvents = 0;
  let totalAudiencias = 0;
  let totalBilling = 0;

  const d = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const dateStr = formatDateLocal(d);
    const dayEvents = eventsByDay.get(dateStr) ?? [];
    const abbr = DAY_ABBR[d.getDay()];
    const num = d.getDate();

    const timed = dayEvents.filter((e: CalendarEvent) => !e.isAllDay);

    if (timed.length === 0) {
      msg += `${abbr} ${num}: <i>sin eventos</i>\n`;
    } else {
      const summaries = timed.slice(0, 3).map((e: CalendarEvent) => {
        const emoji = eventEmoji(e.subject);
        const shortSubject = e.subject.length > 20 ? e.subject.substring(0, 18) + '…' : e.subject;
        return `${emoji} ${esc(shortSubject)} ${fmtHHMM(e.start)}`;
      });
      const extra = timed.length > 3 ? ` +${timed.length - 3}` : '';
      msg += `${abbr} ${num}: ${summaries.join(' | ')}${extra}\n`;
    }

    for (const e of timed) {
      totalEvents++;
      const s = e.subject.toLowerCase();
      if (s.includes('audiencia') || s.includes('diligencia')) totalAudiencias++;
      if (s.includes('consulta')) totalBilling += 500;
    }

    d.setDate(d.getDate() + 1);
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📊 ${totalEvents} eventos`;
  if (totalAudiencias > 0) msg += ` | ${totalAudiencias} audiencia${totalAudiencias !== 1 ? 's' : ''}`;
  if (totalBilling > 0) msg += ` | Q${totalBilling.toLocaleString('es-GT')}`;

  return msg;
}

// ── Multi-day availability for /libre ───────────────────────────────────

export function formatMultiDayAvailability(
  daySlots: Array<{ date: Date; slots: FreeSlot[] }>,
): string {
  let msg = `🟢 <b>DISPONIBILIDAD</b>\n`;

  for (const { date, slots } of daySlots) {
    const abbr = DAY_ABBR[date.getDay()];
    const dayNum = date.getDate();
    const monthAbbr = MONTH_NAMES_UPPER[date.getMonth()].substring(0, 3);

    msg += `\n<b>${abbr} ${dayNum} ${monthAbbr}:</b>\n`;
    if (slots.length === 0) {
      msg += `  Sin slots disponibles\n`;
    } else {
      for (const slot of slots) {
        const dur = slot.durationMin;
        const durLabel = dur >= 60 ? `${(dur / 60).toFixed(1).replace('.0', '')}h` : `${dur} min`;
        const star = slot.preferred ? ' ⭐' : '';
        msg += `  • ${fmtHHMM(slot.start)} – ${fmtHHMM(slot.end)} (${durLabel})${star}\n`;
      }
    }
  }

  return msg;
}
