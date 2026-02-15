// ============================================================================
// lib/services/clientes.service.ts
// Lógica de negocio para clientes
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Cliente, ClienteInsert } from '@/lib/types';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  tipo?: 'persona' | 'empresa';
  activo?: boolean;
  page?: number;
  limit?: number;
  busqueda?: string;  // nombre, nit, email, codigo
}

// --- CRUD ---

/**
 * Lista clientes con filtros, búsqueda y paginación.
 */
export async function listarClientes(params: ListParams = {}) {
  const {
    tipo, activo, page = 1, limit = 20, busqueda,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('clientes')
    .select('*', { count: 'exact' })
    .order('nombre', { ascending: true })
    .range(offset, offset + limit - 1);

  if (tipo) query = query.eq('tipo', tipo);
  if (activo !== undefined) query = query.eq('activo', activo);
  if (busqueda) {
    query = query.or(
      `nombre.ilike.%${busqueda}%,nit.ilike.%${busqueda}%,email.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new ClienteError('Error al listar clientes', error);

  return {
    data: (data ?? []) as Cliente[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene un cliente por ID con estadísticas básicas.
 */
export async function obtenerCliente(id: string): Promise<ClienteConStats> {
  const { data, error } = await db()
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) throw new ClienteError('Cliente no encontrado', error);

  // Stats: cotizaciones, facturas, pagos
  const [cotCount, facCount, pagosSum] = await Promise.all([
    db().from('cotizaciones').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
    db().from('facturas').select('id', { count: 'exact', head: true }).eq('cliente_id', id),
    db().from('pagos').select('monto').eq('cliente_id', id).eq('estado', 'confirmado'),
  ]);

  return {
    ...(data as Cliente),
    stats: {
      cotizaciones: cotCount.count ?? 0,
      facturas: facCount.count ?? 0,
      total_pagado: (pagosSum.data ?? []).reduce((s: number, p: any) => s + (p.monto ?? 0), 0),
    },
  };
}

/**
 * Crea un nuevo cliente. Auto-genera código.
 */
export async function crearCliente(input: ClienteInsert): Promise<Cliente> {
  // Generar código
  const { data: numData, error: numError } = await db()
    // @ts-ignore
    .schema('public').rpc('next_sequence', { p_tipo: 'CLI' });
  if (numError) { console.error('RPC ERROR:', numError.message ?? numError.code); throw new ClienteError('Error al generar código', numError); }
  const codigo = numData as string;

  // Validar NIT único si no es CF
  if (input.nit && input.nit !== 'CF') {
    const { data: existente } = await db()
      .from('clientes')
      .select('id')
      .eq('nit', input.nit)
      .maybeSingle();

    if (existente) {
      throw new ClienteError(`Ya existe un cliente con NIT ${input.nit}`);
    }
  }

  const { data, error } = await db()
    .from('clientes')
    .insert({
      codigo,
      tipo: input.tipo ?? 'persona',
      nombre: input.nombre,
      nit: input.nit ?? 'CF',
      dpi: input.dpi ?? null,
      email: input.email ?? null,
      telefono: input.telefono ?? null,
      direccion: input.direccion ?? null,
      razon_social_facturacion: input.razon_social_facturacion ?? input.nombre,
      nit_facturacion: input.nit_facturacion ?? input.nit ?? 'CF',
      direccion_facturacion: input.direccion_facturacion ?? input.direccion ?? 'Ciudad',
      notas: input.notas ?? null,
      activo: true,
    })
    .select()
    .single();

  if (error) { console.error('INSERT ERROR:', error.message ?? error.code); throw new ClienteError('Error al crear cliente', error); }
  return data as Cliente;
}

/**
 * Actualiza un cliente existente.
 */
export async function actualizarCliente(
  id: string,
  input: Partial<ClienteInsert>
): Promise<Cliente> {
  // Validar NIT único si cambia
  if (input.nit && input.nit !== 'CF') {
    const { data: existente } = await db()
      .from('clientes')
      .select('id')
      .eq('nit', input.nit)
      .neq('id', id)
      .maybeSingle();

    if (existente) {
      throw new ClienteError(`Ya existe otro cliente con NIT ${input.nit}`);
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.tipo !== undefined) updates.tipo = input.tipo;
  if (input.nombre !== undefined) updates.nombre = input.nombre;
  if (input.nit !== undefined) updates.nit = input.nit;
  if (input.dpi !== undefined) updates.dpi = input.dpi;
  if (input.email !== undefined) updates.email = input.email;
  if (input.telefono !== undefined) updates.telefono = input.telefono;
  if (input.direccion !== undefined) updates.direccion = input.direccion;
  if (input.razon_social_facturacion !== undefined) updates.razon_social_facturacion = input.razon_social_facturacion;
  if (input.nit_facturacion !== undefined) updates.nit_facturacion = input.nit_facturacion;
  if (input.direccion_facturacion !== undefined) updates.direccion_facturacion = input.direccion_facturacion;
  if (input.grupo_empresarial_id !== undefined) updates.grupo_empresarial_id = input.grupo_empresarial_id;
  if (input.notas !== undefined) updates.notas = input.notas;
  if (input.activo !== undefined) updates.activo = input.activo;

  const { data, error } = await db()
    .from('clientes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ClienteError('Error al actualizar cliente', error);
  return data as Cliente;
}

/**
 * Desactiva un cliente (soft delete).
 */
export async function desactivarCliente(id: string): Promise<void> {
  const { error } = await db()
    .from('clientes')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new ClienteError('Error al desactivar cliente', error);
}

/**
 * Resumen para dashboard.
 */
export async function resumenClientes() {
  const { count: total } = await db()
    .from('clientes')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true);

  const { count: empresas } = await db()
    .from('clientes')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true)
    .eq('tipo', 'empresa');

  const { count: nuevos } = await db()
    .from('clientes')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString());

  return {
    total_activos: total ?? 0,
    empresas: empresas ?? 0,
    individuales: (total ?? 0) - (empresas ?? 0),
    nuevos_mes: nuevos ?? 0,
  };
}

// --- Tipos extendidos ---

interface ClienteConStats extends Cliente {
  stats: {
    cotizaciones: number;
    facturas: number;
    total_pagado: number;
  };
}

// --- Error ---

export class ClienteError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ClienteError';
    this.details = details;
  }
}
