// ============================================================================
// lib/services/gastos.service.ts
// Lógica de negocio para gastos
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Gasto,
  GastoInsert,
  GastoConCategoria,
  CategoriaGasto,
} from '@/lib/types';
import { calcularIVA } from '@/lib/utils';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  categoria_id?: string;
  expediente_id?: string;
  desde?: string;
  hasta?: string;
  deducibles?: boolean;
  page?: number;
  limit?: number;
  busqueda?: string;
}

// --- Categorías ---

/**
 * Lista todas las categorías de gastos activas.
 */
export async function listarCategorias(): Promise<CategoriaGasto[]> {
  const { data, error } = await db()
    .from('categorias_gastos')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw new GastoError('Error al listar categorías', error);
  return (data ?? []) as CategoriaGasto[];
}

// --- CRUD Gastos ---

/**
 * Lista gastos con filtros y paginación.
 */
export async function listarGastos(params: ListParams = {}) {
  const {
    categoria_id, expediente_id, desde, hasta, deducibles,
    page = 1, limit = 20, busqueda,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('gastos')
    .select(`
      *,
      categoria:categorias_gastos!categoria_id (id, nombre)
    `, { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1);

  if (categoria_id) query = query.eq('categoria_id', categoria_id);
  if (expediente_id) query = query.eq('expediente_id', expediente_id);
  if (desde) query = query.gte('fecha', desde);
  if (hasta) query = query.lte('fecha', hasta);
  if (deducibles !== undefined) query = query.eq('es_deducible', deducibles);
  if (busqueda) {
    query = query.or(
      `descripcion.ilike.%${busqueda}%,proveedor.ilike.%${busqueda}%,numero.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new GastoError('Error al listar gastos', error);

  return {
    data: (data ?? []) as GastoConCategoria[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene un gasto por ID.
 */
export async function obtenerGasto(id: string): Promise<GastoConCategoria> {
  const { data, error } = await db()
    .from('gastos')
    .select(`
      *,
      categoria:categorias_gastos!categoria_id (id, nombre)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new GastoError('Gasto no encontrado', error);
  return data as GastoConCategoria;
}

/**
 * Crea un nuevo gasto. Auto-calcula IVA si está incluido.
 */
export async function crearGasto(input: GastoInsert): Promise<Gasto> {
  // 1. Generar número
  const { data: numData, error: numError } = await db()
    // @ts-ignore
    .schema('public').rpc('next_sequence', { p_tipo: 'GAS' });
  if (numError) throw new GastoError('Error al generar número', numError);
  const numero = numData as string;

  // 2. Validar categoría
  const { data: cat } = await db()
    .from('categorias_gastos')
    .select('id')
    .eq('id', input.categoria_id)
    .eq('activo', true)
    .single();

  if (!cat) throw new GastoError('Categoría no encontrada o inactiva');

  // 3. Calcular IVA
  let ivaMonto = 0;
  if (input.iva_incluido !== false && input.monto > 0) {
    const { iva } = calcularIVA(input.monto);
    ivaMonto = iva;
  }

  // 4. Insertar
  const { data, error } = await db()
    .from('gastos')
    .insert({
      numero,
      categoria_id: input.categoria_id,
      expediente_id: input.expediente_id ?? null,
      fecha: input.fecha ?? new Date().toISOString().split('T')[0],
      descripcion: input.descripcion,
      proveedor: input.proveedor ?? null,
      monto: input.monto,
      iva_incluido: input.iva_incluido ?? true,
      iva_monto: ivaMonto,
      tiene_factura: input.tiene_factura ?? false,
      numero_factura: input.numero_factura ?? null,
      nit_proveedor: input.nit_proveedor ?? null,
      comprobante_url: input.comprobante_url ?? null,
      es_deducible: input.es_deducible ?? (input.tiene_factura ?? false),
      notas: input.notas ?? null,
    })
    .select()
    .single();

  if (error) throw new GastoError('Error al crear gasto', error);
  return data as Gasto;
}

/**
 * Actualiza un gasto.
 */
export async function actualizarGasto(
  id: string,
  input: Partial<GastoInsert>
): Promise<Gasto> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.categoria_id !== undefined) updates.categoria_id = input.categoria_id;
  if (input.expediente_id !== undefined) updates.expediente_id = input.expediente_id;
  if (input.fecha !== undefined) updates.fecha = input.fecha;
  if (input.descripcion !== undefined) updates.descripcion = input.descripcion;
  if (input.proveedor !== undefined) updates.proveedor = input.proveedor;
  if (input.notas !== undefined) updates.notas = input.notas;
  if (input.tiene_factura !== undefined) updates.tiene_factura = input.tiene_factura;
  if (input.numero_factura !== undefined) updates.numero_factura = input.numero_factura;
  if (input.nit_proveedor !== undefined) updates.nit_proveedor = input.nit_proveedor;
  if (input.comprobante_url !== undefined) updates.comprobante_url = input.comprobante_url;
  if (input.es_deducible !== undefined) updates.es_deducible = input.es_deducible;

  // Recalcular IVA si cambia el monto
  if (input.monto !== undefined) {
    updates.monto = input.monto;
    const ivaIncluido = input.iva_incluido ?? true;
    updates.iva_incluido = ivaIncluido;
    updates.iva_monto = ivaIncluido ? calcularIVA(input.monto).iva : 0;
  }

  const { data, error } = await db()
    .from('gastos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new GastoError('Error al actualizar gasto', error);
  return data as Gasto;
}

/**
 * Elimina un gasto.
 */
export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await db().from('gastos').delete().eq('id', id);
  if (error) throw new GastoError('Error al eliminar gasto', error);
}

/**
 * Sube un comprobante (foto o PDF de factura/recibo).
 */
export async function subirComprobante(
  id: string,
  archivo: { url: string }
): Promise<Gasto> {
  const { data, error } = await db()
    .from('gastos')
    .update({
      comprobante_url: archivo.url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new GastoError('Error al subir comprobante', error);
  return data as Gasto;
}

// --- Reportes ---

/**
 * Resumen de gastos para el dashboard.
 */
export async function resumenGastos(mes?: string) {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = mes ?? hoy.slice(0, 7) + '-01';
  const finMes = (() => {
    const d = new Date(inicioMes + 'T12:00:00');
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return d.toISOString().split('T')[0];
  })();

  // Total del mes
  const { data: gastosMes } = await db()
    .from('gastos')
    .select('monto, iva_monto, es_deducible, categoria_id')
    .gte('fecha', inicioMes)
    .lte('fecha', finMes);

  const lista = gastosMes ?? [];
  const totalMes = lista.reduce((s, g) => s + (g.monto ?? 0), 0);
  const ivaMes = lista.reduce((s, g) => s + (g.iva_monto ?? 0), 0);
  const deduciblesMes = lista
    .filter((g: any) => g.es_deducible)
    .reduce((s, g) => s + (g.monto ?? 0), 0);

  // Por categoría
  const porCategoria: Record<string, number> = {};
  for (const g of lista) {
    const catId = g.categoria_id as string;
    porCategoria[catId] = (porCategoria[catId] ?? 0) + (g.monto ?? 0);
  }

  // Obtener nombres de categorías
  const catIds = Object.keys(porCategoria);
  let categoriasDetalle: Array<{ nombre: string; monto: number }> = [];

  if (catIds.length > 0) {
    const { data: cats } = await db()
      .from('categorias_gastos')
      .select('id, nombre')
      .in('id', catIds);

    categoriasDetalle = (cats ?? []).map((c: any) => ({
      nombre: c.nombre,
      monto: porCategoria[c.id] ?? 0,
    })).sort((a, b) => b.monto - a.monto);
  }

  // Promedio diario
  const diasTranscurridos = Math.max(
    1,
    Math.ceil(
      (Math.min(new Date().getTime(), new Date(finMes + 'T23:59:59').getTime()) -
       new Date(inicioMes + 'T00:00:00').getTime()) /
       (1000 * 60 * 60 * 24)
    )
  );

  return {
    mes: inicioMes.slice(0, 7),
    total: round(totalMes),
    iva: round(ivaMes),
    deducibles: round(deduciblesMes),
    no_deducibles: round(totalMes - deduciblesMes),
    cantidad: lista.length,
    promedio_diario: round(totalMes / diasTranscurridos),
    por_categoria: categoriasDetalle,
  };
}

/**
 * Reporte anual de gastos por mes (para gráficas).
 */
export async function reporteAnualGastos(anio?: number) {
  const a = anio ?? new Date().getFullYear();

  const { data } = await db()
    .from('gastos')
    .select('fecha, monto, es_deducible')
    .gte('fecha', `${a}-01-01`)
    .lte('fecha', `${a}-12-31`);

  // Agrupar por mes
  const meses: Record<string, { total: number; deducible: number; cantidad: number }> = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${a}-${String(m).padStart(2, '0')}`;
    meses[key] = { total: 0, deducible: 0, cantidad: 0 };
  }

  for (const g of data ?? []) {
    const key = (g.fecha as string).slice(0, 7);
    if (meses[key]) {
      meses[key].total += g.monto ?? 0;
      meses[key].cantidad++;
      if (g.es_deducible) meses[key].deducible += g.monto ?? 0;
    }
  }

  return {
    anio: a,
    meses: Object.entries(meses).map(([mes, data]) => ({
      mes,
      ...data,
      total: round(data.total),
      deducible: round(data.deducible),
    })),
    total_anual: round(Object.values(meses).reduce((s, m) => s + m.total, 0)),
  };
}

// --- Helper ---

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Error ---

export class GastoError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'GastoError';
    this.details = details;
  }
}
