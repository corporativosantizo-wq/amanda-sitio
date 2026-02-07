// ============================================================================
// lib/services/facturas.service.ts
// Lógica de negocio para facturas electrónicas (FEL Guatemala)
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Factura,
  FacturaInsert,
  FacturaItem,
  FacturaConCliente,
  DesgloseFiscal,
  Cliente,
} from '@/lib/types';
import { EstadoFactura } from '@/lib/types';
import {
  calcularIVASobreSubtotal,
  calcularRetencionISR,
} from '@/lib/utils';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  estado?: EstadoFactura;
  cliente_id?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
  busqueda?: string;
  vencidas?: boolean;
}

// --- CRUD ---

/**
 * Lista facturas con filtros y paginación.
 */
export async function listarFacturas(params: ListParams = {}) {
  const {
    estado, cliente_id, desde, hasta, vencidas,
    page = 1, limit = 20, busqueda,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('facturas')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) query = query.eq('estado', estado);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (desde) query = query.gte('fecha_emision', desde);
  if (hasta) query = query.lte('fecha_emision', hasta);
  if (busqueda) {
    query = query.or(`numero.ilike.%${busqueda}%,razon_social.ilike.%${busqueda}%`);
  }
  if (vencidas) {
    const hoy = new Date().toISOString().split('T')[0];
    query = query
      .eq('estado', 'pendiente')
      .lt('fecha_vencimiento', hoy);
  }

  const { data, error, count } = await query;
  if (error) throw new FacturaError('Error al listar facturas', error);

  return {
    data: (data ?? []) as FacturaConCliente[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene una factura por ID con items, cliente y pagos.
 */
export async function obtenerFactura(id: string): Promise<FacturaConCliente> {
  const { data, error } = await db()
    .from('facturas')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email, telefono),
      items:factura_items (*),
      pagos (*)
    `)
    .eq('id', id)
    .order('orden', { referencedTable: 'factura_items', ascending: true })
    .order('fecha_pago', { referencedTable: 'pagos', ascending: true })
    .single();

  if (error || !data) throw new FacturaError('Factura no encontrada', error);
  return data as unknown as FacturaConCliente;
}

/**
 * Crea una factura. Auto-calcula IVA y retención ISR.
 * Opcionalmente se puede crear desde una cotización aceptada.
 */
export async function crearFactura(input: FacturaInsert): Promise<Factura> {
  // 1. Generar número
  const { data: numData, error: numError } = await db()
    .schema('public').rpc('next_sequence', { p_tipo: 'FAC' });
  if (numError) throw new FacturaError('Error al generar número', numError);
  const numero = numData as string;

  // 2. Config
  const config = await obtenerConfiguracion();

  // 3. Calcular montos
  const itemsConTotal = input.items.map((item, idx) => ({
    ...item,
    total: item.cantidad * item.precio_unitario,
    orden: item.orden ?? idx,
  }));

  const subtotal = itemsConTotal.reduce((sum, item) => sum + item.total, 0);
  const { iva, total } = calcularIVASobreSubtotal(subtotal, config.iva_porcentaje);

  // 4. Retención ISR
  const aplicaRetencion = input.aplica_retencion ?? false;
  let retencionPorcentaje = 0;
  let retencionMonto = 0;
  let montoARecibir = total;

  if (aplicaRetencion) {
    const retencion = calcularRetencionISR(total, {
      porcentaje_bajo: config.isr_porcentaje_bajo,
      porcentaje_alto: config.isr_porcentaje_alto,
      umbral: config.isr_umbral,
    });
    retencionPorcentaje = retencion.porcentaje;
    retencionMonto = retencion.monto;
    montoARecibir = round(total - retencionMonto);
  }

  // 5. Fecha de vencimiento (30 días desde emisión)
  const fechaEmision = new Date().toISOString().split('T')[0];
  const vencimiento = new Date(fechaEmision + 'T12:00:00');
  vencimiento.setDate(vencimiento.getDate() + 30);
  const fechaVencimiento = input.fecha_vencimiento
    ?? vencimiento.toISOString().split('T')[0];

  // 6. Insertar factura
  const { data: factura, error: facError } = await db()
    .from('facturas')
    .insert({
      numero,
      cotizacion_id: input.cotizacion_id ?? null,
      cliente_id: input.cliente_id,
      expediente_id: input.expediente_id ?? null,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      estado: EstadoFactura.PENDIENTE,
      razon_social: input.razon_social,
      nit: input.nit,
      direccion_fiscal: input.direccion_fiscal ?? 'Ciudad',
      subtotal,
      iva_monto: iva,
      total,
      aplica_retencion: aplicaRetencion,
      retencion_porcentaje: retencionPorcentaje,
      retencion_monto: retencionMonto,
      monto_a_recibir: montoARecibir,
    })
    .select()
    .single();

  if (facError || !factura) throw new FacturaError('Error al crear factura', facError);

  // 7. Insertar items
  const itemsInsert = itemsConTotal.map(item => ({
    factura_id: factura.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    total: item.total,
    orden: item.orden,
  }));

  const { error: itemsError } = await db()
    .from('factura_items')
    .insert(itemsInsert);

  if (itemsError) {
    await db().from('facturas').delete().eq('id', factura.id);
    throw new FacturaError('Error al crear items de factura', itemsError);
  }

  return factura as Factura;
}

/**
 * Crea factura automáticamente desde una cotización aceptada.
 */
export async function crearFacturaDesdeCotizacion(cotizacionId: string): Promise<Factura> {
  // Obtener cotización con items y cliente
  const { data: cot, error: cotError } = await db()
    .from('cotizaciones')
    .select(`
      *,
      cliente:clientes!cliente_id (*),
      items:cotizacion_items (*)
    `)
    .eq('id', cotizacionId)
    .single();

  if (cotError || !cot) throw new FacturaError('Cotización no encontrada', cotError);
  if (cot.estado !== 'aceptada') {
    throw new FacturaError('Solo se puede facturar una cotización aceptada');
  }

  const cliente = cot.cliente as Cliente;

  return crearFactura({
    cotizacion_id: cotizacionId,
    cliente_id: cot.cliente_id,
    expediente_id: cot.expediente_id,
    razon_social: cliente.razon_social_facturacion ?? cliente.nombre,
    nit: cliente.nit_facturacion ?? cliente.nit ?? 'CF',
    direccion_fiscal: cliente.direccion_facturacion ?? cliente.direccion ?? 'Ciudad',
    items: (cot.items as any[]).map((item: any) => ({
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      orden: item.orden,
    })),
  });
}

/**
 * Anula una factura. Si tiene FEL emitida, requiere anulación en SAT.
 */
export async function anularFactura(id: string, motivo?: string): Promise<Factura> {
  const actual = await obtenerFactura(id);

  if (actual.estado === EstadoFactura.ANULADA) {
    throw new FacturaError('La factura ya está anulada');
  }

  if (actual.estado === EstadoFactura.PAGADA) {
    throw new FacturaError(
      'No se puede anular una factura pagada. Primero revierte los pagos.'
    );
  }

  // TODO: Si tiene FEL, anular en Megaprint
  if (actual.fel_uuid) {
    // await anularFEL(actual.fel_uuid, motivo);
    console.warn(`[FEL] Pendiente anular FEL UUID: ${actual.fel_uuid}`);
  }

  const notas = motivo
    ? `${actual.notas ?? ''}\n[ANULADA] ${motivo}`.trim()
    : actual.notas;

  const { data, error } = await db()
    .from('facturas')
    .update({
      estado: EstadoFactura.ANULADA,
      notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new FacturaError('Error al anular factura', error);
  return data as Factura;
}

// --- FEL (Factura Electrónica) ---

/**
 * Emite la factura electrónica via Megaprint FEL.
 * Registra UUID, número de autorización, XML y PDF de la SAT.
 */
export async function emitirFEL(id: string): Promise<Factura> {
  const factura = await obtenerFactura(id);

  if (factura.fel_uuid) {
    throw new FacturaError('Esta factura ya tiene FEL emitida');
  }

  if (factura.estado === EstadoFactura.ANULADA) {
    throw new FacturaError('No se puede emitir FEL de una factura anulada');
  }

  // TODO: Integrar con Megaprint FEL API
  // const felResponse = await megaprintClient.emitirFactura({
  //   nit_emisor: config.nit_empresa,
  //   nit_receptor: factura.nit,
  //   nombre_receptor: factura.razon_social,
  //   items: factura.items,
  //   total: factura.total,
  // });

  // Placeholder hasta integrar Megaprint
  const felPlaceholder = {
    uuid: `FEL-${Date.now()}`,
    numero_autorizacion: null as string | null,
    serie: null as string | null,
    numero_dte: null as string | null,
    fecha_certificacion: null as string | null,
    xml_url: null as string | null,
    pdf_url: null as string | null,
  };

  const { data, error } = await db()
    .from('facturas')
    .update({
      fel_uuid: felPlaceholder.uuid,
      fel_numero_autorizacion: felPlaceholder.numero_autorizacion,
      fel_serie: felPlaceholder.serie,
      fel_numero_dte: felPlaceholder.numero_dte,
      fel_fecha_certificacion: felPlaceholder.fecha_certificacion,
      fel_xml_url: felPlaceholder.xml_url,
      fel_pdf_url: felPlaceholder.pdf_url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new FacturaError('Error al registrar FEL', error);
  return data as Factura;
}

// --- Envío ---

/**
 * Marca factura como enviada al cliente.
 * Próximamente: genera PDF y envía email vía Proton SMTP.
 */
export async function enviarFactura(id: string): Promise<Factura> {
  const { data, error } = await db()
    .from('facturas')
    .update({
      enviada_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new FacturaError('Error al marcar como enviada', error);

  // TODO: Generar PDF y enviar email
  // await generarPDFFactura(id);
  // await enviarEmailFactura(id);

  return data as Factura;
}

// --- Estadísticas ---

export async function resumenFacturas() {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = hoy.slice(0, 7) + '-01';

  const [pendientes, vencidas, mesActual] = await Promise.all([
    db()
      .from('facturas')
      .select('id, total, monto_a_recibir', { count: 'exact' })
      .in('estado', ['pendiente', 'parcial']),
    db()
      .from('facturas')
      .select('id, total', { count: 'exact' })
      .eq('estado', 'pendiente')
      .lt('fecha_vencimiento', hoy),
    db()
      .from('facturas')
      .select('total, estado')
      .gte('fecha_emision', inicioMes),
  ]);

  const facturasHoy = pendientes.data ?? [];
  const montoPendiente = facturasHoy.reduce(
    (sum, f) => sum + ((f as any).monto_a_recibir ?? 0), 0
  );

  const facturasMes = mesActual.data ?? [];
  const totalFacturadoMes = facturasMes.reduce((sum, f) => sum + (f.total ?? 0), 0);
  const pagadasMes = facturasMes.filter(f => f.estado === 'pagada');
  const totalCobradoMes = pagadasMes.reduce((sum, f) => sum + (f.total ?? 0), 0);

  return {
    pendientes_count: pendientes.count ?? 0,
    pendientes_monto: montoPendiente,
    vencidas_count: vencidas.count ?? 0,
    facturado_mes: totalFacturadoMes,
    cobrado_mes: totalCobradoMes,
    tasa_cobro: totalFacturadoMes > 0
      ? Math.round((totalCobradoMes / totalFacturadoMes) * 100)
      : 0,
  };
}

// --- Helpers ---

async function obtenerConfiguracion() {
  const { data, error } = await db()
    .from('configuracion')
    .select('*')
    .limit(1)
    .single();
  if (error || !data) throw new FacturaError('Error al obtener configuración', error);
  return data;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Error ---

export class FacturaError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'FacturaError';
    this.details = details;
  }
}
