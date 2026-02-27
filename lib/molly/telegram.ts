// ============================================================================
// lib/molly/telegram.ts
// Telegram Bot — notificaciones y botones para Molly Mail
// ============================================================================

import type { EmailThread, EmailMessage, MollyClassification, EmailDraft, EmailSchedulingIntent } from '@/lib/types/molly';
import type { FreeSlot } from '@/lib/molly/calendar';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID!;

// ── Send message ───────────────────────────────────────────────────────────

export async function sendTelegramMessage(
  text: string,
  options?: {
    parse_mode?: 'HTML' | 'MarkdownV2';
    reply_markup?: unknown;
  },
): Promise<void> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: CHAT_ID,
    text,
    parse_mode: options?.parse_mode ?? 'HTML',
  };

  if (options?.reply_markup) {
    body.reply_markup = options.reply_markup;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[telegram] Error enviando mensaje:', res.status, errText.substring(0, 300));
  } else {
    console.log('[telegram] Mensaje enviado OK');
  }
}

// ── Build email notification with inline keyboard ──────────────────────────

const URGENCIA_LABELS = ['info', 'normal', 'IMPORTANTE', 'URGENTE'];
const CLASIFICACION_EMOJI: Record<string, string> = {
  legal: '\u2696\uFE0F',
  administrativo: '\uD83D\uDCCB',
  financiero: '\uD83D\uDCB0',
  spam: '\uD83D\uDEAB',
  personal: '\uD83D\uDC64',
  urgente: '\uD83D\uDEA8',
  pendiente: '\u23F3',
};

// Account-specific display for Telegram notifications
const ACCOUNT_DISPLAY: Record<string, { emoji: string; label: string }> = {
  'asistente@papeleo.legal': { emoji: '\uD83D\uDCE7', label: 'asistente' },
  'contador@papeleo.legal':  { emoji: '\uD83D\uDCB0', label: 'contador' },
  'amanda@papeleo.legal':    { emoji: '\u2B50',       label: 'amanda' },
};

function accountTag(account: string): string {
  const cfg = ACCOUNT_DISPLAY[account];
  if (!cfg) return '';
  return `${cfg.emoji} [${cfg.label}] `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildEmailNotification(
  thread: EmailThread,
  message: EmailMessage,
  classification: MollyClassification,
  draft?: EmailDraft | null,
): { text: string; reply_markup: unknown } {
  const tag = accountTag(thread.account);
  const urgLabel = URGENCIA_LABELS[classification.urgencia] || 'info';

  let text = `${tag}<b>Nuevo email</b> [${urgLabel}]\n\n`;
  text += `<b>De:</b> ${escapeHtml(message.from_name || message.from_email)}\n`;
  text += `<b>Asunto:</b> ${escapeHtml(message.subject)}\n`;
  text += `<b>Tipo:</b> ${classification.tipo}\n\n`;
  text += `<b>Resumen:</b> ${escapeHtml(classification.resumen)}\n`;

  if (classification.cliente_probable) {
    text += `<b>Cliente:</b> ${escapeHtml(classification.cliente_probable)}\n`;
  }

  if (draft) {
    text += `\n---\n<b>Borrador propuesto:</b>\n${escapeHtml(draft.body_text.substring(0, 500))}`;
    if (draft.body_text.length > 500) text += '...';
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (draft) {
    buttons.push([
      { text: '\u2705 Aprobar', callback_data: `approve:${draft.id}` },
      { text: '\u270F\uFE0F Editar', callback_data: `edit:${draft.id}` },
    ]);
    buttons.push([
      { text: '\u274C Rechazar', callback_data: `reject:${draft.id}` },
      { text: '\u23F0 Posponer', callback_data: `postpone:${draft.id}` },
    ]);
  }

  return {
    text,
    reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
  };
}

// ── Build alert (no draft, just notification) ──────────────────────────────

export function buildUrgentAlert(
  thread: EmailThread,
  message: EmailMessage,
  classification: MollyClassification,
): { text: string } {
  const tag = accountTag(thread.account);
  let text = `\uD83D\uDEA8 ${tag}<b>Alerta \u2014 email urgente</b>\n\n`;
  text += `<b>De:</b> ${escapeHtml(message.from_name || message.from_email)}\n`;
  text += `<b>Asunto:</b> ${escapeHtml(message.subject)}\n`;
  text += `<b>Urgencia:</b> ${URGENCIA_LABELS[classification.urgencia]}\n\n`;
  text += `<b>Resumen:</b> ${escapeHtml(classification.resumen)}`;

  return { text };
}

// ── Validate webhook secret ────────────────────────────────────────────────

export function validateWebhookSecret(req: Request): boolean {
  const secret = req.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected || !secret) return false;
  return secret === expected;
}

// ── Answer callback query (remove loading state) ───────────────────────────

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text: text || 'OK',
    }),
  });
}

// ── Build scheduling intent notification with inline "Agendar" buttons ────

const EVENT_TYPE_LABELS: Record<string, string> = {
  consulta_nueva: 'Consulta Nueva (60 min, Q500)',
  seguimiento: 'Seguimiento de Caso (30 min, sin costo)',
};

export function buildSchedulingNotification(
  intent: EmailSchedulingIntent,
  message: EmailMessage,
  classification: MollyClassification,
  slots: FreeSlot[],
  dateLabel: string,
): { text: string; reply_markup: unknown } {
  const typeLabel = EVENT_TYPE_LABELS[intent.event_type] || intent.event_type;

  let text = `\uD83D\uDCC5 <b>Solicitud de cita detectada</b>\n\n`;
  text += `<b>De:</b> ${escapeHtml(message.from_name || message.from_email)}\n`;
  text += `<b>Asunto:</b> ${escapeHtml(message.subject)}\n`;
  text += `<b>Tipo sugerido:</b> ${escapeHtml(typeLabel)}\n`;
  text += `<b>Fecha:</b> ${escapeHtml(dateLabel)}\n`;

  if (classification.resumen) {
    text += `\n<b>Resumen:</b> ${escapeHtml(classification.resumen)}\n`;
  }

  if (slots.length === 0) {
    text += `\n\u26A0\uFE0F No hay horarios disponibles para esta fecha.`;
  } else {
    text += `\n<b>Horarios disponibles:</b>`;
    for (const slot of slots.slice(0, 6)) {
      const star = slot.preferred ? ' \u2B50' : '';
      text += `\n  ${formatSlotTime(slot.start)} \u2014 ${formatSlotTime(slot.end)}${star}`;
    }
  }

  // Build buttons: up to 6 slot buttons in rows of 2, plus Ignorar
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  const slotBtns = slots.slice(0, 6).map((slot, i) => {
    const star = slot.preferred ? ' \u2B50' : '';
    return {
      text: `\uD83D\uDCC5 ${formatSlotTime(slot.start)}${star}`,
      callback_data: `sched_book:${intent.id}:${i}`,
    };
  });

  // Rows of 2
  for (let i = 0; i < slotBtns.length; i += 2) {
    buttons.push(slotBtns.slice(i, i + 2));
  }

  buttons.push([
    { text: '\u274C Ignorar', callback_data: `sched_ignore:${intent.id}` },
  ]);

  return {
    text,
    reply_markup: { inline_keyboard: buttons },
  };
}

function formatSlotTime(isoStr: string): string {
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Verify chat ID ─────────────────────────────────────────────────────────

export function isAuthorizedChat(chatId: string | number): boolean {
  return String(chatId) === CHAT_ID;
}
