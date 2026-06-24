// ============================================================================
// lib/services/audiencias-outlook.service.ts
// Espeja una audiencia (legal.audiencias) al calendario de Outlook de Amanda.
//
// REUSA las funciones puras de Graph de outlook.service (createCalendarEvent /
// updateCalendarEvent / deleteCalendarEvent), igual que citas.service. El evento
// es INTERNO: va solo al calendario de Amanda (CALENDAR_USER), SIN attendees
// (el cliente ya recibe su .ics por correo; invitarlo duplicaría el aviso) y SIN
// reunión de Teams (las audiencias son presenciales en el juzgado o usan enlace
// externo).
//
// Anti-duplicado: el id del evento se guarda en legal.audiencias.outlook_event_id.
//   · crear   → createCalendarEvent + guardar id
//   · editar  → si hay id, updateCalendarEvent; si no, crear (autocura)
//   · borrar  → si hay id, deleteCalendarEvent + limpiar id
//
// NO está gateado por test_mode: es la agenda interna de Amanda, sin exposición
// al cliente. Solo se condiciona a que Outlook esté conectado. Todo best-effort:
// nunca rompe la creación/edición/borrado de la audiencia.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  isOutlookConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/services/outlook.service';
import { gtLocalStamp } from '@/lib/services/audiencias-ics';
import {
  MODALIDAD_AUDIENCIA_LABEL,
  PLATAFORMA_AUDIENCIA_LABEL,
  type Audiencia,
  type PlataformaAudiencia,
} from '@/lib/types/audiencias';

const db = () => createAdminClient();

// Color del evento en Outlook: 'Rojo', igual que la rama audiencia de citas
// (HORARIOS.audiencia.categoria_outlook), para que la agenda se vea uniforme.
const CATEGORIA_AUDIENCIA = 'Rojo';

// Instante (timestamptz) → "YYYY-MM-DDTHH:mm:ss" en hora local de Guatemala, el
// formato que createCalendarEvent combina con timeZone:'America/Guatemala'.
// Reusa gtLocalStamp (misma aritmética -6h del .ics) y solo le pone separadores,
// para que el evento NO salga corrido 6 horas.
function toGraphLocal(iso: string): string {
  const s = gtLocalStamp(iso); // "YYYYMMDDTHHMMSS"
  return (
    `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` +
    `T${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`
  );
}

// Fin del evento: el real si existe; si no, inicio + 1h (igual que el .ics).
function finIso(a: Audiencia): string {
  return (
    a.fecha_hora_fin ??
    new Date(new Date(a.fecha_hora_inicio).getTime() + 60 * 60 * 1000).toISOString()
  );
}

// Título del evento: "⚖️ Audiencia — {cliente} — Exp. {expediente}", mismo
// formato que los eventos de audiencia que citas creaba (tituloEventoOutlook).
function tituloEvento(a: Audiencia): string {
  const cliente = a.cliente?.nombre ?? 'Cliente';
  const exp = (a.expediente?.numero_expediente ?? '').trim();
  return `⚖️ Audiencia — ${cliente}${exp ? ` — Exp. ${exp}` : ''}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Cuerpo HTML del evento. Incluye juzgado/sala/ubicación (presencial/híbrida),
// plataforma/enlace (virtual/híbrida) e instrucciones. notas_internas NO salen.
function bodyEvento(a: Audiencia): string {
  const filas: string[] = [];
  const add = (label: string, val?: string | null) => {
    const v = (val ?? '').trim();
    if (v) filas.push(`<p><strong>${label}:</strong> ${esc(v)}</p>`);
  };

  add('Cliente', a.cliente?.nombre);
  add('Expediente', a.expediente?.numero_expediente);
  add('Tipo de audiencia', a.tipo_audiencia);
  add('Modalidad', MODALIDAD_AUDIENCIA_LABEL[a.modalidad]);

  if (a.modalidad === 'presencial' || a.modalidad === 'hibrida') {
    add('Juzgado', a.juzgado);
    add('Sala', a.sala);
    add('Ubicación', a.ubicacion);
  }
  if (a.modalidad === 'virtual' || a.modalidad === 'hibrida') {
    const plat = a.plataforma
      ? PLATAFORMA_AUDIENCIA_LABEL[a.plataforma as PlataformaAudiencia] ?? a.plataforma
      : null;
    add('Plataforma', plat);
    if (a.enlace_virtual?.trim()) {
      const url = a.enlace_virtual.trim();
      filas.push(`<p><strong>Enlace:</strong> <a href="${esc(url)}">${esc(url)}</a></p>`);
    }
  }
  add('Instrucciones', a.instrucciones);

  return filas.join('\n');
}

// "Lugar" del evento de Outlook (campo location del calendario).
function locationEvento(a: Audiencia): string {
  if (a.modalidad === 'presencial') {
    return [a.juzgado, a.sala, a.ubicacion].filter(Boolean).join(', ');
  }
  if (a.modalidad === 'virtual') {
    return (a.enlace_virtual ?? a.plataforma ?? 'Virtual').trim();
  }
  const fisico = [a.juzgado, a.sala, a.ubicacion].filter(Boolean).join(', ');
  return [fisico, a.enlace_virtual].filter(Boolean).join(' | ');
}

function eventoParams(a: Audiencia) {
  return {
    subject: tituloEvento(a),
    startDateTime: toGraphLocal(a.fecha_hora_inicio),
    endDateTime: toGraphLocal(finIso(a)),
    attendees: [] as string[], // interno: sin invitar al cliente
    isOnlineMeeting: false, // sin Teams
    categories: [CATEGORIA_AUDIENCIA],
    body: bodyEvento(a),
    location: locationEvento(a),
  };
}

// ── Crear ────────────────────────────────────────────────────────────────────
// Crea el evento en el Outlook de Amanda y guarda outlook_event_id. Idempotente:
// si la audiencia YA tiene outlook_event_id, no crea otro (delega en sincronizar).
export async function crearEventoOutlookAudiencia(a: Audiencia): Promise<string | null> {
  try {
    if (a.outlook_event_id) return a.outlook_event_id; // ya existe → no duplicar
    if (!(await isOutlookConnected())) {
      console.log('[AudienciaOutlook] Outlook no conectado — no se crea evento');
      return null;
    }
    const { eventId } = await createCalendarEvent(eventoParams(a));
    await db()
      .from('audiencias')
      .update({ outlook_event_id: eventId, updated_at: new Date().toISOString() })
      .eq('id', a.id);
    console.log('[AudienciaOutlook] Evento creado:', eventId, 'audiencia', a.id);
    return eventId;
  } catch (e) {
    console.error('[AudienciaOutlook] Error creando evento:', (e as Error)?.message ?? e);
    return null;
  }
}

// ── Editar ───────────────────────────────────────────────────────────────────
// Si hay outlook_event_id → actualiza ese mismo evento (no duplica). Si NO hay
// (audiencia creada con Outlook caído o pre-sync) → lo crea ahora (autocura).
export async function actualizarEventoOutlookAudiencia(a: Audiencia): Promise<void> {
  try {
    if (!(await isOutlookConnected())) return;
    if (!a.outlook_event_id) {
      await crearEventoOutlookAudiencia(a);
      return;
    }
    await updateCalendarEvent(a.outlook_event_id, eventoParams(a));
    console.log('[AudienciaOutlook] Evento actualizado:', a.outlook_event_id, 'audiencia', a.id);
  } catch (e) {
    console.error('[AudienciaOutlook] Error actualizando evento:', (e as Error)?.message ?? e);
  }
}

// ── Borrar / cancelar ─────────────────────────────────────────────────────────
// Elimina el evento del Outlook de Amanda y limpia outlook_event_id. `borrarFila`
// distingue el borrado real (la fila desaparece, no hay que limpiar columna) del
// soft-cancel (la fila queda, hay que limpiar el id para no apuntar a un evento
// ya inexistente).
export async function eliminarEventoOutlookAudiencia(
  eventId: string | null,
  audienciaId: string,
  opts: { borrarFila?: boolean } = {},
): Promise<void> {
  if (!eventId) return;
  try {
    if (await isOutlookConnected()) {
      await deleteCalendarEvent(eventId);
      console.log('[AudienciaOutlook] Evento eliminado:', eventId, 'audiencia', audienciaId);
    }
  } catch (e) {
    console.error('[AudienciaOutlook] Error eliminando evento:', (e as Error)?.message ?? e);
  }
  if (!opts.borrarFila) {
    await db()
      .from('audiencias')
      .update({ outlook_event_id: null, updated_at: new Date().toISOString() })
      .eq('id', audienciaId);
  }
}

// ── Sincronizar (botón) ───────────────────────────────────────────────────────
// Idempotente: si no hay evento, lo crea; si ya hay, lo actualiza. Devuelve la
// acción para el feedback de la UI.
export async function sincronizarEventoOutlookAudiencia(
  a: Audiencia,
): Promise<{ accion: 'creado' | 'actualizado' | 'sin_conexion'; eventId: string | null }> {
  if (!(await isOutlookConnected())) {
    return { accion: 'sin_conexion', eventId: a.outlook_event_id };
  }
  if (a.outlook_event_id) {
    await actualizarEventoOutlookAudiencia(a);
    return { accion: 'actualizado', eventId: a.outlook_event_id };
  }
  const eventId = await crearEventoOutlookAudiencia(a);
  return { accion: 'creado', eventId };
}
