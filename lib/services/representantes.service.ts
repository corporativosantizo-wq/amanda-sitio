// ============================================================================
// lib/services/representantes.service.ts
// Logica de negocio para representantes legales
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { RepresentanteLegal, RepresentanteInput, CargoRepresentante } from '@/lib/types';

const db = () => createAdminClient();

/**
 * Busca representantes por nombre (para autocomplete).
 * Retorna representantes con sus empresas vinculadas.
 */
export async function buscarRepresentantes(query: string, limit = 10) {
  const term = query.trim();
  if (!term || term.length < 2) return [];

  const { data, error } = await db()
    .from('representantes_legales')
    .select('id, nombre_completo, email, telefono')
    .ilike('nombre_completo', `%${term}%`)
    .limit(limit);

  if (error) throw new RepresentanteError('Error al buscar representantes', error);

  // Para cada representante, obtener sus empresas vinculadas
  const results = await Promise.all(
    (data ?? []).map(async (rep: any) => {
      const { data: vinculos } = await db()
        .from('empresa_representante')
        .select('cargo, empresa_id')
        .eq('representante_id', rep.id);

      let empresas: { id: string; codigo: string; nombre: string; cargo: CargoRepresentante }[] = [];
      if (vinculos && vinculos.length > 0) {
        const empresaIds = vinculos.map((v: any) => v.empresa_id);
        const { data: empresasData } = await db()
          .from('clientes')
          .select('id, codigo, nombre')
          .in('id', empresaIds)
          .eq('activo', true);

        empresas = (empresasData ?? []).map((e: any) => {
          const vinculo = vinculos.find((v: any) => v.empresa_id === e.id);
          return { id: e.id, codigo: e.codigo, nombre: e.nombre, cargo: vinculo.cargo };
        });
      }

      return { ...rep, empresas };
    })
  );

  return results;
}

/**
 * Obtiene representantes de una empresa con sus otras vinculaciones.
 */
export async function obtenerRepresentantesEmpresa(empresaId: string) {
  const { data: vinculos, error } = await db()
    .from('empresa_representante')
    .select('id, cargo, representante_id')
    .eq('empresa_id', empresaId);

  if (error) throw new RepresentanteError('Error al obtener representantes', error);
  if (!vinculos || vinculos.length === 0) return [];

  const repIds = vinculos.map((v: any) => v.representante_id);
  const { data: reps } = await db()
    .from('representantes_legales')
    .select('id, nombre_completo, email, telefono')
    .in('id', repIds);

  return await Promise.all(
    vinculos.map(async (v: any) => {
      const representante = (reps ?? []).find((r: any) => r.id === v.representante_id);

      // Obtener otras empresas donde este representante aparece
      const { data: otrosVinculos } = await db()
        .from('empresa_representante')
        .select('cargo, empresa_id')
        .eq('representante_id', v.representante_id)
        .neq('empresa_id', empresaId);

      let otras_empresas: { id: string; codigo: string; nombre: string; cargo: CargoRepresentante }[] = [];
      if (otrosVinculos && otrosVinculos.length > 0) {
        const otraIds = otrosVinculos.map((ov: any) => ov.empresa_id);
        const { data: otrasData } = await db()
          .from('clientes')
          .select('id, codigo, nombre')
          .in('id', otraIds)
          .eq('activo', true);

        otras_empresas = (otrasData ?? []).map((e: any) => {
          const ov = otrosVinculos.find((x: any) => x.empresa_id === e.id);
          return { id: e.id, codigo: e.codigo, nombre: e.nombre, cargo: ov.cargo };
        });
      }

      return { cargo: v.cargo as CargoRepresentante, representante, otras_empresas };
    })
  );
}

/**
 * Crea o busca un representante por nombre exacto (case-insensitive).
 * Si existe, actualiza email si se proporciona uno nuevo.
 */
export async function crearOBuscarRepresentante(
  nombre: string,
  email?: string | null
): Promise<RepresentanteLegal> {
  const { data: existente } = await db()
    .from('representantes_legales')
    .select('*')
    .ilike('nombre_completo', nombre.trim())
    .limit(1)
    .maybeSingle();

  if (existente) {
    // Actualizar email si se proporciona uno nuevo y el existente no tiene
    if (email && !existente.email) {
      await db()
        .from('representantes_legales')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', existente.id);
      return { ...existente, email } as RepresentanteLegal;
    }
    return existente as RepresentanteLegal;
  }

  const { data, error } = await db()
    .from('representantes_legales')
    .insert({ nombre_completo: nombre.trim(), email: email ?? null })
    .select()
    .single();

  if (error) throw new RepresentanteError('Error al crear representante', error);
  return data as RepresentanteLegal;
}

/**
 * Sincroniza representantes de una empresa.
 * Borra asociaciones existentes y crea nuevas.
 */
export async function sincronizarRepresentantes(
  empresaId: string,
  representantes: RepresentanteInput[]
) {
  // 1. Para cada input, crear o buscar representante
  const repsCreados = await Promise.all(
    representantes.map(async (input) => {
      const rep = input.representante_id
        ? await (async () => {
            const { data } = await db()
              .from('representantes_legales')
              .select('*')
              .eq('id', input.representante_id)
              .single();
            return data as RepresentanteLegal;
          })()
        : await crearOBuscarRepresentante(input.nombre_completo, input.email);
      return { rep, cargo: input.cargo };
    })
  );

  // 2. Borrar asociaciones existentes de la empresa
  await db()
    .from('empresa_representante')
    .delete()
    .eq('empresa_id', empresaId);

  // 3. Crear nuevas asociaciones
  const inserts = repsCreados
    .filter((r) => r.rep)
    .map((r) => ({
      empresa_id: empresaId,
      representante_id: r.rep.id,
      cargo: r.cargo,
    }));

  if (inserts.length > 0) {
    const { error } = await db()
      .from('empresa_representante')
      .insert(inserts);

    if (error) throw new RepresentanteError('Error al sincronizar representantes', error);
  }

  return inserts;
}

/**
 * Obtiene empresas que comparten un representante.
 */
export async function obtenerEmpresasRepresentante(
  representanteId: string,
  excluirEmpresaId?: string
) {
  let query = db()
    .from('empresa_representante')
    .select('cargo, empresa_id')
    .eq('representante_id', representanteId);

  if (excluirEmpresaId) query = query.neq('empresa_id', excluirEmpresaId);

  const { data: vinculos, error } = await query;
  if (error) throw new RepresentanteError('Error al obtener empresas', error);
  if (!vinculos || vinculos.length === 0) return [];

  const empresaIds = vinculos.map((v: any) => v.empresa_id);
  const { data: empresas } = await db()
    .from('clientes')
    .select('id, codigo, nombre')
    .in('id', empresaIds)
    .eq('activo', true);

  return (empresas ?? []).map((e: any) => {
    const vinculo = vinculos.find((v: any) => v.empresa_id === e.id);
    return { id: e.id, codigo: e.codigo, nombre: e.nombre, cargo: vinculo.cargo as CargoRepresentante };
  });
}

// --- Error ---

export class RepresentanteError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'RepresentanteError';
    this.details = details;
  }
}
