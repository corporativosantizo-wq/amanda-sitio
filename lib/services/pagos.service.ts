// ============================================================================
// lib/services/pagos.service.ts
// Lógica de negocio para pagos
// Flujo: registrar pago → confirmar → trigger actualiza factura
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  Pago,
  PagoInsert,
  PagoConRelaciones,
} from '@/lib/types';
import { EstadoPago, TipoPago } from '@/lib/types';

const db = () => createAdminClient();

// --- Tipos ---

interface ListParams {
  cliente_id?: string;
  factura_id?: string;
  estado?: EstadoPago;
  tipo?: TipoPago;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

// --- CRUD ---

/**
 * Lista pagos con filtros.
 */
export async function listarPagos(params: ListParams = {}) {
  const {
    cliente_id, factura_id, estado, tipo, desde, hasta,
    page = 1, limit = 20,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('pagos')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre),
      factura:facturas!factura_id (id, numero, total)
    `, { count: 'exact' })
    .order('fecha_pago', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (factura_id) query = query.eq('factura_id', factura_id);
  if (estado) query = query.eq('estado', estado);
  if (tipo) query = query.eq('tipo', tipo);
  if (desde) query = query.gte('fecha_pago', desde);
  if (hasta) query = query.lte('fecha_pago', hasta);

  const { data, error, count } = await query;
  if (error) throw new PagoError('Error al listar pagos', error);

  return {
    data: (data ?? []) as PagoConRelaciones[],
    total: count ?? 0,
    page, limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

/**
 * Obtiene un pago por ID.
 */
export async function obtenerPago(id: string): Promise<PagoConRelaciones> {
  const { data, error } = await db()
    .from('pagos')
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre),
      factura:facturas!factura_id (id, numero, total, estado, monto_a_recibir)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new PagoError('Pago no encontrado', error);
  return data as unknown as PagoConRelaciones;
}

/**
 * Registra un nuevo pago.
 * - El pago se crea en estado 'registrado'
 * - Necesitas llamar confirmarPago() para que surta efecto
 *
 * Esto permite un flujo: cliente dice "ya pagué" → tú verificas → confirmas
 */
export async function registrarPago(input: PagoInsert): Promise<Pago> {
  // 1. Generar número
  const { data: numData, error: numError } = await db()
    .schema('public').rpc('next_sequence', { p_tipo: 'PAG' });
  if (numError) throw new PagoError('Error al generar número', numError);
  const numero = numData as string;

  // 2. Validar monto
  if (!input.monto || input.monto <= 0) {
    throw new PagoError('El monto del pago debe ser mayor a 0');
  }

  // 3. Si es pago de factura, validar que la factura exista y no esté pagada
  if (input.factura_id) {
    const { data: factura, error: facError } = await db()
      .from('facturas')
      .select('id, estado, monto_a_recibir, total')
      .eq('id', input.factura_id)
      .single();

    if (facError || !factura) {
      throw new PagoError('Factura no encontrada');
    }
    if (factura.estado === 'pagada') {
      throw new PagoError('Esta factura ya está completamente pagada');
    }
    if (factura.estado === 'anulada') {
      throw new PagoError('No se puede pagar una factura anulada');
    }
  }

  // 4. Determinar tipo de pago
  let tipo = input.tipo ?? TipoPago.TOTAL;
  if (input.es_anticipo) {
    tipo = TipoPago.ANTICIPO;
  }

  // 5. Insertar
  const { data, error } = await db()
    .from('pagos')
    .insert({
      numero,
      factura_id: input.factura_id ?? null,
      cotizacion_id: input.cotizacion_id ?? null,
      cliente_id: input.cliente_id,
      fecha_pago: input.fecha_pago ?? new Date().toISOString().split('T')[0],
      monto: input.monto,
      tipo,
      estado: EstadoPago.REGISTRADO,
      metodo: input.metodo ?? 'transferencia',
      referencia_bancaria: input.referencia_bancaria ?? null,
      comprobante_url: input.comprobante_url ?? null,
      es_anticipo: input.es_anticipo ?? false,
      porcentaje_anticipo: input.porcentaje_anticipo ?? null,
      notas: input.notas ?? null,
    })
    .select()
    .single();

  if (error) throw new PagoError('Error al registrar pago', error);
  return data as Pago;
}

/**
 * Confirma un pago.
 * El trigger on_pago_confirmado en DB:
 * - Setea confirmado_at
 * - Suma pagos de la factura
 * - Si total pagos >= monto_a_recibir → factura = 'pagada'
 * - Si parcial → factura = 'parcial'
 */
export async function confirmarPago(id: string): Promise<Pago> {
  const actual = await obtenerPago(id);

  if (actual.estado === EstadoPago.CONFIRMADO) {
    throw new PagoError('Este pago ya está confirmado');
  }
  if (actual.estado === EstadoPago.RECHAZADO) {
    throw new PagoError('No se puede confirmar un pago rechazado. Registra uno nuevo.');
  }

  const { data, error } = await db()
    .from('pagos')
    .update({
      estado: EstadoPago.CONFIRMADO,
      confirmado_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new PagoError('Error al confirmar pago', error);

  // TODO: Disparar generación de factura FEL y envío de email
  // if (data.factura_id) {
  //   const factura = await obtenerFactura(data.factura_id);
  //   if (factura.estado === 'pagada' && !factura.fel_uuid) {
  //     await emitirFEL(factura.id);
  //     await enviarFactura(factura.id);
  //   }
  // }

  return data as Pago;
}

/**
 * Rechaza un pago (comprobante inválido, monto incorrecto, etc.).
 */
export async function rechazarPago(id: string, motivo?: string): Promise<Pago> {
  const actual = await obtenerPago(id);

  if (actual.estado !== EstadoPago.REGISTRADO) {
    throw new PagoError('Solo se pueden rechazar pagos en estado registrado');
  }

  const notas = motivo
    ? `${actual.notas ?? ''}\n[RECHAZADO] ${motivo}`.trim()
    : actual.notas;

  const { data, error } = await db()
    .from('pagos')
    .update({
      estado: EstadoPago.RECHAZADO,
      notas,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new PagoError('Error al rechazar pago', error);
  return data as Pago;
}

/**
 * Sube comprobante de pago (imagen o PDF).
 */
export async function subirComprobante(
  id: string,
  archivo: { url: string; nombre: string }
): Promise<Pago> {
  const { data, error } = await db()
    .from('pagos')
    .update({
      comprobante_url: archivo.url,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new PagoError('Error al subir comprobante', error);
  return data as Pago;
}

/**
 * Registra y confirma un pago en un solo paso.
 * Atajo para cuando ya verificaste el depósito en el banco.
 */
export async function registrarYConfirmar(input: PagoInsert): Promise<Pago> {
  const pago = await registrarPago(input);
  return confirmarPago(pago.id);
}

// --- Estado de cuenta ---

/**
 * Obtiene el estado de cuenta de un cliente.
 */
export async function estadoCuentaCliente(clienteId: string) {
  // Facturas pendientes
  const { data: facturasPendientes } = await db()
    .from('facturas')
    .select('id, numero, fecha_emision, fecha_vencimiento, total, monto_a_recibir, estado')
    .eq('cliente_id', clienteId)
    .in('estado', ['pendiente', 'parcial'])
    .order('fecha_emision', { ascending: true });

  // Total pagado (pagos confirmados)
  const { data: pagosConfirmados } = await db()
    .from('pagos')
    .select('monto')
    .eq('cliente_id', clienteId)
    .eq('estado', 'confirmado');

  // Total facturado
  const { data: totalFacturado } = await db()
    .from('facturas')
    .select('total')
    .eq('cliente_id', clienteId)
    .neq('estado', 'anulada');

  const totalPagado = (pagosConfirmados ?? []).reduce((sum, p) => sum + (p.monto ?? 0), 0);
  const totalFact = (totalFacturado ?? []).reduce((sum, f) => sum + (f.total ?? 0), 0);
  const saldoPendiente = (facturasPendientes ?? []).reduce(
    (sum, f) => sum + ((f as any).monto_a_recibir ?? 0), 0
  );

  // Facturas vencidas
  const hoy = new Date().toISOString().split('T')[0];
  const vencidas = (facturasPendientes ?? []).filter(
    (f: any) => f.fecha_vencimiento && f.fecha_vencimiento < hoy
  );

  return {
    cliente_id: clienteId,
    total_facturado: totalFact,
    total_pagado: totalPagado,
    saldo_pendiente: saldoPendiente,
    facturas_pendientes: facturasPendientes ?? [],
    facturas_vencidas_count: vencidas.length,
  };
}

// --- Resumen ---

export async function resumenPagos() {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = hoy.slice(0, 7) + '-01';
  const inicioSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  })();

  const [porConfirmar, cobradoMes, cobradoSemana] = await Promise.all([
    db()
      .from('pagos')
      .select('id, monto', { count: 'exact' })
      .eq('estado', 'registrado'),
    db()
      .from('pagos')
      .select('monto')
      .eq('estado', 'confirmado')
      .gte('confirmado_at', inicioMes),
    db()
      .from('pagos')
      .select('monto')
      .eq('estado', 'confirmado')
      .gte('confirmado_at', inicioSemana),
  ]);

  const montoPorConfirmar = (porConfirmar.data ?? []).reduce(
    (sum, p) => sum + ((p as any).monto ?? 0), 0
  );
  const montoCobradoMes = (cobradoMes.data ?? []).reduce(
    (sum, p) => sum + ((p as any).monto ?? 0), 0
  );
  const montoCobradoSemana = (cobradoSemana.data ?? []).reduce(
    (sum, p) => sum + ((p as any).monto ?? 0), 0
  );

  return {
    por_confirmar_count: porConfirmar.count ?? 0,
    por_confirmar_monto: montoPorConfirmar,
    cobrado_mes: montoCobradoMes,
    cobrado_semana: montoCobradoSemana,
  };
}

// --- Error ---

export class PagoError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'PagoError';
    this.details = details;
  }
}
