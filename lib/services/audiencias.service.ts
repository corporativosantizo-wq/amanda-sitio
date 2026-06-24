// ============================================================================
// lib/services/audiencias.service.ts
// Lógica de negocio del módulo de Audiencias (tabla legal.audiencias).
//
// Acceso server-side con createAdminClient() (service_role, bypassa RLS), igual
// que expedientes.service.ts / citas.service.ts. La autorización la da el
// middleware Clerk (proxy.ts), no este servicio.
//
// REUSA / convive con citas: esta tabla es el registro formal de audiencias
// judiciales; NO toca legal.citas. La rama tipo='audiencia' de citas se retira
// recién en el cutover (Fase 8).
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { pgrstQuote } from '@/lib/utils/postgrest';
import { encolarRecordatoriosAudiencia, reencolarPorReprogramacion } from '@/lib/services/audiencias-recordatorios.service';
import {
  crearEventoOutlookAudiencia,
  actualizarEventoOutlookAudiencia,
  eliminarEventoOutlookAudiencia,
} from '@/lib/services/audiencias-outlook.service';
import type { Audiencia, AudienciaInsert } from '@/lib/types/audiencias';

const db = () => createAdminClient();

export class AudienciaError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'AudienciaError';
  }
}

const SELECT_CON_RELACIONES =
  '*, cliente:clientes(id, codigo, nombre, email), expediente:expedientes(id, numero_expediente)';

export async function crearAudiencia(
  input: AudienciaInsert,
  programarRecordatorios = true,
): Promise<Audiencia> {
  if (!input.fecha_hora_inicio) {
    throw new AudienciaError('fecha_hora_inicio es obligatorio');
  }
  if (!input.modalidad) {
    throw new AudienciaError('modalidad es obligatoria');
  }

  const { data, error } = await db()
    .from('audiencias')
    .insert({
      expediente_id: input.expediente_id ?? null,
      cliente_id: input.cliente_id ?? null,
      titulo: input.titulo ?? null,
      tipo_audiencia: input.tipo_audiencia ?? null,
      modalidad: input.modalidad,
      fecha_hora_inicio: input.fecha_hora_inicio,
      fecha_hora_fin: input.fecha_hora_fin ?? null,
      juzgado: input.juzgado ?? null,
      sala: input.sala ?? null,
      ubicacion: input.ubicacion ?? null,
      enlace_virtual: input.enlace_virtual ?? null,
      plataforma: input.plataforma ?? null,
      instrucciones: input.instrucciones ?? null,
      emails_cc: input.emails_cc?.length ? input.emails_cc : null,
      notas_internas: input.notas_internas ?? null,
      // estado se deja en el default de la tabla ('programada').
    })
    .select(SELECT_CON_RELACIONES)
    .single();

  if (error) throw new AudienciaError('Error al crear audiencia', error);
  const audiencia = data as Audiencia;

  // Espejar al Outlook de Amanda (evento interno, sin attendees). Best-effort:
  // guarda outlook_event_id en la fila si lo logra. No gateado por test_mode.
  const eventId = await crearEventoOutlookAudiencia(audiencia);
  if (eventId) audiencia.outlook_event_id = eventId;

  // Encolar los 2 recordatorios automáticos (best-effort: no romper la creación).
  if (programarRecordatorios) {
    try {
      await encolarRecordatoriosAudiencia(audiencia);
    } catch (e) {
      console.error('[crearAudiencia] Error encolando recordatorios:', (e as Error)?.message ?? e);
    }
  }

  return audiencia;
}

// ── Listado / detalle ───────────────────────────────────────────────────────

interface ListAudienciasParams {
  busqueda?: string;
  estado?: string;
  modalidad?: string;
  cliente_id?: string;
  expediente_id?: string;
  desde?: string;   // fecha/hora ISO mínima (fecha_hora_inicio >=)
  hasta?: string;   // fecha/hora ISO máxima (fecha_hora_inicio <=)
  page?: number;
  limit?: number;
}

export async function listarAudiencias(params: ListAudienciasParams = {}): Promise<{
  data: Audiencia[];
  total: number;
  totalPages: number;
}> {
  const { page = 1, limit = 25 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('audiencias')
    .select(
      `id, expediente_id, cliente_id, titulo, tipo_audiencia, modalidad,
       fecha_hora_inicio, fecha_hora_fin, juzgado, sala, estado, ics_sequence,
       created_at, updated_at,
       cliente:clientes(id, codigo, nombre),
       expediente:expedientes(id, numero_expediente)`,
      { count: 'exact' },
    );

  if (params.estado) query = query.eq('estado', params.estado);
  else query = query.neq('estado', 'cancelada'); // soft-delete: oculta canceladas por defecto
  if (params.modalidad) query = query.eq('modalidad', params.modalidad);
  if (params.cliente_id) query = query.eq('cliente_id', params.cliente_id);
  if (params.expediente_id) query = query.eq('expediente_id', params.expediente_id);
  if (params.desde) query = query.gte('fecha_hora_inicio', params.desde);
  if (params.hasta) query = query.lte('fecha_hora_inicio', params.hasta);
  if (params.busqueda) {
    const v = pgrstQuote(`%${params.busqueda}%`);
    query = query.or(`titulo.ilike.${v},tipo_audiencia.ilike.${v},juzgado.ilike.${v}`);
  }

  query = query
    .order('fecha_hora_inicio', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new AudienciaError('Error al listar audiencias', error);

  const total = count ?? 0;
  return {
    data: (data ?? []) as Audiencia[],
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function obtenerAudiencia(id: string): Promise<Audiencia> {
  const { data, error } = await db()
    .from('audiencias')
    .select('*, cliente:clientes(id, codigo, nombre, email, emails_cc), expediente:expedientes(id, numero_expediente)')
    .eq('id', id)
    .single();

  if (error) throw new AudienciaError('Audiencia no encontrada', error);
  return data as Audiencia;
}

// Campos editables vía actualizarAudiencia. (La reprogramación con SEQUENCE++
// es lógica de Fase 5; aquí solo se actualizan campos.)
const CAMPOS_EDITABLES: (keyof AudienciaInsert)[] = [
  'expediente_id', 'cliente_id', 'titulo', 'tipo_audiencia', 'modalidad',
  'fecha_hora_inicio', 'fecha_hora_fin', 'juzgado', 'sala', 'ubicacion',
  'enlace_virtual', 'plataforma', 'instrucciones', 'emails_cc', 'notas_internas',
  'estado',
];

export async function actualizarAudiencia(
  id: string,
  input: Partial<AudienciaInsert>,
  reprogramarSiCambiaFecha = true,
): Promise<Audiencia> {
  const actual = await obtenerAudiencia(id); // estado previo (detectar cambio de fecha)

  const updates: Record<string, unknown> = {};
  for (const k of CAMPOS_EDITABLES) {
    if (k in input) updates[k] = (input as Record<string, unknown>)[k] ?? null;
  }
  // emails_cc vacío → null (consistente con crearAudiencia).
  if ('emails_cc' in updates) {
    const cc = updates.emails_cc as string[] | null;
    updates.emails_cc = cc && cc.length ? cc : null;
  }

  // ¿Cambió la fecha/hora de inicio? → reprogramación: SEQUENCE++ y re-encolar.
  const nuevaInicio = (input as Record<string, unknown>).fecha_hora_inicio as string | undefined;
  const cambioFecha = !!nuevaInicio &&
    new Date(nuevaInicio).getTime() !== new Date(actual.fecha_hora_inicio).getTime();
  if (cambioFecha) {
    updates.ics_sequence = (actual.ics_sequence ?? 0) + 1;
  }

  const { data, error } = await db()
    .from('audiencias')
    .update(updates)
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email, emails_cc), expediente:expedientes(id, numero_expediente)')
    .single();

  if (error) throw new AudienciaError('Error al actualizar audiencia', error);
  const audiencia = data as Audiencia;

  // Espejar el cambio al Outlook de Amanda (best-effort). Si la editaron a
  // 'cancelada', se quita del calendario; si no, se actualiza el mismo evento
  // (o se crea si aún no estaba sincronizada). No duplica: reusa outlook_event_id.
  if (audiencia.estado === 'cancelada') {
    await eliminarEventoOutlookAudiencia(audiencia.outlook_event_id, audiencia.id);
  } else {
    await actualizarEventoOutlookAudiencia(audiencia);
  }

  // Reprogramación automática de recordatorios (best-effort).
  if (cambioFecha && reprogramarSiCambiaFecha) {
    try {
      await reencolarPorReprogramacion(audiencia);
    } catch (e) {
      console.error('[actualizarAudiencia] Error reprogramando recordatorios:', (e as Error)?.message ?? e);
    }
  }

  return audiencia;
}

/**
 * Borra una audiencia con la regla de Amanda:
 * - Si NUNCA envió un recordatorio → borrado real (cascade borra los encolados).
 * - Si YA envió al menos uno → NO se borra: estado='cancelada' (se oculta de la
 *   lista) + se descartan los pendientes; la constancia de lo enviado se conserva.
 */
export async function eliminarAudiencia(id: string): Promise<{ accion: 'eliminada' | 'cancelada' }> {
  // Leer el evento de Outlook ANTES de borrar la fila (en el borrado real la fila
  // desaparece y se perdería el id).
  const { data: fila } = await db()
    .from('audiencias')
    .select('outlook_event_id')
    .eq('id', id)
    .single();
  const eventId = (fila?.outlook_event_id as string | null) ?? null;

  const { count } = await db()
    .from('audiencias_recordatorios')
    .select('id', { count: 'exact', head: true })
    .eq('audiencia_id', id)
    .eq('estado', 'enviado');
  const yaEnvio = (count ?? 0) > 0;

  if (!yaEnvio) {
    // Borrado real. El FK audiencias_recordatorios.audiencia_id es ON DELETE
    // CASCADE → los recordatorios encolados se borran solos.
    const { error } = await db().from('audiencias').delete().eq('id', id);
    if (error) throw new AudienciaError('Error al eliminar audiencia', error);
    // Quitar el evento del Outlook de Amanda (la fila ya no existe → borrarFila).
    await eliminarEventoOutlookAudiencia(eventId, id, { borrarFila: true });
    return { accion: 'eliminada' };
  }

  // Ya envió: cancelar (no borrar). Descartar pendientes; conservar 'enviado'.
  await db().from('audiencias_recordatorios')
    .update({ estado: 'descartado' })
    .eq('audiencia_id', id)
    .is('fecha_enviado', null)
    .in('estado', ['programado', 'aprobado', 'pendiente_aprobacion', 'pospuesto']);

  const { error } = await db().from('audiencias').update({ estado: 'cancelada' }).eq('id', id);
  if (error) throw new AudienciaError('Error al cancelar audiencia', error);
  // Quitar el evento del Outlook de Amanda y limpiar outlook_event_id en la fila.
  await eliminarEventoOutlookAudiencia(eventId, id);
  return { accion: 'cancelada' };
}
