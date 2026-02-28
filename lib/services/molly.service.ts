// ============================================================================
// lib/services/molly.service.ts
// Orquestación principal de Molly Mail
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchNewEmails, stripHtmlToText } from '@/lib/molly/graph-mail';
import { classifyEmail, generateDraft } from '@/lib/molly/brain';
import {
  sendTelegramMessage,
  buildEmailNotification,
  buildUrgentAlert,
  buildSchedulingNotification,
} from '@/lib/molly/telegram';
import {
  getCalendarEvents,
  findFreeSlots,
  getDayBounds,
  formatAgendaForTelegram,
  formatAvailabilityForTelegram,
  formatDateSpanish,
  formatDayViewForTelegram,
  formatWeekViewForTelegram,
  formatMultiDayAvailability,
  getNextBusinessDays,
} from '@/lib/molly/calendar';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import type {
  EmailThread,
  EmailMessage,
  EmailDraft,
  EmailSchedulingIntent,
  GraphMailMessage,
  MollyClassification,
  ApprovedVia,
} from '@/lib/types/molly';

const db = () => createAdminClient();

// ── Custom error ───────────────────────────────────────────────────────────

export class MollyError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'MollyError';
    this.details = details;
  }
}

// ── Accounts to poll ───────────────────────────────────────────────────────

const ACCOUNTS: MailboxAlias[] = ['amanda@papeleo.legal', 'asistente@papeleo.legal', 'contador@papeleo.legal'];

// ── Main pipeline ──────────────────────────────────────────────────────────

export async function checkAndProcessEmails(): Promise<{
  processed: number;
  drafts: number;
  errors: string[];
}> {
  let processed = 0;
  let draftsCreated = 0;
  const errors: string[] = [];

  // Read last check timestamps from configuracion
  const { data: config } = await db()
    .from('configuracion')
    .select('molly_last_check')
    .limit(1)
    .single();

  const lastCheck: Record<string, string> = config?.molly_last_check ?? {};

  for (const account of ACCOUNTS) {
    try {
      // Buffer de 5 minutos: Graph API puede demorar en indexar emails nuevos.
      // Sin buffer, emails con receivedDateTime < lastCheck se pierden si Graph
      // los indexa después. La dedup por microsoft_id en processOneEmail evita reprocesar.
      const rawSince = lastCheck[account] || new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const sinceWithBuffer = new Date(new Date(rawSince).getTime() - 5 * 60 * 1000).toISOString();
      const messages = await fetchNewEmails(account, sinceWithBuffer);

      // Process max 10 per cycle per account
      for (const msg of messages.slice(0, 10)) {
        try {
          const result = await processOneEmail(msg, account);
          processed++;
          if (result.draftCreated) draftsCreated++;
        } catch (err: any) {
          const errMsg = `Error procesando ${msg.id}: ${err.message}`;
          console.error('[molly]', errMsg);
          errors.push(errMsg);
        }
      }

      // Update last check timestamp
      lastCheck[account] = new Date().toISOString();
    } catch (err: any) {
      const errMsg = `Error fetching ${account}: ${err.message}`;
      console.error('[molly]', errMsg);
      errors.push(errMsg);
    }
  }

  // Save updated timestamps
  await db()
    .from('configuracion')
    .update({ molly_last_check: lastCheck })
    .not('id', 'is', null); // update all rows (there's only 1)

  console.log(`[molly] Ciclo completado: ${processed} procesados, ${draftsCreated} borradores, ${errors.length} errores`);
  return { processed, drafts: draftsCreated, errors };
}

// ── Process a single email ─────────────────────────────────────────────────

async function processOneEmail(
  msg: GraphMailMessage,
  account: MailboxAlias,
): Promise<{ draftCreated: boolean }> {
  // Skip if already processed (UNIQUE constraint on microsoft_id)
  const { data: existing } = await db()
    .from('email_messages')
    .select('id')
    .eq('microsoft_id', msg.id)
    .maybeSingle();

  if (existing) {
    console.log('[molly] Mensaje ya procesado:', msg.id);
    return { draftCreated: false };
  }

  const fromEmail = msg.from.emailAddress.address.toLowerCase();
  const fromName = msg.from.emailAddress.name || null;
  const bodyText = msg.body.contentType === 'html'
    ? stripHtmlToText(msg.body.content)
    : msg.body.content;

  // Find or create thread by conversationId
  const thread = await findOrCreateThread(msg, account);

  // Insert email message
  const toEmails = msg.toRecipients.map((r) => r.emailAddress.address);
  const ccEmails = msg.ccRecipients?.map((r) => r.emailAddress.address) ?? [];
  const attachments = msg.attachments?.map((a) => ({
    name: a.name,
    contentType: a.contentType,
    size: a.size,
  })) ?? [];

  const { data: emailMsg, error: insertErr } = await db()
    .from('email_messages')
    .insert({
      thread_id: thread.id,
      microsoft_id: msg.id,
      from_email: fromEmail,
      from_name: fromName,
      to_emails: toEmails,
      cc_emails: ccEmails,
      subject: msg.subject,
      body_text: bodyText,
      body_html: msg.body.contentType === 'html' ? msg.body.content : null,
      direction: isOurEmail(fromEmail) ? 'outbound' : 'inbound',
      attachments,
      received_at: msg.receivedDateTime,
    })
    .select()
    .single();

  if (insertErr) throw new MollyError('Error insertando mensaje', insertErr);

  // Update thread message count and last_message_at
  await db()
    .from('email_threads')
    .update({
      message_count: thread.message_count + 1,
      last_message_at: msg.receivedDateTime,
      updated_at: new Date().toISOString(),
    })
    .eq('id', thread.id);

  // Upsert contact
  await upsertContact(fromEmail, fromName);

  // Skip classification for our own outbound emails
  if (isOurEmail(fromEmail)) {
    return { draftCreated: false };
  }

  // Classify with Claude (account-aware)
  const knownContact = await getContactName(fromEmail);
  const classification = await classifyEmail(fromEmail, msg.subject, bodyText || '', knownContact, account);

  // Update message with classification
  await db()
    .from('email_messages')
    .update({
      clasificacion: classification.tipo,
      confidence_score: classification.confianza,
      resumen: classification.resumen,
    })
    .eq('id', emailMsg.id);

  // Update thread classification + urgency
  await db()
    .from('email_threads')
    .update({
      clasificacion: classification.tipo,
      urgencia: classification.urgencia,
      updated_at: new Date().toISOString(),
    })
    .eq('id', thread.id);

  // Try to match contact to client
  await matchContactToClient(fromEmail, classification.cliente_probable);

  // Check scheduling intent (skip for contador@ — financial emails don't schedule)
  if (classification.scheduling_intent && account !== 'contador@papeleo.legal') {
    try {
      await handleSchedulingIntent(classification, emailMsg as EmailMessage, thread);
    } catch (err: any) {
      console.error('[molly] Error procesando scheduling intent:', err.message);
    }
  }

  // Generate draft if needed
  let draftCreated = false;
  if (classification.requiere_respuesta && classification.tipo !== 'spam') {
    try {
      const clientContext = await getClientContext(fromEmail);
      const recentMessages = await getRecentThreadMessages(thread.id);

      const draftResult = await generateDraft(emailMsg as EmailMessage, thread.subject, clientContext, recentMessages, account);

      const { data: draft } = await db()
        .from('email_drafts')
        .insert({
          thread_id: thread.id,
          message_id: emailMsg.id,
          to_email: fromEmail,
          subject: draftResult.subject,
          body_text: draftResult.body_text,
          body_html: draftResult.body_html,
          tone: draftResult.tone,
          status: 'pendiente',
        })
        .select()
        .single();

      if (draft) {
        // Notify via Telegram
        const updatedThread = { ...thread, clasificacion: classification.tipo, urgencia: classification.urgencia } as EmailThread;
        const notification = buildEmailNotification(updatedThread, emailMsg as EmailMessage, classification, draft as EmailDraft);
        await sendTelegramMessage(notification.text, {
          parse_mode: 'HTML',
          reply_markup: notification.reply_markup,
        });
        draftCreated = true;
      }
    } catch (err: any) {
      console.error('[molly] Error generando borrador:', err.message);
      // Still send alert even if draft generation fails
      const updatedThread = { ...thread, clasificacion: classification.tipo, urgencia: classification.urgencia } as EmailThread;
      const alert = buildUrgentAlert(updatedThread, emailMsg as EmailMessage, classification);
      await sendTelegramMessage(alert.text, { parse_mode: 'HTML' });
    }
  } else if (classification.urgencia >= 2) {
    // Urgent but no draft needed — just alert
    const updatedThread = { ...thread, clasificacion: classification.tipo, urgencia: classification.urgencia } as EmailThread;
    const alert = buildUrgentAlert(updatedThread, emailMsg as EmailMessage, classification);
    await sendTelegramMessage(alert.text, { parse_mode: 'HTML' });
  }

  return { draftCreated };
}

// ── Scheduling intent handler ─────────────────────────────────────────────

async function handleSchedulingIntent(
  classification: MollyClassification,
  message: EmailMessage,
  thread: EmailThread,
): Promise<void> {
  const eventType = classification.event_type ?? 'consulta_nueva';
  const durationMin = eventType === 'consulta_nueva' ? 60 : 30;

  // Determine target date
  let targetDate: Date;
  if (classification.suggested_date) {
    targetDate = new Date(classification.suggested_date + 'T12:00:00');
    if (isNaN(targetDate.getTime())) {
      targetDate = getNextBusinessDay();
    }
  } else {
    targetDate = getNextBusinessDay();
  }

  // Skip weekends
  while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
    targetDate.setDate(targetDate.getDate() + 1);
  }

  // Find free slots
  const slots = await findFreeSlots(targetDate, durationMin);

  // Save intent to DB
  const { data: intent, error } = await db()
    .from('email_scheduling_intents')
    .insert({
      thread_id: thread.id,
      message_id: message.id,
      from_email: message.from_email,
      event_type: eventType,
      suggested_date: formatDateYMD(targetDate),
      suggested_time: classification.suggested_time ?? null,
      available_slots: slots,
      status: 'pendiente',
    })
    .select()
    .single();

  if (error || !intent) {
    console.error('[molly] Error guardando scheduling intent:', error);
    return;
  }

  // Send Telegram notification with slot buttons
  const dateLabel = formatDateSpanish(targetDate);
  const notification = buildSchedulingNotification(
    intent as EmailSchedulingIntent,
    message,
    classification,
    slots,
    dateLabel,
  );

  await sendTelegramMessage(notification.text, {
    parse_mode: 'HTML',
    reply_markup: notification.reply_markup,
  });

  console.log(`[molly] Scheduling intent detectado: ${eventType} para ${formatDateYMD(targetDate)}, ${slots.length} slots disponibles`);
}

function getNextBusinessDay(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── Thread management ──────────────────────────────────────────────────────

async function findOrCreateThread(
  msg: GraphMailMessage,
  account: MailboxAlias,
): Promise<EmailThread> {
  // Try to find by conversationId
  if (msg.conversationId) {
    const { data: existing } = await db()
      .from('email_threads')
      .select('*')
      .eq('conversation_id', msg.conversationId)
      .eq('account', account)
      .maybeSingle();

    if (existing) return existing as EmailThread;
  }

  // Create new thread
  const { data: thread, error } = await db()
    .from('email_threads')
    .insert({
      subject: msg.subject,
      conversation_id: msg.conversationId,
      account,
      status: 'abierto',
      last_message_at: msg.receivedDateTime,
      message_count: 0,
    })
    .select()
    .single();

  if (error) throw new MollyError('Error creando thread', error);
  return thread as EmailThread;
}

// ── Contact management ─────────────────────────────────────────────────────

async function upsertContact(email: string, name: string | null): Promise<void> {
  const { data: existing } = await db()
    .from('email_contacts')
    .select('id, nombre')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (existing) {
    // Update name if we have a better one
    if (name && !existing.nombre) {
      await db()
        .from('email_contacts')
        .update({ nombre: name, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    }
  } else {
    await db()
      .from('email_contacts')
      .insert({
        email: email.toLowerCase(),
        nombre: name,
        tipo: isOurEmail(email) ? 'interno' : 'desconocido',
      });
  }
}

async function getContactName(email: string): Promise<string | null> {
  const { data } = await db()
    .from('email_contacts')
    .select('nombre')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  return data?.nombre ?? null;
}

async function matchContactToClient(email: string, clienteProbable: string | null): Promise<void> {
  if (!clienteProbable) return;

  // Check if contact already has a client
  const { data: contact } = await db()
    .from('email_contacts')
    .select('id, cliente_id')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!contact || contact.cliente_id) return;

  // Try fuzzy match on client name
  const { data: clients } = await db()
    .from('clientes')
    .select('id, nombre')
    .ilike('nombre', `%${clienteProbable}%`)
    .limit(1);

  if (clients?.length) {
    await db()
      .from('email_contacts')
      .update({
        cliente_id: clients[0].id,
        tipo: 'cliente',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id);

    // Also update threads from this contact
    await db()
      .from('email_threads')
      .update({ cliente_id: clients[0].id })
      .is('cliente_id', null)
      .in('id',
        db()
          .from('email_messages')
          .select('thread_id')
          .eq('from_email', email.toLowerCase())
      );
  }
}

// ── Context helpers ────────────────────────────────────────────────────────

async function getClientContext(email: string): Promise<string | null> {
  const { data: contact } = await db()
    .from('email_contacts')
    .select('cliente_id, nombre')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (!contact?.cliente_id) return null;

  const { data: client } = await db()
    .from('clientes')
    .select('nombre, tipo, nit, telefono')
    .eq('id', contact.cliente_id)
    .single();

  if (!client) return null;

  // Get active expedientes
  const { data: expedientes } = await db()
    .from('expedientes')
    .select('numero, titulo, estado')
    .eq('cliente_id', contact.cliente_id)
    .neq('estado', 'cerrado')
    .limit(5);

  let context = `Cliente: ${client.nombre} (${client.tipo})`;
  if (expedientes?.length) {
    context += '\nExpedientes activos:';
    for (const exp of expedientes) {
      context += `\n- ${exp.numero}: ${exp.titulo} (${exp.estado})`;
    }
  }

  return context;
}

async function getRecentThreadMessages(
  threadId: string,
): Promise<Array<{ from: string; body: string }>> {
  const { data } = await db()
    .from('email_messages')
    .select('from_email, body_text')
    .eq('thread_id', threadId)
    .order('received_at', { ascending: false })
    .limit(3);

  return (data ?? []).map((m: any) => ({
    from: m.from_email,
    body: m.body_text || '',
  }));
}

// ── Draft actions ──────────────────────────────────────────────────────────

export async function approveDraft(
  draftId: string,
  via: ApprovedVia,
): Promise<void> {
  const { data: draft, error } = await db()
    .from('email_drafts')
    .select('*, email_threads!inner(account)')
    .eq('id', draftId)
    .single();

  if (error || !draft) throw new MollyError('Borrador no encontrado', error);
  if (draft.status !== 'pendiente') throw new MollyError(`Borrador ya está en estado: ${draft.status}`);

  const account = (draft as any).email_threads?.account as MailboxAlias;

  // Send email via Graph API
  await sendMail({
    from: account || 'asistente@papeleo.legal',
    to: draft.to_email,
    subject: draft.subject,
    htmlBody: draft.body_html || `<p>${draft.body_text.replace(/\n/g, '<br>')}</p>`,
  });

  // Update draft status
  await db()
    .from('email_drafts')
    .update({
      status: 'enviado',
      approved_via: via,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId);

  console.log(`[molly] Borrador ${draftId} aprobado via ${via} y enviado`);
}

export async function rejectDraft(draftId: string): Promise<void> {
  const { error } = await db()
    .from('email_drafts')
    .update({
      status: 'rechazado',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId);

  if (error) throw new MollyError('Error rechazando borrador', error);
  console.log(`[molly] Borrador ${draftId} rechazado`);
}

// ── List / Query ───────────────────────────────────────────────────────────

interface ListThreadsParams {
  status?: string;
  clasificacion?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
}

export async function listThreads(params: ListThreadsParams = {}) {
  const { status, clasificacion, page = 1, limit = 20, busqueda } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('email_threads')
    .select('*', { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) query = query.eq('status', status);
  if (clasificacion) query = query.eq('clasificacion', clasificacion);
  if (busqueda) {
    query = query.ilike('subject', `%${busqueda}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new MollyError('Error listando threads', error);

  return {
    data: (data ?? []) as EmailThread[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function listPendingDrafts(): Promise<
  Array<EmailDraft & { thread: EmailThread; message: EmailMessage | null }>
> {
  const { data, error } = await db()
    .from('email_drafts')
    .select('*, thread:email_threads(*), message:email_messages(*)')
    .eq('status', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new MollyError('Error listando borradores pendientes', error);
  return (data ?? []) as any;
}

export async function getStats(): Promise<{
  totalThreads: number;
  pendingDrafts: number;
  emailsToday: number;
  threadsByClasificacion: Record<string, number>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [threads, drafts, todayMsgs, clasificaciones] = await Promise.all([
    db().from('email_threads').select('*', { count: 'exact', head: true }),
    db().from('email_drafts').select('*', { count: 'exact', head: true }).eq('status', 'pendiente'),
    db().from('email_messages').select('*', { count: 'exact', head: true }).gte('received_at', today.toISOString()),
    db().from('email_threads').select('clasificacion'),
  ]);

  const byClasificacion: Record<string, number> = {};
  for (const t of clasificaciones.data ?? []) {
    const c = t.clasificacion || 'pendiente';
    byClasificacion[c] = (byClasificacion[c] || 0) + 1;
  }

  return {
    totalThreads: threads.count ?? 0,
    pendingDrafts: drafts.count ?? 0,
    emailsToday: todayMsgs.count ?? 0,
    threadsByClasificacion: byClasificacion,
  };
}

// ── Calendar / Agenda ──────────────────────────────────────────────────────

export async function getAgenda(
  range: 'hoy' | 'mañana' | 'semana',
): Promise<string> {
  const now = new Date();

  let startDate: Date;
  let endDate: Date;
  let label: string;

  switch (range) {
    case 'hoy':
      startDate = now;
      endDate = now;
      label = `Hoy (${formatDateSpanish(now)})`;
      break;
    case 'mañana': {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      startDate = tomorrow;
      endDate = tomorrow;
      label = `Mañana (${formatDateSpanish(tomorrow)})`;
      break;
    }
    case 'semana': {
      startDate = now;
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 7);
      label = `Próximos 7 días`;
      break;
    }
  }

  const { start, end } = range === 'semana'
    ? { start: getDayBounds(startDate).start, end: getDayBounds(endDate).end }
    : getDayBounds(startDate);

  const events = await getCalendarEvents(start, end);
  return formatAgendaForTelegram(events, label);
}

export async function getAvailability(
  dateStr?: string,
): Promise<string> {
  let targetDate: Date;

  if (dateStr) {
    targetDate = new Date(dateStr + 'T12:00:00');
    if (isNaN(targetDate.getTime())) {
      return 'Fecha no válida. Usa formato YYYY-MM-DD';
    }
  } else {
    // Default: tomorrow
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    // Skip to Monday if tomorrow is weekend
    while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
  }

  const slots = await findFreeSlots(targetDate);
  const label = formatDateSpanish(targetDate);
  return formatAvailabilityForTelegram(slots, label);
}

// ── Enhanced calendar views for Telegram ──────────────────────────────────

/** /hoy or /mañana — rich day view with emojis, stats, free slots */
export async function getDayView(
  offset: 0 | 1,
): Promise<string> {
  const date = new Date();
  if (offset === 1) date.setDate(date.getDate() + 1);

  const { start, end } = getDayBounds(date);
  const events = await getCalendarEvents(start, end);

  // Count free slots for the footer
  let freeSlotCount = 0;
  try {
    const slots = await findFreeSlots(date);
    freeSlotCount = slots.length;
  } catch { /* weekend or error */ }

  return formatDayViewForTelegram(events, date, freeSlotCount);
}

/** /semana — compact week overview grouped by day */
export async function getWeekView(): Promise<string> {
  const now = new Date();
  // Start from Monday of current week
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const { start } = getDayBounds(monday);
  const { end } = getDayBounds(sunday);
  const events = await getCalendarEvents(start, end);

  // Group by date string
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const dateStr = e.start.substring(0, 10);
    if (!byDay.has(dateStr)) byDay.set(dateStr, []);
    byDay.get(dateStr)!.push(e);
  }

  return formatWeekViewForTelegram(byDay, monday, sunday);
}

/** /libre — availability for next 3 business days */
export async function getMultiDayAvailability(): Promise<string> {
  const now = new Date();
  // Start from today if weekday, otherwise next business day
  const startDate = new Date(now);
  while (startDate.getDay() === 0 || startDate.getDay() === 6) {
    startDate.setDate(startDate.getDate() + 1);
  }

  // Get today + next 2 business days
  const dates = [new Date(startDate)];
  const nextDays = getNextBusinessDays(startDate, 2);
  dates.push(...nextDays);

  const daySlots: Array<{ date: Date; slots: Awaited<ReturnType<typeof findFreeSlots>> }> = [];
  for (const d of dates) {
    try {
      const slots = await findFreeSlots(d);
      daySlots.push({ date: d, slots });
    } catch {
      daySlots.push({ date: d, slots: [] });
    }
  }

  return formatMultiDayAvailability(daySlots);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function isOurEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower.endsWith('@papeleo.legal');
}
