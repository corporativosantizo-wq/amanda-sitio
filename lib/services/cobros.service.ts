// ============================================================================
// lib/services/cobros.service.ts
// CRUD y lógica de negocio para Cobros (cuentas por cobrar)
// ============================================================================

import { randomUUID } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { pgrstQuote } from '@/lib/utils/postgrest';
import type { Cobro, CobroConCliente, CobroInsert, RecordatorioCobro } from '@/lib/types';
import { sendMail } from '@/lib/services/outlook.service';
// Los correos al cliente se seleccionan ES/EN vía plantillasDeCliente().
import { plantillasDeCliente } from '@/lib/templates/seleccionar';
import { obtenerConfiguracionDespacho } from '@/lib/services/configuracion.service';
import { notificarPagoParaFactura } from '@/lib/services/factura-re.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';

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
      id, numero_cobro, cliente_id, expediente_id, cotizacion_id,
      concepto, descripcion, monto, monto_pagado, saldo_pendiente, moneda,
      estado, fecha_emision, fecha_vencimiento, dias_credito, notas,
      factura_solicitada, factura_solicitada_at, factura_numero, factura_serie,
      created_at, updated_at,
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
    const v = pgrstQuote(`%${busqueda}%`);
    query = query.or(`concepto.ilike.${v},descripcion.ilike.${v}`);
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
      cliente:clientes!cliente_id (id, nombre, email, idioma, moneda)
    `)
    .eq('id', id)
    .single();

  if (error || !data) throw new CobroError('Cobro no encontrado', error);
  return data as unknown as CobroConCliente;
}

// ── Token de pago con tarjeta (Fase B, correos EN) ──────────────────────────

/**
 * Devuelve (generándolo si falta) el token del botón "Pay by card" de un
 * cobro, SOLO si es elegible: cliente idioma='en' y moneda='USD', cobro en
 * USD, con saldo y en estado cobrable (capa 2 del blindaje — un cliente
 * local jamás obtiene token). Devuelve null si no aplica o si falla el
 * guardado: el correo simplemente sale sin botón, nunca se bloquea el envío.
 */
export async function asegurarTokenPagoCobro(
  cobro: { id: string; moneda?: string | null; saldo_pendiente?: number | null; estado: string; token_pago?: string | null; cliente?: { idioma?: string | null; moneda?: string | null } | null },
): Promise<string | null> {
  const elegible =
    cobro.cliente?.idioma === 'en' &&
    cobro.cliente?.moneda === 'USD' &&
    cobro.moneda === 'USD' &&
    Number(cobro.saldo_pendiente ?? 0) > 0 &&
    !['pagado', 'cancelado'].includes(cobro.estado);

  if (!elegible) return null;
  if (cobro.token_pago) return cobro.token_pago;

  const token = randomUUID();
  const { error } = await db()
    .from('cobros')
    .update({ token_pago: token, updated_at: new Date().toISOString() })
    .eq('id', cobro.id);

  if (error) {
    console.error('[Cobros] No se pudo guardar token_pago:', error.message);
    return null;
  }
  return token;
}

export async function crearCobro(input: CobroInsert): Promise<Cobro> {
  if (!input.concepto?.trim()) throw new CobroError('El concepto es obligatorio');
  if (!input.monto || input.monto <= 0) throw new CobroError('El monto debe ser mayor a 0');

  // El cobro hereda la moneda del cliente (decisión Fase B, jul-2026): un
  // cliente internacional (USD) genera cobros en USD — es lo que habilita el
  // pago con tarjeta y lo que los correos EN ya asumían al formatear $.
  let moneda = 'GTQ';
  if (input.cliente_id) {
    const { data: cli } = await db()
      .from('clientes')
      .select('moneda')
      .eq('id', input.cliente_id)
      .maybeSingle();
    if (cli?.moneda === 'USD') moneda = 'USD';
  }

  const payload = {
    cliente_id: input.cliente_id,
    expediente_id: input.expediente_id ?? null,
    cotizacion_id: input.cotizacion_id ?? null,
    concepto: input.concepto.trim(),
    descripcion: input.descripcion ?? null,
    monto: input.monto,
    moneda,
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
  if ((updates as any).factura_solicitada !== undefined) {
    payload.factura_solicitada = (updates as any).factura_solicitada;
    payload.factura_solicitada_at = (updates as any).factura_solicitada_at ?? new Date().toISOString();
  }

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
  // Idempotencia del webhook de Stripe (UNIQUE parcial en legal.pagos).
  stripe_session_id?: string;
  // SOLO para el webhook: si el cobro ya está pagado pero Stripe cobró de
  // verdad (doble pago con dos sesiones abiertas), el dinero real SE REGISTRA
  // igual — el sobrepago queda visible y Amanda decide el reembolso.
  permitirPagado?: boolean;
}): Promise<{ pago: any; cobro: Cobro }> {
  // Get cobro to find client
  const cobro = await obtenerCobro(params.cobro_id);
  if (cobro.estado === 'pagado' && !params.permitirPagado) throw new CobroError('Este cobro ya está pagado');
  if (cobro.estado === 'cancelado') throw new CobroError('Este cobro está cancelado');

  // FIX bug preexistente (jul-2026): el insert no generaba `numero`
  // (NOT NULL en legal.pagos) → esta función fallaba SIEMPRE con 23502,
  // desde el panel y desde Molly. Mismo RPC que usa registrarPago().
  const { data: numData, error: numError } = await db()
    // @ts-ignore
    .schema('public').rpc('next_sequence', { p_tipo: 'PAG' });
  if (numError) throw new CobroError('Error al generar número de pago', numError);

  // Create pago linked to cobro
  const { data: pago, error: pagoErr } = await db()
    .from('pagos')
    .insert({
      numero: numData as string,
      cobro_id: params.cobro_id,
      cliente_id: cobro.cliente_id,
      fecha_pago: params.fecha_pago ?? new Date().toISOString().split('T')[0],
      monto: params.monto,
      tipo: 'total',
      estado: 'confirmado',
      metodo: params.metodo,
      referencia_bancaria: params.referencia_bancaria ?? null,
      notas: params.notas ?? null,
      stripe_session_id: params.stripe_session_id ?? null,
      confirmado_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (pagoErr) {
    console.error('[Cobros] registrarPago ERROR:', JSON.stringify(pagoErr));
    throw new CobroError(`Error al registrar pago: ${pagoErr.message ?? 'desconocido'}`, pagoErr);
  }

  // FIX bug preexistente (jul-2026): el comentario original decía que un
  // trigger actualizaba monto_pagado/estado del cobro — ese trigger NUNCA
  // existió, así que registrar un pago dejaba el saldo intacto. Se actualiza
  // explícitamente aquí (saldo_pendiente es columna generada monto-pagado).
  const montoPagadoNuevo = Number(cobro.monto_pagado ?? 0) + Number(params.monto);
  const estadoNuevo = montoPagadoNuevo >= Number(cobro.monto) ? 'pagado' : 'parcial';
  const { error: updErr } = await db()
    .from('cobros')
    .update({ monto_pagado: montoPagadoNuevo, estado: estadoNuevo, updated_at: new Date().toISOString() })
    .eq('id', params.cobro_id);
  if (updErr) {
    console.error('[Cobros] ERROR actualizando saldo del cobro tras el pago:', updErr.message);
    throw new CobroError(`Pago ${pago.numero ?? pago.id} registrado pero el cobro no se pudo actualizar: ${updErr.message}`, updErr);
  }

  const cobroActualizado = await obtenerCobro(params.cobro_id);

  // Notificar a Amanda por Telegram para que apruebe solicitud de factura
  try {
    await notificarPagoParaFactura(pago.id);
  } catch (err: any) {
    console.error('[Cobros] Error notificando pago para factura:', err.message);
  }

  // Telegram notification — formato según la moneda del cobro (USD para
  // clientes internacionales, Q para locales).
  const fmt = (n: number) => cobroActualizado.moneda === 'USD'
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`
    : `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  try {
    await sendTelegramMessage(
      `💰 <b>Pago recibido</b>\n\n` +
      `<b>Cobro:</b> #${cobroActualizado.numero_cobro}\n` +
      `<b>Cliente:</b> ${cobroActualizado.cliente?.nombre ?? 'N/A'}\n` +
      `<b>Método:</b> ${params.metodo}\n` +
      `<b>Monto pagado:</b> ${fmt(params.monto)}\n` +
      `<b>Saldo pendiente:</b> ${fmt(cobroActualizado.saldo_pendiente)}\n` +
      `<b>Estado:</b> ${cobroActualizado.estado.toUpperCase()}`
    );
  } catch (e: any) {
    console.error('[Cobros] Error notificando Telegram:', e.message);
  }

  return { pago, cobro: cobroActualizado };
}

// --- Enviar solicitud de pago ---

// Mapeo del tipo según cuántos envíos previos hay para este cobro.
// La columna `tipo` en legal.recordatorios_cobro tiene CHECK contra estos 4 valores;
// reusamos la semántica del cron diario (primer/segundo/tercer/urgente) para que la
// columna refleje correctamente el nivel de insistencia sin migrar el constraint.
function tipoPorEnvioPrevio(envios: number): 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | 'urgente' {
  if (envios <= 0) return 'primer_aviso';
  if (envios === 1) return 'segundo_aviso';
  if (envios === 2) return 'tercer_aviso';
  return 'urgente';
}

export type EnviarSolicitudPagoResult =
  | { status: 'sent'; tipo: 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | 'urgente'; mensaje: string }
  | { status: 'duplicate_recent'; ultimo_envio: string };

export async function enviarSolicitudPago(
  cobro_id: string,
  options: { forceResend?: boolean } = {},
): Promise<EnviarSolicitudPagoResult> {
  const cobro = await obtenerCobro(cobro_id);
  if (!cobro.cliente?.email) {
    throw new CobroError(`El cliente ${cobro.cliente?.nombre ?? 'desconocido'} no tiene email`);
  }

  // Anti doble envío: si hubo un envío en las últimas 24h y forceResend != true, devolvemos
  // un señal para que el endpoint conteste 409 y el frontend muestre confirmación.
  if (!options.forceResend) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recientes } = await db()
      .from('recordatorios_cobro')
      .select('fecha_envio')
      .eq('cobro_id', cobro_id)
      .eq('email_enviado', true)
      .gte('fecha_envio', since)
      .order('fecha_envio', { ascending: false })
      .limit(1);

    if (recientes && recientes.length > 0) {
      return { status: 'duplicate_recent', ultimo_envio: recientes[0].fecha_envio };
    }
  }

  // Determinar tipo según cuántos envíos exitosos previos hay (sin importar la ventana 24h)
  const { count: enviosPrevios } = await db()
    .from('recordatorios_cobro')
    .select('id', { count: 'exact', head: true })
    .eq('cobro_id', cobro_id)
    .eq('email_enviado', true);
  const tipo = tipoPorEnvioPrevio(enviosPrevios ?? 0);

  const numeroCotizacion = (cobro as any).cotizacion?.numero ?? undefined;
  // Fase B: botón "Pay by card" solo si el cobro es elegible (cliente EN/USD,
  // cobro USD, saldo > 0). Cliente local: token null → sin botón.
  const tokenPago = await asegurarTokenPagoCobro(cobro as any);
  const template = plantillasDeCliente(cobro.cliente).emailSolicitudPago({
    clienteNombre: cobro.cliente.nombre,
    concepto: cobro.concepto,
    monto: cobro.saldo_pendiente,
    fechaLimite: cobro.fecha_vencimiento ?? undefined,
    numeroCotizacion,
    configuracion: await obtenerConfiguracionDespacho(),
    payUrl: tokenPago ? `https://amandasantizo.com/pagar/cobro?token=${encodeURIComponent(tokenPago)}` : undefined,
  });

  await sendMail({
    from: template.from,
    to: cobro.cliente.email,
    subject: template.subject,
    htmlBody: template.html,
  });

  // Tracking: el email ya salió. Si esto falla, NO devolvemos error al usuario
  // porque el correo ya se envió — sería confuso. Solo logueamos.
  try {
    await registrarRecordatorio(cobro_id, tipo, true, `Manual desde panel — enviado a ${cobro.cliente.email}`);
  } catch (err: any) {
    console.error('[Cobros] enviarSolicitudPago tracking fallido:', err.message ?? err);
  }

  return {
    status: 'sent',
    tipo,
    mensaje: `Solicitud de pago enviada a ${cobro.cliente.nombre} (${cobro.cliente.email})`,
  };
}

// --- Enviar comprobante de pago ---

export async function enviarComprobantePago(cobro_id: string, montoPagado: number): Promise<void> {
  const cobro = await obtenerCobro(cobro_id);
  if (!cobro.cliente?.email) return;

  const template = plantillasDeCliente(cobro.cliente).emailPagoRecibido({
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
    count_cobrado_mes: 0,
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

  // Sum ALL confirmed payments this month (not just cobro-linked)
  const { data: pagos } = await db()
    .from('pagos')
    .select('monto')
    .eq('estado', 'confirmado')
    .gte('fecha_pago', inicioMesStr);

  result.cobrado_mes = (pagos ?? []).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
  result.count_cobrado_mes = (pagos ?? []).length;

  // Include accepted cotizaciones without cobros (por cobrar sin cobro formal)
  const cotsSinCobro = await cotizacionesSinCobro();
  for (const cot of cotsSinCobro) {
    const saldo = cot.saldo_pendiente;
    if (saldo <= 0) continue;
    result.total_pendiente += saldo;
    result.count_pendientes++;
  }

  return result;
}

// --- Cotizaciones aceptadas sin cobro formal ---

export async function cotizacionesSinCobro() {
  // Fetch accepted cotizaciones that have NO cobro linked
  const { data: cots } = await db()
    .from('cotizaciones')
    .select(`
      id, numero, total, estado, cliente_id, aceptada_at, created_at,
      cliente:clientes!cliente_id (id, nombre, email)
    `)
    .eq('estado', 'aceptada');

  if (!cots || cots.length === 0) return [];

  // Check which have a cobro already
  const cotIds = cots.map((c: any) => c.id);
  const { data: cobrosExistentes } = await db()
    .from('cobros')
    .select('cotizacion_id')
    .in('cotizacion_id', cotIds);

  const cotIdsConCobro = new Set((cobrosExistentes ?? []).map((c: any) => c.cotizacion_id));

  // For each cotización without cobro, calculate paid amount
  const results: any[] = [];
  for (const cot of cots) {
    if (cotIdsConCobro.has(cot.id)) continue;

    const { data: pagosCot } = await db()
      .from('pagos')
      .select('monto')
      .eq('cotizacion_id', cot.id)
      .eq('estado', 'confirmado');

    const totalPagado = (pagosCot ?? []).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
    const saldo = parseFloat(cot.total) - totalPagado;

    results.push({
      id: `cot-${cot.id}`,
      cotizacion_id: cot.id,
      numero_cobro: 0,
      numero_cotizacion: cot.numero,
      cliente_id: cot.cliente_id,
      concepto: `Cotización ${cot.numero}`,
      monto: parseFloat(cot.total),
      monto_pagado: totalPagado,
      saldo_pendiente: saldo,
      estado: saldo <= 0 ? 'pagado' : 'pendiente',
      fecha_emision: cot.aceptada_at?.split('T')[0] ?? cot.created_at?.split('T')[0] ?? '',
      fecha_vencimiento: null,
      dias_credito: 0,
      notas: null,
      moneda: 'GTQ',
      factura_solicitada: false,
      factura_solicitada_at: null,
      factura_numero: null,
      factura_serie: null,
      created_at: cot.created_at,
      updated_at: cot.created_at,
      es_cotizacion_sin_cobro: true,
      cliente: cot.cliente,
    });
  }

  return results;
}

// --- Crear cobro automático desde cotización aceptada ---

export async function crearCobroDesdeCotizacion(cotizacionId: string): Promise<Cobro> {
  const { data: cot, error: cotErr } = await db()
    .from('cotizaciones')
    .select(`
      id, numero, cliente_id, expediente_id, total,
      cliente:clientes!cliente_id (id, nombre)
    `)
    .eq('id', cotizacionId)
    .single();

  if (cotErr || !cot) throw new CobroError('Cotización no encontrada para generar cobro', cotErr);

  // Check if cobro already exists for this cotización
  const { data: existing } = await db()
    .from('cobros')
    .select('id')
    .eq('cotizacion_id', cotizacionId)
    .limit(1);

  if (existing && existing.length > 0) {
    // Already has a cobro — return it
    return await db()
      .from('cobros')
      .select('*')
      .eq('id', existing[0].id)
      .single()
      .then(({ data }: any) => data as Cobro);
  }

  const cobro = await crearCobro({
    cliente_id: cot.cliente_id,
    expediente_id: cot.expediente_id,
    cotizacion_id: cotizacionId,
    concepto: `Cotización ${cot.numero}`,
    monto: cot.total,
    dias_credito: 30,
    notas: `Cobro generado automáticamente al aceptar cotización ${cot.numero}`,
  });

  // Telegram notification
  const clienteNombre = (cot.cliente as any)?.nombre ?? 'N/A';
  const Q = (n: number) => `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  try {
    await sendTelegramMessage(
      `📋 <b>Cobro generado automáticamente</b>\n\n` +
      `<b>Cotización:</b> ${cot.numero} aceptada\n` +
      `<b>Cliente:</b> ${clienteNombre}\n` +
      `<b>Monto:</b> ${Q(cot.total)}\n` +
      `<b>Crédito:</b> 30 días`
    );
  } catch (e: any) {
    console.error('[Cobros] Error notificando Telegram:', e.message);
  }

  return cobro;
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
