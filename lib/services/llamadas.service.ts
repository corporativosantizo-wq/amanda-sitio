// ============================================================================
// lib/services/llamadas.service.ts
// Llamadas telefónicas programadas por el admin. Tabla: legal.llamadas_programadas.
// Al agendar: crea evento en el calendario de Outlook de Amanda (bloquea el slot)
// y envía email de confirmación al cliente (CC amanda@ + CC indicados).
// El día de la llamada (8 AM) se envían recordatorios al cliente y a Amanda.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  isOutlookConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy,
  sendMail,
} from './outlook.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import {
  emailConfirmacionLlamada,
  emailRecordatorioLlamadaCliente,
  emailRecordatorioLlamadaInterno,
} from '@/lib/templates/emails';

const db = () => createAdminClient();
const TZ = 'America/Guatemala';

export class LlamadaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'LlamadaError';
    this.details = details;
  }
}

export type EstadoLlamada = 'programada' | 'completada' | 'cancelada' | 'reprogramada';

export interface Llamada {
  id: string;
  cliente_id: string | null;
  nombre_contacto: string;
  email_contacto: string;
  telefono_contacto: string | null;
  emails_cc: string[] | null;
  fecha: string;
  hora: string;
  duracion_minutos: number | null;
  asunto: string;
  notas: string | null;
  estado: EstadoLlamada;
  recordatorio_enviado: boolean;
  confirmacion_enviada: boolean;
  outlook_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LlamadaInsert {
  cliente_id?: string | null;
  nombre_contacto: string;
  email_contacto: string;
  telefono_contacto?: string | null;
  emails_cc?: string[];
  fecha: string;
  hora: string;
  duracion_minutos?: number;
  asunto: string;
  notas?: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtmlTg(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + min;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatearHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function bodyEventoLlamada(ll: { nombre_contacto: string; telefono_contacto: string | null; asunto: string; notas?: string | null }): string {
  return [
    'Llamada telefónica.',
    `Contacto: ${escapeHtmlTg(ll.nombre_contacto)}`,
    `Tel: ${escapeHtmlTg(ll.telefono_contacto ?? '—')}`,
    `Asunto: ${escapeHtmlTg(ll.asunto)}`,
    ll.notas ? `Notas: ${escapeHtmlTg(ll.notas)}` : '',
  ].filter(Boolean).join('<br/>');
}

// ── Disponibilidad (Outlook free/busy) ──────────────────────────────────────

// Devuelve true si Amanda está libre en el rango fecha/hora+duración.
export async function llamadaDisponible(fecha: string, hora: string, duracion: number): Promise<{ disponible: boolean; outlook: boolean }> {
  if (!(await isOutlookConnected())) {
    // Sin Outlook no podemos verificar; asumimos disponible.
    return { disponible: true, outlook: false };
  }
  const fin = sumarMinutos(hora, duracion);
  const startISO = `${fecha}T${hora.substring(0, 5)}:00`;
  const endISO = `${fecha}T${fin}:00`;
  const busy = await getFreeBusy(startISO, endISO);
  const horaFin = fin;
  const ocupado = busy.some((b: any) => {
    const bStart = b.start.substring(11, 16);
    const bEnd = b.end.substring(11, 16);
    return hora.substring(0, 5) < bEnd && bStart < horaFin;
  });
  return { disponible: !ocupado, outlook: true };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export async function listarLlamadas(): Promise<Llamada[]> {
  const { data, error } = await db()
    .from('llamadas_programadas')
    .select('*')
    .order('fecha', { ascending: false })
    .order('hora', { ascending: true });
  if (error) throw new LlamadaError('Error al listar llamadas', error);
  return (data ?? []) as Llamada[];
}

async function crearEventoOutlookLlamada(ll: any): Promise<void> {
  try {
    if (!(await isOutlookConnected())) {
      console.log('[Llamadas] Outlook no conectado — no se crea evento');
      return;
    }
    const fin = sumarMinutos(ll.hora, ll.duracion_minutos ?? 30);
    const { eventId } = await createCalendarEvent({
      subject: `📞 Llamada — ${ll.nombre_contacto} — ${ll.asunto}`,
      startDateTime: `${ll.fecha}T${ll.hora.substring(0, 5)}:00`,
      endDateTime: `${ll.fecha}T${fin}:00`,
      attendees: [],
      isOnlineMeeting: false,
      categories: ['Azul'],
      body: bodyEventoLlamada(ll),
    });
    await db()
      .from('llamadas_programadas')
      .update({ outlook_event_id: eventId, updated_at: new Date().toISOString() })
      .eq('id', ll.id);
    ll.outlook_event_id = eventId;
  } catch (e: any) {
    console.error('[Llamadas] Error creando evento Outlook:', e?.message ?? e);
  }
}

async function enviarConfirmacionLlamada(ll: any): Promise<void> {
  const email = emailConfirmacionLlamada({
    nombre: ll.nombre_contacto,
    fecha: ll.fecha,
    hora: ll.hora,
    duracion: ll.duracion_minutos ?? 30,
    asunto: ll.asunto,
    telefono: ll.telefono_contacto,
  });
  const cc = ['amanda@papeleo.legal', ...((ll.emails_cc ?? []) as string[])];
  try {
    await sendMail({ from: email.from, to: ll.email_contacto, cc, subject: email.subject, htmlBody: email.html });
    await db().from('llamadas_programadas').update({ confirmacion_enviada: true }).eq('id', ll.id);
  } catch (e: any) {
    console.error('[Llamadas] Error enviando confirmación:', e?.message ?? e);
  }
}

export async function crearLlamada(input: LlamadaInsert): Promise<Llamada> {
  const duracion = input.duracion_minutos ?? 30;
  const { data: ll, error } = await db()
    .from('llamadas_programadas')
    .insert({
      cliente_id: input.cliente_id ?? null,
      nombre_contacto: input.nombre_contacto,
      email_contacto: input.email_contacto,
      telefono_contacto: input.telefono_contacto ?? null,
      emails_cc: input.emails_cc && input.emails_cc.length ? input.emails_cc : null,
      fecha: input.fecha,
      hora: input.hora,
      duracion_minutos: duracion,
      asunto: input.asunto,
      notas: input.notas ?? null,
      estado: 'programada' as EstadoLlamada,
    })
    .select('*')
    .single();
  if (error) throw new LlamadaError('Error al crear llamada', error);

  await crearEventoOutlookLlamada(ll);
  await enviarConfirmacionLlamada(ll);

  return ll as Llamada;
}

export async function actualizarLlamada(
  id: string,
  updates: { fecha?: string; hora?: string; duracion_minutos?: number; asunto?: string; notas?: string | null },
): Promise<Llamada> {
  const { data: ll, error } = await db()
    .from('llamadas_programadas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new LlamadaError('Error al actualizar llamada', error);

  // Sincronizar el evento de Outlook con la nueva fecha/hora.
  if (ll.outlook_event_id) {
    try {
      const fin = sumarMinutos(ll.hora, ll.duracion_minutos ?? 30);
      await updateCalendarEvent(ll.outlook_event_id, {
        subject: `📞 Llamada — ${ll.nombre_contacto} — ${ll.asunto}`,
        startDateTime: `${ll.fecha}T${ll.hora.substring(0, 5)}:00`,
        endDateTime: `${ll.fecha}T${fin}:00`,
        body: bodyEventoLlamada(ll),
        attendees: [],
        isOnlineMeeting: false,
        categories: ['Azul'],
      });
    } catch (e: any) {
      console.warn('[Llamadas] Error actualizando evento Outlook:', e?.message ?? e);
    }
  }

  return ll as Llamada;
}

export async function completarLlamada(id: string): Promise<Llamada> {
  const { data, error } = await db()
    .from('llamadas_programadas')
    .update({ estado: 'completada' as EstadoLlamada, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new LlamadaError('Error al completar llamada', error);
  return data as Llamada;
}

export async function cancelarLlamada(id: string): Promise<Llamada> {
  const { data: ll, error } = await db()
    .from('llamadas_programadas')
    .update({ estado: 'cancelada' as EstadoLlamada, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new LlamadaError('Error al cancelar llamada', error);

  if (ll.outlook_event_id) {
    try { await deleteCalendarEvent(ll.outlook_event_id); } catch { /* best-effort */ }
  }
  return ll as Llamada;
}

// ── Recordatorios del día de la llamada (8 AM) ──────────────────────────────

export async function enviarRecordatoriosLlamadas(): Promise<{ llamadas: number }> {
  const ahora = new Date();
  const zonaGT = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const horaGT = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  const hoyStr = zonaGT.format(ahora);
  const horaActualH = Number(horaGT.format(ahora).split(':')[0]);

  // Solo en horario de oficina (a partir de las 8 AM GT); el cron corre cada 15
  // min, así que el primero después de las 8 AM dispara el recordatorio del día.
  if (horaActualH < 8 || horaActualH >= 18) return { llamadas: 0 };

  const { data: llamadas } = await db()
    .from('llamadas_programadas')
    .select('*')
    .eq('fecha', hoyStr)
    .eq('estado', 'programada')
    .eq('recordatorio_enviado', false);

  let count = 0;
  for (const ll of llamadas ?? []) {
    try {
      // Cliente
      if (ll.email_contacto) {
        const e = emailRecordatorioLlamadaCliente({ nombre: ll.nombre_contacto, hora: ll.hora, asunto: ll.asunto });
        await sendMail({ from: e.from, to: ll.email_contacto, subject: e.subject, htmlBody: e.html });
      }
      // Amanda (email)
      const eAm = emailRecordatorioLlamadaInterno({ nombre: ll.nombre_contacto, hora: ll.hora, asunto: ll.asunto, telefono: ll.telefono_contacto });
      await sendMail({ from: eAm.from, to: 'amanda@papeleo.legal', subject: eAm.subject, htmlBody: eAm.html });
      // Amanda (Telegram privado)
      await sendTelegramMessage(
        `📞 <b>Llamada hoy:</b> ${escapeHtmlTg(ll.nombre_contacto)}\n` +
        `🕐 ${formatearHora12(ll.hora)} | 📌 ${escapeHtmlTg(ll.asunto)}\n` +
        `📱 Tel: ${escapeHtmlTg(ll.telefono_contacto ?? '—')}`,
        { parse_mode: 'HTML' },
      );

      await db().from('llamadas_programadas').update({ recordatorio_enviado: true }).eq('id', ll.id);
      count++;
    } catch (e: any) {
      console.warn('[Llamadas] Error enviando recordatorio de llamada', ll.id, e?.message ?? e);
    }
  }

  return { llamadas: count };
}
