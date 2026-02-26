// ============================================================================
// POST /api/webhooks/telegram
// Telegram webhook — botones de aprobación y comandos de texto
// NO usa Clerk auth — Telegram envía requests directamente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  validateWebhookSecret,
  answerCallbackQuery,
  sendTelegramMessage,
  isAuthorizedChat,
} from '@/lib/molly/telegram';
import { approveDraft, rejectDraft, listPendingDrafts, getStats } from '@/lib/services/molly.service';
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
  const [action, draftId] = data.split(':');

  // Log command
  await logCommand(String(chatId), `callback:${action}`, { draftId });

  try {
    switch (action) {
      case 'approve': {
        await approveDraft(draftId, 'telegram');
        await answerCallbackQuery(query.id, 'Aprobado y enviado');
        await sendTelegramMessage(`\u2705 Borrador aprobado y enviado`);
        break;
      }
      case 'reject': {
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

  // Unknown command
  if (text.startsWith('/')) {
    await sendTelegramMessage(
      `Comandos disponibles:\n/pendientes — ver borradores pendientes\n/stats — estadísticas`,
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
