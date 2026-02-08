// ============================================================================
// lib/services/tareas.service.ts
// CRUD y lógica de negocio para Task Tracker / Bullet Journal
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Tarea, TareaConCliente, TareaInsert } from '@/lib/types';
import { EstadoTarea } from '@/lib/types';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  estado?: string;
  prioridad?: string;
  categoria?: string;
  asignado_a?: string;
  cliente_id?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

// --- CRUD ---

export async function listarTareas(params: ListParams = {}) {
  const {
    estado, prioridad, categoria, asignado_a, cliente_id,
    fecha_desde, fecha_hasta, busqueda,
    page = 1, limit = 50,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('tareas')
    .select(`
      *,
      cliente:clientes!cliente_id (id, nombre)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) query = query.eq('estado', estado);
  if (prioridad) query = query.eq('prioridad', prioridad);
  if (categoria) query = query.eq('categoria', categoria);
  if (asignado_a) query = query.eq('asignado_a', asignado_a);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (fecha_desde) query = query.gte('fecha_limite', fecha_desde);
  if (fecha_hasta) query = query.lte('fecha_limite', fecha_hasta);
  if (busqueda) {
    query = query.or(`titulo.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%,notas.ilike.%${busqueda}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new TareaError('Error al listar tareas', error);

  return {
    data: (data ?? []) as TareaConCliente[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerTarea(id: string): Promise<TareaConCliente> {
  const { data, error } = await db()
    .from('tareas')
    .select(`
      *,
      cliente:clientes!cliente_id (id, nombre)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new TareaError('Tarea no encontrada', error);
  return data as unknown as TareaConCliente;
}

export async function crearTarea(input: TareaInsert): Promise<Tarea> {
  if (!input.titulo?.trim()) {
    throw new TareaError('El título es obligatorio');
  }

  const { data, error } = await db()
    .from('tareas')
    .insert({
      titulo: input.titulo.trim(),
      descripcion: input.descripcion ?? null,
      tipo: input.tipo ?? 'tarea',
      estado: input.estado ?? EstadoTarea.PENDIENTE,
      prioridad: input.prioridad ?? 'media',
      fecha_limite: input.fecha_limite ?? null,
      cliente_id: input.cliente_id ?? null,
      expediente_id: input.expediente_id ?? null,
      asignado_a: input.asignado_a ?? 'amanda',
      categoria: input.categoria ?? 'tramites',
      recurrente: input.recurrente ?? false,
      recurrencia_tipo: input.recurrencia_tipo ?? null,
      notas: input.notas ?? null,
    })
    .select()
    .single();

  if (error) throw new TareaError('Error al crear tarea', error);
  return data as Tarea;
}

export async function actualizarTarea(id: string, updates: Partial<TareaInsert> & { estado?: string }): Promise<Tarea> {
  const payload: any = { ...updates };

  // Auto-set fecha_completada
  if (updates.estado === EstadoTarea.COMPLETADA) {
    payload.fecha_completada = new Date().toISOString();
  } else if (updates.estado) {
    payload.fecha_completada = null;
  }

  const { data, error } = await db()
    .from('tareas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new TareaError('Error al actualizar tarea', error);
  return data as Tarea;
}

export async function eliminarTarea(id: string): Promise<void> {
  const { error } = await db()
    .from('tareas')
    .delete()
    .eq('id', id);

  if (error) throw new TareaError('Error al eliminar tarea', error);
}

export async function completarTarea(id: string): Promise<Tarea> {
  return actualizarTarea(id, { estado: EstadoTarea.COMPLETADA });
}

export async function migrarTarea(id: string, nuevaFecha: string): Promise<Tarea> {
  return actualizarTarea(id, {
    estado: EstadoTarea.PENDIENTE,
    fecha_limite: nuevaFecha,
  });
}

// --- Resumen para dashboard ---

export async function resumenTareas() {
  const hoy = new Date().toISOString().split('T')[0];

  const [pendientes, enProgreso, completadasHoy, vencidas] = await Promise.all([
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente'),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'en_progreso'),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'completada')
      .gte('fecha_completada', `${hoy}T00:00:00`),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .lt('fecha_limite', hoy),
  ]);

  return {
    pendientes: pendientes.count ?? 0,
    en_progreso: enProgreso.count ?? 0,
    completadas_hoy: completadasHoy.count ?? 0,
    vencidas: vencidas.count ?? 0,
  };
}

// --- Error ---

export class TareaError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'TareaError';
    this.details = details;
  }
}
