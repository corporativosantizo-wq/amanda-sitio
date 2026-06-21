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

export async function crearAudiencia(input: AudienciaInsert): Promise<Audiencia> {
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
  return data as Audiencia;
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
): Promise<Audiencia> {
  const updates: Record<string, unknown> = {};
  for (const k of CAMPOS_EDITABLES) {
    if (k in input) updates[k] = (input as Record<string, unknown>)[k] ?? null;
  }
  // emails_cc vacío → null (consistente con crearAudiencia).
  if ('emails_cc' in updates) {
    const cc = updates.emails_cc as string[] | null;
    updates.emails_cc = cc && cc.length ? cc : null;
  }

  const { data, error } = await db()
    .from('audiencias')
    .update(updates)
    .eq('id', id)
    .select('*, cliente:clientes(id, codigo, nombre, email, emails_cc), expediente:expedientes(id, numero_expediente)')
    .single();

  if (error) throw new AudienciaError('Error al actualizar audiencia', error);
  return data as Audiencia;
}
