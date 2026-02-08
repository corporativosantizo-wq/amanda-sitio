// ============================================================================
// lib/services/citas.service.ts
// Lógica de negocio para el sistema de citas
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  Cita,
  CitaInsert,
  BloqueoInsert,
  BloqueoCalendario,
  SlotDisponible,
  TipoCita,
  EstadoCita,
  HORARIOS,
} from '@/lib/types';
import {
  isOutlookConnected,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getFreeBusy,
  sendMail,
} from './outlook.service';
import {
  emailConfirmacionCita,
  emailRecordatorio24h,
  emailRecordatorio1h,
  emailCancelacionCita,
} from '@/lib/templates/emails';

const db = () => createAdminClient();

// ── Error ───────────────────────────────────────────────────────────────────

export class CitaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'CitaError';
    this.details = details;
  }
}

// ── Disponibilidad ──────────────────────────────────────────────────────────

export async function obtenerDisponibilidad(
  fecha: string,
  tipo: TipoCita
): Promise<SlotDisponible[]> {
  const config = HORARIOS[tipo];
  if (!config) throw new CitaError(`Tipo de cita inválido: ${tipo}`);

  // Verificar que el día es válido para este tipo
  const date = new Date(fecha + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ...
  if (!config.dias.includes(dayOfWeek)) {
    console.log(`[Disponibilidad] fecha=${fecha}, tipo=${tipo}: día ${dayOfWeek} no válido (permitidos: ${config.dias})`);
    return []; // No hay slots disponibles este día
  }

  // Verificar que no es fecha pasada (usar zona Guatemala)
  const nowGT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  nowGT.setHours(0, 0, 0, 0);
  const fechaDate = new Date(fecha + 'T00:00:00');
  if (fechaDate < nowGT) {
    console.log(`[Disponibilidad] fecha=${fecha} es pasada (hoy GT: ${nowGT.toISOString()})`);
    return [];
  }

  // Generar slots base
  const slots = generarSlots(config.hora_inicio, config.hora_fin, config.duracion_min);
  console.log(`[Disponibilidad] fecha=${fecha}, tipo=${tipo}: ${slots.length} slots base generados (${config.hora_inicio}-${config.hora_fin}, cada ${config.duracion_min}min)`);

  // Obtener citas existentes del día (no canceladas)
  const { data: citasExistentes } = await db()
    .from('citas')
    .select('hora_inicio, hora_fin')
    .eq('fecha', fecha)
    .neq('estado', 'cancelada');

  // Obtener bloqueos del día
  const { data: bloqueos } = await db()
    .from('disponibilidad_bloqueos')
    .select('hora_inicio, hora_fin')
    .eq('fecha', fecha);

  console.log(`[Disponibilidad] fecha=${fecha}: citas existentes=${JSON.stringify(citasExistentes ?? [])}, bloqueos=${JSON.stringify(bloqueos ?? [])}`);

  // Filtrar slots ocupados por citas
  let disponibles = slots.filter((slot: SlotDisponible) => {
    const ocupado = (citasExistentes ?? []).some((cita: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, cita.hora_inicio, cita.hora_fin)
    );
    return !ocupado;
  });
  console.log(`[Disponibilidad] Después de filtrar citas: ${disponibles.length} slots`);

  // Filtrar slots bloqueados
  disponibles = disponibles.filter((slot: SlotDisponible) => {
    const bloqueado = (bloqueos ?? []).some((b: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, b.hora_inicio, b.hora_fin)
    );
    return !bloqueado;
  });
  console.log(`[Disponibilidad] Después de filtrar bloqueos: ${disponibles.length} slots`);

  // Si Outlook conectado, filtrar por busy slots
  try {
    const connected = await isOutlookConnected();
    if (connected) {
      const startISO = `${fecha}T${config.hora_inicio}:00`;
      const endISO = `${fecha}T${config.hora_fin}:00`;
      const busySlots = await getFreeBusy(startISO, endISO);
      console.log(`[Disponibilidad] Outlook busy slots: ${JSON.stringify(busySlots)}`);

      disponibles = disponibles.filter((slot: SlotDisponible) => {
        const busy = busySlots.some((b: any) => {
          const bStart = b.start.substring(11, 16); // HH:mm
          const bEnd = b.end.substring(11, 16);
          return slotsOverlap(slot.hora_inicio, slot.hora_fin, bStart, bEnd);
        });
        return !busy;
      });
      console.log(`[Disponibilidad] Después de filtrar Outlook: ${disponibles.length} slots`);
    } else {
      console.log(`[Disponibilidad] Outlook no conectado, sin filtrar`);
    }
  } catch (outlookErr) {
    console.warn('[Citas] No se pudo consultar Outlook free/busy:', outlookErr);
  }

  console.log(`[Disponibilidad] RESULTADO FINAL: ${disponibles.length} slots disponibles:`, disponibles.map((s: SlotDisponible) => s.hora_inicio));
  return disponibles;
}

function generarSlots(
  horaInicio: string,
  horaFin: string,
  duracionMin: number
): SlotDisponible[] {
  const slots: SlotDisponible[] = [];
  let [h, m] = horaInicio.split(':').map(Number);
  const [endH, endM] = horaFin.split(':').map(Number);
  const endMinutes = endH * 60 + endM;

  while (h * 60 + m + duracionMin <= endMinutes) {
    const inicio = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const totalMin = h * 60 + m + duracionMin;
    const finH = Math.floor(totalMin / 60);
    const finM = totalMin % 60;
    const fin = `${String(finH).padStart(2, '0')}:${String(finM).padStart(2, '0')}`;

    slots.push({ hora_inicio: inicio, hora_fin: fin, duracion_minutos: duracionMin });

    m += duracionMin;
    while (m >= 60) {
      h++;
      m -= 60;
    }
  }

  return slots;
}

function slotsOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  // Compare as HH:mm strings (works because they're zero-padded)
  return startA < endB && startB < endA;
}

// ── CRUD Citas ──────────────────────────────────────────────────────────────

interface ListCitasParams {
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: EstadoCita;
  tipo?: TipoCita;
  cliente_id?: string;
  page?: number;
  limit?: number;
}

export async function listarCitas(params: ListCitasParams = {}): Promise<{
  data: Cita[];
  total: number;
}> {
  const { page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)', { count: 'exact' });

  if (params.fecha_inicio) query = query.gte('fecha', params.fecha_inicio);
  if (params.fecha_fin) query = query.lte('fecha', params.fecha_fin);
  if (params.estado) query = query.eq('estado', params.estado);
  if (params.tipo) query = query.eq('tipo', params.tipo);
  if (params.cliente_id) query = query.eq('cliente_id', params.cliente_id);

  query = query.order('fecha', { ascending: true }).order('hora_inicio', { ascending: true });
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new CitaError('Error al listar citas', error);

  return { data: data ?? [], total: count ?? 0 };
}

export async function obtenerCita(id: string): Promise<Cita> {
  const { data, error } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .eq('id', id)
    .single();

  if (error) throw new CitaError('Cita no encontrada', error);
  return data;
}

export async function crearCita(input: CitaInsert): Promise<Cita> {
  const config = HORARIOS[input.tipo];
  if (!config) throw new CitaError(`Tipo de cita inválido: ${input.tipo}`);

  // Validar que el slot esté disponible
  const disponibles = await obtenerDisponibilidad(input.fecha, input.tipo);

  let slotValido: boolean;
  if (input.tipo === 'consulta_nueva') {
    // consulta_nueva books a 60-min block but disponibilidad returns 30-min sub-slots.
    // Validate that both the :00 and :30 sub-slots are available.
    const halfHour = input.hora_inicio.replace(':00', ':30');
    const hasStart = disponibles.some((s: SlotDisponible) => s.hora_inicio === input.hora_inicio);
    const hasHalf = disponibles.some((s: SlotDisponible) => s.hora_inicio === halfHour);
    slotValido = hasStart && hasHalf;
    console.log(`[crearCita] consulta_nueva validation: hora=${input.hora_inicio}, halfHour=${halfHour}, hasStart=${hasStart}, hasHalf=${hasHalf}, slotValido=${slotValido}`);
  } else {
    slotValido = disponibles.some(
      (s: SlotDisponible) => s.hora_inicio === input.hora_inicio && s.hora_fin === input.hora_fin
    );
    console.log(`[crearCita] seguimiento validation: hora_inicio=${input.hora_inicio}, hora_fin=${input.hora_fin}, slotValido=${slotValido}`);
  }

  if (!slotValido) {
    console.error(`[crearCita] Slot NO disponible. fecha=${input.fecha}, tipo=${input.tipo}, hora_inicio=${input.hora_inicio}, hora_fin=${input.hora_fin}. Slots disponibles:`, JSON.stringify(disponibles));
    throw new CitaError('El horario seleccionado ya no está disponible.');
  }

  // Rate limit: 10 citas por semana por cliente
  if (input.cliente_id) {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - hoy.getDay() + 1);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    const { count } = await db()
      .from('citas')
      .select('id', { count: 'exact', head: true })
      .eq('cliente_id', input.cliente_id)
      .neq('estado', 'cancelada')
      .gte('fecha', lunes.toISOString().split('T')[0])
      .lte('fecha', domingo.toISOString().split('T')[0]);

    if ((count ?? 0) >= 10) {
      throw new CitaError('Límite de citas por semana alcanzado (máximo 10).');
    }
  }

  // Insertar cita
  const costo = input.costo ?? config.costo;
  const { data: cita, error } = await db()
    .from('citas')
    .insert({
      cliente_id: input.cliente_id ?? null,
      expediente_id: input.expediente_id ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      fecha: input.fecha,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      duracion_minutos: input.duracion_minutos,
      costo,
      categoria_outlook: config.categoria_outlook,
      notas: input.notas ?? null,
    })
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al crear cita', error);

  // Crear evento en Outlook (si conectado)
  let clienteEmail: string | null = null;
  if (cita.cliente) {
    clienteEmail = cita.cliente.email;
  }
  console.log(`[crearCita] clienteEmail: ${clienteEmail ? clienteEmail.replace(/(.{2}).+(@.+)/, '$1***$2') : 'NULL'}`);

  try {
    const connected = await isOutlookConnected();
    console.log(`[crearCita] Outlook conectado: ${connected}`);

    if (connected) {
      const { eventId, teamsLink } = await createCalendarEvent({
        subject: cita.titulo,
        startDateTime: `${cita.fecha}T${cita.hora_inicio}:00`,
        endDateTime: `${cita.fecha}T${cita.hora_fin}:00`,
        attendees: clienteEmail ? [clienteEmail] : [],
        isOnlineMeeting: true,
        categories: [config.categoria_outlook],
        body: generarBodyEvento(cita),
      });
      console.log(`[crearCita] Evento Outlook creado: eventId=${eventId}, teamsLink=${teamsLink ? 'sí' : 'no'}`);

      await db()
        .from('citas')
        .update({
          outlook_event_id: eventId,
          teams_link: teamsLink,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cita.id);

      cita.outlook_event_id = eventId;
      cita.teams_link = teamsLink;
    }
  } catch (outlookErr) {
    console.warn('[crearCita] Error al crear evento en Outlook:', outlookErr);
  }

  // Enviar email de confirmación (independiente de Outlook calendar)
  if (clienteEmail) {
    console.log(`[crearCita] ── Enviando email de confirmación ──`);
    try {
      const email = emailConfirmacionCita(cita);
      console.log(`[crearCita] Template generado: from=${email.from}, subject=${email.subject}, html=${email.html.length} chars`);
      await sendMail({ from: email.from, to: clienteEmail, subject: email.subject, htmlBody: email.html });
      console.log(`[crearCita] ── Email de confirmación ENVIADO OK ──`);
      await db()
        .from('citas')
        .update({ email_confirmacion_enviado: true })
        .eq('id', cita.id);
    } catch (emailErr: any) {
      console.error(`[crearCita] ── ERROR al enviar email de confirmación ──`);
      console.error(`[crearCita] Error: ${emailErr.message ?? emailErr}`);
      console.error(`[crearCita] statusCode: ${emailErr.statusCode ?? 'N/A'}`);
      console.error(`[crearCita] code: ${emailErr.code ?? 'N/A'}`);
    }
  } else {
    console.log(`[crearCita] No se envía email — clienteEmail es null`);
  }

  return cita;
}

export async function actualizarCita(
  id: string,
  updates: Partial<Pick<Cita, 'titulo' | 'descripcion' | 'fecha' | 'hora_inicio' | 'hora_fin' | 'duracion_minutos' | 'estado' | 'notas'>>
): Promise<Cita> {
  const citaActual = await obtenerCita(id);

  const { data, error } = await db()
    .from('citas')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al actualizar cita', error);

  // Sincronizar con Outlook
  if (citaActual.outlook_event_id) {
    try {
      await updateCalendarEvent(citaActual.outlook_event_id, {
        subject: data.titulo,
        startDateTime: `${data.fecha}T${data.hora_inicio}:00`,
        endDateTime: `${data.fecha}T${data.hora_fin}:00`,
        body: generarBodyEvento(data),
        attendees: [],
        isOnlineMeeting: true,
        categories: [data.categoria_outlook ?? 'Azul'],
      });
    } catch {
      console.warn('[Citas] Error al actualizar evento en Outlook');
    }
  }

  return data;
}

export async function cancelarCita(id: string): Promise<Cita> {
  const cita = await obtenerCita(id);

  const { data, error } = await db()
    .from('citas')
    .update({
      estado: 'cancelada' as EstadoCita,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al cancelar cita', error);

  // Eliminar evento de Outlook
  if (cita.outlook_event_id) {
    try {
      await deleteCalendarEvent(cita.outlook_event_id);
    } catch {
      console.warn('[Citas] Error al eliminar evento de Outlook');
    }
  }

  // Email de cancelación
  if (cita.cliente?.email) {
    try {
      const email = emailCancelacionCita(cita);
      await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
    } catch {
      console.warn('[Citas] Error al enviar email de cancelación');
    }
  }

  return data;
}

export async function completarCita(id: string): Promise<Cita> {
  const { data, error } = await db()
    .from('citas')
    .update({
      estado: 'completada' as EstadoCita,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al completar cita', error);
  return data;
}

// ── Bloqueos ────────────────────────────────────────────────────────────────

export async function crearBloqueo(input: BloqueoInsert): Promise<BloqueoCalendario> {
  const { data, error } = await db()
    .from('disponibilidad_bloqueos')
    .insert({
      fecha: input.fecha,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      motivo: input.motivo ?? null,
    })
    .select('*')
    .single();

  if (error) throw new CitaError('Error al crear bloqueo', error);
  return data;
}

export async function listarBloqueos(params: {
  fecha_inicio?: string;
  fecha_fin?: string;
} = {}): Promise<BloqueoCalendario[]> {
  let query = db()
    .from('disponibilidad_bloqueos')
    .select('*');

  if (params.fecha_inicio) query = query.gte('fecha', params.fecha_inicio);
  if (params.fecha_fin) query = query.lte('fecha', params.fecha_fin);

  query = query.order('fecha').order('hora_inicio');

  const { data, error } = await query;
  if (error) throw new CitaError('Error al listar bloqueos', error);
  return data ?? [];
}

export async function eliminarBloqueo(id: string): Promise<void> {
  const { error } = await db()
    .from('disponibilidad_bloqueos')
    .delete()
    .eq('id', id);

  if (error) throw new CitaError('Error al eliminar bloqueo', error);
}

// ── Recordatorios ───────────────────────────────────────────────────────────

export async function enviarRecordatorios(): Promise<{
  enviados_24h: number;
  enviados_1h: number;
  completadas: number;
}> {
  const ahora = new Date();
  const zonaGT = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guatemala',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const horaGT = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const hoyStr = zonaGT.format(ahora);
  const mananaDate = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const mananaStr = zonaGT.format(mananaDate);
  const horaActual = horaGT.format(ahora);

  let enviados_24h = 0;
  let enviados_1h = 0;
  let completadas = 0;

  // Recordatorios 24h: citas de mañana que no se han enviado
  const { data: citas24h } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .eq('fecha', mananaStr)
    .eq('recordatorio_24h_enviado', false)
    .in('estado', ['pendiente', 'confirmada']);

  for (const cita of citas24h ?? []) {
    if (cita.cliente?.email) {
      try {
        const email = emailRecordatorio24h(cita);
        await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
        await db()
          .from('citas')
          .update({ recordatorio_24h_enviado: true })
          .eq('id', cita.id);
        enviados_24h++;
      } catch {
        console.warn(`[Citas] Error enviando recordatorio 24h para cita ${cita.id}`);
      }
    }
  }

  // Recordatorios 1h: citas de hoy cuya hora_inicio es dentro de ~1 hora
  const { data: citasHoy } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .eq('fecha', hoyStr)
    .eq('recordatorio_1h_enviado', false)
    .in('estado', ['pendiente', 'confirmada']);

  for (const cita of citasHoy ?? []) {
    // Calcular si estamos a ~1 hora de la cita
    const [ch, cm] = horaActual.split(':').map(Number);
    const [citaH, citaM] = cita.hora_inicio.split(':').map(Number);
    const diffMin = (citaH * 60 + citaM) - (ch * 60 + cm);

    if (diffMin > 0 && diffMin <= 75) {
      if (cita.cliente?.email) {
        try {
          const email = emailRecordatorio1h(cita);
          await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
          await db()
            .from('citas')
            .update({ recordatorio_1h_enviado: true })
            .eq('id', cita.id);
          enviados_1h++;
        } catch {
          console.warn(`[Citas] Error enviando recordatorio 1h para cita ${cita.id}`);
        }
      }
    }
  }

  // Auto-completar citas pasadas
  const { data: citasPasadas } = await db()
    .from('citas')
    .select('id')
    .lt('fecha', hoyStr)
    .in('estado', ['pendiente', 'confirmada']);

  if (citasPasadas && citasPasadas.length > 0) {
    const ids = citasPasadas.map((c: any) => c.id);
    await db()
      .from('citas')
      .update({ estado: 'completada', updated_at: new Date().toISOString() })
      .in('id', ids);
    completadas = ids.length;
  }

  console.log(`[Citas] Recordatorios: 24h=${enviados_24h}, 1h=${enviados_1h}, completadas=${completadas}`);
  return { enviados_24h, enviados_1h, completadas };
}

// ── Calendar Event Body (NOT an email template — used for Outlook event) ────

function generarBodyEvento(cita: any): string {
  const clienteNombre = cita.cliente?.nombre ?? 'Sin cliente asignado';
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  return `<p><strong>Cliente:</strong> ${clienteNombre}</p>
<p><strong>Tipo:</strong> ${tipo}</p>
<p><strong>Costo:</strong> Q${Number(cita.costo).toLocaleString('es-GT')}</p>
${cita.descripcion ? `<p><strong>Descripción:</strong> ${cita.descripcion}</p>` : ''}`;
}
