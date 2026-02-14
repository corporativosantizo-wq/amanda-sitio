// ============================================================================
// lib/services/cotizaciones.service.ts
// Lógica de negocio para cotizaciones
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Cotizacion,
  CotizacionItem,
  CotizacionInsert,
  CotizacionUpdate,
  CotizacionConCliente,
  DesgloseFiscal,
} from '@/lib/types';
import { EstadoCotizacion } from '@/lib/types';
import { calcularIVASobreSubtotal, calcularAnticipo } from '@/lib/utils';
import { sendMail } from '@/lib/services/outlook.service';
import { emailCotizacion } from '@/lib/templates/emails';

const db = () => createAdminClient();

// --- Helpers ---

interface ListParams {
  estado?: EstadoCotizacion;
  cliente_id?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
}

// --- CRUD ---

/**
 * Lista cotizaciones con filtros, paginación y datos del cliente.
 */
export async function listarCotizaciones(params: ListParams = {}) {
  const { estado, cliente_id, page = 1, limit = 20, busqueda } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('cotizaciones')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) {
    query = query.eq('estado', estado);
  }
  if (cliente_id) {
    query = query.eq('cliente_id', cliente_id);
  }
  if (busqueda) {
    query = query.or(`numero.ilike.%${busqueda}%`);
  }

  const { data, error, count } = await query;

  if (error) throw new CotizacionError('Error al listar cotizaciones', error);

  return {
    data: data as CotizacionConCliente[],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene una cotización por ID con items y datos del cliente.
 */
export async function obtenerCotizacion(id: string): Promise<CotizacionConCliente> {
  const { data: cotizacion, error } = await db()
    .from('cotizaciones')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email, telefono, direccion),
      items:cotizacion_items (*)
    `)
    .eq('id', id)
    .order('orden', { referencedTable: 'cotizacion_items', ascending: true })
    .single();

  if (error || !cotizacion) {
    throw new CotizacionError('Cotización no encontrada', error);
  }

  return cotizacion as CotizacionConCliente;
}

/**
 * Crea una cotización con items. Auto-calcula montos.
 */
export async function crearCotizacion(input: CotizacionInsert): Promise<Cotizacion> {
  // 1. Generar número secuencial
  const { data: numData, error: numError } = await db()
    // @ts-ignore
    .schema('public').rpc('next_sequence', { p_tipo: 'COT' });

  if (numError) throw new CotizacionError('Error al generar número', numError);
  const numero = numData as string;

  // 2. Obtener configuración
  const config = await obtenerConfiguracion();

  // 3. Calcular montos desde items
  const itemsConTotal = input.items.map((item, idx) => ({
    ...item,
    total: item.cantidad * item.precio_unitario,
    orden: item.orden ?? idx,
  }));

  const subtotal = itemsConTotal.reduce((sum, item) => sum + item.total, 0);
  const { iva, total } = calcularIVASobreSubtotal(subtotal, config.iva_porcentaje);

  // 4. Calcular anticipo
  const anticipoPorcentaje = input.anticipo_porcentaje ?? config.anticipo_porcentaje;
  const { anticipo } = calcularAnticipo(total, anticipoPorcentaje);

  // 5. Calcular fecha de vencimiento
  const fechaEmision = input.fecha_emision ?? new Date().toISOString().split('T')[0];
  const vencimiento = new Date(fechaEmision + 'T12:00:00');
  vencimiento.setDate(vencimiento.getDate() + config.validez_cotizacion_dias);
  const fechaVencimiento = vencimiento.toISOString().split('T')[0];

  // 6. Condiciones default
  const condiciones = input.condiciones ?? generarCondicionesDefault(config);

  // 7. Insertar cotización
  const { data: cotizacion, error: cotError } = await db()
    .from('cotizaciones')
    .insert({
      numero,
      cliente_id: input.cliente_id,
      expediente_id: input.expediente_id ?? null,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      estado: EstadoCotizacion.BORRADOR,
      subtotal,
      iva_monto: iva,
      total,
      condiciones,
      notas_internas: input.notas_internas ?? null,
      incluye_consultas: input.incluye_consultas ?? 2,
      duracion_consulta_min: input.duracion_consulta_min ?? 15,
      requiere_anticipo: input.requiere_anticipo ?? true,
      anticipo_porcentaje: anticipoPorcentaje,
      anticipo_monto: anticipo,
    })
    .select()
    .single();

  if (cotError || !cotizacion) {
    throw new CotizacionError('Error al crear cotización', cotError);
  }

  // 8. Insertar items
  const itemsInsert = itemsConTotal.map(item => ({
    cotizacion_id: cotizacion.id,
    servicio_id: item.servicio_id ?? null,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    total: item.total,
    orden: item.orden,
  }));

  const { error: itemsError } = await db()
    .from('cotizacion_items')
    .insert(itemsInsert);

  if (itemsError) {
    // Rollback: eliminar la cotización si fallan los items
    await db().from('cotizaciones').delete().eq('id', cotizacion.id);
    throw new CotizacionError('Error al crear items de cotización', itemsError);
  }

  return cotizacion as Cotizacion;
}

/**
 * Actualiza una cotización. Recalcula montos si se cambian items.
 */
export async function actualizarCotizacion(
  id: string,
  input: CotizacionUpdate
): Promise<Cotizacion> {
  // Verificar que existe y está editable
  const actual = await obtenerCotizacion(id);

  if (actual.estado !== EstadoCotizacion.BORRADOR) {
    throw new CotizacionError(
      `No se puede editar una cotización en estado "${actual.estado}". Solo se editan borradores.`
    );
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // Campos simples
  if (input.condiciones !== undefined) updates.condiciones = input.condiciones;
  if (input.notas_internas !== undefined) updates.notas_internas = input.notas_internas;
  if (input.incluye_consultas !== undefined) updates.incluye_consultas = input.incluye_consultas;
  if (input.requiere_anticipo !== undefined) updates.requiere_anticipo = input.requiere_anticipo;
  if (input.anticipo_porcentaje !== undefined) updates.anticipo_porcentaje = input.anticipo_porcentaje;

  // Si cambian los items, recalcular montos
  if (input.items) {
    const config = await obtenerConfiguracion();

    // Eliminar items anteriores
    await db().from('cotizacion_items').delete().eq('cotizacion_id', id);

    // Insertar nuevos items
    const itemsConTotal = input.items.map((item, idx) => ({
      cotizacion_id: id,
      servicio_id: item.servicio_id ?? null,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      total: item.cantidad * item.precio_unitario,
      orden: item.orden ?? idx,
    }));

    const { error: itemsError } = await db()
      .from('cotizacion_items')
      .insert(itemsConTotal);

    if (itemsError) throw new CotizacionError('Error al actualizar items', itemsError);

    // Recalcular montos
    const subtotal = itemsConTotal.reduce((sum, item) => sum + item.total, 0);
    const { iva, total } = calcularIVASobreSubtotal(subtotal, config.iva_porcentaje);
    const anticipoPorcentaje = (input.anticipo_porcentaje ?? actual.anticipo_porcentaje);
    const { anticipo } = calcularAnticipo(total, anticipoPorcentaje);

    updates.subtotal = subtotal;
    updates.iva_monto = iva;
    updates.total = total;
    updates.anticipo_monto = anticipo;
  }

  const { data, error } = await db()
    .from('cotizaciones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al actualizar cotización', error);
  return data as Cotizacion;
}

/**
 * Elimina una cotización (solo si es borrador).
 */
export async function eliminarCotizacion(id: string): Promise<void> {
  const actual = await obtenerCotizacion(id);

  if (actual.estado !== EstadoCotizacion.BORRADOR) {
    throw new CotizacionError(
      'Solo se pueden eliminar cotizaciones en estado borrador'
    );
  }

  // Items se eliminan por CASCADE
  const { error } = await db().from('cotizaciones').delete().eq('id', id);
  if (error) throw new CotizacionError('Error al eliminar cotización', error);
}

// --- Acciones de Estado ---

/**
 * Envía cotización por email al cliente y marca como enviada.
 * Si el email falla, la cotización permanece en borrador.
 */
export async function enviarCotizacion(id: string): Promise<Cotizacion> {
  const actual = await obtenerCotizacion(id);

  if (actual.estado !== EstadoCotizacion.BORRADOR) {
    throw new CotizacionError('Solo se pueden enviar cotizaciones en estado borrador');
  }

  const cliente = actual.cliente as any;
  if (!cliente?.email) {
    throw new CotizacionError('El cliente no tiene email registrado. Agrega un email antes de enviar.');
  }

  // Obtener configuración para datos bancarios en el template
  const config = await obtenerConfiguracion();

  // Generar email HTML
  const items = (actual.items ?? []).map((item: any) => ({
    descripcion: item.descripcion,
    monto: item.total ?? item.cantidad * item.precio_unitario,
  }));

  const template = emailCotizacion({
    clienteNombre: cliente.nombre,
    servicios: items,
    subtotal: actual.subtotal,
    iva: actual.iva_monto,
    total: actual.total,
    anticipo: actual.anticipo_monto ?? 0,
    anticipoPorcentaje: actual.anticipo_porcentaje ?? 60,
    numeroCotizacion: actual.numero,
    fechaEmision: actual.fecha_emision,
    condiciones: actual.condiciones ?? undefined,
    configuracion: config,
  });

  // Enviar email — si falla, NO cambiamos el estado
  try {
    await sendMail({
      from: 'contador@papeleo.legal',
      to: cliente.email,
      subject: template.subject,
      htmlBody: template.html,
    });
  } catch (err: any) {
    throw new CotizacionError(
      `Error al enviar email a ${cliente.email}: ${err.message ?? 'error desconocido'}`,
      err.details
    );
  }

  // Copia a Amanda (no bloquea si falla)
  try {
    await sendMail({
      from: 'contador@papeleo.legal',
      to: 'amanda@papeleo.legal',
      subject: `[Copia] Cotización ${actual.numero} enviada a ${cliente.nombre}`,
      htmlBody: template.html,
    });
  } catch (e) {
    console.error('Error enviando copia a Amanda:', e);
  }

  // Email enviado OK → actualizar estado
  const { data, error } = await db()
    .from('cotizaciones')
    .update({
      estado: EstadoCotizacion.ENVIADA,
      enviada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al actualizar estado de cotización', error);

  return data as Cotizacion;
}

/**
 * Marca cotización como aceptada. Punto de partida para generar factura.
 */
export async function aceptarCotizacion(id: string): Promise<Cotizacion> {
  const actual = await obtenerCotizacion(id);

  if (actual.estado !== EstadoCotizacion.ENVIADA) {
    throw new CotizacionError('Solo se pueden aceptar cotizaciones que ya fueron enviadas');
  }

  const { data, error } = await db()
    .from('cotizaciones')
    .update({
      estado: EstadoCotizacion.ACEPTADA,
      aceptada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al aceptar cotización', error);
  return data as Cotizacion;
}

/**
 * Marca cotización como rechazada.
 */
export async function rechazarCotizacion(id: string): Promise<Cotizacion> {
  const actual = await obtenerCotizacion(id);

  if (!['enviada', 'borrador'].includes(actual.estado)) {
    throw new CotizacionError('Esta cotización no se puede rechazar en su estado actual');
  }

  const { data, error } = await db()
    .from('cotizaciones')
    .update({
      estado: EstadoCotizacion.RECHAZADA,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al rechazar cotización', error);
  return data as Cotizacion;
}

/**
 * Duplica una cotización existente (crea una nueva en borrador).
 * Útil para re-enviar a otro cliente o actualizar precios.
 */
export async function duplicarCotizacion(id: string, nuevoClienteId?: string): Promise<Cotizacion> {
  const original = await obtenerCotizacion(id);

  const items = original.items.map(item => ({
    servicio_id: item.servicio_id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    orden: item.orden,
  }));

  return crearCotizacion({
    cliente_id: nuevoClienteId ?? original.cliente_id,
    expediente_id: original.expediente_id,
    condiciones: original.condiciones,
    notas_internas: `Duplicada de ${original.numero}`,
    incluye_consultas: original.incluye_consultas,
    duracion_consulta_min: original.duracion_consulta_min,
    requiere_anticipo: original.requiere_anticipo,
    anticipo_porcentaje: original.anticipo_porcentaje,
    items,
  });
}

// --- Helpers internos ---

export async function obtenerConfiguracion() {
  const { data, error } = await db()
    .from('configuracion')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) throw new CotizacionError('Error al obtener configuración', error);
  return data;
}

function generarCondicionesDefault(config: Record<string, unknown>): string {
  const banco = config.banco ?? 'Banco Industrial';
  const cuenta = config.numero_cuenta ?? '455-008846-4';
  const nombre = config.cuenta_nombre ?? 'Invest & Jure-Advisor, S.A.';
  const emailContador = config.email_contador ?? 'contador@papeleo.legal';
  const validez = config.validez_cotizacion_dias ?? 30;

  return [
    `Depositar en cuenta monetaria de ${banco} No. ${cuenta} a nombre de ${nombre}.`,
    `Enviar comprobante de pago y número de NIT para facturación al correo: ${emailContador}`,
    `Los servicios contratados son exclusivamente los descritos en esta cotización.`,
    `Esta cotización tiene una validez de ${validez} días a partir de la fecha de emisión.`,
    `Las consultas incluidas son vía Microsoft Teams (grabadas) con duración de 15 minutos cada una.`,
    `Consultas adicionales tienen un costo de Q100.00 cada una.`,
  ].join('\n');
}

// --- Estadísticas ---

/**
 * Resumen de cotizaciones para el dashboard.
 */
export async function resumenCotizaciones() {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = hoy.slice(0, 7) + '-01';

  const [activas, porVencer, mesActual] = await Promise.all([
    db()
      .from('cotizaciones')
      .select('id', { count: 'exact', head: true })
      .in('estado', [EstadoCotizacion.BORRADOR, EstadoCotizacion.ENVIADA])
      .gte('fecha_vencimiento', hoy),
    db()
      .from('cotizaciones')
      .select('id', { count: 'exact', head: true })
      .eq('estado', EstadoCotizacion.ENVIADA)
      .gte('fecha_vencimiento', hoy)
      .lte('fecha_vencimiento', sumarDias(hoy, 5)),
    db()
      .from('cotizaciones')
      .select('total, estado')
      .gte('fecha_emision', inicioMes),
  ]);

  const cotizacionesMes = mesActual.data ?? [];
  const totalCotizado = cotizacionesMes.reduce((sum: number, c: any) => sum + (c.total ?? 0), 0);
  const aceptadas = cotizacionesMes.filter((c: any) => c.estado === EstadoCotizacion.ACEPTADA);
  const montoAceptado = aceptadas.reduce((sum: number, c: any) => sum + (c.total ?? 0), 0);

  return {
    activas: activas.count ?? 0,
    por_vencer: porVencer.count ?? 0,
    cotizadas_mes: cotizacionesMes.length,
    total_cotizado_mes: totalCotizado,
    aceptadas_mes: aceptadas.length,
    monto_aceptado_mes: montoAceptado,
    tasa_conversion: cotizacionesMes.length > 0
      ? Math.round((aceptadas.length / cotizacionesMes.length) * 100)
      : 0,
  };
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

// --- Error class ---

export class CotizacionError extends Error {
  public details: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'CotizacionError';
    this.details = details;
  }
}
