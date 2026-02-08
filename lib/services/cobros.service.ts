// ============================================================================
// lib/services/cobros.service.ts
// CRUD y lógica de negocio para Cobros (cuentas por cobrar)
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Cobro, CobroConCliente, CobroInsert, RecordatorioCobro } from '@/lib/types';
import { sendMail } from '@/lib/services/outlook.service';
import {
  emailSolicitudPago,
  emailPagoRecibido,
} from '@/lib/templates/emails';

const db = () => createAdminClient();

// --- Tipos ---

interface ListCobrosParams {
  estado?: string;
  cliente_id?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

// --- CRUD ---

export async function listarCobros(params: ListCobrosParams = {}) {
  const {
    estado, cliente_id, desde, hasta, busqueda,
    page = 1, limit = 50,
  } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('cobros')
    .select(`
      *,
      cliente:clientes!cliente_id (id, nombre, email)
    `, { count: 'exact' })
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (estado === 'vencidos') {
    const hoy = new Date().toISOString().split('T')[0];
    query = query.in('estado', ['pendiente', 'vencido']).lt('fecha_vencimiento', hoy);
  } else if (estado) {
    query = query.eq('estado', estado);
  }
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (desde) query = query.gte('fecha_emision', desde);
  if (hasta) query = query.lte('fecha_emision', hasta);
  if (busqueda) {
    query = query.or(`concepto.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new CobroError('Error al listar cobros', error);

  return {
    data: (data ?? []) as CobroConCliente[],
    total: count ?? 0,
    page,
    limit,
  };
}

export async function obtenerCobro(id: string): Promise<CobroConCliente> {
  const { data, error } = await db()
    .from('cobros')
    .select(`
      *,
      cliente:clientes!cliente_id (id, nombre, email)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new CobroError('Cobro no encontrado', error);
  return data as unknown as CobroConCliente;
}

export async function crearCobro(input: CobroInsert): Promise<Cobro> {
  if (!input.concepto?.trim()) throw new CobroError('El concepto es obligatorio');
  if (!input.monto || input.monto <= 0) throw new CobroError('El monto debe ser mayor a 0');

  const payload = {
    cliente_id: input.cliente_id,
    expediente_id: input.expediente_id ?? null,
    concepto: input.concepto.trim(),
    descripcion: input.descripcion ?? null,
    monto: input.monto,
    dias_credito: input.dias_credito ?? 15,
    estado: 'pendiente',
    notas: input.notas ?? null,
  };

  const { data, error } = await db()
    .from('cobros')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Cobros] crearCobro ERROR:', JSON.stringify(error));
    throw new CobroError(`Error al crear cobro: ${error.message ?? 'desconocido'}`, error);
  }

  return data as Cobro;
}

export async function actualizarCobro(id: string, updates: Partial<Cobro>): Promise<Cobro> {
  const payload: any = {};
  if (updates.concepto !== undefined) payload.concepto = updates.concepto;
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion;
  if (updates.monto !== undefined) payload.monto = updates.monto;
  if (updates.estado !== undefined) payload.estado = updates.estado;
  if (updates.fecha_vencimiento !== undefined) payload.fecha_vencimiento = updates.fecha_vencimiento;
  if (updates.dias_credito !== undefined) payload.dias_credito = updates.dias_credito;
  if (updates.notas !== undefined) payload.notas = updates.notas;

  const { data, error } = await db()
    .from('cobros')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CobroError('Error al actualizar cobro', error);
  return data as Cobro;
}

// --- Registrar pago contra un cobro ---

export async function registrarPagoCobro(params: {
  cobro_id: string;
  monto: number;
  metodo: string;
  referencia_bancaria?: string;
  fecha_pago?: string;
  notas?: string;
}): Promise<{ pago: any; cobro: Cobro }> {
  // Get cobro to find client
  const cobro = await obtenerCobro(params.cobro_id);
  if (cobro.estado === 'pagado') throw new CobroError('Este cobro ya está pagado');
  if (cobro.estado === 'cancelado') throw new CobroError('Este cobro está cancelado');

  // Create pago linked to cobro
  const { data: pago, error: pagoErr } = await db()
    .from('pagos')
    .insert({
      cobro_id: params.cobro_id,
      cliente_id: cobro.cliente_id,
      fecha_pago: params.fecha_pago ?? new Date().toISOString().split('T')[0],
      monto: params.monto,
      tipo: 'total',
      estado: 'confirmado',
      metodo: params.metodo,
      referencia_bancaria: params.referencia_bancaria ?? null,
      notas: params.notas ?? null,
      confirmado_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (pagoErr) {
    console.error('[Cobros] registrarPago ERROR:', JSON.stringify(pagoErr));
    throw new CobroError(`Error al registrar pago: ${pagoErr.message ?? 'desconocido'}`, pagoErr);
  }

  // Trigger will auto-update cobro monto_pagado and estado.
  // Refetch cobro to get updated data.
  const cobroActualizado = await obtenerCobro(params.cobro_id);

  return { pago, cobro: cobroActualizado };
}

// --- Enviar solicitud de pago ---

export async function enviarSolicitudPago(cobro_id: string): Promise<string> {
  const cobro = await obtenerCobro(cobro_id);
  if (!cobro.cliente?.email) {
    throw new CobroError(`El cliente ${cobro.cliente?.nombre ?? 'desconocido'} no tiene email`);
  }

  const template = emailSolicitudPago({
    clienteNombre: cobro.cliente.nombre,
    concepto: cobro.concepto,
    monto: cobro.saldo_pendiente,
    fechaLimite: cobro.fecha_vencimiento ?? undefined,
  });

  await sendMail({
    from: template.from,
    to: cobro.cliente.email,
    subject: template.subject,
    htmlBody: template.html,
  });

  return `Solicitud de pago enviada a ${cobro.cliente.nombre} (${cobro.cliente.email})`;
}

// --- Enviar comprobante de pago ---

export async function enviarComprobantePago(cobro_id: string, montoPagado: number): Promise<void> {
  const cobro = await obtenerCobro(cobro_id);
  if (!cobro.cliente?.email) return;

  const template = emailPagoRecibido({
    clienteNombre: cobro.cliente.nombre,
    concepto: cobro.concepto,
    monto: montoPagado,
    fechaPago: new Date().toISOString().split('T')[0],
  });

  try {
    await sendMail({
      from: template.from,
      to: cobro.cliente.email,
      subject: template.subject,
      htmlBody: template.html,
    });
  } catch (err: any) {
    console.error('[Cobros] Error enviando comprobante:', err.message);
  }
}

// --- Recordatorios ---

export async function obtenerRecordatorios(cobro_id: string): Promise<RecordatorioCobro[]> {
  const { data, error } = await db()
    .from('recordatorios_cobro')
    .select('*')
    .eq('cobro_id', cobro_id)
    .order('created_at', { ascending: false });

  if (error) throw new CobroError('Error al obtener recordatorios', error);
  return (data ?? []) as RecordatorioCobro[];
}

export async function registrarRecordatorio(cobro_id: string, tipo: string, emailEnviado: boolean, resultado?: string): Promise<void> {
  await db().from('recordatorios_cobro').insert({
    cobro_id,
    tipo,
    email_enviado: emailEnviado,
    resultado: resultado ?? null,
  });
}

// --- Resumen para dashboard ---

export async function resumenCobros() {
  const hoy = new Date().toISOString().split('T')[0];
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const inicioMesStr = inicioMes.toISOString().split('T')[0];

  // Fetch all active cobros in one query
  const { data: cobros } = await db()
    .from('cobros')
    .select('estado, saldo_pendiente, monto_pagado, fecha_vencimiento, fecha_emision')
    .not('estado', 'in', '("cancelado")');

  const result = {
    total_pendiente: 0,
    total_vencido: 0,
    por_vencer_7d: 0,
    cobrado_mes: 0,
    count_pendientes: 0,
    count_vencidos: 0,
    count_por_vencer: 0,
  };

  const en7dias = new Date();
  en7dias.setDate(en7dias.getDate() + 7);
  const en7diasStr = en7dias.toISOString().split('T')[0];

  for (const c of (cobros ?? [])) {
    if (c.estado === 'pagado') {
      // Cobrado — check if this month
      if (c.fecha_emision >= inicioMesStr) {
        result.cobrado_mes += c.monto_pagado ?? 0;
      }
      continue;
    }

    const saldo = c.saldo_pendiente ?? 0;
    if (saldo <= 0) continue;

    const vencido = c.fecha_vencimiento && c.fecha_vencimiento < hoy;
    const porVencer = c.fecha_vencimiento && c.fecha_vencimiento >= hoy && c.fecha_vencimiento <= en7diasStr;

    if (vencido) {
      result.total_vencido += saldo;
      result.count_vencidos++;
    } else if (porVencer) {
      result.por_vencer_7d += saldo;
      result.count_por_vencer++;
    }

    result.total_pendiente += saldo;
    result.count_pendientes++;
  }

  // Also sum payments confirmed this month
  const { data: pagos } = await db()
    .from('pagos')
    .select('monto')
    .not('cobro_id', 'is', null)
    .eq('estado', 'confirmado')
    .gte('fecha_pago', inicioMesStr);

  result.cobrado_mes = (pagos ?? []).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);

  return result;
}

// --- Error ---

export class CobroError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'CobroError';
    this.details = details;
  }
}
