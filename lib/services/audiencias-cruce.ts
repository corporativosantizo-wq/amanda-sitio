// ============================================================================
// lib/services/audiencias-cruce.ts
// Cruce registro (legal.audiencias) ↔ eventos del Outlook de amanda@.
// ÚNICA implementación del cruce — la usan la tarjeta del dashboard y
// cualquier otra vista que mezcle ambas fuentes (p. ej. /admin/calendario).
//
// Reglas (aprobadas 26-jul-2026):
// - El cruce es SOLO por outlook_event_id. Los IDs comparados deben venir de
//   getCalendarEvents / createCalendarEvent (misma API de Graph); los IDs de
//   otras APIs (p. ej. búsqueda) usan otra codificación y NO casan.
// - Filtro de eventos por palabra "audiencia" en el título (etiqueta
//   ⚖️/[AUDIENCIA] opcional: exigirla escondería eventos pre-convención).
// - Lo que no casa se marca sin_registro: true (discrepancia visible,
//   "En calendario, sin registro"), nunca como audiencia normal.
// ============================================================================

import type { OutlookEvent } from '@/lib/services/outlook.service';
import { materiaDeAudiencia, type Audiencia, type EstadoAudiencia } from '@/lib/types/audiencias';

export interface AudienciaUnificada {
  id: string;                       // registro: uuid | outlook: event id
  origen: 'registro' | 'outlook';
  titulo: string;
  fecha: string;                    // ISO con offset
  fecha_fin: string | null;
  todo_dia: boolean;
  tipo: string | null;              // materia: registro → derivada de expediente.tipo_proceso ('—' si no hay); outlook → extraída del título
  tribunal: string;
  cliente: string;
  estado: EstadoAudiencia | null;   // null en las sin registro
  sin_registro: boolean;
}

// calendarView llega con Prefer: outlook.timezone="America/Guatemala" → hora de
// pared sin offset. Guatemala no tiene horario de verano: -06:00 fijo.
export const toIsoGT = (s: string) => (/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}-06:00`);

export function esAudienciaTitulo(title: string): boolean {
  if (/auditor[ií]a/i.test(title)) return false;
  return /\[audiencia\]/i.test(title) || /\baudiencia\b/i.test(title);
}

export function mapEventoOutlook(ev: OutlookEvent): AudienciaUnificada {
  const title = ev.subject ?? '';

  let tipo: string | null = null;
  const tipoMatch = title.match(/\[AUDIENCIA[- ]?(Civil|Penal|Laboral|Familia|Mercantil)\]/i)
    || title.match(/\baudiencia\s+(civil|penal|laboral|familia|mercantil)\b/i);
  if (tipoMatch) tipo = tipoMatch[1].charAt(0).toUpperCase() + tipoMatch[1].slice(1).toLowerCase();

  let tribunal = '';
  const juzgadoMatch = (ev.bodyPreview ?? title).match(/(juzgado|tribunal|sala|corte)[^,.;\n]*/i);
  if (juzgadoMatch) tribunal = juzgadoMatch[0].trim();

  let cliente = '';
  const clienteMatch = title.match(/[—–-]\s*([^[\]]+)$/);
  if (clienteMatch) cliente = clienteMatch[1].trim();

  return {
    id: ev.id,
    origen: 'outlook',
    titulo: title,
    fecha: toIsoGT(ev.start.dateTime),
    fecha_fin: toIsoGT(ev.end.dateTime),
    todo_dia: ev.isAllDay,
    tipo,
    tribunal,
    cliente,
    estado: null,
    sin_registro: true,
  };
}

export function mapAudienciaRegistro(a: Audiencia): AudienciaUnificada {
  return {
    id: a.id,
    origen: 'registro',
    titulo: a.titulo ?? a.tipo_audiencia ?? 'Audiencia',
    fecha: a.fecha_hora_inicio,
    fecha_fin: a.fecha_hora_fin ?? null,
    todo_dia: false,
    // Materia derivada del expediente. SIN default: sin expediente o valor
    // desconocido → '—' (nunca asumir Civil).
    tipo: materiaDeAudiencia(a) ?? '—',
    tribunal: [a.juzgado, a.sala].filter(Boolean).join(' · '),
    cliente: a.cliente?.nombre ?? '',
    estado: a.estado,
    sin_registro: false,
  };
}

// IDs de eventos de Outlook que YA son el espejo de una fila del registro.
// Cualquier vista que mezcle ambas fuentes debe suprimir estos eventos para
// no duplicar la audiencia — esta función es la única definición del match.
export function idsOutlookRegistrados(registro: Audiencia[]): Set<string> {
  return new Set(
    registro.map((a) => a.outlook_event_id).filter((id): id is string => Boolean(id)),
  );
}

/**
 * Mezcla registro + Outlook: todas las del registro salen tal cual; de Outlook
 * solo entran los eventos con "audiencia" en el título cuyo id NO esté ya
 * referenciado por una fila del registro (esos son la misma audiencia). El
 * resultado va ordenado por fecha ascendente.
 */
export function cruzarAudienciasConOutlook(
  registro: Audiencia[],
  events: OutlookEvent[],
): AudienciaUnificada[] {
  const idsRegistrados = idsOutlookRegistrados(registro);
  const deOutlook = events
    .filter((ev) => esAudienciaTitulo(ev.subject ?? '') && !idsRegistrados.has(ev.id))
    .map(mapEventoOutlook);

  return [...registro.map(mapAudienciaRegistro), ...deOutlook]
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}
