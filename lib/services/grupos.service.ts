// ============================================================================
// lib/services/grupos.service.ts
// Logica de negocio para grupos empresariales
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { GrupoEmpresarial } from '@/lib/types';

const db = () => createAdminClient();

/**
 * Crea un grupo empresarial y asigna empresas.
 */
export async function crearGrupo(nombre: string, empresaIds: string[]): Promise<GrupoEmpresarial> {
  const { data, error } = await db()
    .from('grupos_empresariales')
    .insert({ nombre: nombre.trim() })
    .select()
    .single();

  if (error) throw new GrupoError('Error al crear grupo', error);

  if (empresaIds.length > 0) {
    const { error: updateError } = await db()
      .from('clientes')
      .update({ grupo_empresarial_id: data.id })
      .in('id', empresaIds);

    if (updateError) throw new GrupoError('Error al asignar empresas al grupo', updateError);
  }

  return data as GrupoEmpresarial;
}

/**
 * Agrega una empresa a un grupo existente.
 */
export async function agregarEmpresaAGrupo(grupoId: string, empresaId: string) {
  const { error } = await db()
    .from('clientes')
    .update({ grupo_empresarial_id: grupoId })
    .eq('id', empresaId);

  if (error) throw new GrupoError('Error al agregar empresa al grupo', error);
}

/**
 * Remueve una empresa de su grupo.
 */
export async function removerEmpresaDeGrupo(empresaId: string) {
  const { error } = await db()
    .from('clientes')
    .update({ grupo_empresarial_id: null })
    .eq('id', empresaId);

  if (error) throw new GrupoError('Error al remover empresa del grupo', error);
}

/**
 * Obtiene un grupo con sus empresas.
 */
export async function obtenerGrupo(grupoId: string): Promise<GrupoEmpresarial & { empresas: any[] }> {
  const { data, error } = await db()
    .from('grupos_empresariales')
    .select('*')
    .eq('id', grupoId)
    .single();

  if (error || !data) throw new GrupoError('Grupo no encontrado', error);

  const { data: empresas } = await db()
    .from('clientes')
    .select('id, codigo, nombre')
    .eq('grupo_empresarial_id', grupoId)
    .eq('activo', true)
    .order('nombre');

  return { ...data, empresas: empresas ?? [] } as GrupoEmpresarial & { empresas: any[] };
}

/**
 * Lista todos los grupos con conteo de empresas.
 */
export async function listarGrupos() {
  const { data, error } = await db()
    .from('grupos_empresariales')
    .select('*')
    .order('nombre');

  if (error) throw new GrupoError('Error al listar grupos', error);

  // Obtener conteo de empresas por grupo
  const grupos = await Promise.all(
    (data ?? []).map(async (g: any) => {
      const { count } = await db()
        .from('clientes')
        .select('id', { count: 'exact', head: true })
        .eq('grupo_empresarial_id', g.id)
        .eq('activo', true);

      return { ...g, num_empresas: count ?? 0 };
    })
  );

  return grupos;
}

// --- Error ---

export class GrupoError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'GrupoError';
    this.details = details;
  }
}
