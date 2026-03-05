// ============================================================================
// lib/services/proveedores.service.ts
// Lógica de negocio para proveedores
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Proveedor, ProveedorInsert, TipoProveedor } from '@/lib/types';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  tipo?: TipoProveedor;
  activo?: boolean;
  page?: number;
  limit?: number;
  busqueda?: string;
}

// --- CRUD ---

export async function listarProveedores(params: ListParams = {}) {
  const {
    tipo, activo, page = 1, limit = 20, busqueda,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('proveedores')
    .select('*', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq('tipo', tipo);
  if (activo !== undefined) query = query.eq('activo', activo);
  if (busqueda) {
    query = query.or(
      `nombre.ilike.%${busqueda}%,nit.ilike.%${busqueda}%,email.ilike.%${busqueda}%,especialidad.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new ProveedorError('Error al listar proveedores', error);

  return {
    data: (data ?? []) as Proveedor[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerProveedor(id: string): Promise<Proveedor> {
  const { data, error } = await db()
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new ProveedorError('Proveedor no encontrado', error);
  return data as Proveedor;
}

export async function crearProveedor(input: ProveedorInsert): Promise<Proveedor> {
  // El código PROV-XXXX se genera automáticamente vía trigger auto_codigo_proveedor
  const { data, error } = await db()
    .from('proveedores')
    .insert({
      nombre: input.nombre,
      tipo: input.tipo ?? 'freelance',
      especialidad: input.especialidad ?? null,
      nit: input.nit ?? null,
      dpi: input.dpi ?? null,
      telefono: input.telefono ?? null,
      email: input.email ?? null,
      direccion: input.direccion ?? null,
      banco: input.banco ?? null,
      tipo_cuenta: input.tipo_cuenta ?? null,
      numero_cuenta: input.numero_cuenta ?? null,
      cuenta_nombre: input.cuenta_nombre ?? null,
      tarifa_hora: input.tarifa_hora ?? null,
      notas: input.notas ?? null,
      activo: true,
    })
    .select()
    .single();

  if (error) {
    console.error('INSERT ERROR:', error.message ?? error.code);
    throw new ProveedorError('Error al crear proveedor', error);
  }
  return data as Proveedor;
}

export async function actualizarProveedor(
  id: string,
  input: Partial<ProveedorInsert>
): Promise<Proveedor> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const fields: (keyof ProveedorInsert)[] = [
    'nombre', 'tipo', 'especialidad', 'nit', 'dpi',
    'telefono', 'email', 'direccion',
    'banco', 'tipo_cuenta', 'numero_cuenta', 'cuenta_nombre', 'tarifa_hora',
    'notas', 'activo',
  ];

  for (const key of fields) {
    if (input[key] !== undefined) updates[key] = input[key];
  }

  const { data, error } = await db()
    .from('proveedores')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ProveedorError('Error al actualizar proveedor', error);
  return data as Proveedor;
}

export async function desactivarProveedor(id: string): Promise<void> {
  const { error } = await db()
    .from('proveedores')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new ProveedorError('Error al desactivar proveedor', error);
}

// --- Error ---

export class ProveedorError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ProveedorError';
    this.details = details;
  }
}
