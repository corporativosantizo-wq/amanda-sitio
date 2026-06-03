// ============================================================================
// lib/services/notificaciones-email-telegram.service.ts
// Reglas configurables: cuando se envía un correo a cierto destinatario (y
// opcionalmente desde cierta cuenta), notifica a un chat de Telegram.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/molly/telegram';

const db = () => createAdminClient();

export interface NotificacionEmailTelegram {
  id: string;
  email_destinatario: string;
  email_remitente: string | null;
  telegram_chat_id: string;
  nombre_destinatario: string;
  mensaje_saludo: string | null;
  activo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface NotificacionInput {
  email_destinatario: string;
  email_remitente?: string | null;
  telegram_chat_id: string;
  nombre_destinatario: string;
  mensaje_saludo?: string | null;
  activo?: boolean;
}

export class NotificacionError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'NotificacionError';
  }
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listarNotificaciones(): Promise<NotificacionEmailTelegram[]> {
  const { data, error } = await db()
    .from('notificaciones_email_telegram')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new NotificacionError('Error al listar notificaciones', error);
  return (data ?? []) as NotificacionEmailTelegram[];
}

export async function crearNotificacion(input: NotificacionInput): Promise<NotificacionEmailTelegram> {
  if (!input.email_destinatario?.trim()) throw new NotificacionError('El email destinatario es obligatorio');
  if (!input.telegram_chat_id?.trim()) throw new NotificacionError('El chat ID de Telegram es obligatorio');
  if (!input.nombre_destinatario?.trim()) throw new NotificacionError('El nombre del destinatario es obligatorio');

  const { data, error } = await db()
    .from('notificaciones_email_telegram')
    .insert({
      email_destinatario: input.email_destinatario.trim().toLowerCase(),
      email_remitente: input.email_remitente?.trim().toLowerCase() || null,
      telegram_chat_id: input.telegram_chat_id.trim(),
      nombre_destinatario: input.nombre_destinatario.trim(),
      mensaje_saludo: input.mensaje_saludo?.trim() || null,
      activo: input.activo ?? true,
    })
    .select()
    .single();
  if (error) throw new NotificacionError('Error al crear notificación', error);
  return data as NotificacionEmailTelegram;
}

export async function actualizarNotificacion(
  id: string,
  input: Partial<NotificacionInput>,
): Promise<NotificacionEmailTelegram> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.email_destinatario !== undefined) updates.email_destinatario = input.email_destinatario.trim().toLowerCase();
  if (input.email_remitente !== undefined) updates.email_remitente = input.email_remitente?.trim().toLowerCase() || null;
  if (input.telegram_chat_id !== undefined) updates.telegram_chat_id = input.telegram_chat_id.trim();
  if (input.nombre_destinatario !== undefined) updates.nombre_destinatario = input.nombre_destinatario.trim();
  if (input.mensaje_saludo !== undefined) updates.mensaje_saludo = input.mensaje_saludo?.trim() || null;
  if (input.activo !== undefined) updates.activo = input.activo;

  const { data, error } = await db()
    .from('notificaciones_email_telegram')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new NotificacionError('Error al actualizar notificación', error);
  return data as NotificacionEmailTelegram;
}

export async function eliminarNotificacion(id: string): Promise<void> {
  const { error } = await db().from('notificaciones_email_telegram').delete().eq('id', id);
  if (error) throw new NotificacionError('Error al eliminar notificación', error);
}

// ── Disparo desde el envío de correo ──────────────────────────────────────────

// Escapa caracteres que rompen el parse_mode HTML de Telegram.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Quita HTML y deja texto plano (versión ligera, sin dependencias del pipeline
// de Molly para evitar imports circulares con outlook.service).
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Primeras N palabras del cuerpo (resumen).
function primerasPalabras(texto: string, n: number): string {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const corte = palabras.slice(0, n).join(' ');
  return palabras.length > n ? `${corte}…` : corte;
}

// Marcadores que indican el inicio de la firma o de un disclaimer legal. El
// resumen se corta en el PRIMERO que aparezca: como la firma suele ir antes del
// aviso de confidencialidad, cortar en "Atentamente," elimina firma + disclaimer
// de una sola vez. Case-insensitive.
const CORTES_RESUMEN: RegExp[] = [
  /aviso de confidencialidad/i,
  /\bconfidencialidad\s*:/i,
  /\batentamente\b/i,
  /\bsaludos cordiales\b/i,
  /\bsaludos\s*,/i,
  /\bcordialmente\b/i,
  /\bquedo a sus[ ]?[oó]rdenes\b/i,
  /\beste (correo|mensaje|e-?mail)[^.]*confidencial/i,
];

// Devuelve solo el contenido ÚTIL del correo: lo que va ANTES de la firma o de
// cualquier disclaimer legal. Si no encuentra marcadores, devuelve el texto tal
// cual.
function contenidoUtil(texto: string): string {
  let corte = texto.length;
  for (const re of CORTES_RESUMEN) {
    const m = texto.match(re);
    if (m && m.index !== undefined && m.index < corte) corte = m.index;
  }
  return texto.slice(0, corte).trim();
}

const SALUDO_DEFAULT =
  '👋 ¡Hola {nombre}, buen día!\n\n' +
  '📧 Se te ha enviado un correo desde {cuenta_remitente}\n\n' +
  '📌 Asunto: {asunto}\n' +
  '📝 Resumen: {resumen}\n\n' +
  'Por favor revisa tu bandeja de entrada.\n\n' +
  '— Despacho Jurídico Amanda Santizo';

function renderSaludo(
  plantilla: string,
  vars: { nombre: string; asunto: string; resumen: string; cuenta_remitente: string },
): string {
  return plantilla
    .replace(/\{nombre\}/g, escapeHtml(vars.nombre))
    .replace(/\{asunto\}/g, escapeHtml(vars.asunto))
    .replace(/\{resumen\}/g, escapeHtml(vars.resumen))
    .replace(/\{cuenta_remitente\}/g, escapeHtml(vars.cuenta_remitente))
    .replace(/\{cuenta\}/g, escapeHtml(vars.cuenta_remitente));
}

/**
 * Tras enviar un correo exitosamente, revisa las reglas activas y notifica por
 * Telegram a quien corresponda. Best-effort: nunca lanza (no debe bloquear el
 * envío del correo).
 */
export async function notificarDestinatariosTelegram(params: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
}): Promise<void> {
  try {
    const { data: reglas, error } = await db()
      .from('notificaciones_email_telegram')
      .select('*')
      .eq('activo', true);

    if (error) {
      console.error('[notif-email-telegram] Error consultando reglas:', error.message);
      return;
    }
    if (!reglas || reglas.length === 0) return;

    const fromLc = params.from.toLowerCase();
    const destinatarios = new Set(
      [...params.to, ...(params.cc ?? [])].map((e) => e.trim().toLowerCase()).filter(Boolean),
    );

    // Resumen = solo el contenido útil (sin firma ni disclaimers), máx 150 palabras.
    const resumen =
      primerasPalabras(contenidoUtil(stripHtml(params.htmlBody)), 150)
      || 'Ver correo para más detalles';

    for (const regla of reglas as NotificacionEmailTelegram[]) {
      const dest = regla.email_destinatario.toLowerCase();
      if (!destinatarios.has(dest)) continue;
      // email_remitente NULL → cualquier cuenta; si está, debe coincidir.
      if (regla.email_remitente && regla.email_remitente.toLowerCase() !== fromLc) continue;

      const mensaje = renderSaludo(regla.mensaje_saludo?.trim() || SALUDO_DEFAULT, {
        nombre: regla.nombre_destinatario,
        asunto: params.subject,
        resumen,
        cuenta_remitente: params.from,
      });

      try {
        await sendTelegramMessage(mensaje, { parse_mode: 'HTML', chatId: regla.telegram_chat_id });
        console.log(`[notif-email-telegram] Notificado a ${regla.nombre_destinatario} (${dest}) → chat ${regla.telegram_chat_id}`);
      } catch (sendErr: any) {
        console.error(`[notif-email-telegram] Error notificando a ${dest}:`, sendErr?.message ?? sendErr);
      }
    }
  } catch (err: any) {
    console.error('[notif-email-telegram] Error inesperado:', err?.message ?? err);
  }
}
