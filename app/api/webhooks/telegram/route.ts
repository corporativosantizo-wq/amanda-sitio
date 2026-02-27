// ============================================================================
// POST /api/webhooks/telegram
// Telegram webhook — botones de aprobación, comandos de texto, calendario
// NO usa Clerk auth — Telegram envía requests directamente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  validateWebhookSecret,
  answerCallbackQuery,
  sendTelegramMessage,
  isAuthorizedChat,
} from '@/lib/molly/telegram';
import { approveDraft, rejectDraft, listPendingDrafts, getStats, getAgenda, getAvailability } from '@/lib/services/molly.service';
import {
  getConversation,
  clearConversation,
  startCreateFlow,
  handleCreateCallback,
  handleCreateText,
  startCancelFlow,
  handleCancelCallback,
} from '@/lib/molly/telegram-calendar';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

export async function POST(req: NextRequest) {
  // Always return 200 to prevent Telegram retries
  try {
    // Validate webhook secret
    if (!validateWebhookSecret(req)) {
      console.error('[telegram-webhook] Invalid secret token');
      return NextResponse.json({ ok: true });
    }

    const body = await req.json();

    // Handle callback queries (button presses)
    if (body.callback_query) {
      await handleCallbackQuery(body.callback_query);
      return NextResponse.json({ ok: true });
    }

    // Handle text messages (commands)
    if (body.message?.text) {
      await handleTextMessage(body.message);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[telegram-webhook] Error:', err.message);
    return NextResponse.json({ ok: true }); // Always 200
  }
}

// ── Callback queries (button presses) ──────────────────────────────────────

async function handleCallbackQuery(query: any): Promise<void> {
  const chatId = query.message?.chat?.id;

  if (!isAuthorizedChat(chatId)) {
    await answerCallbackQuery(query.id, 'No autorizado');
    return;
  }

  const data = query.data as string;
  const [action] = data.split(':');

  // Log command
  await logCommand(String(chatId), `callback:${data}`, {});

  try {
    // Calendar flow callbacks
    if (data.startsWith('cal_type:') || data.startsWith('cal_day:') || data.startsWith('cal_slot:')) {
      await answerCallbackQuery(query.id);
      await handleCreateCallback(data);
      return;
    }

    if (data.startsWith('cal_cancel:') || data.startsWith('cal_confirm_cancel:')) {
      await answerCallbackQuery(query.id);
      await handleCancelCallback(data);
      return;
    }

    // Email draft callbacks
    switch (action) {
      case 'approve': {
        const draftId = data.split(':')[1];
        await approveDraft(draftId, 'telegram');
        await answerCallbackQuery(query.id, 'Aprobado y enviado');
        await sendTelegramMessage(`\u2705 Borrador aprobado y enviado`);
        break;
      }
      case 'reject': {
        const draftId = data.split(':')[1];
        await rejectDraft(draftId);
        await answerCallbackQuery(query.id, 'Rechazado');
        await sendTelegramMessage(`\u274C Borrador rechazado`);
        break;
      }
      case 'edit': {
        await answerCallbackQuery(query.id, 'Editar en dashboard');
        await sendTelegramMessage(
          `\u270F\uFE0F Para editar, visita el dashboard:\nhttps://papeleo.legal/admin/email`,
        );
        break;
      }
      case 'postpone': {
        await answerCallbackQuery(query.id, 'Pospuesto');
        await sendTelegramMessage(`\u23F0 Borrador pospuesto — queda pendiente`);
        break;
      }
      default:
        await answerCallbackQuery(query.id, 'Acción desconocida');
    }
  } catch (err: any) {
    console.error('[telegram-webhook] Error en callback:', err.message);
    await answerCallbackQuery(query.id, 'Error: ' + err.message.substring(0, 50));
  }
}

// ── Text messages (commands) ───────────────────────────────────────────────

async function handleTextMessage(message: any): Promise<void> {
  const chatId = message.chat?.id;

  if (!isAuthorizedChat(chatId)) return;

  const text = (message.text as string).trim();

  // Log command
  await logCommand(String(chatId), text, {});

  // Check if there's an active conversation flow expecting text input
  const conv = getConversation();
  if (conv && !text.startsWith('/')) {
    if (conv.flow === 'crear') {
      await handleCreateText(text);
      return;
    }
    // cancelar flow doesn't need text input
  }

  // Commands that cancel any active flow
  if (text === '/cancelar_flujo' || text === '/x') {
    if (conv) {
      clearConversation();
      await sendTelegramMessage('Flujo cancelado.');
    }
    return;
  }

  // ── Calendar commands ────────────────────────────────────────────────

  if (text === '/semana') {
    try {
      const msg = await getAgenda('semana');
      await sendTelegramMessage(msg, { parse_mode: 'HTML' });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo agenda: ${err.message}`);
    }
    return;
  }

  if (text === '/crear') {
    clearConversation();
    await startCreateFlow();
    return;
  }

  if (text === '/cancelar') {
    clearConversation();
    await startCancelFlow();
    return;
  }

  // ── Existing commands ────────────────────────────────────────────────

  if (text === '/pendientes') {
    const drafts = await listPendingDrafts();
    if (drafts.length === 0) {
      await sendTelegramMessage('\u2705 No hay borradores pendientes');
      return;
    }

    let msg = `\uD83D\uDCE8 <b>${drafts.length} borradores pendientes:</b>\n`;
    for (const d of drafts.slice(0, 10)) {
      msg += `\n\u2022 <b>${escapeHtml(d.subject)}</b>\n  Para: ${escapeHtml(d.to_email)}\n  Creado: ${new Date(d.created_at).toLocaleString('es-GT')}\n`;
    }
    if (drafts.length > 10) {
      msg += `\n... y ${drafts.length - 10} más`;
    }
    await sendTelegramMessage(msg, { parse_mode: 'HTML' });
    return;
  }

  if (text === '/stats') {
    const stats = await getStats();
    const msg =
      `\uD83D\uDCCA <b>Estadísticas Molly Mail</b>\n\n` +
      `\uD83D\uDCE7 Total hilos: ${stats.totalThreads}\n` +
      `\uD83D\uDCDD Borradores pendientes: ${stats.pendingDrafts}\n` +
      `\uD83D\uDCC5 Emails hoy: ${stats.emailsToday}\n\n` +
      `<b>Por clasificación:</b>\n` +
      Object.entries(stats.threadsByClasificacion)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');

    await sendTelegramMessage(msg, { parse_mode: 'HTML' });
    return;
  }

  if (text.startsWith('/agenda')) {
    const arg = text.replace('/agenda', '').trim().toLowerCase();
    let range: 'hoy' | 'mañana' | 'semana' = 'hoy';
    if (arg === 'mañana' || arg === 'manana') range = 'mañana';
    else if (arg === 'semana') range = 'semana';

    try {
      const msg = await getAgenda(range);
      await sendTelegramMessage(msg, { parse_mode: 'HTML' });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo agenda: ${err.message}`);
    }
    return;
  }

  if (text.startsWith('/disponibilidad')) {
    const arg = text.replace('/disponibilidad', '').trim();

    try {
      const msg = await getAvailability(arg || undefined);
      await sendTelegramMessage(msg, { parse_mode: 'HTML' });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo disponibilidad: ${err.message}`);
    }
    return;
  }

  // Unknown command
  if (text.startsWith('/')) {
    await sendTelegramMessage(
      `<b>Comandos disponibles:</b>\n\n` +
      `<b>Calendario:</b>\n` +
      `/agenda — agenda de hoy\n` +
      `/agenda mañana — agenda de mañana\n` +
      `/semana — agenda de la semana\n` +
      `/disponibilidad — slots libres\n` +
      `/crear — crear evento\n` +
      `/cancelar — cancelar evento de hoy\n\n` +
      `<b>Email:</b>\n` +
      `/pendientes — borradores pendientes\n` +
      `/stats — estadísticas Molly Mail\n\n` +
      `<b>Otros:</b>\n` +
      `/x — cancelar flujo activo`,
      { parse_mode: 'HTML' },
    );
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function logCommand(
  chatId: string,
  command: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db().from('telegram_commands').insert({
      chat_id: chatId,
      command,
      payload,
    });
  } catch {
    // Non-critical, don't throw
  }
}
