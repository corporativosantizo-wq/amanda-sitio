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
  ModalidadCita,
  HORARIOS,
  HORARIOS_MODALIDAD,
  ADMIN_ONLY_TIPOS,
  MODALIDAD_INFO,
} from '@/lib/types';
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
  emailConfirmacionCita,
  emailRecordatorio24h,
  emailRecordatorio1h,
  emailCancelacionCita,
  emailSolicitudConfirmada,
  emailFirmaConfirmadaMultiple,
  emailSolicitudPropuestaFecha,
  emailSolicitudRechazada,
  emailNuevaSolicitudInterno,
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
  tipo: TipoCita,
  modalidad?: ModalidadCita,
): Promise<SlotDisponible[]> {
  const config = HORARIOS[tipo];
  if (!config) throw new CitaError(`Tipo de cita inválido: ${tipo}`);

  // Entrega/firma de documentos: las atiende Mariano en oficina, con horario
  // propio (lun–vie 9–16), sin consultar la agenda de Outlook de Amanda, y solo
  // chocan contra otras citas de entrega/firma. El resto usa HORARIOS[tipo].
  const esEntregaFirma =
    tipo === 'seguimiento' &&
    (modalidad === 'entrega_documentos' || modalidad === 'firma_documentos');
  const modConfig = esEntregaFirma ? HORARIOS_MODALIDAD[modalidad!] : undefined;

  const dias = modConfig?.dias ?? config.dias;
  const horaInicio = modConfig?.hora_inicio ?? config.hora_inicio;
  const horaFin = modConfig?.hora_fin ?? config.hora_fin;
  const duracionMin = modConfig?.duracion ?? config.duracion_min;

  // Verificar que el día es válido
  const date = new Date(fecha + 'T12:00:00');
  const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ...
  if (!dias.includes(dayOfWeek)) {
    console.log('[Disponibilidad] fecha=', fecha, ', tipo=', tipo, ', modalidad=', modalidad, ': día', dayOfWeek, 'no válido (permitidos:', dias + ')');
    return []; // No hay slots disponibles este día
  }

  // Verificar que no es fecha pasada (usar zona Guatemala)
  const nowGT = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  nowGT.setHours(0, 0, 0, 0);
  const fechaDate = new Date(fecha + 'T00:00:00');
  if (fechaDate < nowGT) {
    console.log('[Disponibilidad] fecha=', fecha, 'es pasada (hoy GT:', nowGT.toISOString() + ')');
    return [];
  }

  // Generar slots base
  const slots = generarSlots(horaInicio, horaFin, duracionMin);
  console.log('[Disponibilidad] fecha=', fecha, ', tipo=', tipo, ', modalidad=', modalidad + ':', slots.length, 'slots base (' + horaInicio + '-' + horaFin + ', cada', duracionMin + 'min)');

  // Obtener citas existentes del día (no canceladas). Para entrega/firma solo
  // importan otras citas de entrega/firma (no sobrecargar a Mariano).
  let citasQuery = db()
    .from('citas')
    .select('hora_inicio, hora_fin')
    .eq('fecha', fecha)
    .neq('estado', 'cancelada');
  if (esEntregaFirma) {
    citasQuery = citasQuery.in('modalidad', ['entrega_documentos', 'firma_documentos']);
  }
  const { data: citasExistentes } = await citasQuery;

  // Obtener bloqueos del día
  const { data: bloqueos } = await db()
    .from('disponibilidad_bloqueos')
    .select('hora_inicio, hora_fin')
    .eq('fecha', fecha);

  console.log('[Disponibilidad] fecha=', fecha, ': citas existentes=', JSON.stringify(citasExistentes ?? []), ', bloqueos=', JSON.stringify(bloqueos ?? []));

  // Filtrar slots ocupados por citas
  let disponibles = slots.filter((slot: SlotDisponible) => {
    const ocupado = (citasExistentes ?? []).some((cita: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, cita.hora_inicio, cita.hora_fin)
    );
    return !ocupado;
  });
  console.log('[Disponibilidad] Después de filtrar citas:', disponibles.length, 'slots');

  // Filtrar slots bloqueados
  disponibles = disponibles.filter((slot: SlotDisponible) => {
    const bloqueado = (bloqueos ?? []).some((b: any) =>
      slotsOverlap(slot.hora_inicio, slot.hora_fin, b.hora_inicio, b.hora_fin)
    );
    return !bloqueado;
  });
  console.log('[Disponibilidad] Después de filtrar bloqueos:', disponibles.length, 'slots');

  // Si Outlook conectado, filtrar por busy slots — SOLO para citas que atiende
  // Amanda. La entrega/firma la atiende Mariano, así que su agenda de Outlook no
  // debe bloquear estos slots.
  try {
    const connected = !esEntregaFirma && (await isOutlookConnected());
    if (connected) {
      const startISO = `${fecha}T${horaInicio}:00`;
      const endISO = `${fecha}T${horaFin}:00`;
      const busySlots = await getFreeBusy(startISO, endISO);
      console.log('[Disponibilidad] Outlook busy slots:', JSON.stringify(busySlots));

      disponibles = disponibles.filter((slot: SlotDisponible) => {
        const busy = busySlots.some((b: any) => {
          const bStart = b.start.substring(11, 16); // HH:mm
          const bEnd = b.end.substring(11, 16);
          return slotsOverlap(slot.hora_inicio, slot.hora_fin, bStart, bEnd);
        });
        return !busy;
      });
      console.log('[Disponibilidad] Después de filtrar Outlook:', disponibles.length, 'slots');
    } else {
      console.log(`[Disponibilidad] Outlook no conectado, sin filtrar`);
    }
  } catch (outlookErr) {
    console.warn('[Citas] No se pudo consultar Outlook free/busy:', outlookErr);
  }

  console.log('[Disponibilidad] RESULTADO FINAL:', disponibles.length, 'slots disponibles:', disponibles.map((s: SlotDisponible) => s.hora_inicio));
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

// Suma minutos a una hora 'HH:MM' y devuelve 'HH:MM' (zero-padded).
function sumarMinutosHora(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number);
  const total = h * 60 + m + min;
  const fh = Math.floor(total / 60);
  const fm = total % 60;
  return `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
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
    .select(`
      id, cliente_id, expediente_id, tipo, titulo, descripcion,
      fecha, hora_inicio, hora_fin, duracion_minutos,
      estado, costo, categoria_outlook, modalidad, documentos_entrega,
      teams_link, outlook_event_id, es_personal_privada,
      notas, created_at, updated_at,
      cliente:clientes(id, codigo, nombre, email),
      participantes:cita_participantes(id, nombre, email)
    `, { count: 'exact' });

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
    .select('*, cliente:clientes(id, codigo, nombre, email), participantes:cita_participantes(id, nombre, email)')
    .eq('id', id)
    .single();

  if (error) throw new CitaError('Cita no encontrada', error);
  return data;
}

export async function crearCita(input: CitaInsert): Promise<Cita> {
  const config = HORARIOS[input.tipo];
  if (!config) throw new CitaError(`Tipo de cita inválido: ${input.tipo}`);

  const isAdminOnly = ADMIN_ONLY_TIPOS.has(input.tipo);

  if (!isAdminOnly) {
    // Validar que el slot esté disponible (solo para tipos públicos)
    const disponibles = await obtenerDisponibilidad(input.fecha, input.tipo);

    let slotValido: boolean;
    if (input.tipo === 'consulta_nueva') {
      // consulta_nueva books a 60-min block but disponibilidad returns 30-min sub-slots.
      // Validate that both the :00 and :30 sub-slots are available.
      const halfHour = input.hora_inicio.replace(':00', ':30');
      const hasStart = disponibles.some((s: SlotDisponible) => s.hora_inicio === input.hora_inicio);
      const hasHalf = disponibles.some((s: SlotDisponible) => s.hora_inicio === halfHour);
      slotValido = hasStart && hasHalf;
      console.log('[crearCita] consulta_nueva validation: hora=', input.hora_inicio, ', halfHour=', halfHour, ', hasStart=', hasStart, ', hasHalf=', hasHalf, ', slotValido=', slotValido);
    } else if (input.tipo === 'seguimiento' && input.modalidad === 'firma_documentos') {
      // La firma de documentos dura 30 min = dos sub-slots de 15 min consecutivos.
      const next = sumarMinutosHora(input.hora_inicio, 15);
      const hasStart = disponibles.some((s: SlotDisponible) => s.hora_inicio === input.hora_inicio);
      const hasNext = disponibles.some((s: SlotDisponible) => s.hora_inicio === next);
      slotValido = hasStart && hasNext;
      console.log('[crearCita] firma validation: hora=', input.hora_inicio, ', next=', next, ', hasStart=', hasStart, ', hasNext=', hasNext, ', slotValido=', slotValido);
    } else {
      slotValido = disponibles.some(
        (s: SlotDisponible) => s.hora_inicio === input.hora_inicio && s.hora_fin === input.hora_fin
      );
      console.log('[crearCita] seguimiento validation: hora_inicio=', input.hora_inicio, ', hora_fin=', input.hora_fin, ', slotValido=', slotValido);
    }

    if (!slotValido) {
      console.error('[crearCita] Slot NO disponible. fecha=', input.fecha, ', tipo=', input.tipo, ', hora_inicio=', input.hora_inicio, ', hora_fin=', input.hora_fin, '. Slots disponibles:', JSON.stringify(disponibles));
      throw new CitaError('El horario seleccionado ya no está disponible.');
    }

    // Rate limit: 10 citas por semana por cliente (solo para tipos públicos)
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
  } else {
    console.log('[crearCita] Tipo admin-only:', input.tipo, '— saltando validación de slots/rate limit');
  }

  // Insertar cita
  const costo = input.costo ?? config.costo;
  const modalidad: ModalidadCita = input.modalidad ?? 'virtual';
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
      modalidad,
      documentos_entrega: input.documentos_entrega ?? null,
      notas: input.notas ?? null,
      es_personal_privada: input.es_personal_privada ?? false,
      detalle_privado: input.detalle_privado ?? null,
    })
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al crear cita', error);

  // Crear evento en Outlook (si conectado)
  let clienteEmail: string | null = null;
  if (cita.cliente) {
    clienteEmail = cita.cliente.email;
  }
  console.log('[crearCita] clienteEmail:', clienteEmail ? clienteEmail.replace(/(.{2}).+(@.+)/, '$1***$2') : 'NULL');

  console.log(`[crearCita] ══════ INICIO Outlook Calendar ══════`);
  try {
    const connected = await isOutlookConnected();
    console.log('[crearCita] isOutlookConnected() =', connected);

    if (!connected) {
      console.log(`[crearCita] ⚠ Outlook NO conectado — no se creará evento. Verifica que exista outlook_access_token_encrypted en legal.configuracion`);
    } else {
      const calendarPayload = {
        subject: cita.titulo,
        startDateTime: `${cita.fecha}T${cita.hora_inicio.substring(0, 5)}:00`,
        endDateTime: `${cita.fecha}T${cita.hora_fin.substring(0, 5)}:00`,
        attendees: clienteEmail ? [clienteEmail] : [],
        // Las entregas de documentos no llevan reunión de Teams.
        isOnlineMeeting: (input.isOnlineMeeting ?? true) && MODALIDAD_INFO[modalidad].usaTeams,
        categories: [config.categoria_outlook],
        body: generarBodyEvento(cita),
      };
      console.log('[crearCita] createCalendarEvent: subject=', calendarPayload.subject, ', start=', calendarPayload.startDateTime, ', attendees=', calendarPayload.attendees.length);

      const { eventId, teamsLink } = await createCalendarEvent(calendarPayload);
      console.log('[crearCita] Evento Outlook creado: eventId=', eventId);
      console.log('[crearCita] Teams link:', teamsLink ?? 'NULL');

      const { error: updateErr } = await db()
        .from('citas')
        .update({
          outlook_event_id: eventId,
          teams_link: teamsLink,
          updated_at: new Date().toISOString(),
        })
        .eq('id', cita.id);

      if (updateErr) {
        console.error('[crearCita] ERROR al guardar outlook_event_id/teams_link en BD:', JSON.stringify(updateErr));
      } else {
        console.log('[crearCita] outlook_event_id y teams_link guardados en BD');
      }

      cita.outlook_event_id = eventId;
      cita.teams_link = teamsLink;
    }
  } catch (outlookErr: any) {
    console.error(`[crearCita] ══════ ERROR Outlook Calendar ══════`);
    console.error('[crearCita] message:', outlookErr.message ?? outlookErr);
    console.error('[crearCita] name:', outlookErr.name ?? 'N/A');
    console.error('[crearCita] statusCode:', outlookErr.statusCode ?? 'N/A');
    console.error('[crearCita] code:', outlookErr.code ?? 'N/A');
    console.error('[crearCita] details:', JSON.stringify(outlookErr.details ?? outlookErr.body ?? {}).substring(0, 1000));
    console.error('[crearCita] stack:', (outlookErr.stack ?? '').substring(0, 500));
  }
  console.log('[crearCita] FIN Outlook Calendar (event_id=', cita.outlook_event_id ?? 'NULL', ', teams=', cita.teams_link ? 'SÍ' : 'NULL', ')');

  // Enviar email de confirmación (independiente de Outlook calendar)
  if (clienteEmail) {
    console.log(`[crearCita] ── Enviando email de confirmación ──`);
    try {
      const email = emailConfirmacionCita(cita);
      console.log('[crearCita] Template generado: from=', email.from, ', subject=', email.subject, ', html=', email.html.length, 'chars');
      await sendMail({ from: email.from, to: clienteEmail, subject: email.subject, htmlBody: email.html });
      console.log(`[crearCita] ── Email de confirmación ENVIADO OK ──`);
      await db()
        .from('citas')
        .update({ email_confirmacion_enviado: true })
        .eq('id', cita.id);
    } catch (emailErr: any) {
      console.error(`[crearCita] ── ERROR al enviar email de confirmación ──`);
      console.error('[crearCita] Error:', emailErr.message ?? emailErr);
      console.error('[crearCita] statusCode:', emailErr.statusCode ?? 'N/A');
      console.error('[crearCita] code:', emailErr.code ?? 'N/A');
    }
  } else {
    console.log(`[crearCita] No se envía email — clienteEmail es null`);
  }

  // ── Entrega / firma de documentos: avisar a Mariano ──
  if (modalidad === 'entrega_documentos' || modalidad === 'firma_documentos') {
    await notificarMarianoCita(cita, modalidad).catch((e) =>
      console.error('[crearCita] Error notificando a Mariano:', e?.message ?? e),
    );
  }
  // Solo la entrega genera Nota de entrega automática.
  if (modalidad === 'entrega_documentos') {
    await generarNotaEntregaParaCita(cita).catch((e) =>
      console.error('[crearCita] Error generando nota de entrega:', e?.message ?? e),
    );
  }

  return cita;
}

// Avisa al grupo de Telegram de Mariano (TELEGRAM_GROUP_CHAT_ID) que se agendó
// una cita presencial (entrega o firma), para que prepare la documentación.
async function notificarMarianoCita(cita: any, modalidad: ModalidadCita): Promise<void> {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) {
    console.warn('[crearCita] TELEGRAM_GROUP_CHAT_ID no configurado — no se avisa a Mariano');
    return;
  }
  const nombreCliente = cita.cliente?.nombre ?? 'Cliente';
  const fechaFmt = new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guatemala',
  });
  const horaFmt = formatearHora12(cita.hora_inicio);

  const esFirma = modalidad === 'firma_documentos';
  const titulo = esFirma
    ? '✍️ <b>Nueva cita de firma de documentos agendada</b>'
    : '📦 <b>Nueva cita de entrega de documentos agendada</b>';
  const instruccion = esFirma
    ? 'Por favor preparar los documentos para firma, timbres notariales y protocolo.'
    : 'Por favor preparar los documentos correspondientes del cliente para la entrega.';

  const texto =
    `${titulo}\n\n` +
    `👤 Cliente: ${escapeHtmlTg(nombreCliente)}\n` +
    `📅 Fecha: ${fechaFmt}\n` +
    `🕐 Hora: ${horaFmt}\n\n` +
    `${instruccion}\n\n` +
    `cc: Licda. Amanda Santizo`;

  await sendTelegramMessage(texto, { parse_mode: 'HTML', chatId });
}

// Crea automáticamente una Nota de entrega (estado 'pendiente') vinculada a la
// cita, lista para que el admin la complete antes de la entrega. Best-effort.
async function generarNotaEntregaParaCita(cita: any): Promise<void> {
  if (!cita.cliente_id) return;
  const { crearNotaEntrega } = await import('./notas-entrega.service');
  await crearNotaEntrega({
    cliente_id: cita.cliente_id,
    cita_id: cita.id,
    fecha: cita.fecha,
    documentos_entregados: cita.documentos_entrega ?? null,
  });
}

function formatearHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function escapeHtmlTg(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        startDateTime: `${data.fecha}T${data.hora_inicio.substring(0, 5)}:00`,
        endDateTime: `${data.fecha}T${data.hora_fin.substring(0, 5)}:00`,
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

// ── Solicitudes de entrega / firma de documentos ────────────────────────────
//
// El cliente envía una solicitud con su fecha/hora preferida; la cita nace como
// estado='pendiente'. NO se crea evento en Outlook ni se envía confirmación al
// cliente hasta que Amanda decida (confirmar / proponer otra fecha / rechazar).

// Crea un evento de calendario en Outlook para una cita ya existente y guarda
// outlook_event_id/teams_link. Best-effort (no lanza). Reutilizado al confirmar.
async function crearEventoOutlookParaCita(
  cita: any,
  firmantes: Array<{ nombre: string; email: string | null }> = [],
): Promise<void> {
  try {
    if (!(await isOutlookConnected())) {
      console.log('[Solicitud] Outlook no conectado — no se crea evento');
      return;
    }
    if (!cita.fecha) return;
    const modalidad = (cita.modalidad ?? 'virtual') as ModalidadCita;
    const { eventId, teamsLink } = await createCalendarEvent({
      subject: cita.titulo,
      startDateTime: `${cita.fecha}T${cita.hora_inicio.substring(0, 5)}:00`,
      endDateTime: `${cita.fecha}T${cita.hora_fin.substring(0, 5)}:00`,
      attendees: cita.cliente?.email ? [cita.cliente.email] : [],
      isOnlineMeeting: MODALIDAD_INFO[modalidad].usaTeams,
      categories: [cita.categoria_outlook ?? 'Verde'],
      body: generarBodyEvento(cita, firmantes),
    });
    await db()
      .from('citas')
      .update({ outlook_event_id: eventId, teams_link: teamsLink, updated_at: new Date().toISOString() })
      .eq('id', cita.id);
    cita.outlook_event_id = eventId;
    cita.teams_link = teamsLink;
  } catch (e: any) {
    console.error('[Solicitud] Error creando evento Outlook:', e?.message ?? e);
  }
}

// Avisa al despacho (email a amanda@ + asistente@, Telegram a Mariano) de una
// nueva solicitud pendiente de asignar fecha. Best-effort.
async function notificarDespachoNuevaSolicitud(
  cita: any,
  extra: { telefono?: string; empresa?: string } = {},
): Promise<void> {
  // Email interno
  try {
    const email = emailNuevaSolicitudInterno(cita);
    await sendMail({
      from: email.from,
      to: 'amanda@papeleo.legal, asistente@papeleo.legal',
      subject: email.subject,
      htmlBody: email.html,
    });
  } catch (e: any) {
    console.error('[Solicitud] Error email interno al despacho:', e?.message ?? e);
  }

  // Telegram a Mariano
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) {
    console.warn('[Solicitud] TELEGRAM_GROUP_CHAT_ID no configurado');
    return;
  }
  const esFirma = cita.modalidad === 'firma_documentos';
  const nombre = cita.cliente?.nombre ?? 'Cliente';
  const empresa = (extra.empresa ?? '').trim();
  const email = cita.cliente?.email ?? '—';
  const telefono = (extra.telefono ?? '').trim() || '—';
  const comentarios = (cita.comentarios_cliente ?? '').trim();

  const texto =
    `📋 <b>Nueva solicitud de ${esFirma ? 'firma' : 'entrega'}</b>\n` +
    `👤 ${escapeHtmlTg(nombre)}${empresa ? ` — ${escapeHtmlTg(empresa)}` : ''}\n` +
    `📧 ${escapeHtmlTg(email)} | 📞 ${escapeHtmlTg(telefono)}\n` +
    (comentarios ? `💬 ${escapeHtmlTg(comentarios)}\n` : '') +
    `⏳ Pendiente de asignar fecha\n\n` +
    `→ amandasantizo.com/admin/calendario`;

  try {
    await sendTelegramMessage(texto, { parse_mode: 'HTML', chatId });
  } catch (e: any) {
    console.error('[Solicitud] Error Telegram a Mariano:', e?.message ?? e);
  }
}

// Avisa a Mariano que una cita de entrega/firma quedó confirmada. Para firmas
// con múltiples partes, lista a todos los firmantes (nombre + email).
async function notificarMarianoCitaConfirmada(
  cita: any,
  firmantes: Array<{ nombre: string; email: string | null }> = [],
): Promise<void> {
  const chatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!chatId) return;
  const esFirma = cita.modalidad === 'firma_documentos';
  const nombre = cita.cliente?.nombre ?? 'Cliente';
  const fechaFmt = cita.fecha
    ? new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-GT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guatemala',
      })
    : '—';
  const horaFmt = formatearHora12(cita.hora_inicio);

  // Firma con varias partes: notificación detallada con la lista de firmantes.
  const partes = firmantes.filter((f) => (f.nombre ?? '').trim());
  if (esFirma && partes.length > 1) {
    const lista = partes
      .map((f) => `- ${escapeHtmlTg(f.nombre)}${f.email ? ` (${escapeHtmlTg(f.email)})` : ''}`)
      .join('\n');
    const texto =
      `✍️ <b>Cita de firma confirmada</b>\n` +
      `📅 ${fechaFmt} a las ${horaFmt}\n` +
      `👥 <b>Firmantes:</b>\n${lista}\n\n` +
      `Preparar documentos para firma, timbres notariales y protocolo.`;
    try {
      await sendTelegramMessage(texto, { parse_mode: 'HTML', chatId });
    } catch (e: any) {
      console.error('[Solicitud] Error Telegram confirmación:', e?.message ?? e);
    }
    return;
  }

  const texto =
    `✅ <b>Cita confirmada: ${esFirma ? 'firma' : 'entrega'}</b>\n\n` +
    `👤 ${escapeHtmlTg(nombre)}\n` +
    `📅 ${fechaFmt} a las ${horaFmt}\n\n` +
    `Preparar documentos.`;
  try {
    await sendTelegramMessage(texto, { parse_mode: 'HTML', chatId });
  } catch (e: any) {
    console.error('[Solicitud] Error Telegram confirmación:', e?.message ?? e);
  }
}

export interface SolicitudInsert {
  tipo: TipoCita;
  titulo: string;
  descripcion?: string | null;
  modalidad: ModalidadCita;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  cliente_id?: string | null;
  comentarios_cliente?: string | null;
  notas?: string | null;
  // Solo para la notificación al despacho (no se persisten en la cita).
  cliente_telefono?: string;
  cliente_empresa?: string;
}

export async function crearSolicitudCita(input: SolicitudInsert): Promise<Cita> {
  const config = HORARIOS[input.tipo];
  const { data: cita, error } = await db()
    .from('citas')
    .insert({
      cliente_id: input.cliente_id ?? null,
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      fecha: input.fecha,
      hora_inicio: input.hora_inicio,
      hora_fin: input.hora_fin,
      duracion_minutos: input.duracion_minutos,
      estado: 'pendiente' as EstadoCita,
      costo: 0,
      categoria_outlook: config?.categoria_outlook ?? 'Verde',
      modalidad: input.modalidad,
      fecha_solicitada: input.fecha,
      hora_solicitada: input.hora_inicio,
      comentarios_cliente: input.comentarios_cliente ?? null,
      notas: input.notas ?? null,
    })
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();

  if (error) throw new CitaError('Error al crear solicitud', error);

  await notificarDespachoNuevaSolicitud(cita, {
    telefono: input.cliente_telefono,
    empresa: input.cliente_empresa,
  }).catch((e) => console.error('[crearSolicitudCita] Error notificando al despacho:', e?.message ?? e));

  return cita;
}

export async function listarSolicitudesPendientes(): Promise<Cita[]> {
  const { data, error } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .eq('estado', 'pendiente')
    .in('modalidad', ['entrega_documentos', 'firma_documentos'])
    .order('created_at', { ascending: true });
  if (error) throw new CitaError('Error al listar solicitudes', error);
  return (data ?? []) as Cita[];
}

interface ParticipanteInput {
  nombre: string;
  email?: string | null;
}

interface AccionFechaInput {
  fecha?: string;
  hora_inicio?: string;
  hora_fin?: string;
  duracion_minutos?: number;
  mensaje?: string;
  // Partes adicionales que firman en la misma cita (solo firma_documentos).
  participantes?: ParticipanteInput[];
}

// Amanda CONFIRMA la solicitud (con la fecha del cliente o una nueva).
export async function confirmarSolicitud(id: string, input: AccionFechaInput = {}): Promise<Cita> {
  const updates: Record<string, unknown> = {
    estado: 'confirmada' as EstadoCita,
    updated_at: new Date().toISOString(),
  };
  if (input.fecha) updates.fecha = input.fecha;
  if (input.hora_inicio) updates.hora_inicio = input.hora_inicio;
  if (input.hora_fin) updates.hora_fin = input.hora_fin;
  if (input.duracion_minutos) updates.duracion_minutos = input.duracion_minutos;

  const { data: cita, error } = await db()
    .from('citas')
    .update(updates)
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();
  if (error) throw new CitaError('Error al confirmar solicitud', error);

  const esFirma = cita.modalidad === 'firma_documentos';

  // Partes adicionales que firman en la misma cita (solo firma_documentos).
  // Se guardan en legal.cita_participantes y cada una recibe su propio correo.
  let participantes: Array<{ id: string; nombre: string; email: string }> = [];
  if (esFirma && Array.isArray(input.participantes)) {
    const filas = input.participantes
      .map((p) => ({ nombre: (p.nombre ?? '').trim(), email: (p.email ?? '').trim() }))
      .filter((p) => p.nombre && p.email);
    if (filas.length) {
      const { data: insertadas, error: insErr } = await db()
        .from('cita_participantes')
        .insert(filas.map((p) => ({ cita_id: cita.id, nombre: p.nombre, email: p.email })))
        .select('id, nombre, email');
      if (insErr) {
        console.error('[confirmarSolicitud] Error guardando participantes:', insErr);
      } else {
        participantes = insertadas ?? [];
      }
    }
  }

  // Lista completa de firmantes: contacto principal + partes adicionales.
  const firmantes: Array<{ nombre: string; email: string | null }> = [
    { nombre: cita.cliente?.nombre ?? '', email: cita.cliente?.email ?? null },
    ...participantes.map((p) => ({ nombre: p.nombre, email: p.email })),
  ].filter((f) => f.nombre.trim());

  // Solo se listan firmantes en el evento/Telegram cuando hay varias partes.
  const firmantesParaEvento = esFirma && participantes.length > 0 ? firmantes : [];
  await crearEventoOutlookParaCita(cita, firmantesParaEvento);

  // ── Correos de confirmación ──
  if (esFirma && participantes.length > 0) {
    // Múltiples firmantes: correo personalizado a cada uno (principal + partes),
    // mencionando a TODAS las partes con quienes va a firmar.
    if (cita.cliente?.email) {
      try {
        const email = emailFirmaConfirmadaMultiple(cita, cita.cliente.nombre ?? '', firmantes, input.mensaje);
        await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
        await db().from('citas').update({ email_confirmacion_enviado: true }).eq('id', cita.id);
      } catch (e: any) {
        console.error('[confirmarSolicitud] Error email firmante principal:', e?.message ?? e);
      }
    }
    for (const p of participantes) {
      if (!p.email) continue;
      try {
        const email = emailFirmaConfirmadaMultiple(cita, p.nombre, firmantes, input.mensaje);
        await sendMail({ from: email.from, to: p.email, subject: email.subject, htmlBody: email.html });
        await db().from('cita_participantes').update({ confirmacion_enviada: true }).eq('id', p.id);
      } catch (e: any) {
        console.error('[confirmarSolicitud] Error email participante:', e?.message ?? e);
      }
    }
  } else if (cita.cliente?.email) {
    // Un solo contacto: correo de confirmación estándar.
    try {
      const email = emailSolicitudConfirmada(cita, input.mensaje);
      await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
      await db().from('citas').update({ email_confirmacion_enviado: true }).eq('id', cita.id);
    } catch (e: any) {
      console.error('[confirmarSolicitud] Error email cliente:', e?.message ?? e);
    }
  }

  await notificarMarianoCitaConfirmada(cita, firmantes).catch((e) =>
    console.error('[confirmarSolicitud] Error Telegram:', e?.message ?? e));

  return { ...cita, participantes };
}

// Amanda PROPONE otra fecha; la cita sigue 'pendiente' hasta que el cliente
// confirme (o Amanda la confirme manualmente después). fecha_solicitada NO se
// toca: conserva la fecha original del cliente para el correo.
export async function proponerFechaSolicitud(id: string, input: AccionFechaInput = {}): Promise<Cita> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fecha) updates.fecha = input.fecha;
  if (input.hora_inicio) updates.hora_inicio = input.hora_inicio;
  if (input.hora_fin) updates.hora_fin = input.hora_fin;
  if (input.duracion_minutos) updates.duracion_minutos = input.duracion_minutos;

  const { data: cita, error } = await db()
    .from('citas')
    .update(updates)
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();
  if (error) throw new CitaError('Error al proponer fecha', error);

  if (cita.cliente?.email) {
    try {
      const email = emailSolicitudPropuestaFecha(cita, input.mensaje);
      await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
    } catch (e: any) {
      console.error('[proponerFechaSolicitud] Error email cliente:', e?.message ?? e);
    }
  }

  return cita;
}

// Amanda RECHAZA la solicitud (mensaje personalizable).
export async function rechazarSolicitud(id: string, mensaje?: string): Promise<Cita> {
  const { data: cita, error } = await db()
    .from('citas')
    .update({ estado: 'cancelada' as EstadoCita, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .single();
  if (error) throw new CitaError('Error al rechazar solicitud', error);

  if (cita.outlook_event_id) {
    try { await deleteCalendarEvent(cita.outlook_event_id); } catch { /* best-effort */ }
  }

  if (cita.cliente?.email) {
    try {
      const email = emailSolicitudRechazada(cita, mensaje);
      await sendMail({ from: email.from, to: cita.cliente.email, subject: email.subject, htmlBody: email.html });
    } catch (e: any) {
      console.error('[rechazarSolicitud] Error email cliente:', e?.message ?? e);
    }
  }

  return cita;
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
    .select('id, fecha, hora_inicio, hora_fin, motivo, created_at');

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
  followups: number;
  personales: number;
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

  // Horario de oficina Guatemala (UTC-6, sin horario de verano): 8 AM – 6 PM.
  // `horaActual` ya viene en hora GT (Intl con timeZone America/Guatemala).
  const horaActualH = Number(horaActual.split(':')[0]);
  const enHorarioOficina = horaActualH >= 8 && horaActualH < 18;

  // Recordatorios 24h: SOLO dentro de horario de oficina. Como el cron detecta
  // las citas de "mañana" desde la medianoche GT, enviarlas en ese momento
  // dispararía correos a las 12 AM. Fuera de horario (6 PM – 7:59 AM) los
  // diferimos sin marcarlos como enviados: el cron corre cada 15 min y los
  // mandará en cuanto entre al horario de oficina (8:00 AM). La cita sigue
  // siendo "mañana" durante todo el día previo, así que ninguno se pierde.
  // Los recordatorios de 1h NO se gatean (son urgentes, la cita es pronto).
  if (enHorarioOficina) {
    const { data: citas24h } = await db()
      .from('citas')
      .select('*, cliente:clientes(id, codigo, nombre, email)')
      .eq('fecha', mananaStr)
      .eq('recordatorio_24h_enviado', false)
      // Solo citas confirmadas (las solicitudes pendientes de entrega/firma no
      // reciben recordatorios hasta que Amanda confirme la fecha).
      .eq('estado', 'confirmada');

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
          console.warn('[Citas] Error enviando recordatorio 24h para cita', cita.id);
        }
      }
    }
  }

  // Recordatorios 1h: citas de hoy cuya hora_inicio es dentro de ~1 hora
  const { data: citasHoy } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, codigo, nombre, email)')
    .eq('fecha', hoyStr)
    .eq('recordatorio_1h_enviado', false)
    // Solo citas confirmadas (ver nota en recordatorios 24h).
    .eq('estado', 'confirmada');

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
          console.warn('[Citas] Error enviando recordatorio 1h para cita', cita.id);
        }
      }
    }
  }

  // Auto-completar citas pasadas
  const { data: citasPasadas } = await db()
    .from('citas')
    .select('id')
    .lt('fecha', hoyStr)
    // Solo se autocompletan citas confirmadas; una solicitud pendiente sin
    // confirmar no debe marcarse como "completada" solo porque pasó la fecha.
    .eq('estado', 'confirmada');

  if (citasPasadas && citasPasadas.length > 0) {
    const ids = citasPasadas.map((c: any) => c.id);
    await db()
      .from('citas')
      .update({ estado: 'completada', updated_at: new Date().toISOString() })
      .in('id', ids);
    completadas = ids.length;
  }

  // Post-consultation follow-up: citas de hoy que terminaron hace ~2 horas
  let followups = 0;
  const [curH, curM] = horaActual.split(':').map(Number);
  const currentMinutes = curH * 60 + curM;

  const { data: citasFollowup } = await db()
    .from('citas')
    .select('*, cliente:clientes(id, nombre, email)')
    .eq('fecha', hoyStr)
    .in('tipo', ['consulta_nueva', 'seguimiento'])
    // 'pendiente' excluido: una solicitud de entrega/firma sin confirmar no
    // dispara el follow-up post-consulta.
    .in('estado', ['confirmada', 'completada'])
    .eq('followup_enviado', false);

  for (const cita of citasFollowup ?? []) {
    const [fh, fm] = cita.hora_fin.split(':').map(Number);
    const endMinutes = fh * 60 + fm;
    const elapsed = currentMinutes - endMinutes;

    // Send followup if cita ended 90-150 min ago (~2 hours, with 30-min cron window)
    if (elapsed >= 90 && elapsed <= 150) {
      const clienteName = cita.cliente?.nombre || 'cliente';
      const tipoLabel = cita.tipo === 'consulta_nueva' ? 'Consulta' : 'Seguimiento';

      const buttons = [
        [
          { text: '\uD83D\uDCC4 Cotizaci\u00F3n', callback_data: `followup_quote:${cita.id}` },
          { text: '\uD83D\uDCDD Resumen', callback_data: `followup_summary:${cita.id}` },
        ],
        [
          { text: '\u23F0 M\u00E1s tarde', callback_data: `followup_tomorrow:${cita.id}` },
          { text: '\u274C No', callback_data: `followup_no:${cita.id}` },
        ],
      ];

      try {
        await sendTelegramMessage(
          `\uD83D\uDCCB <b>${tipoLabel} con ${clienteName} termin\u00F3</b>\n\n` +
          `\u23F0 ${cita.hora_inicio} \u2014 ${cita.hora_fin}\n` +
          `\u00BFEnviar cotizaci\u00F3n o agregar notas?`,
          { parse_mode: 'HTML', reply_markup: { inline_keyboard: buttons } },
        );

        await db()
          .from('citas')
          .update({ followup_enviado: true })
          .eq('id', cita.id);

        followups++;
      } catch {
        console.warn('[Citas] Error enviando followup para cita', cita.id);
      }
    }
  }

  // ── Citas personales privadas de Amanda: aviso del día (horario de oficina) ──
  // A su Telegram privado va el detalle real; al grupo de la oficina solo un
  // aviso genérico (sin detalle). Tras enviar AMBOS, se marca enviado y se BORRA
  // detalle_privado. Si algo falla, no se marca → se reintenta el próximo tick.
  let personales = 0;
  if (enHorarioOficina) {
    const { data: citasPersonales } = await db()
      .from('citas')
      .select('id, hora_inicio, hora_fin, detalle_privado')
      .eq('fecha', hoyStr)
      .eq('es_personal_privada', true)
      .eq('recordatorio_personal_enviado', false)
      .neq('estado', 'cancelada');

    const chatPrivado = process.env.TELEGRAM_CHAT_ID;
    const chatGrupo = process.env.TELEGRAM_GROUP_CHAT_ID;

    for (const cita of citasPersonales ?? []) {
      const ini = formatearHora12(cita.hora_inicio);
      const fin = formatearHora12(cita.hora_fin);
      const detalle = (cita.detalle_privado ?? '').trim() || '(sin detalle)';
      try {
        // 1) Telegram privado a Amanda CON el detalle (debe ir primero).
        if (!chatPrivado) throw new Error('TELEGRAM_CHAT_ID no configurado');
        await sendTelegramMessage(
          `🔒 <b>Recordatorio personal de hoy:</b>\n${escapeHtmlTg(detalle)}\n🕐 ${ini} a ${fin}`,
          { parse_mode: 'HTML', chatId: chatPrivado },
        );
        // 2) Aviso genérico al grupo de la oficina (NUNCA el detalle).
        if (chatGrupo) {
          await sendTelegramMessage(
            `📅 <b>Aviso:</b> La Licda. Amanda estará en una cita personal hoy.\n` +
            `🕐 ${ini} a ${fin}\n🔒 No disponible durante ese horario.`,
            { parse_mode: 'HTML', chatId: chatGrupo },
          );
        }
        // 3) Solo tras enviar ambos: marcar enviado y BORRAR el detalle privado.
        await db()
          .from('citas')
          .update({ recordatorio_personal_enviado: true, detalle_privado: null, updated_at: new Date().toISOString() })
          .eq('id', cita.id);
        personales++;
      } catch (e: any) {
        console.warn('[Citas] Error enviando recordatorio personal para cita', cita.id, e?.message ?? e);
      }
    }
  }

  console.log('[Citas] Recordatorios: 24h=', enviados_24h, ', 1h=', enviados_1h, ', completadas=', completadas, ', followups=', followups, ', personales=', personales);
  return { enviados_24h, enviados_1h, completadas, followups, personales };
}

// ── Calendar Event Body (NOT an email template — used for Outlook event) ────

const TIPO_LABELS: Record<string, string> = {
  consulta_nueva: 'Consulta Nueva',
  seguimiento: 'Seguimiento',
  audiencia: 'Audiencia',
  reunion: 'Reunión',
  bloqueo_personal: 'Bloqueo Personal',
  evento_libre: 'Evento Libre',
};

function generarBodyEvento(
  cita: any,
  firmantes: Array<{ nombre: string; email: string | null }> = [],
): string {
  const clienteNombre = cita.cliente?.nombre ?? 'Sin cliente asignado';
  const tipo = TIPO_LABELS[cita.tipo] ?? cita.tipo;
  const nombresFirmantes = firmantes.map((f) => (f.nombre ?? '').trim()).filter(Boolean);
  const firmantesBlock = nombresFirmantes.length
    ? `<p><strong>Firmantes:</strong></p>\n<ul>${nombresFirmantes.map((n) => `<li>${n}</li>`).join('')}</ul>`
    : '';
  return `<p><strong>Cliente:</strong> ${clienteNombre}</p>
<p><strong>Tipo:</strong> ${tipo}</p>
${firmantesBlock}
${cita.costo > 0 ? `<p><strong>Costo:</strong> $${Number(cita.costo).toLocaleString('en-US')} USD</p>` : ''}
${cita.descripcion ? `<p><strong>Descripción:</strong> ${cita.descripcion}</p>` : ''}`;
}
