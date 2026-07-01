// ============================================================================
// lib/services/salientes.service.ts
// Borradores de correos salientes nuevos (sin hilo previo). Permite cargar,
// revisar y enviar en lote correos que el despacho inicia desde cero.
// Funcionalidad PARALELA a email_drafts (respuestas) — no la toca.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { enviarCorreoNuevo, type MailboxAlias } from './outlook.service';
import { emailWrapper } from '@/lib/templates/emails';

const db = () => createAdminClient();

const CUENTAS_VALIDAS: MailboxAlias[] = [
  'asistente@papeleo.legal',
  'contador@papeleo.legal',
  'amanda@papeleo.legal',
];

export class SalienteError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'SalienteError';
  }
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface BorradorSaliente {
  id: string;
  account: string;
  to_emails: string[];
  cc_emails: string[] | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  cliente_id: string | null;
  lote: string | null;
  status: 'pendiente' | 'enviado' | 'cancelado';
  enviado_via: string | null;
  sent_at: string | null;
  programado_para: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalienteInput {
  account: string;
  to_emails: string[];
  cc_emails?: string[] | null;
  subject: string;
  body_text: string;
  body_html?: string | null;
  cliente_id?: string | null;
  lote?: string | null;
}

// ── Validación ──────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function esEmailValido(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function normalizarEmails(lista: unknown): string[] {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((e) => String(e ?? '').trim())
    .filter(Boolean);
}

// Convierte texto plano a HTML simple (mismo criterio que el flujo de respuestas).
function textoAHtml(texto: string): string {
  return `<p>${texto.replace(/\n/g, '<br>')}</p>`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────

// Crea uno o varios borradores salientes (carga masiva). Devuelve los creados.
export async function crearBorradoresSalientes(
  items: SalienteInput[],
): Promise<BorradorSaliente[]> {
  if (!Array.isArray(items) || items.length === 0) {
    throw new SalienteError('No se recibió ningún borrador para crear.');
  }

  const filas = items.map((it, idx) => {
    const account = String(it.account ?? '').trim();
    if (!CUENTAS_VALIDAS.includes(account as MailboxAlias)) {
      throw new SalienteError(`Cuenta de envío inválida en el correo #${idx + 1}: ${account || '(vacía)'}`);
    }
    const to = normalizarEmails(it.to_emails);
    if (to.length === 0) {
      throw new SalienteError(`El correo #${idx + 1} no tiene destinatarios.`);
    }
    const cc = normalizarEmails(it.cc_emails);
    const malos = [...to, ...cc].filter((e) => !esEmailValido(e));
    if (malos.length > 0) {
      throw new SalienteError(`Emails inválidos en el correo #${idx + 1}: ${malos.join(', ')}`);
    }
    const subject = String(it.subject ?? '').trim();
    if (!subject) throw new SalienteError(`El correo #${idx + 1} no tiene asunto.`);
    const bodyText = String(it.body_text ?? '').trim();
    if (!bodyText) throw new SalienteError(`El correo #${idx + 1} no tiene cuerpo.`);

    return {
      account,
      to_emails: to,
      cc_emails: cc.length ? cc : null,
      subject,
      body_text: bodyText,
      body_html: it.body_html?.trim() || null,
      cliente_id: it.cliente_id ?? null,
      lote: it.lote?.trim() || null,
      status: 'pendiente',
    };
  });

  const { data, error } = await db()
    .from('borradores_salientes')
    .insert(filas)
    .select('*');
  if (error) throw new SalienteError('Error al crear borradores salientes', error);
  return (data ?? []) as BorradorSaliente[];
}

// Crea un único borrador saliente redactado por IA. A diferencia de
// crearBorradoresSalientes, el destinatario es OPCIONAL (Amanda lo completa
// antes de enviar; enviarSaliente exige destinatario al enviar). Nunca envía.
export async function crearBorradorIA(input: {
  account: string;
  subject: string;
  body_text: string;
  body_html?: string | null;
  to_emails?: string[];
  cc_emails?: string[] | null;
  cliente_id?: string | null;
}): Promise<BorradorSaliente> {
  const account = String(input.account ?? '').trim();
  if (!CUENTAS_VALIDAS.includes(account as MailboxAlias)) {
    throw new SalienteError(`Cuenta de envío inválida: ${account || '(vacía)'}`);
  }
  const to = normalizarEmails(input.to_emails);
  const cc = normalizarEmails(input.cc_emails);
  const malos = [...to, ...cc].filter((e) => !esEmailValido(e));
  if (malos.length) throw new SalienteError(`Emails inválidos: ${malos.join(', ')}`);
  const subject = String(input.subject ?? '').trim();
  if (!subject) throw new SalienteError('La IA no devolvió un asunto.');
  const bodyText = String(input.body_text ?? '').trim();
  if (!bodyText) throw new SalienteError('La IA no devolvió un cuerpo.');

  const { data, error } = await db()
    .from('borradores_salientes')
    .insert({
      account,
      to_emails: to, // puede ir vacío; se exige al enviar
      cc_emails: cc.length ? cc : null,
      subject,
      body_text: bodyText,
      body_html: input.body_html?.trim() || null,
      cliente_id: input.cliente_id ?? null,
      lote: null,
      status: 'pendiente',
    })
    .select('*')
    .single();
  if (error) throw new SalienteError('Error al crear el borrador de IA', error);
  return data as BorradorSaliente;
}

export async function listarSalientes(params: { lote?: string; status?: string } = {}): Promise<BorradorSaliente[]> {
  let query = db()
    .from('borradores_salientes')
    .select('*')
    .order('lote', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  // Por defecto solo pendientes; status='todos' trae todo.
  if (params.status && params.status !== 'todos') query = query.eq('status', params.status);
  else if (!params.status) query = query.eq('status', 'pendiente');
  if (params.lote) query = query.eq('lote', params.lote);

  const { data, error } = await query;
  if (error) throw new SalienteError('Error al listar borradores salientes', error);
  return (data ?? []) as BorradorSaliente[];
}

export async function obtenerSaliente(id: string): Promise<BorradorSaliente> {
  const { data, error } = await db()
    .from('borradores_salientes')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new SalienteError('Borrador saliente no encontrado', error);
  return data as BorradorSaliente;
}

export interface SalienteUpdate {
  subject?: string;
  body_text?: string;
  body_html?: string | null;
  to_emails?: string[];
  cc_emails?: string[] | null;
  // ISO timestamp (con offset, p.ej. ...-06:00) para programar el envío, o null
  // para volver a envío manual. undefined = no se toca.
  programado_para?: string | null;
}

// Valida que un timestamp de programación sea una fecha futura válida.
// Devuelve el ISO normalizado, o null si se pasa null/'' (envío manual).
function validarProgramacion(valor: string | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) throw new SalienteError('Fecha de programación inválida.');
  if (d.getTime() <= Date.now()) throw new SalienteError('La fecha programada debe ser futura.');
  return d.toISOString();
}

export async function editarSaliente(id: string, updates: SalienteUpdate): Promise<BorradorSaliente> {
  const actual = await obtenerSaliente(id);
  if (actual.status !== 'pendiente') {
    throw new SalienteError(`No se puede editar un borrador en estado: ${actual.status}`);
  }

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (updates.to_emails !== undefined) {
    const to = normalizarEmails(updates.to_emails);
    if (to.length === 0) throw new SalienteError('Debe haber al menos un destinatario.');
    const malos = to.filter((e) => !esEmailValido(e));
    if (malos.length) throw new SalienteError(`Emails inválidos: ${malos.join(', ')}`);
    payload.to_emails = to;
  }
  if (updates.cc_emails !== undefined) {
    const cc = normalizarEmails(updates.cc_emails);
    const malos = cc.filter((e) => !esEmailValido(e));
    if (malos.length) throw new SalienteError(`Emails CC inválidos: ${malos.join(', ')}`);
    payload.cc_emails = cc.length ? cc : null;
  }
  if (updates.subject !== undefined) {
    const s = updates.subject.trim();
    if (!s) throw new SalienteError('El asunto no puede quedar vacío.');
    payload.subject = s;
  }
  if (updates.body_text !== undefined) {
    const b = updates.body_text.trim();
    if (!b) throw new SalienteError('El cuerpo no puede quedar vacío.');
    payload.body_text = b;
    // Si el cuerpo cambió y no se pasó html explícito, regenerar el html.
    if (updates.body_html === undefined) payload.body_html = null;
  }
  if (updates.body_html !== undefined) payload.body_html = updates.body_html?.trim() || null;
  if (updates.programado_para !== undefined) {
    // null/'' → envío manual; con valor → debe ser futura.
    payload.programado_para = validarProgramacion(updates.programado_para);
  }

  const { data, error } = await db()
    .from('borradores_salientes')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new SalienteError('Error al editar borrador saliente', error);
  return data as BorradorSaliente;
}

// Programa (o desprograma) todos los pendientes de un lote para la misma fecha.
// programadoPara=null vuelve el lote a envío manual.
export async function programarLoteSaliente(
  lote: string,
  programadoPara: string | null,
): Promise<{ actualizados: number; programado_para: string | null }> {
  if (!lote.trim()) throw new SalienteError('Lote requerido.');
  const valor = validarProgramacion(programadoPara);

  const { data, error } = await db()
    .from('borradores_salientes')
    .update({ programado_para: valor, updated_at: new Date().toISOString() })
    .eq('lote', lote)
    .eq('status', 'pendiente')
    .select('id');
  if (error) throw new SalienteError('Error al programar el lote', error);
  return { actualizados: data?.length ?? 0, programado_para: valor };
}

// Cancela (no borra físicamente).
export async function cancelarSaliente(id: string): Promise<BorradorSaliente> {
  const { data, error } = await db()
    .from('borradores_salientes')
    .update({ status: 'cancelado', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new SalienteError('Error al cancelar borrador saliente', error);
  return data as BorradorSaliente;
}

// ── Envío ───────────────────────────────────────────────────────────────────

// Registra el correo enviado en el historial (legal.email_threads + email_messages,
// direction='outbound') para que quede asociado al cliente/hilo. Best-effort: si
// el log falla, el correo ya se envió y el borrador queda como 'enviado'.
async function registrarEnHistorial(
  borrador: BorradorSaliente,
  account: string,
  messageId: string,
  bodyHtml: string,
): Promise<void> {
  try {
    const ahora = new Date().toISOString();
    const { data: thread, error: thErr } = await db()
      .from('email_threads')
      .insert({
        subject: borrador.subject,
        conversation_id: null,
        account,
        status: 'abierto',
        cliente_id: borrador.cliente_id ?? null,
        last_message_at: ahora,
        message_count: 1,
      })
      .select('id')
      .single();
    if (thErr || !thread) {
      console.error('[saliente] No se pudo crear thread para historial:', thErr);
      return;
    }
    const { error: msgErr } = await db()
      .from('email_messages')
      .insert({
        thread_id: thread.id,
        microsoft_id: messageId,
        from_email: account,
        to_emails: borrador.to_emails,
        cc_emails: borrador.cc_emails ?? [],
        subject: borrador.subject,
        body_text: borrador.body_text,
        body_html: bodyHtml,
        direction: 'outbound',
        received_at: ahora,
      });
    if (msgErr) console.error('[saliente] No se pudo registrar email_message:', msgErr);
  } catch (e) {
    console.error('[saliente] Error registrando en historial:', e instanceof Error ? e.message : e);
  }
}

// Envía un borrador saliente vía Graph y lo marca como enviado.
export async function enviarSaliente(id: string): Promise<BorradorSaliente> {
  const borrador = await obtenerSaliente(id);
  if (borrador.status !== 'pendiente') {
    throw new SalienteError(`El correo ya está en estado: ${borrador.status}`);
  }
  if (!CUENTAS_VALIDAS.includes(borrador.account as MailboxAlias)) {
    throw new SalienteError(`Cuenta de envío inválida: ${borrador.account}`);
  }

  const to = normalizarEmails(borrador.to_emails);
  const cc = normalizarEmails(borrador.cc_emails);
  const malos = [...to, ...cc].filter((e) => !esEmailValido(e));
  if (to.length === 0) throw new SalienteError('El correo no tiene destinatarios.');
  if (malos.length) throw new SalienteError(`Emails inválidos: ${malos.join(', ')}`);

  // Cuerpo interno (sin marca) — así se guarda en BD e historial.
  const bodyHtml = borrador.body_html?.trim() || textoAHtml(borrador.body_text);

  const { messageId } = await enviarCorreoNuevo({
    from: borrador.account as MailboxAlias,
    to,
    cc: cc.length ? cc : undefined,
    subject: borrador.subject,
    // Se envuelve en la plantilla de marca SOLO al enviar (logo/header/footer),
    // igual que las respuestas de Molly y las cotizaciones/citas.
    htmlBody: emailWrapper(bodyHtml),
  });

  await registrarEnHistorial(borrador, borrador.account, messageId, bodyHtml);

  const { data, error } = await db()
    .from('borradores_salientes')
    .update({
      status: 'enviado',
      enviado_via: messageId,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new SalienteError('Correo enviado, pero error al actualizar el borrador', error);
  return data as BorradorSaliente;
}

export interface ResultadoLote {
  total: number;
  enviados: Array<{ id: string; subject: string; to: string[] }>;
  fallidos: Array<{ id: string; subject: string; error: string }>;
}

// Envía todos los pendientes de un lote, con delay entre cada uno para no
// saturar Graph. Un fallo individual no detiene el resto.
export async function enviarLoteSaliente(lote: string, delayMs = 2500): Promise<ResultadoLote> {
  const pendientes = await listarSalientes({ lote, status: 'pendiente' });
  const resultado: ResultadoLote = { total: pendientes.length, enviados: [], fallidos: [] };

  for (let i = 0; i < pendientes.length; i++) {
    const b = pendientes[i];
    try {
      await enviarSaliente(b.id);
      resultado.enviados.push({ id: b.id, subject: b.subject, to: b.to_emails });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      console.error('[saliente] Falló envío en lote para', b.id, msg);
      resultado.fallidos.push({ id: b.id, subject: b.subject, error: msg });
    }
    // Delay entre envíos (no tras el último).
    if (i < pendientes.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return resultado;
}

// Envía los correos programados cuya fecha ya venció (status='pendiente',
// programado_para IS NOT NULL y <= now()). Lo usa el cron. Delay entre correos
// para no saturar Graph; un fallo individual no detiene el resto.
export async function enviarProgramadosVencidos(delayMs = 2500): Promise<{ enviados: number; errores: number }> {
  const { data: pendientes, error } = await db()
    .from('borradores_salientes')
    .select('id')
    .eq('status', 'pendiente')
    .not('programado_para', 'is', null)
    .lte('programado_para', new Date().toISOString())
    .order('programado_para', { ascending: true });

  if (error) throw new SalienteError('Error consultando programados', error);
  if (!pendientes || pendientes.length === 0) return { enviados: 0, errores: 0 };

  let enviados = 0;
  let errores = 0;
  for (let i = 0; i < pendientes.length; i++) {
    try {
      await enviarSaliente(pendientes[i].id);
      enviados++;
    } catch (e) {
      console.error('[saliente] Error enviando programado', pendientes[i].id, e instanceof Error ? e.message : e);
      errores++;
    }
    if (i < pendientes.length - 1 && delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { enviados, errores };
}
