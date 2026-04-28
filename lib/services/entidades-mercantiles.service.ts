// ============================================================================
// lib/services/entidades-mercantiles.service.ts
// CRUD para entidades mercantiles y documentos mercantiles
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { pgrstQuote } from '@/lib/utils/postgrest';

const db = () => createAdminClient();

// ── Types ──────────────────────────────────────────────────────────────────

export interface EntidadMercantil {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  tipo_entidad: string;
  nit: string | null;
  registro_mercantil_numero: number | null;
  registro_mercantil_folio: number | null;
  registro_mercantil_libro: number | null;
  patente_comercio: string | null;
  escritura_numero: number | null;
  escritura_fecha: string | null;
  escritura_notario: string | null;
  escritura_archivo_url: string | null;
  representante_legal_nombre: string | null;
  representante_legal_cargo: string | null;
  representante_legal_registro: number | null;
  representante_legal_folio: number | null;
  representante_legal_libro: number | null;
  cliente_id: string | null;
  expediente_id: string | null;
  activa: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentoMercantil {
  id: string;
  entidad_id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha_documento: string | null;
  numero_acta: number | null;
  tipo_asamblea: string | null;
  archivo_generado_url: string | null;
  archivo_generado_nombre: string | null;
  archivo_escaneado_url: string | null;
  archivo_escaneado_nombre: string | null;
  estado: string;
  registro_numero: number | null;
  registro_folio: number | null;
  registro_libro: number | null;
  fecha_inscripcion: string | null;
  created_at: string;
  updated_at: string;
}

interface ListEntidadesParams {
  busqueda?: string;
  page?: number;
  limit?: number;
  activa?: boolean;
}

// ── Entidades CRUD ─────────────────────────────────────────────────────────

export async function listarEntidades(params: ListEntidadesParams = {}) {
  const { busqueda, page = 1, limit = 25, activa } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('entidades_mercantiles')
    .select('id, nombre, nombre_corto, tipo_entidad, nit, representante_legal_nombre, activa, created_at, updated_at', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1);

  if (activa !== undefined) query = query.eq('activa', activa);
  if (busqueda) {
    const v = pgrstQuote(`%${busqueda}%`);
    query = query.or(
      `nombre.ilike.${v},nombre_corto.ilike.${v},nit.ilike.${v},representante_legal_nombre.ilike.${v}`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new EntidadError('Error al listar entidades', error);

  return {
    data: (data ?? []) as EntidadMercantil[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerEntidad(id: string): Promise<EntidadMercantil> {
  const { data, error } = await db()
    .from('entidades_mercantiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new EntidadError('Entidad no encontrada', error);
  return data as EntidadMercantil;
}

export async function crearEntidad(input: Partial<EntidadMercantil>): Promise<EntidadMercantil> {
  const { data, error } = await db()
    .from('entidades_mercantiles')
    .insert({
      nombre: input.nombre,
      nombre_corto: input.nombre_corto ?? null,
      tipo_entidad: input.tipo_entidad ?? 'sociedad_anonima',
      nit: input.nit ?? null,
      registro_mercantil_numero: input.registro_mercantil_numero ?? null,
      registro_mercantil_folio: input.registro_mercantil_folio ?? null,
      registro_mercantil_libro: input.registro_mercantil_libro ?? null,
      patente_comercio: input.patente_comercio ?? null,
      escritura_numero: input.escritura_numero ?? null,
      escritura_fecha: input.escritura_fecha ?? null,
      escritura_notario: input.escritura_notario ?? null,
      escritura_archivo_url: input.escritura_archivo_url ?? null,
      representante_legal_nombre: input.representante_legal_nombre ?? null,
      representante_legal_cargo: input.representante_legal_cargo ?? 'Administrador Único y Representante Legal',
      representante_legal_registro: input.representante_legal_registro ?? null,
      representante_legal_folio: input.representante_legal_folio ?? null,
      representante_legal_libro: input.representante_legal_libro ?? null,
      cliente_id: input.cliente_id ?? null,
      expediente_id: input.expediente_id ?? null,
      notas: input.notas ?? null,
      activa: true,
    })
    .select()
    .single();

  if (error) throw new EntidadError('Error al crear entidad', error);
  return data as EntidadMercantil;
}

export async function actualizarEntidad(id: string, input: Partial<EntidadMercantil>): Promise<EntidadMercantil> {
  const { id: _id, created_at: _c, ...updates } = input as any;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await db()
    .from('entidades_mercantiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EntidadError('Error al actualizar entidad', error);
  return data as EntidadMercantil;
}

// ── Documentos CRUD ────────────────────────────────────────────────────────

export async function listarDocumentos(entidadId: string) {
  const { data, error } = await db()
    .from('documentos_mercantiles')
    .select('*')
    .eq('entidad_id', entidadId)
    .order('fecha_documento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new EntidadError('Error al listar documentos', error);
  return (data ?? []) as DocumentoMercantil[];
}

export async function crearDocumento(input: Partial<DocumentoMercantil>): Promise<DocumentoMercantil> {
  const { data, error } = await db()
    .from('documentos_mercantiles')
    .insert({
      entidad_id: input.entidad_id,
      tipo: input.tipo,
      titulo: input.titulo,
      descripcion: input.descripcion ?? null,
      fecha_documento: input.fecha_documento ?? null,
      numero_acta: input.numero_acta ?? null,
      tipo_asamblea: input.tipo_asamblea ?? null,
      archivo_generado_url: input.archivo_generado_url ?? null,
      archivo_generado_nombre: input.archivo_generado_nombre ?? null,
      archivo_escaneado_url: input.archivo_escaneado_url ?? null,
      archivo_escaneado_nombre: input.archivo_escaneado_nombre ?? null,
      estado: input.estado ?? 'generado',
      registro_numero: input.registro_numero ?? null,
      registro_folio: input.registro_folio ?? null,
      registro_libro: input.registro_libro ?? null,
      fecha_inscripcion: input.fecha_inscripcion ?? null,
    })
    .select()
    .single();

  if (error) throw new EntidadError('Error al crear documento', error);
  return data as DocumentoMercantil;
}

export async function actualizarDocumento(id: string, input: Partial<DocumentoMercantil>): Promise<DocumentoMercantil> {
  const { id: _id, created_at: _c, entidad_id: _e, ...updates } = input as any;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await db()
    .from('documentos_mercantiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new EntidadError('Error al actualizar documento', error);
  return data as DocumentoMercantil;
}

// ── Búsqueda rápida (para combobox en generadores) ─────────────────────────

export async function buscarEntidades(q: string, limit = 10) {
  const v = pgrstQuote(`%${q}%`);
  const { data, error } = await db()
    .from('entidades_mercantiles')
    .select('id, nombre, nombre_corto, tipo_entidad, representante_legal_nombre, representante_legal_cargo')
    .eq('activa', true)
    .or(`nombre.ilike.${v},nombre_corto.ilike.${v},nit.ilike.${v}`)
    .order('nombre')
    .limit(limit);

  if (error) throw new EntidadError('Error al buscar entidades', error);
  return (data ?? []) as Partial<EntidadMercantil>[];
}

// ── Contar documentos por entidad (para lista) ─────────────────────────────

export async function contarDocumentosPorEntidad(entidadIds: string[]): Promise<Record<string, number>> {
  if (entidadIds.length === 0) return {};

  const { data, error } = await db()
    .from('documentos_mercantiles')
    .select('entidad_id')
    .in('entidad_id', entidadIds);

  if (error) return {};

  const counts: Record<string, number> = {};
  for (const row of (data ?? [])) {
    counts[row.entidad_id] = (counts[row.entidad_id] ?? 0) + 1;
  }
  return counts;
}

// ── Error ──────────────────────────────────────────────────────────────────

export class EntidadError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'EntidadError';
    this.details = details;
  }
}
