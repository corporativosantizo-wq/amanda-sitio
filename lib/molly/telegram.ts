// ============================================================================
// lib/molly/telegram.ts
// Telegram Bot — notificaciones y botones para Molly Mail
// ============================================================================

import type { EmailThread, EmailMessage, MollyClassification, EmailDraft } from '@/lib/types/molly';

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
  const emoji = CLASIFICACION_EMOJI[classification.tipo] || '\uD83D\uDCE7';
  const urgLabel = URGENCIA_LABELS[classification.urgencia] || 'info';

  let text = `${emoji} <b>Nuevo email</b> [${urgLabel}]\n\n`;
  text += `<b>De:</b> ${escapeHtml(message.from_name || message.from_email)}\n`;
  text += `<b>Para:</b> ${escapeHtml(thread.account)}\n`;
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
  let text = `\uD83D\uDEA8 <b>Alerta — email urgente</b>\n\n`;
  text += `<b>De:</b> ${escapeHtml(message.from_name || message.from_email)}\n`;
  text += `<b>Para:</b> ${escapeHtml(thread.account)}\n`;
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

// ── Verify chat ID ─────────────────────────────────────────────────────────

export function isAuthorizedChat(chatId: string | number): boolean {
  return String(chatId) === CHAT_ID;
}
