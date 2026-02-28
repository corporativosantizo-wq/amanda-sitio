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
import { approveDraft, rejectDraft, listPendingDrafts, getStats, getAgenda, getAvailability, getDayView, getWeekView, getMultiDayAvailability } from '@/lib/services/molly.service';
import { createCalendarEvent } from '@/lib/services/outlook.service';
import { crearTarea, listarTareas, completarTarea, migrarTarea, resumenTareas } from '@/lib/services/tareas.service';
import { HORARIOS, CategoriaTarea, EstadoTarea } from '@/lib/types';
import type { TipoCita, TareaInsert } from '@/lib/types';
import {
  getConversation,
  clearConversation,
  startCreateFlow,
  handleCreateCallback,
  handleCreateText,
  startCancelFlow,
  handleCancelCallback,
} from '@/lib/molly/telegram-calendar';
import { searchDriveFiles } from '@/lib/molly/graph-drive';
import type { DriveItem } from '@/lib/molly/graph-drive';
import { searchEmails, getConversationThread } from '@/lib/molly/graph-mail';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

const SEARCH_ACCOUNTS: MailboxAlias[] = ['amanda@papeleo.legal', 'asistente@papeleo.legal', 'contador@papeleo.legal'];

// In-memory store for /buscar "Ver hilo" callbacks
let lastSearchEmails: Array<{
  account: MailboxAlias;
  conversationId: string | null;
  subject: string;
  preview: string;
  from: string;
}> = [];

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
    // Inline button shortcuts (from /hoy, /semana, /libre)
    if (data.startsWith('cmd_')) {
      await answerCallbackQuery(query.id);
      if (data === 'cmd_crear') { clearConversation(); await startCreateFlow(); }
      else if (data === 'cmd_hoy') {
        const msg = await getDayView(0);
        await sendTelegramMessage(msg, { parse_mode: 'HTML' });
      }
      else if (data === 'cmd_semana') {
        const msg = await getWeekView();
        await sendTelegramMessage(msg, { parse_mode: 'HTML' });
      }
      else if (data === 'cmd_libre') {
        const msg = await getMultiDayAvailability();
        await sendTelegramMessage(msg, { parse_mode: 'HTML' });
      }
      return;
    }

    // Calendar flow callbacks
    if (data.startsWith('cal_type:') || data.startsWith('cal_day:') || data.startsWith('cal_slot:') || data.startsWith('cal_dur:') || data === 'cal_client_skip' || data.startsWith('cal_confirm:')) {
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

    // Task callbacks (complete, migrate)
    if (data.startsWith('tarea_done:') || data.startsWith('tarea_migrar:')) {
      await answerCallbackQuery(query.id);
      await handleTareaCallback(data);
      return;
    }

    // Habit callbacks
    if (data.startsWith('habit_toggle:')) {
      await answerCallbackQuery(query.id);
      await handleHabitCallback(data);
      return;
    }

    // Search email thread callback
    if (data.startsWith('search_email:')) {
      await answerCallbackQuery(query.id);
      await handleSearchEmailCallback(parseInt(data.split(':')[1], 10));
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

  if (text === '/hoy') {
    try {
      const msg = await getDayView(0);
      await sendTelegramMessage(msg, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: '+ Crear evento', callback_data: 'cmd_crear' }, { text: 'Ver semana', callback_data: 'cmd_semana' }, { text: 'Disponibilidad', callback_data: 'cmd_libre' }],
        ] },
      });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo agenda: ${err.message}`);
    }
    return;
  }

  if (text === '/mañana' || text === '/manana') {
    try {
      const msg = await getDayView(1);
      await sendTelegramMessage(msg, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: '+ Crear evento', callback_data: 'cmd_crear' }, { text: 'Ver semana', callback_data: 'cmd_semana' }, { text: 'Disponibilidad', callback_data: 'cmd_libre' }],
        ] },
      });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo agenda: ${err.message}`);
    }
    return;
  }

  if (text === '/semana') {
    try {
      const msg = await getWeekView();
      await sendTelegramMessage(msg, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: '📅 Hoy', callback_data: 'cmd_hoy' }, { text: '+ Crear evento', callback_data: 'cmd_crear' }],
        ] },
      });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo agenda: ${err.message}`);
    }
    return;
  }

  if (text === '/libre') {
    try {
      const msg = await getMultiDayAvailability();
      await sendTelegramMessage(msg, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [
          [{ text: '+ Crear evento', callback_data: 'cmd_crear' }, { text: '📅 Hoy', callback_data: 'cmd_hoy' }],
        ] },
      });
    } catch (err: any) {
      await sendTelegramMessage(`Error obteniendo disponibilidad: ${err.message}`);
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

  // ── Task commands ───────────────────────────────────────────────────

  if (text.startsWith('/tarea ')) {
    await handleTareaCommand(text.slice(7).trim());
    return;
  }

  if (text === '/tareas') {
    await handleTareasListCommand();
    return;
  }

  // ── Habit commands ────────────────────────────────────────────────

  if (text === '/habitos') {
    await handleHabitosCommand();
    return;
  }

  if (text === '/racha') {
    await handleRachaCommand();
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

  // ── Search command ──────────────────────────────────────────────────

  if (text.startsWith('/buscar ')) {
    const query = text.slice(8).trim();
    if (!query) {
      await sendTelegramMessage('Uso: <code>/buscar texto</code>', { parse_mode: 'HTML' });
      return;
    }
    await handleBuscarCommand(query);
    return;
  }

  if (text === '/buscar') {
    await sendTelegramMessage(
      'Uso: <code>/buscar texto</code>\n\nEjemplos:\n<code>/buscar Derick</code>\n<code>/buscar contrato Procapeli</code>\n<code>/buscar cotización Sololá</code>',
      { parse_mode: 'HTML' },
    );
    return;
  }

  // Unknown command
  if (text.startsWith('/')) {
    await sendTelegramMessage(
      `<b>Comandos disponibles:</b>\n\n` +
      `<b>Calendario:</b>\n` +
      `/hoy — resumen visual de hoy\n` +
      `/mañana — resumen de mañana\n` +
      `/semana — vista compacta de la semana\n` +
      `/libre — disponibilidad 3 días\n` +
      `/disponibilidad [fecha] — slots de un día\n` +
      `/crear — crear evento\n` +
      `/cancelar — cancelar evento de hoy\n\n` +
      `<b>Tareas:</b>\n` +
      `/tarea [texto] — crear tarea rápida\n` +
      `/tareas — ver pendientes\n\n` +
      `<b>Hábitos:</b>\n` +
      `/habitos — hábitos de hoy\n` +
      `/racha — ver rachas\n\n` +
      `<b>Email:</b>\n` +
      `/pendientes — borradores pendientes\n` +
      `/stats — estadísticas Molly Mail\n\n` +
      `<b>Buscar:</b>\n` +
      `/buscar [texto] — archivos y emails\n\n` +
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

// ── Task commands ────────────────────────────────────────────────────────────

const CATEGORIA_KEYWORDS: Array<{ cat: CategoriaTarea; keywords: string[] }> = [
  { cat: CategoriaTarea.COBROS, keywords: ['cobr', 'pago', 'factur', 'honorar'] },
  { cat: CategoriaTarea.DOCUMENTOS, keywords: ['documento', 'contrato', 'escritura', 'redact'] },
  { cat: CategoriaTarea.AUDIENCIAS, keywords: ['audiencia', 'juzgado', 'tribunal'] },
  { cat: CategoriaTarea.SEGUIMIENTO, keywords: ['seguimiento', 'revisar', 'llamar', 'contactar'] },
  { cat: CategoriaTarea.PERSONAL, keywords: ['personal', 'gym', 'médico', 'doctor'] },
];

function detectCategoria(text: string): CategoriaTarea {
  const lower = text.toLowerCase();
  for (const { cat, keywords } of CATEGORIA_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return CategoriaTarea.TRAMITES;
}

function detectPrioridad(text: string): 'alta' | 'media' | 'baja' {
  if (text.includes('!!!') || text.toLowerCase().includes('urgente')) return 'alta';
  if (text.includes('!!')) return 'alta';
  return 'media';
}

async function handleTareaCommand(text: string): Promise<void> {
  if (!text) {
    await sendTelegramMessage(
      'Uso: <code>/tarea Revisar expediente López</code>\n\n' +
      'Prefijos opcionales:\n' +
      '<code>!</code> o <code>!!</code> para prioridad alta\n' +
      '<code>@cobros</code> <code>@audiencias</code> etc. para categoría',
      { parse_mode: 'HTML' },
    );
    return;
  }

  let titulo = text;
  const prioridad = detectPrioridad(titulo);
  titulo = titulo.replace(/!+/g, '').trim();

  // Detect @category tag
  let categoria = detectCategoria(titulo);
  const catMatch = titulo.match(/@(cobros|documentos|audiencias|tramites|personal|seguimiento)\b/i);
  if (catMatch) {
    categoria = catMatch[1].toLowerCase() as CategoriaTarea;
    titulo = titulo.replace(catMatch[0], '').trim();
  }

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  const input: TareaInsert = {
    titulo,
    prioridad,
    categoria,
    fecha_limite: hoy,
  };

  try {
    const tarea = await crearTarea(input);

    const prioTag = prioridad === 'alta' ? ' <b>[ALTA]</b>' : '';
    await sendTelegramMessage(
      `\u2705 <b>Tarea creada</b>${prioTag}\n\n` +
      `\u2022 ${escapeHtml(tarea.titulo)}\n` +
      `\uD83C\uDFF7 ${categoria} | \uD83D\uDCC5 ${hoy}`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            { text: '\u2715 Completar', callback_data: `tarea_done:${tarea.id}` },
            { text: '> Migrar', callback_data: `tarea_migrar:${tarea.id}` },
          ]],
        },
      },
    );
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error al crear tarea: ${err.message}`);
  }
}

async function handleTareasListCommand(): Promise<void> {
  try {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
    const { data: tareas } = await listarTareas({
      estado: 'pendiente',
      limit: 15,
    });

    if (tareas.length === 0) {
      await sendTelegramMessage('\u2705 No hay tareas pendientes. ¡Buen trabajo!');
      return;
    }

    // Sort: overdue first, then high priority, then by date
    const sorted = [...tareas].sort((a, b) => {
      const aOverdue = a.fecha_limite && a.fecha_limite < hoy ? -1 : 0;
      const bOverdue = b.fecha_limite && b.fecha_limite < hoy ? -1 : 0;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      const prio: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      return (prio[a.prioridad] ?? 1) - (prio[b.prioridad] ?? 1);
    });

    let msg = `\uD83D\uDCCB <b>Tareas pendientes</b> (${tareas.length})\n`;

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    for (const t of sorted.slice(0, 10)) {
      const overdue = t.fecha_limite && t.fecha_limite < hoy ? '\uD83D\uDD34' : '';
      const prio = t.prioridad === 'alta' ? '\u203C\uFE0F' : '';
      const fecha = t.fecha_limite ? ` (${t.fecha_limite})` : '';
      msg += `\n${overdue}${prio}\u2022 ${escapeHtml(t.titulo)}${fecha}`;

      buttons.push([
        { text: `\u2715 ${t.titulo.substring(0, 25)}`, callback_data: `tarea_done:${t.id}` },
        { text: '>', callback_data: `tarea_migrar:${t.id}` },
      ]);
    }

    if (tareas.length > 10) {
      msg += `\n\n... y ${tareas.length - 10} más`;
    }

    // Add summary
    const resumen = await resumenTareas();
    if (resumen.vencidas > 0) {
      msg += `\n\n\uD83D\uDD34 ${resumen.vencidas} vencidas`;
    }

    await sendTelegramMessage(msg, {
      parse_mode: 'HTML',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
    });
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error: ${err.message}`);
  }
}

async function handleTareaCallback(data: string): Promise<void> {
  const [action, tareaId] = data.split(':');

  if (!tareaId) return;

  try {
    if (action === 'tarea_done') {
      const tarea = await completarTarea(tareaId);
      await sendTelegramMessage(
        `\u2715 <b>Completada:</b> ${escapeHtml(tarea.titulo)}`,
        { parse_mode: 'HTML' },
      );
    } else if (action === 'tarea_migrar') {
      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      const mananaStr = manana.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
      const tarea = await migrarTarea(tareaId, mananaStr);
      await sendTelegramMessage(
        `> <b>Migrada a ${mananaStr}:</b> ${escapeHtml(tarea.titulo)}`,
        { parse_mode: 'HTML' },
      );
    }
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error: ${err.message}`);
  }
}

// ── Habit commands ──────────────────────────────────────────────────────────

async function handleHabitosCommand(): Promise<void> {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  try {
    // Get all active habits
    const { data: habits } = await db()
      .from('habits')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (!habits || habits.length === 0) {
      await sendTelegramMessage('No hay hábitos configurados.');
      return;
    }

    // Get today's logs
    const { data: logs } = await db()
      .from('habit_logs')
      .select('habit_id')
      .eq('fecha', hoy);

    const completedIds = new Set((logs ?? []).map((l: any) => l.habit_id));

    let msg = `\uD83C\uDFAF <b>Hábitos de hoy</b> — ${hoy}\n`;
    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

    for (const h of habits) {
      const done = completedIds.has(h.id);
      const check = done ? '\u2705' : '\u2B1C';
      msg += `\n${check} ${h.emoji} ${escapeHtml(h.nombre)}`;

      buttons.push([{
        text: `${done ? '\u2705' : '\u2B1C'} ${h.emoji} ${h.nombre}`,
        callback_data: `habit_toggle:${h.id}`,
      }]);
    }

    const doneCount = completedIds.size;
    const total = habits.length;
    msg += `\n\n${doneCount}/${total} completados`;

    await sendTelegramMessage(msg, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buttons },
    });
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error: ${err.message}`);
  }
}

async function handleRachaCommand(): Promise<void> {
  try {
    const { data: habits } = await db()
      .from('habits')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });

    if (!habits || habits.length === 0) {
      await sendTelegramMessage('No hay hábitos configurados.');
      return;
    }

    // Calculate streaks: count consecutive days back from today (or yesterday)
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

    let msg = `\uD83D\uDD25 <b>Rachas de hábitos</b>\n`;

    for (const h of habits) {
      // Get last 30 logs for this habit, ordered descending
      const { data: logs } = await db()
        .from('habit_logs')
        .select('fecha')
        .eq('habit_id', h.id)
        .order('fecha', { ascending: false })
        .limit(60);

      const fechas = new Set((logs ?? []).map((l: any) => l.fecha));

      // Count streak from today or yesterday backwards
      let streak = 0;
      let checkDate = new Date(hoy + 'T12:00:00');

      // If today not done, start from yesterday
      if (!fechas.has(hoy)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 60; i++) {
        const dateStr = checkDate.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
        if (fechas.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      const fire = streak >= 7 ? '\uD83D\uDD25' : streak >= 3 ? '\u2B50' : '';
      msg += `\n${h.emoji} ${escapeHtml(h.nombre)}: <b>${streak} días</b> ${fire}`;
    }

    await sendTelegramMessage(msg, { parse_mode: 'HTML' });
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error: ${err.message}`);
  }
}

async function handleHabitCallback(data: string): Promise<void> {
  const habitId = data.split(':')[1];
  if (!habitId) return;

  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  try {
    // Check if already logged today
    const { data: existing } = await db()
      .from('habit_logs')
      .select('id')
      .eq('habit_id', habitId)
      .eq('fecha', hoy)
      .maybeSingle();

    if (existing) {
      // Toggle off — delete log
      await db().from('habit_logs').delete().eq('id', existing.id);
    } else {
      // Toggle on — create log
      await db().from('habit_logs').insert({ habit_id: habitId, fecha: hoy });
    }

    // Re-render the habits list
    await handleHabitosCommand();
  } catch (err: any) {
    await sendTelegramMessage(`\u274C Error: ${err.message}`);
  }
}

// ── Search command (/buscar) ──────────────────────────────────────────────

async function handleBuscarCommand(query: string): Promise<void> {
  await sendTelegramMessage(
    `\uD83D\uDD0D Buscando "<b>${escapeHtml(query)}</b>"...`,
    { parse_mode: 'HTML' },
  );

  try {
    // Search drives and emails in parallel across all 3 accounts
    const drivePromises = SEARCH_ACCOUNTS.map((acc: MailboxAlias) =>
      searchDriveFiles(acc, query).catch((err: any) => {
        console.error(`[buscar] Drive error ${acc}:`, err.message);
        return [] as DriveItem[];
      }),
    );
    const emailPromises = SEARCH_ACCOUNTS.map((acc: MailboxAlias) =>
      searchEmails(acc, query, 90)
        .then((msgs: any[]) => msgs.map((m: any) => ({ msg: m, account: acc })))
        .catch((err: any) => {
          console.error(`[buscar] Email error ${acc}:`, err.message);
          return [] as Array<{ msg: any; account: MailboxAlias }>;
        }),
    );

    const [driveResults, emailResults] = await Promise.all([
      Promise.all(drivePromises).then((r: DriveItem[][]) => r.flat()),
      Promise.all(emailPromises).then((r: Array<Array<{ msg: any; account: MailboxAlias }>>) => r.flat()),
    ]);

    // Dedup drive results by lowercase name, skip folders
    const seenFiles = new Set<string>();
    const files = driveResults.filter((f: DriveItem) => {
      if (f.type === 'folder') return false;
      const key = f.name.toLowerCase();
      if (seenFiles.has(key)) return false;
      seenFiles.add(key);
      return true;
    }).slice(0, 5);

    // Dedup emails by conversationId, keep most recent
    const emailMap = new Map<string, { msg: any; account: MailboxAlias }>();
    for (const e of emailResults) {
      const key = e.msg.conversationId || e.msg.id;
      const existing = emailMap.get(key);
      if (!existing || e.msg.receivedDateTime > existing.msg.receivedDateTime) {
        emailMap.set(key, e);
      }
    }
    const emails = [...emailMap.values()]
      .sort((a: any, b: any) => b.msg.receivedDateTime.localeCompare(a.msg.receivedDateTime))
      .slice(0, 5);

    // Store for "Ver hilo" callbacks
    lastSearchEmails = emails.map((e: any) => ({
      account: e.account,
      conversationId: e.msg.conversationId || null,
      subject: e.msg.subject || '(Sin asunto)',
      preview: e.msg.bodyPreview || '',
      from: e.msg.from?.emailAddress?.name || e.msg.from?.emailAddress?.address || '',
    }));

    if (files.length === 0 && emails.length === 0) {
      await sendTelegramMessage(
        `No encontr\u00E9 documentos ni emails con "<b>${escapeHtml(query)}</b>"`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Build message text + inline keyboard
    let msg = '';
    const keyboard: Array<Array<{ text: string; url?: string; callback_data?: string }>> = [];

    if (files.length > 0) {
      msg += `\uD83D\uDCC2 <b>ARCHIVOS ENCONTRADOS:</b>\n`;
      files.forEach((f: DriveItem, i: number) => {
        const sizeKB = Math.round(f.size / 1024);
        const sizeLabel = sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
        msg += `\n${i + 1}. <b>${escapeHtml(f.name)}</b>\n`;
        msg += `   \uD83D\uDCC1 ${escapeHtml(f.path)} \u00B7 ${sizeLabel}\n`;
        keyboard.push([{
          text: `\uD83D\uDCC4 ${f.name.length > 35 ? f.name.substring(0, 33) + '\u2026' : f.name}`,
          url: f.webUrl,
        }]);
      });
    }

    if (emails.length > 0) {
      if (files.length > 0) msg += `\n`;
      msg += `\uD83D\uDCE7 <b>EMAILS RELACIONADOS:</b>\n`;
      emails.forEach((e: any, i: number) => {
        const accountShort = (e.account as string).split('@')[0];
        const dateObj = new Date(e.msg.receivedDateTime);
        const dateStr = new Intl.DateTimeFormat('es', {
          timeZone: 'America/Guatemala',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).format(dateObj);
        const subject = e.msg.subject || '(Sin asunto)';
        msg += `\n${i + 1}. <b>${escapeHtml(subject)}</b>\n`;
        msg += `   \uD83D\uDCEC ${accountShort}@ \u00B7 ${dateStr}\n`;
        keyboard.push([{
          text: `\uD83D\uDCE8 ${subject.length > 35 ? subject.substring(0, 33) + '\u2026' : subject}`,
          callback_data: `search_email:${i}`,
        }]);
      });
    }

    await sendTelegramMessage(msg, {
      parse_mode: 'HTML',
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    });
  } catch (err: any) {
    console.error('[buscar] Error:', err);
    await sendTelegramMessage(`\u274C Error buscando: ${err.message}`);
  }
}

async function handleSearchEmailCallback(index: number): Promise<void> {
  const ref = lastSearchEmails[index];
  if (!ref) {
    await sendTelegramMessage('Resultado expirado. Busca de nuevo con /buscar');
    return;
  }

  try {
    if (!ref.conversationId) {
      // No thread, show single message info
      await sendTelegramMessage(
        `\uD83D\uDCE7 <b>${escapeHtml(ref.subject)}</b>\n` +
        `De: ${escapeHtml(ref.from)}\n\n${escapeHtml(ref.preview)}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    const messages = await getConversationThread(ref.account, ref.conversationId);

    if (messages.length === 0) {
      await sendTelegramMessage(
        `\uD83D\uDCE7 <b>${escapeHtml(ref.subject)}</b>\n` +
        `De: ${escapeHtml(ref.from)}\n\n${escapeHtml(ref.preview)}`,
        { parse_mode: 'HTML' },
      );
      return;
    }

    // Format thread: show last 5 messages
    let msg = `\uD83D\uDCE7 <b>Hilo: ${escapeHtml(ref.subject)}</b>\n`;
    msg += `\uD83D\uDCEC ${ref.account}\n`;
    msg += `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n`;

    const recent = messages.slice(-5);
    for (const m of recent) {
      const fromAddr = m.from.emailAddress.address.toLowerCase();
      const fromName = m.from.emailAddress.name || fromAddr;
      const isOutbound = fromAddr.endsWith('@papeleo.legal');
      const dirEmoji = isOutbound ? '\uD83D\uDCE4' : '\uD83D\uDCE9';

      const dateStr = new Intl.DateTimeFormat('es', {
        timeZone: 'America/Guatemala',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(m.receivedDateTime));

      msg += `\n${dirEmoji} <b>${escapeHtml(fromName)}</b> \u2014 ${dateStr}\n`;

      const preview = (m.bodyPreview || '').trim();
      if (preview) {
        const truncated = preview.length > 200 ? preview.substring(0, 197) + '...' : preview;
        msg += `${escapeHtml(truncated)}\n`;
      }
    }

    if (messages.length > 5) {
      msg += `\n<i>... ${messages.length - 5} mensajes anteriores</i>`;
    }

    await sendTelegramMessage(msg, { parse_mode: 'HTML' });
  } catch (err: any) {
    console.error('[buscar] Thread error:', err);
    await sendTelegramMessage(`\u274C Error leyendo hilo: ${err.message}`);
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
