// ============================================================================
// lib/services/laboral.service.ts
// Lógica de negocio para Cumplimiento Laboral
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  TramiteLaboral,
  TramiteLaboralConCliente,
  TramiteLaboralInsert,
  TramiteLaboralUpdate,
  HistorialLaboral,
  HistorialLaboralInsert,
} from '@/lib/types/laboral';

const db = () => createAdminClient();

// --- Error ---

export class LaboralError extends Error {
  constructor(message: string, public cause?: unknown) { super(message); }
}

// --- Tipos para listado ---

interface ListParams {
  categoria?: string;
  estado?: string;
  cliente_id?: string;
  busqueda?: string;
  fecha_fin_desde?: string;
  fecha_fin_hasta?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

// --- CRUD Trámites Laborales ---

export async function listarTramitesLaborales(params: ListParams = {}) {
  const {
    categoria, estado, cliente_id, busqueda,
    fecha_fin_desde, fecha_fin_hasta,
    page = 1, limit = 25, orderBy = 'updated_at', orderDir = 'desc',
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('tramites_laborales')
    .select(`
      *,
      cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre, nit)
    `, { count: 'exact' })
    .order(orderBy, { ascending: orderDir === 'asc', nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (categoria) query = query.eq('categoria', categoria);
  if (estado) query = query.eq('estado', estado);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (fecha_fin_desde) query = query.gte('fecha_fin', fecha_fin_desde);
  if (fecha_fin_hasta) query = query.lte('fecha_fin', fecha_fin_hasta);
  if (busqueda) {
    query = query.or(
      `nombre_empleado.ilike.%${busqueda}%,puesto.ilike.%${busqueda}%,numero_registro_igt.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new LaboralError('Error al listar trámites laborales', error);

  return {
    data: (data ?? []) as TramiteLaboralConCliente[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerTramiteLaboral(id: string) {
  const { data, error } = await db()
    .from('tramites_laborales')
    .select(`
      *,
      cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre, nit)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new LaboralError('Trámite laboral no encontrado', error);

  // Fetch historial
  const { data: historial, error: hError } = await db()
    .from('historial_tramite_laboral')
    .select('*')
    .eq('tramite_id', id)
    .order('fecha', { ascending: false });

  if (hError) throw new LaboralError('Error al obtener historial', hError);

  return {
    tramite: data as TramiteLaboralConCliente,
    historial: (historial ?? []) as HistorialLaboral[],
  };
}

export async function crearTramiteLaboral(input: TramiteLaboralInsert): Promise<TramiteLaboral> {
  const { data, error } = await db()
    .from('tramites_laborales')
    .insert({
      cliente_id: input.cliente_id,
      categoria: input.categoria,
      estado: input.estado ?? 'pendiente',
      nombre_empleado: input.nombre_empleado || null,
      puesto: input.puesto || null,
      fecha_inicio: input.fecha_inicio || null,
      fecha_fin: input.fecha_fin || null,
      fecha_registro_igt: input.fecha_registro_igt || null,
      numero_registro_igt: input.numero_registro_igt || null,
      salario: input.salario ?? null,
      moneda: input.moneda ?? 'GTQ',
      es_temporal: input.es_temporal ?? false,
      duracion_meses: input.duracion_meses ?? null,
      alerta_dias_antes: input.alerta_dias_antes ?? 30,
      descripcion: input.descripcion || null,
      notas: input.notas || null,
      documento_url: input.documento_url || null,
    })
    .select()
    .single();

  if (error) throw new LaboralError('Error al crear trámite laboral', error);
  return data as TramiteLaboral;
}

export async function actualizarTramiteLaboral(id: string, input: TramiteLaboralUpdate): Promise<TramiteLaboral> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = [
    'cliente_id', 'categoria', 'estado', 'nombre_empleado', 'puesto',
    'fecha_inicio', 'fecha_fin', 'fecha_registro_igt', 'numero_registro_igt',
    'salario', 'moneda', 'es_temporal', 'duracion_meses', 'alerta_dias_antes',
    'descripcion', 'notas', 'documento_url',
  ] as const;

  for (const f of fields) {
    if (f in input) updateData[f] = (input as any)[f];
  }

  const { data, error } = await db()
    .from('tramites_laborales')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new LaboralError('Error al actualizar trámite laboral', error);
  return data as TramiteLaboral;
}

export async function eliminarTramiteLaboral(id: string): Promise<void> {
  const { error } = await db()
    .from('tramites_laborales')
    .delete()
    .eq('id', id);

  if (error) throw new LaboralError('Error al eliminar trámite laboral', error);
}

// --- Historial ---

export async function crearHistorialLaboral(input: HistorialLaboralInsert): Promise<HistorialLaboral> {
  const { data, error } = await db()
    .from('historial_tramite_laboral')
    .insert(input)
    .select()
    .single();

  if (error) throw new LaboralError('Error al crear registro de historial', error);
  return data as HistorialLaboral;
}

// --- Trámites por cliente ---

export async function tramitesLaboralesPorCliente(clienteId: string) {
  const { data, error } = await db()
    .from('tramites_laborales')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('updated_at', { ascending: false });

  if (error) throw new LaboralError('Error al listar trámites del cliente', error);
  return (data ?? []) as TramiteLaboral[];
}

// --- Contratos próximos a vencer ---

export async function tramitesLaboralesPorVencer(dias: number = 30) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('tramites_laborales')
    .select(`
      *,
      cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre)
    `)
    .in('estado', ['vigente', 'registrado', 'firmado'])
    .not('fecha_fin', 'is', null)
    .gte('fecha_fin', hoy)
    .lte('fecha_fin', limite)
    .order('fecha_fin', { ascending: true });

  if (error) throw new LaboralError('Error al obtener trámites por vencer', error);
  return (data ?? []).map((t: any) => ({
    ...t,
    dias_restantes: Math.ceil(
      (new Date(t.fecha_fin).getTime() - Date.now()) / 86400000
    ),
  }));
}

// --- Trámites vencidos ---

export async function tramitesLaboralesVencidos() {
  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('tramites_laborales')
    .select(`
      *,
      cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre)
    `)
    .not('fecha_fin', 'is', null)
    .lt('fecha_fin', hoy)
    .in('estado', ['vigente', 'registrado', 'firmado'])
    .order('fecha_fin', { ascending: true });

  if (error) throw new LaboralError('Error al obtener trámites vencidos', error);
  return data ?? [];
}

// --- Estadísticas para dashboard ---

export async function estadisticasLaborales() {
  const [porEstado, porCategoria, total] = await Promise.all([
    db().from('tramites_laborales').select('estado'),
    db().from('tramites_laborales').select('categoria'),
    db().from('tramites_laborales').select('id', { count: 'exact', head: true }),
  ]);

  const estadoCount: Record<string, number> = {};
  for (const row of porEstado.data ?? []) {
    estadoCount[row.estado] = (estadoCount[row.estado] ?? 0) + 1;
  }

  const categoriaCount: Record<string, number> = {};
  for (const row of porCategoria.data ?? []) {
    categoriaCount[row.categoria] = (categoriaCount[row.categoria] ?? 0) + 1;
  }

  // Count próximos a vencer (30 días)
  const hoy = new Date().toISOString().slice(0, 10);
  const limite30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const { count: porVencer } = await db()
    .from('tramites_laborales')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['vigente', 'registrado', 'firmado'])
    .not('fecha_fin', 'is', null)
    .gte('fecha_fin', hoy)
    .lte('fecha_fin', limite30);

  // Count vencidos
  const { count: vencidos } = await db()
    .from('tramites_laborales')
    .select('id', { count: 'exact', head: true })
    .not('fecha_fin', 'is', null)
    .lt('fecha_fin', hoy)
    .in('estado', ['vigente', 'registrado', 'firmado']);

  return {
    total: total.count ?? 0,
    por_estado: estadoCount,
    por_categoria: categoriaCount,
    por_vencer: porVencer ?? 0,
    vencidos: vencidos ?? 0,
  };
}
