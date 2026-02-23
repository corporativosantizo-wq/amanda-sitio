// ============================================================================
// lib/services/expedientes.service.ts
// Lógica de negocio para expedientes judiciales/fiscales/administrativos
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Expediente, ExpedienteInsert, ExpedienteUpdate,
  ExpedienteConCliente, ActuacionProcesal, ActuacionInsert,
  PlazoProcesal, PlazoInsert, ExpedienteVinculado, VinculoInsert,
} from '@/lib/types/expedientes';

const db = () => createAdminClient();

// --- Error ---

export class ExpedienteError extends Error {
  constructor(message: string, public cause?: unknown) { super(message); }
}

// --- Tipos para listado ---

interface ListParams {
  origen?: string;
  tipo_proceso?: string;
  fase_actual?: string;
  estado?: string;
  cliente_id?: string;
  departamento?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

// --- CRUD Expedientes ---

export async function listarExpedientes(params: ListParams = {}) {
  const {
    origen, tipo_proceso, fase_actual, estado, cliente_id, departamento,
    busqueda, page = 1, limit = 25, orderBy = 'fecha_ultima_actuacion',
    orderDir = 'desc',
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('expedientes')
    .select(`
      *,
      cliente:clientes!expedientes_cliente_id_fkey(id, codigo, nombre, nit)
    `, { count: 'exact' })
    .order(orderBy, { ascending: orderDir === 'asc', nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (origen) query = query.eq('origen', origen);
  if (tipo_proceso) query = query.eq('tipo_proceso', tipo_proceso);
  if (fase_actual) query = query.eq('fase_actual', fase_actual);
  if (estado) query = query.eq('estado', estado);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (departamento) query = query.eq('departamento', departamento);
  if (busqueda) {
    query = query.or(
      `numero_expediente.ilike.%${busqueda}%,numero_mp.ilike.%${busqueda}%,numero_administrativo.ilike.%${busqueda}%,actor.ilike.%${busqueda}%,demandado.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new ExpedienteError('Error al listar expedientes', error);

  // Enrich with próximo plazo
  const expedienteIds = (data ?? []).map((e: any) => e.id);
  let plazosMap: Record<string, any> = {};

  if (expedienteIds.length > 0) {
    const { data: plazos } = await db()
      .from('plazos_procesales')
      .select('expediente_id, fecha_vencimiento, descripcion')
      .in('expediente_id', expedienteIds)
      .eq('estado', 'pendiente')
      .gte('fecha_vencimiento', new Date().toISOString().slice(0, 10))
      .order('fecha_vencimiento', { ascending: true });

    for (const p of plazos ?? []) {
      if (!plazosMap[p.expediente_id]) {
        const dias = Math.ceil(
          (new Date(p.fecha_vencimiento).getTime() - Date.now()) / 86400000
        );
        plazosMap[p.expediente_id] = {
          fecha_vencimiento: p.fecha_vencimiento,
          descripcion: p.descripcion,
          dias_restantes: dias,
        };
      }
    }
  }

  const enriched = (data ?? []).map((e: any) => ({
    ...e,
    plazo_proximo: plazosMap[e.id] ?? null,
  })) as ExpedienteConCliente[];

  return {
    data: enriched,
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerExpediente(id: string) {
  const { data, error } = await db()
    .from('expedientes')
    .select(`
      *,
      cliente:clientes!expedientes_cliente_id_fkey(id, codigo, nombre, nit, tipo, email, telefono, grupo_empresarial_id)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new ExpedienteError('Expediente no encontrado', error);

  // Fetch all related data in parallel
  const [actuacionesRes, plazosRes, vinculosOrigenRes, vinculosDestinoRes] = await Promise.all([
    db().from('actuaciones_procesales')
      .select('*')
      .eq('expediente_id', id)
      .order('fecha', { ascending: false })
      .limit(50),
    db().from('plazos_procesales')
      .select('*')
      .eq('expediente_id', id)
      .order('fecha_vencimiento', { ascending: true }),
    db().from('expedientes_vinculados')
      .select(`
        *,
        expediente_destino:expedientes!expedientes_vinculados_expediente_destino_id_fkey(id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, estado)
      `)
      .eq('expediente_origen_id', id),
    db().from('expedientes_vinculados')
      .select(`
        *,
        expediente_origen:expedientes!expedientes_vinculados_expediente_origen_id_fkey(id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, estado)
      `)
      .eq('expediente_destino_id', id),
  ]);

  // Merge vinculados from both directions
  const vinculadosOrigen = (vinculosOrigenRes.data ?? []).map((v: any) => ({
    ...v,
    expediente_vinculado: v.expediente_destino,
    direccion: 'origen' as const,
  }));
  const vinculadosDest = (vinculosDestinoRes.data ?? []).map((v: any) => ({
    ...v,
    expediente_vinculado: v.expediente_origen,
    direccion: 'destino' as const,
  }));

  return {
    expediente: data as Expediente & { cliente: any },
    actuaciones: (actuacionesRes.data ?? []) as ActuacionProcesal[],
    plazos: (plazosRes.data ?? []) as PlazoProcesal[],
    vinculados: [...vinculadosOrigen, ...vinculadosDest],
  };
}

export async function crearExpediente(input: ExpedienteInsert): Promise<Expediente> {
  const { data, error } = await db()
    .from('expedientes')
    .insert({
      numero_expediente: input.numero_expediente || null,
      numero_mp: input.numero_mp || null,
      numero_administrativo: input.numero_administrativo || null,
      cliente_id: input.cliente_id,
      origen: input.origen,
      tipo_proceso: input.tipo_proceso,
      subtipo: input.subtipo || null,
      fase_actual: input.fase_actual,
      fiscalia: input.fiscalia || null,
      agente_fiscal: input.agente_fiscal || null,
      entidad_administrativa: input.entidad_administrativa || null,
      dependencia: input.dependencia || null,
      monto_multa: input.monto_multa ?? null,
      resolucion_administrativa: input.resolucion_administrativa || null,
      instancia: input.instancia || null,
      tribunal_nombre: input.tribunal_nombre || null,
      departamento: input.departamento || null,
      actor: input.actor || null,
      demandado: input.demandado || null,
      rol_cliente: input.rol_cliente || null,
      estado: input.estado ?? 'activo',
      fecha_inicio: input.fecha_inicio,
      fecha_ultima_actuacion: input.fecha_ultima_actuacion || null,
      fecha_finalizacion: input.fecha_finalizacion || null,
      descripcion: input.descripcion || null,
      notas_internas: input.notas_internas || null,
      monto_pretension: input.monto_pretension ?? null,
      moneda: input.moneda ?? 'GTQ',
    })
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al crear expediente', error);
  return data as Expediente;
}

export async function actualizarExpediente(id: string, input: ExpedienteUpdate): Promise<Expediente> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = [
    'numero_expediente', 'numero_mp', 'numero_administrativo',
    'cliente_id', 'origen', 'tipo_proceso', 'subtipo', 'fase_actual',
    'fiscalia', 'agente_fiscal', 'entidad_administrativa', 'dependencia',
    'monto_multa', 'resolucion_administrativa', 'instancia', 'tribunal_nombre', 'departamento',
    'actor', 'demandado', 'rol_cliente', 'estado',
    'fecha_inicio', 'fecha_ultima_actuacion', 'fecha_finalizacion',
    'descripcion', 'notas_internas', 'monto_pretension', 'moneda',
  ] as const;

  for (const f of fields) {
    if (f in input) updateData[f] = (input as any)[f];
  }

  const { data, error } = await db()
    .from('expedientes')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al actualizar expediente', error);
  return data as Expediente;
}

// --- Actuaciones procesales ---

export async function listarActuaciones(expedienteId: string) {
  const { data, error } = await db()
    .from('actuaciones_procesales')
    .select('*')
    .eq('expediente_id', expedienteId)
    .order('fecha', { ascending: false });

  if (error) throw new ExpedienteError('Error al listar actuaciones', error);
  return (data ?? []) as ActuacionProcesal[];
}

export async function crearActuacion(input: ActuacionInsert): Promise<ActuacionProcesal> {
  const { data, error } = await db()
    .from('actuaciones_procesales')
    .insert(input)
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al crear actuación', error);

  // Update fecha_ultima_actuacion on the expediente
  await db()
    .from('expedientes')
    .update({ fecha_ultima_actuacion: input.fecha, updated_at: new Date().toISOString() })
    .eq('id', input.expediente_id);

  return data as ActuacionProcesal;
}

// --- Plazos procesales ---

export async function listarPlazos(expedienteId: string) {
  const { data, error } = await db()
    .from('plazos_procesales')
    .select('*')
    .eq('expediente_id', expedienteId)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw new ExpedienteError('Error al listar plazos', error);
  return (data ?? []) as PlazoProcesal[];
}

export async function crearPlazo(input: PlazoInsert): Promise<PlazoProcesal> {
  const { data, error } = await db()
    .from('plazos_procesales')
    .insert(input)
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al crear plazo', error);
  return data as PlazoProcesal;
}

export async function actualizarPlazo(id: string, estado: string): Promise<PlazoProcesal> {
  const { data, error } = await db()
    .from('plazos_procesales')
    .update({ estado })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al actualizar plazo', error);
  return data as PlazoProcesal;
}

// --- Expedientes vinculados ---

export async function crearVinculo(input: VinculoInsert): Promise<ExpedienteVinculado> {
  const { data, error } = await db()
    .from('expedientes_vinculados')
    .insert(input)
    .select()
    .single();

  if (error) throw new ExpedienteError('Error al vincular expedientes', error);
  return data as ExpedienteVinculado;
}

export async function eliminarVinculo(id: string): Promise<void> {
  const { error } = await db()
    .from('expedientes_vinculados')
    .delete()
    .eq('id', id);

  if (error) throw new ExpedienteError('Error al eliminar vínculo', error);
}

// --- Plazos próximos (para dashboard y calendario) ---

export async function plazosProximos(dias: number = 7) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('plazos_procesales')
    .select(`
      *,
      expediente:expedientes!plazos_procesales_expediente_id_fkey(
        id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso,
        cliente:clientes!expedientes_cliente_id_fkey(id, nombre)
      )
    `)
    .eq('estado', 'pendiente')
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', limite)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw new ExpedienteError('Error al obtener plazos próximos', error);
  return (data ?? []).map((p: any) => ({
    ...p,
    dias_restantes: Math.ceil(
      (new Date(p.fecha_vencimiento).getTime() - Date.now()) / 86400000
    ),
  }));
}

// --- Plazos vencidos no atendidos ---

export async function plazosVencidos() {
  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('plazos_procesales')
    .select(`
      *,
      expediente:expedientes!plazos_procesales_expediente_id_fkey(
        id, numero_expediente, numero_mp, numero_administrativo, origen,
        cliente:clientes!expedientes_cliente_id_fkey(id, nombre)
      )
    `)
    .eq('estado', 'pendiente')
    .lt('fecha_vencimiento', hoy)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw new ExpedienteError('Error al obtener plazos vencidos', error);
  return data ?? [];
}

// --- Estadísticas para dashboard ---

export async function estadisticasExpedientes() {
  const [porEstado, porOrigen, recientes] = await Promise.all([
    db().from('expedientes').select('estado', { count: 'exact', head: false })
      .in('estado', ['activo', 'suspendido']),
    db().from('expedientes').select('origen', { count: 'exact', head: false })
      .eq('estado', 'activo'),
    db().from('expedientes')
      .select('id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, fecha_ultima_actuacion, cliente:clientes!expedientes_cliente_id_fkey(id, nombre)')
      .eq('estado', 'activo')
      .order('fecha_ultima_actuacion', { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  // Count by estado
  const estadoCount: Record<string, number> = {};
  for (const row of porEstado.data ?? []) {
    estadoCount[row.estado] = (estadoCount[row.estado] ?? 0) + 1;
  }

  // Count by origen
  const origenCount: Record<string, number> = {};
  for (const row of porOrigen.data ?? []) {
    origenCount[row.origen] = (origenCount[row.origen] ?? 0) + 1;
  }

  return {
    por_estado: estadoCount,
    por_origen: origenCount,
    total_activos: (estadoCount['activo'] ?? 0),
    total_suspendidos: (estadoCount['suspendido'] ?? 0),
    recientes: recientes.data ?? [],
  };
}

// --- Expedientes por cliente (para integración) ---

export async function expedientesPorCliente(clienteId: string) {
  const { data, error } = await db()
    .from('expedientes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_ultima_actuacion', { ascending: false, nullsFirst: false });

  if (error) throw new ExpedienteError('Error al listar expedientes del cliente', error);
  return (data ?? []) as Expediente[];
}

// --- Expedientes por grupo empresarial ---

export async function expedientesPorGrupo(grupoId: string) {
  // Get all clientes in the group
  const { data: clientes } = await db()
    .from('clientes')
    .select('id')
    .eq('grupo_empresarial_id', grupoId);

  if (!clientes || clientes.length === 0) return [];

  const clienteIds = clientes.map((c: any) => c.id);

  const { data, error } = await db()
    .from('expedientes')
    .select(`
      *,
      cliente:clientes!expedientes_cliente_id_fkey(id, codigo, nombre)
    `)
    .in('cliente_id', clienteIds)
    .order('fecha_ultima_actuacion', { ascending: false, nullsFirst: false });

  if (error) throw new ExpedienteError('Error al listar expedientes del grupo', error);
  return data ?? [];
}

// --- Audiencias para calendario ---

export async function actuacionesCalendario(fechaInicio: string, fechaFin: string) {
  const { data, error } = await db()
    .from('actuaciones_procesales')
    .select(`
      *,
      expediente:expedientes!actuaciones_procesales_expediente_id_fkey(
        id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso,
        instancia, tribunal_nombre, fiscalia, entidad_administrativa,
        cliente:clientes!expedientes_cliente_id_fkey(id, nombre)
      )
    `)
    .in('tipo', ['audiencia', 'diligencia'])
    .gte('fecha', fechaInicio)
    .lte('fecha', fechaFin)
    .order('fecha', { ascending: true });

  if (error) throw new ExpedienteError('Error al obtener audiencias', error);
  return data ?? [];
}
