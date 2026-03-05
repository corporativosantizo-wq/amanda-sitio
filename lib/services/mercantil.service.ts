// ============================================================================
// lib/services/mercantil.service.ts
// Lógica de negocio para Cumplimiento Mercantil (Registro Mercantil)
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  TramiteMercantil,
  TramiteMercantilConCliente,
  TramiteMercantilInsert,
  TramiteMercantilUpdate,
  HistorialMercantil,
  HistorialMercantilInsert,
} from '@/lib/types/mercantil';

const db = () => createAdminClient();

// --- Error ---

export class MercantilError extends Error {
  constructor(message: string, public cause?: unknown) { super(message); }
}

// --- Tipos para listado ---

interface ListParams {
  categoria?: string;
  estado?: string;
  cliente_id?: string;
  busqueda?: string;
  vencimiento_desde?: string;
  vencimiento_hasta?: string;
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

// --- CRUD Trámites Mercantiles ---

export async function listarTramitesMercantiles(params: ListParams = {}) {
  const {
    categoria, estado, cliente_id, busqueda,
    vencimiento_desde, vencimiento_hasta,
    page = 1, limit = 25, orderBy = 'updated_at', orderDir = 'desc',
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('tramites_mercantiles')
    .select(`
      *,
      cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre, nit)
    `, { count: 'exact' })
    .order(orderBy, { ascending: orderDir === 'asc', nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (categoria) query = query.eq('categoria', categoria);
  if (estado) query = query.eq('estado', estado);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (vencimiento_desde) query = query.gte('fecha_vencimiento', vencimiento_desde);
  if (vencimiento_hasta) query = query.lte('fecha_vencimiento', vencimiento_hasta);
  if (busqueda) {
    query = query.or(
      `numero_registro.ilike.%${busqueda}%,numero_expediente_rm.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%,notario_responsable.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new MercantilError('Error al listar trámites mercantiles', error);

  return {
    data: (data ?? []) as TramiteMercantilConCliente[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerTramiteMercantil(id: string) {
  const { data, error } = await db()
    .from('tramites_mercantiles')
    .select(`
      *,
      cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre, nit)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new MercantilError('Trámite mercantil no encontrado', error);

  // Fetch historial
  const { data: historial, error: hError } = await db()
    .from('historial_tramite_mercantil')
    .select('*')
    .eq('tramite_id', id)
    .order('fecha', { ascending: false });

  if (hError) throw new MercantilError('Error al obtener historial', hError);

  return {
    tramite: data as TramiteMercantilConCliente,
    historial: (historial ?? []) as HistorialMercantil[],
  };
}

export async function crearTramiteMercantil(input: TramiteMercantilInsert): Promise<TramiteMercantil> {
  const { data, error } = await db()
    .from('tramites_mercantiles')
    .insert({
      cliente_id: input.cliente_id,
      categoria: input.categoria,
      subtipo: input.subtipo || null,
      estado: input.estado ?? 'pendiente',
      numero_registro: input.numero_registro || null,
      fecha_tramite: input.fecha_tramite,
      fecha_inscripcion: input.fecha_inscripcion || null,
      fecha_vencimiento: input.fecha_vencimiento || null,
      es_recurrente: input.es_recurrente ?? false,
      periodicidad_meses: input.periodicidad_meses ?? null,
      alerta_dias_antes: input.alerta_dias_antes ?? 30,
      numero_expediente_rm: input.numero_expediente_rm || null,
      notario_responsable: input.notario_responsable || null,
      descripcion: input.descripcion || null,
      notas: input.notas || null,
      documento_url: input.documento_url || null,
      archivo_pdf_url: input.archivo_pdf_url || null,
      archivo_pdf_nombre: input.archivo_pdf_nombre || null,
      archivo_docx_url: input.archivo_docx_url || null,
      archivo_docx_nombre: input.archivo_docx_nombre || null,
    })
    .select()
    .single();

  if (error) throw new MercantilError('Error al crear trámite mercantil', error);
  return data as TramiteMercantil;
}

export async function actualizarTramiteMercantil(id: string, input: TramiteMercantilUpdate): Promise<TramiteMercantil> {
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  const fields = [
    'cliente_id', 'categoria', 'subtipo', 'estado', 'numero_registro',
    'fecha_tramite', 'fecha_inscripcion', 'fecha_vencimiento',
    'es_recurrente', 'periodicidad_meses', 'alerta_dias_antes',
    'numero_expediente_rm', 'notario_responsable',
    'descripcion', 'notas', 'documento_url',
    'archivo_pdf_url', 'archivo_pdf_nombre', 'archivo_docx_url', 'archivo_docx_nombre',
  ] as const;

  for (const f of fields) {
    if (f in input) updateData[f] = (input as any)[f];
  }

  const { data, error } = await db()
    .from('tramites_mercantiles')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new MercantilError('Error al actualizar trámite mercantil', error);
  return data as TramiteMercantil;
}

export async function eliminarTramiteMercantil(id: string): Promise<void> {
  const { error } = await db()
    .from('tramites_mercantiles')
    .delete()
    .eq('id', id);

  if (error) throw new MercantilError('Error al eliminar trámite mercantil', error);
}

// --- Historial ---

export async function crearHistorialMercantil(input: HistorialMercantilInsert): Promise<HistorialMercantil> {
  const { data, error } = await db()
    .from('historial_tramite_mercantil')
    .insert(input)
    .select()
    .single();

  if (error) throw new MercantilError('Error al crear registro de historial', error);
  return data as HistorialMercantil;
}

// --- Trámites por cliente ---

export async function tramitesMercantilesPorCliente(clienteId: string) {
  const { data, error } = await db()
    .from('tramites_mercantiles')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('updated_at', { ascending: false });

  if (error) throw new MercantilError('Error al listar trámites del cliente', error);
  return (data ?? []) as TramiteMercantil[];
}

// --- Trámites próximos a vencer ---

export async function tramitesMercantilesPorVencer(dias: number = 30) {
  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('tramites_mercantiles')
    .select(`
      *,
      cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre)
    `)
    .in('estado', ['vigente', 'inscrito'])
    .not('fecha_vencimiento', 'is', null)
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', limite)
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw new MercantilError('Error al obtener trámites por vencer', error);
  return (data ?? []).map((t: any) => ({
    ...t,
    dias_restantes: Math.ceil(
      (new Date(t.fecha_vencimiento).getTime() - Date.now()) / 86400000
    ),
  }));
}

// --- Trámites vencidos ---

export async function tramitesMercantilesVencidos() {
  const hoy = new Date().toISOString().slice(0, 10);

  const { data, error } = await db()
    .from('tramites_mercantiles')
    .select(`
      *,
      cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre)
    `)
    .not('fecha_vencimiento', 'is', null)
    .lt('fecha_vencimiento', hoy)
    .in('estado', ['vigente', 'inscrito'])
    .order('fecha_vencimiento', { ascending: true });

  if (error) throw new MercantilError('Error al obtener trámites vencidos', error);
  return data ?? [];
}

// --- Estadísticas para dashboard ---

export async function estadisticasMercantiles() {
  const [porEstado, porCategoria, total] = await Promise.all([
    db().from('tramites_mercantiles').select('estado'),
    db().from('tramites_mercantiles').select('categoria'),
    db().from('tramites_mercantiles').select('id', { count: 'exact', head: true }),
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
    .from('tramites_mercantiles')
    .select('id', { count: 'exact', head: true })
    .in('estado', ['vigente', 'inscrito'])
    .not('fecha_vencimiento', 'is', null)
    .gte('fecha_vencimiento', hoy)
    .lte('fecha_vencimiento', limite30);

  // Count vencidos
  const { count: vencidos } = await db()
    .from('tramites_mercantiles')
    .select('id', { count: 'exact', head: true })
    .not('fecha_vencimiento', 'is', null)
    .lt('fecha_vencimiento', hoy)
    .in('estado', ['vigente', 'inscrito']);

  return {
    total: total.count ?? 0,
    por_estado: estadoCount,
    por_categoria: categoriaCount,
    por_vencer: porVencer ?? 0,
    vencidos: vencidos ?? 0,
  };
}
