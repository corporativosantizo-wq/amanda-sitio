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
import { createCalendarEvent } from '@/lib/services/outlook.service';
import { HORARIOS } from '@/lib/types';
import type { TipoCita } from '@/lib/types';
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

    // Scheduling intent callbacks
    if (data.startsWith('sched_book:') || data.startsWith('sched_ignore:')) {
      await answerCallbackQuery(query.id);
      await handleSchedulingCallback(data);
      return;
    }

    // Post-consultation followup callbacks
    if (data.startsWith('followup_')) {
      await answerCallbackQuery(query.id);
      await handleFollowupCallback(data);
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

// ── Scheduling intent callbacks ──────────────────────────────────────────────

const SCHED_TYPE_LABELS: Record<string, string> = {
  consulta_nueva: 'Consulta Nueva',
  seguimiento: 'Seguimiento',
};

async function handleSchedulingCallback(data: string): Promise<void> {
  // ── Book a slot
  if (data.startsWith('sched_book:')) {
    const parts = data.split(':');
    const intentId = parts[1];
    const slotIndex = parseInt(parts[2], 10);

    const { data: intent } = await db()
      .from('email_scheduling_intents')
      .select('*')
      .eq('id', intentId)
      .single();

    if (!intent) {
      await sendTelegramMessage('Solicitud no encontrada.');
      return;
    }

    if (intent.status !== 'pendiente') {
      await sendTelegramMessage('Esta solicitud ya fue procesada.');
      return;
    }

    const slots = intent.available_slots as Array<{
      start: string;
      end: string;
      durationMin: number;
      preferred: boolean;
    }>;
    const slot = slots[slotIndex];
    if (!slot) {
      await sendTelegramMessage('Slot no v\u00E1lido.');
      return;
    }

    // Extract local datetime from ISO (strip Z/timezone)
    const startLocal = slot.start.substring(0, 19);
    const endLocal = slot.end.substring(0, 19);

    const eventType = intent.event_type as TipoCita;
    const config = HORARIOS[eventType];
    const typeLabel = SCHED_TYPE_LABELS[eventType] || eventType;

    // Get sender name from email_messages
    const { data: msg } = await db()
      .from('email_messages')
      .select('from_name, from_email')
      .eq('id', intent.message_id)
      .single();

    const contactName = msg?.from_name || msg?.from_email || intent.from_email;

    // Create calendar event
    const { eventId } = await createCalendarEvent({
      subject: `${typeLabel} \u2014 ${contactName}`,
      startDateTime: startLocal,
      endDateTime: endLocal,
      attendees: [intent.from_email],
      isOnlineMeeting: true,
      categories: [config?.categoria_outlook ?? 'Azul'],
      body: `<p>Cita agendada autom\u00E1ticamente por Molly desde email.</p><p>Thread: ${intent.thread_id}</p>`,
    });

    // Update intent status
    await db()
      .from('email_scheduling_intents')
      .update({ status: 'agendada' })
      .eq('id', intentId);

    // Format time for confirmation message
    const startDate = new Date(slot.start);
    const h = startDate.getHours();
    const m = startDate.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    const dateStr = intent.suggested_date;

    await sendTelegramMessage(
      `\u2705 <b>Cita agendada</b>\n\n` +
      `<b>${escapeHtml(typeLabel)}</b> con ${escapeHtml(contactName)}\n` +
      `\uD83D\uDCC5 ${dateStr}\n` +
      `\u23F0 ${timeStr}`,
      { parse_mode: 'HTML' },
    );

    // Append scheduling info to pending draft if it exists
    await appendSchedulingToDraft(intent.thread_id, typeLabel, dateStr, timeStr);
    return;
  }

  // ── Ignore scheduling intent
  if (data.startsWith('sched_ignore:')) {
    const intentId = data.split(':')[1];

    await db()
      .from('email_scheduling_intents')
      .update({ status: 'ignorada' })
      .eq('id', intentId);

    await sendTelegramMessage('\u274C Solicitud de cita ignorada');
    return;
  }
}

async function appendSchedulingToDraft(
  threadId: string,
  typeLabel: string,
  dateStr: string,
  timeStr: string,
): Promise<void> {
  try {
    const { data: draft } = await db()
      .from('email_drafts')
      .select('id, body_text, body_html')
      .eq('thread_id', threadId)
      .eq('status', 'pendiente')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!draft) return;

    const appendText = `\n\nSu cita ha sido agendada:\n- Tipo: ${typeLabel}\n- Fecha: ${dateStr}\n- Hora: ${timeStr}\n\nLe enviaremos un enlace de Teams para la reuni\u00F3n.`;
    const appendHtml = `<br><br><p><strong>Su cita ha sido agendada:</strong></p><ul><li>Tipo: ${typeLabel}</li><li>Fecha: ${dateStr}</li><li>Hora: ${timeStr}</li></ul><p>Le enviaremos un enlace de Teams para la reuni\u00F3n.</p>`;

    await db()
      .from('email_drafts')
      .update({
        body_text: draft.body_text + appendText,
        body_html: (draft.body_html || '') + appendHtml,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id);

    await sendTelegramMessage(
      '\uD83D\uDCDD Borrador actualizado con confirmaci\u00F3n de cita. Revisa antes de aprobar.',
    );
  } catch {
    // Non-critical
  }
}

// ── Post-consultation followup callbacks ────────────────────────────────────

async function handleFollowupCallback(data: string): Promise<void> {
  const parts = data.split(':');
  const action = parts[0]; // followup_quote, followup_summary, followup_tomorrow, followup_no
  const citaId = parts[1];

  if (!citaId) return;

  // Get cita info
  const { data: cita } = await db()
    .from('citas')
    .select('id, titulo, tipo, cliente:clientes(nombre, email)')
    .eq('id', citaId)
    .single();

  const clienteName = (cita as any)?.cliente?.nombre || 'cliente';

  switch (action) {
    case 'followup_quote':
      await sendTelegramMessage(
        `\uD83D\uDCC4 <b>Cotizaci\u00F3n pendiente</b> para ${escapeHtml(clienteName)}\n\n` +
        `Crea la cotizaci\u00F3n en el dashboard:\nhttps://papeleo.legal/admin/cotizaciones`,
        { parse_mode: 'HTML' },
      );
      break;

    case 'followup_summary':
      await sendTelegramMessage(
        `\uD83D\uDCDD <b>Agrega notas</b> de la consulta con ${escapeHtml(clienteName)}\n\n` +
        `Dashboard: https://papeleo.legal/admin/calendario`,
        { parse_mode: 'HTML' },
      );
      break;

    case 'followup_tomorrow':
      // Reset followup so it triggers again on next cron cycle
      await db()
        .from('citas')
        .update({ followup_enviado: false })
        .eq('id', citaId);

      await sendTelegramMessage('\u23F0 Te recordar\u00E9 de nuevo m\u00E1s tarde.');
      return; // Don't mark followup_enviado

    case 'followup_no':
      await sendTelegramMessage('\u274C Seguimiento descartado');
      break;

    default:
      return;
  }

  // Mark followup as handled (followup_tomorrow returns early above)
  await db()
    .from('citas')
    .update({ followup_enviado: true })
    .eq('id', citaId);
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
