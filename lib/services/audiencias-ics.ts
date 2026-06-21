// ============================================================================
// lib/services/audiencias-ics.ts
// Generador de .ics para audiencias (server-side). Se ADJUNTA vía el parámetro
// `attachments` de sendMail (outlook.service.ts); NO crea cliente Graph nuevo.
//
// Guatemala es UTC-6 SIN horario de verano → el VTIMEZONE es fijo y la
// conversión instante→hora local es restar 6h y leer en UTC.
//
// METHOD:PUBLISH (no REQUEST): es un .ics descargable "Agregar a mi calendario",
// no una invitación de reunión con ORGANIZER/ATTENDEE. UID estable + SEQUENCE
// creciente hacen que una reprogramación ACTUALICE el evento en vez de duplicarlo.
// ============================================================================

import type { Audiencia } from '@/lib/types/audiencias';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Escape RFC 5545 para valores de texto (\, ; , y saltos de línea).
function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

// timestamptz (instante) → "YYYYMMDDTHHMMSS" en hora local de Guatemala (UTC-6).
function gtLocalStamp(iso: string): string {
  const d = new Date(new Date(iso).getTime() - 6 * 3600 * 1000);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

// Date → "YYYYMMDDTHHMMSSZ" (UTC, para DTSTAMP).
function utcStamp(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function estadoIcsStatus(estado: string): 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE' {
  if (estado === 'cancelada') return 'CANCELLED';
  if (estado === 'suspendida' || estado === 'reprogramada') return 'TENTATIVE';
  return 'CONFIRMED';
}

// Plegado RFC 5545: líneas largas se parten con CRLF + espacio.
function foldLine(line: string): string {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) {
    parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 73));
  }
  return parts.join('\r\n');
}

function locationDe(a: Audiencia): string {
  if (a.modalidad === 'presencial') {
    return [a.juzgado, a.sala, a.ubicacion].filter(Boolean).join(', ');
  }
  if (a.modalidad === 'virtual') {
    return a.enlace_virtual ?? a.plataforma ?? 'Virtual';
  }
  // híbrida
  const fisico = [a.juzgado, a.sala, a.ubicacion].filter(Boolean).join(', ');
  return [fisico, a.enlace_virtual].filter(Boolean).join(' | ');
}

/**
 * Genera el texto .ics de una audiencia. `dtstamp` se inyecta para tests
 * deterministas; por defecto usa la hora actual.
 */
export function generarIcsAudiencia(a: Audiencia, opts: { dtstamp?: Date } = {}): string {
  const dtstamp = opts.dtstamp ?? new Date();
  const inicio = a.fecha_hora_inicio;
  const finIso = a.fecha_hora_fin
    ?? new Date(new Date(inicio).getTime() + 60 * 60 * 1000).toISOString(); // default +1h

  const empresa = a.cliente?.nombre ?? 'Cliente';
  const exp = a.expediente?.numero_expediente ?? '';
  const summary = `Audiencia · ${empresa}${exp ? ` · ${exp}` : ''}`;

  const location = locationDe(a);
  const description = [
    a.instrucciones ?? '',
    `Modalidad: ${a.modalidad}`,
    a.modalidad !== 'presencial' && a.enlace_virtual ? `Enlace: ${a.enlace_virtual}` : '',
  ].filter(Boolean).join('\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IURISLEX//Audiencias//ES',
    'METHOD:PUBLISH',
    'CALSCALE:GREGORIAN',
    'BEGIN:VTIMEZONE',
    'TZID:America/Guatemala',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
    'BEGIN:VEVENT',
    `UID:${a.id}`,
    `SEQUENCE:${a.ics_sequence}`,
    `DTSTAMP:${utcStamp(dtstamp)}`,
    `DTSTART;TZID=America/Guatemala:${gtLocalStamp(inicio)}`,
    `DTEND;TZID=America/Guatemala:${gtLocalStamp(finIso)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    location ? `LOCATION:${escapeIcs(location)}` : '',
    description ? `DESCRIPTION:${escapeIcs(description)}` : '',
    `STATUS:${estadoIcsStatus(a.estado)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    'DESCRIPTION:Recordatorio audiencia',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Adjunto listo para el parámetro `attachments` de sendMail. */
export function icsAttachmentAudiencia(a: Audiencia): {
  name: string; contentType: string; contentBytes: string;
} {
  return {
    name: 'audiencia.ics',
    contentType: 'text/calendar; method=PUBLISH; charset=utf-8',
    contentBytes: Buffer.from(generarIcsAudiencia(a), 'utf-8').toString('base64'),
  };
}
