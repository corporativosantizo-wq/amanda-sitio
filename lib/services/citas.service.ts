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
  sendEmail,
} from './outlook.service';

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
    return []; // No hay slots disponibles este día
  }

  // Verificar que no es fecha pasada
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaDate = new Date(fecha + 'T00:00:00');
  if (fechaDate < hoy) return [];

  // Generar slots base
  const slots = generarSlots(config.hora_inicio, config.hora_fin, config.duracion_min);

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

  // Filtrar slots ocupados por citas
  let disponibles = slots.filter((slot: SlotDisponible) => {
    const ocupado = (citasExistentes ?? []).some((cita: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, cita.hora_inicio, cita.hora_fin)
    );
    return !ocupado;
  });

  // Filtrar slots bloqueados
  disponibles = disponibles.filter((slot: SlotDisponible) => {
    const bloqueado = (bloqueos ?? []).some((b: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, b.hora_inicio, b.hora_fin)
    );
    return !bloqueado;
  });

  // Si Outlook conectado, filtrar por busy slots
  try {
    const connected = await isOutlookConnected();
    if (connected) {
      const startISO = `${fecha}T${config.hora_inicio}:00`;
      const endISO = `${fecha}T${config.hora_fin}:00`;
      const busySlots = await getFreeBusy(startISO, endISO);

      disponibles = disponibles.filter((slot: SlotDisponible) => {
        const busy = busySlots.some((b: any) => {
          const bStart = b.start.substring(11, 16); // HH:mm
          const bEnd = b.end.substring(11, 16);
          return slotsOverlap(slot.hora_inicio, slot.hora_fin, bStart, bEnd);
        });
        return !busy;
      });
    }
  } catch {
    // Si falla Outlook, continuamos sin filtrar
    console.warn('[Citas] No se pudo consultar Outlook free/busy');
  }

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
  const slotValido = disponibles.some(
    (s: SlotDisponible) => s.hora_inicio === input.hora_inicio && s.hora_fin === input.hora_fin
  );
  if (!slotValido) {
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
  try {
    const connected = await isOutlookConnected();
    if (connected) {
      let clienteEmail: string | null = null;
      if (cita.cliente) {
        clienteEmail = cita.cliente.email;
      }

      const { eventId, teamsLink } = await createCalendarEvent({
        subject: cita.titulo,
        startDateTime: `${cita.fecha}T${cita.hora_inicio}:00`,
        endDateTime: `${cita.fecha}T${cita.hora_fin}:00`,
        attendees: clienteEmail ? [clienteEmail] : [],
        isOnlineMeeting: true,
        categories: [config.categoria_outlook],
        body: generarBodyEvento(cita),
      });

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

      // Enviar email de confirmación
      if (clienteEmail) {
        try {
          const html = generarEmailConfirmacion(cita);
          await sendEmail(clienteEmail, `Confirmación de cita — ${cita.titulo}`, html);
          await db()
            .from('citas')
            .update({ email_confirmacion_enviado: true })
            .eq('id', cita.id);
        } catch (emailErr) {
          console.warn('[Citas] Error al enviar email de confirmación:', emailErr);
        }
      }
    }
  } catch (outlookErr) {
    console.warn('[Citas] No se pudo crear evento en Outlook:', outlookErr);
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
      const html = generarEmailCancelacion(cita);
      await sendEmail(cita.cliente.email, `Cita cancelada — ${cita.titulo}`, html);
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
        const html = generarEmailRecordatorio(cita, '24h');
        await sendEmail(cita.cliente.email, `Recordatorio: su cita es mañana — ${cita.titulo}`, html);
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
          const html = generarEmailRecordatorio(cita, '1h');
          await sendEmail(cita.cliente.email, `¡Su cita es en 1 hora! — ${cita.titulo}`, html);
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

// ── Email Templates ─────────────────────────────────────────────────────────

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#06b6d4);padding:24px 32px;text-align:center;">
            <span style="font-size:24px;font-weight:700;color:#ffffff;letter-spacing:1px;">AS</span>
            <p style="margin:4px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">Amanda Santizo & Asociados</p>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Amanda Santizo & Asociados — Servicios Legales y Notariales</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function formatearFechaGT(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-GT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

function formatearHora(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function generarBodyEvento(cita: any): string {
  const clienteNombre = cita.cliente?.nombre ?? 'Sin cliente asignado';
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  return `<p><strong>Cliente:</strong> ${clienteNombre}</p>
<p><strong>Tipo:</strong> ${tipo}</p>
<p><strong>Costo:</strong> Q${Number(cita.costo).toLocaleString('es-GT')}</p>
${cita.descripcion ? `<p><strong>Descripción:</strong> ${cita.descripcion}</p>` : ''}`;
}

function generarEmailConfirmacion(cita: any): string {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  let teamsBtn = '';
  if (cita.teams_link) {
    teamsBtn = `
      <tr><td style="padding:16px 0;">
        <a href="${cita.teams_link}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Unirse a la reunión
        </a>
      </td></tr>`;
  }

  let costoSection = '';
  if (cita.costo > 0) {
    costoSection = `<p style="margin:8px 0;font-size:14px;"><strong>Costo:</strong> Q${Number(cita.costo).toLocaleString('es-GT')}</p>`;
  }

  return emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita Confirmada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita ha sido agendada exitosamente.</p>
    <table width="100%" style="margin:16px 0;background:#f0fdfa;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
        ${costoSection}
      </td></tr>
    </table>
    <table>${teamsBtn}</table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si necesita cancelar o reprogramar, contáctenos con anticipación.</p>
  `);
}

function generarEmailRecordatorio(cita: any, tipo: '24h' | '1h'): string {
  const tipoCita = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  const titulo = tipo === '24h' ? 'Recordatorio: su cita es mañana' : '¡Su cita es en 1 hora!';
  const bgColor = tipo === '1h' ? '#fef3c7' : '#f0fdfa';
  const subtitulo = tipo === '24h'
    ? 'Le recordamos que tiene una cita programada para mañana.'
    : 'Su cita está por comenzar. Por favor prepárese para conectarse.';

  let teamsBtn = '';
  if (cita.teams_link) {
    teamsBtn = `
      <tr><td style="padding:16px 0;">
        <a href="${cita.teams_link}" style="display:inline-block;background:linear-gradient(135deg,#0d9488,#06b6d4);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
          Unirse a la reunión
        </a>
      </td></tr>`;
  }

  return emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">${titulo}</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">${subtitulo}</p>
    <table width="100%" style="margin:16px 0;background:${bgColor};border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipoCita}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <table>${teamsBtn}</table>
  `);
}

function generarEmailCancelacion(cita: any): string {
  const tipo = cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : 'Seguimiento';
  const fechaFmt = formatearFechaGT(cita.fecha);
  const horaFmt = `${formatearHora(cita.hora_inicio)} - ${formatearHora(cita.hora_fin)}`;

  return emailWrapper(`
    <h2 style="margin:0 0 16px;color:#0f172a;font-size:20px;">Cita Cancelada</h2>
    <p style="color:#475569;font-size:14px;line-height:1.6;">Su cita ha sido cancelada.</p>
    <table width="100%" style="margin:16px 0;background:#fef2f2;border-radius:8px;padding:16px;">
      <tr><td>
        <p style="margin:8px 0;font-size:14px;"><strong>Tipo:</strong> ${tipo}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Fecha:</strong> ${fechaFmt}</p>
        <p style="margin:8px 0;font-size:14px;"><strong>Hora:</strong> ${horaFmt}</p>
      </td></tr>
    </table>
    <p style="color:#64748b;font-size:13px;margin-top:16px;">Si desea reagendar, no dude en contactarnos.</p>
  `);
}
