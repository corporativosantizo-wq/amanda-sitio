// ============================================================================
// lib/services/cotizaciones.service.ts
// Lógica de negocio para cotizaciones
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { pgrstQuote } from '@/lib/utils/postgrest';
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
import { plantillasDeCliente } from '@/lib/templates/seleccionar';
import { crearCobroDesdeCotizacion } from '@/lib/services/cobros.service';

const db = () => createAdminClient();

/** Devuelve la fecha actual en Guatemala como YYYY-MM-DD */
function fechaHoyGT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

/** Convierte un Date a YYYY-MM-DD en zona Guatemala */
function fechaGT(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

// --- Helpers ---

interface ListParams {
  estado?: EstadoCotizacion;
  programadas?: boolean;
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
  const { estado, programadas, cliente_id, page = 1, limit = 20, busqueda } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('cotizaciones')
    .select(`
      id, numero, cliente_id, expediente_id,
      fecha_emision, fecha_vencimiento, estado,
      subtotal, iva_monto, total,
      requiere_anticipo, anticipo_porcentaje, anticipo_monto,
      cc_emails, enviada_at, aceptada_at,
      envio_programado, envio_programado_fecha,
      created_at, updated_at,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (programadas) {
    query = query.eq('envio_programado', true).eq('estado', EstadoCotizacion.BORRADOR);
  } else if (estado) {
    query = query.eq('estado', estado);
  }
  if (cliente_id) {
    query = query.eq('cliente_id', cliente_id);
  }
  if (busqueda) {
    // Search by cotizacion number or client name
    const { data: matchClientes } = await db()
      .from('clientes')
      .select('id')
      .ilike('nombre', `%${busqueda}%`)
      .limit(10);
    const clientIds = (matchClientes ?? []).map((c: any) => c.id);

    if (clientIds.length > 0) {
      // pgrstQuote solo sobre el ilike: el .in.(uuid1,uuid2,...) tiene comas
      // estructurales que PostgREST necesita como separadores.
      const v = pgrstQuote(`%${busqueda}%`);
      query = query.or(`numero.ilike.${v},cliente_id.in.(${clientIds.join(',')})`);
    } else {
      // .ilike() con args separados — supabase-js escapa el valor, no hace falta pgrstQuote.
      query = query.ilike('numero', `%${busqueda}%`);
    }
  }

  const { data, error, count } = await query;

  if (error) throw new CotizacionError('Error al listar cotizaciones', error);

  // Fetch confirmed payment totals for these cotizaciones
  const ids = (data ?? []).map((c: any) => c.id);
  let pagosPorCot: Record<string, number> = {};
  let facturaSolicitadaPorCot: Record<string, boolean> = {};
  if (ids.length > 0) {
    const { data: pagos } = await db()
      .from('pagos')
      .select('cotizacion_id, monto')
      .in('cotizacion_id', ids)
      .eq('estado', 'confirmado');
    for (const p of (pagos ?? [])) {
      pagosPorCot[p.cotizacion_id] = (pagosPorCot[p.cotizacion_id] ?? 0) + p.monto;
    }

    const { data: cobros } = await db()
      .from('cobros')
      .select('cotizacion_id, factura_solicitada')
      .in('cotizacion_id', ids);
    for (const c of (cobros ?? [])) {
      if (c.factura_solicitada) facturaSolicitadaPorCot[c.cotizacion_id] = true;
    }
  }

  const dataConPagos = (data ?? []).map((c: any) => ({
    ...c,
    monto_pagado: pagosPorCot[c.id] ?? 0,
    factura_solicitada: facturaSolicitadaPorCot[c.id] ?? false,
  }));

  return {
    data: dataConPagos as (CotizacionConCliente & { monto_pagado: number })[],
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
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email, emails_cc, telefono, direccion, idioma),
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

  // 3. Calcular montos desde items (IVA per-item)
  const itemsConTotal = input.items.map((item, idx) => ({
    ...item,
    total: item.cantidad * item.precio_unitario,
    orden: item.orden ?? idx,
    aplica_iva: item.aplica_iva ?? true,
  }));

  const subtotal = itemsConTotal.reduce((sum, item) => sum + item.total, 0);
  const baseGravable = itemsConTotal
    .filter(item => item.aplica_iva)
    .reduce((sum, item) => sum + item.total, 0);
  const ivaPct = config.iva_porcentaje ?? 12;
  const iva = Math.round(baseGravable * (ivaPct / 100) * 100) / 100;
  const total = subtotal + iva;

  // 4. Calcular anticipo
  const anticipoPorcentaje = input.anticipo_porcentaje ?? config.anticipo_porcentaje;
  const { anticipo } = calcularAnticipo(total, anticipoPorcentaje);

  // 5. Calcular fecha de vencimiento
  const fechaEmision = input.fecha_emision ?? fechaHoyGT();
  const vencimiento = new Date(fechaEmision + 'T12:00:00');
  vencimiento.setDate(vencimiento.getDate() + config.validez_cotizacion_dias);
  const fechaVencimiento = fechaGT(vencimiento);

  // 6. Condiciones default
  const condiciones = input.condiciones ?? generarCondicionesDefault(config);

  // 7. Determine estado and dates for retroactive registrations
  let estadoInicial = EstadoCotizacion.BORRADOR;
  let enviadaAt: string | null = null;
  let aceptadaAt: string | null = null;

  if (input.retroactiva) {
    const retroEstado = input.retroactiva_estado ?? 'enviada';
    if (retroEstado === 'enviada') {
      estadoInicial = EstadoCotizacion.ENVIADA;
      enviadaAt = input.retroactiva_fecha_envio
        ? new Date(input.retroactiva_fecha_envio + 'T12:00:00').toISOString()
        : new Date().toISOString();
    } else if (retroEstado === 'aceptada') {
      estadoInicial = EstadoCotizacion.ACEPTADA;
      enviadaAt = input.retroactiva_fecha_envio
        ? new Date(input.retroactiva_fecha_envio + 'T12:00:00').toISOString()
        : new Date().toISOString();
      aceptadaAt = input.retroactiva_fecha_aceptacion
        ? new Date(input.retroactiva_fecha_aceptacion + 'T12:00:00').toISOString()
        : new Date().toISOString();
    } else if (retroEstado === 'rechazada') {
      estadoInicial = EstadoCotizacion.RECHAZADA;
      enviadaAt = input.retroactiva_fecha_envio
        ? new Date(input.retroactiva_fecha_envio + 'T12:00:00').toISOString()
        : new Date().toISOString();
    }
  }

  // 8. Insertar cotización
  const { data: cotizacion, error: cotError } = await db()
    .from('cotizaciones')
    .insert({
      numero,
      cliente_id: input.cliente_id,
      expediente_id: input.expediente_id ?? null,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      estado: estadoInicial,
      subtotal,
      iva_monto: iva,
      total,
      condiciones,
      notas_internas: input.notas_internas ?? null,
      notas_cliente: input.notas_cliente ?? null,
      cc_emails: input.cc_emails ?? null,
      incluye_consultas: input.incluye_consultas ?? 2,
      duracion_consulta_min: input.duracion_consulta_min ?? 15,
      requiere_anticipo: input.requiere_anticipo ?? true,
      anticipo_porcentaje: anticipoPorcentaje,
      anticipo_monto: anticipo,
      monto_gastos: input.monto_gastos ?? 0,
      envio_programado: input.envio_programado ?? false,
      envio_programado_fecha: input.envio_programado_fecha ?? null,
      enviada_at: enviadaAt,
      aceptada_at: aceptadaAt,
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
    aplica_iva: item.aplica_iva,
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
  if (input.notas_cliente !== undefined) updates.notas_cliente = input.notas_cliente;
  if (input.cc_emails !== undefined) updates.cc_emails = input.cc_emails;
  if (input.incluye_consultas !== undefined) updates.incluye_consultas = input.incluye_consultas;
  if (input.requiere_anticipo !== undefined) updates.requiere_anticipo = input.requiere_anticipo;
  if (input.anticipo_porcentaje !== undefined) updates.anticipo_porcentaje = input.anticipo_porcentaje;
  if (input.monto_gastos !== undefined) updates.monto_gastos = input.monto_gastos;

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
      aplica_iva: item.aplica_iva ?? true,
    }));

    const { error: itemsError } = await db()
      .from('cotizacion_items')
      .insert(itemsConTotal);

    if (itemsError) throw new CotizacionError('Error al actualizar items', itemsError);

    // Recalcular montos (IVA per-item)
    const subtotal = itemsConTotal.reduce((sum, item) => sum + item.total, 0);
    const baseGravable = itemsConTotal
      .filter(item => item.aplica_iva)
      .reduce((sum, item) => sum + item.total, 0);
    const ivaPct = config.iva_porcentaje ?? 12;
    const iva = Math.round(baseGravable * (ivaPct / 100) * 100) / 100;
    const total = subtotal + iva;
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
export async function enviarCotizacion(id: string, ccManual?: string[]): Promise<Cotizacion> {
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

  const template = construirTemplateCotizacion(actual, config);

  // CC: SOLO lo que Amanda eligió/escribió explícitamente en el modal de envío
  // (heredados marcados + tipeados). NUNCA se agrega cliente.emails_cc de forma
  // automática (regla de confidencialidad). Si ccManual viene vacío, la
  // cotización va únicamente al destinatario principal.
  const ccEmails = Array.from(new Set<string>((ccManual ?? []).map((e) => e.trim().toLowerCase())))
    .filter((e) => e && e !== String(cliente.email).toLowerCase());

  // Enviar email — si falla, NO cambiamos el estado
  try {
    await sendMail({
      from: 'contador@papeleo.legal',
      to: cliente.email,
      subject: template.subject,
      htmlBody: template.html,
      ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
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

  // Auto-create cobro from accepted cotización
  try {
    await crearCobroDesdeCotizacion(id);
  } catch (err: any) {
    console.error('[Cotizaciones] Error creando cobro automático:', err.message);
  }

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
 * Construye el template de correo de una cotización (ES/EN según el cliente),
 * con la cotización completa: servicios (cantidad real), totales, condiciones,
 * botones de respuesta y datos bancarios. `mensajePersonal` (reenvíos)
 * sustituye el saludo estándar arriba de la tabla.
 * Compartido por enviar / reenviar / envío masivo para que el cliente reciba
 * siempre el mismo documento con marca.
 */
function construirTemplateCotizacion(
  cot: CotizacionConCliente,
  config: Record<string, any>,
  mensajePersonal?: string,
) {
  const cliente = cot.cliente as any;

  const items = (cot.items ?? []).map((item: any) => ({
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    monto: item.total ?? item.cantidad * item.precio_unitario,
  }));

  // ES/EN según la ficha del cliente (los montos vienen tal cual de la
  // cotización que Amanda editó — EN solo cambia idioma y formato USD).
  return plantillasDeCliente(cliente).emailCotizacion({
    clienteNombre: cliente?.nombre ?? '',
    servicios: items,
    subtotal: cot.subtotal,
    iva: cot.iva_monto,
    total: cot.total,
    anticipo: cot.anticipo_monto ?? 0,
    anticipoPorcentaje: cot.anticipo_porcentaje ?? 60,
    numeroCotizacion: cot.numero,
    fechaEmision: cot.fecha_emision,
    condiciones: condicionesParaEnvio(cliente?.idioma, cot.condiciones),
    notas_cliente: (cot as any).notas_cliente ?? undefined,
    configuracion: config,
    tokenRespuesta: cot.token_respuesta ?? undefined,
    vigenciaDias: config.validez_cotizacion_dias ?? 30,
    mensajePersonal,
  });
}

/**
 * Reenvía una cotización por email con mensaje personalizado.
 * El correo lleva la cotización COMPLETA (misma plantilla de marca que el
 * envío original) con el mensaje de Amanda como introducción.
 * No cambia el estado de la cotización.
 */
export async function reenviarCotizacion(id: string, params: {
  to: string;
  subject: string;
  mensaje: string;
  from?: string;
  cc?: string[];
}): Promise<void> {
  const actual = await obtenerCotizacion(id);
  const config = await obtenerConfiguracion();
  const template = construirTemplateCotizacion(actual, config, params.mensaje);

  // CC: SOLO lo explícito que Amanda eligió/escribió en el modal de reenvío.
  // NUNCA cliente.emails_cc automático. Si viene vacío, va solo al principal.
  const ccEmails = Array.from(new Set<string>((params.cc ?? []).map((e) => e.trim().toLowerCase())))
    .filter((e) => e && e !== String(params.to).toLowerCase());

  await sendMail({
    from: (params.from || 'amanda@papeleo.legal') as any,
    to: params.to,
    subject: params.subject,
    htmlBody: template.html,
    ...(ccEmails.length > 0 ? { cc: ccEmails } : {}),
  });

  // Update cotización to track reenvío
  await db()
    .from('cotizaciones')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id);
}

/**
 * Programa el reenvío de una cotización para una fecha futura. Genera AHORA el
 * HTML completo (cotización + mensaje personal, con marca) y lo deja como
 * correo programado — el cron de comunicaciones lo envía tal cual (detecta
 * HTML completo y no lo re-envuelve).
 */
export async function programarReenvioCotizacion(id: string, params: {
  to: string;
  subject: string;
  mensaje: string;
  from?: string;
  programadoPara: string; // ISO
}): Promise<void> {
  const actual = await obtenerCotizacion(id);
  const config = await obtenerConfiguracion();
  const template = construirTemplateCotizacion(actual, config, params.mensaje);

  const { crearCorreo } = await import('@/lib/services/comunicaciones.service');
  await crearCorreo({
    cliente_id: actual.cliente_id,
    destinatario_email: params.to,
    destinatario_nombre: (actual.cliente as any)?.nombre ?? null,
    cuenta_envio: params.from || 'amanda@papeleo.legal',
    asunto: params.subject,
    cuerpo: template.html,
    estado: 'programado',
    programado_para: params.programadoPara,
  });
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
    aplica_iva: item.aplica_iva,
  }));

  return crearCotizacion({
    cliente_id: nuevoClienteId ?? original.cliente_id,
    expediente_id: original.expediente_id,
    condiciones: original.condiciones,
    notas_internas: `Duplicada de ${original.numero}`,
    cc_emails: (original as any).cc_emails ?? null,
    incluye_consultas: original.incluye_consultas,
    duracion_consulta_min: original.duracion_consulta_min,
    requiere_anticipo: original.requiere_anticipo,
    anticipo_porcentaje: original.anticipo_porcentaje,
    items,
  });
}

// --- Envío masivo ---

/**
 * Envía múltiples cotizaciones por correo, cada una personalizada.
 * No detiene el proceso si una falla.
 */
export async function enviarCotizacionMasivo(params: {
  ids: string[];
  from: string;
  subjectTemplate: string;
  mensajeTemplate: string;
}): Promise<{
  enviadas: number;
  errores: Array<{ id: string; numero: string; error: string }>;
}> {
  const { ids, from, subjectTemplate, mensajeTemplate } = params;
  const enviadas: string[] = [];
  const errores: Array<{ id: string; numero: string; error: string }> = [];

  const config = await obtenerConfiguracion();

  for (const id of ids) {
    try {
      const cot = await obtenerCotizacion(id);
      const cliente = cot.cliente as any;

      if (!cliente?.email) {
        errores.push({ id, numero: cot.numero, error: 'Cliente sin email' });
        continue;
      }

      // Personalizar mensaje ("cliente" como fallback evita el doble saludo
      // "Estimado/a Estimado/a" cuando la ficha no tiene nombre)
      const subject = subjectTemplate
        .replace(/\{numero\}/g, cot.numero)
        .replace(/\{cliente\}/g, cliente.nombre ?? '')
        .replace(/\{total\}/g, cot.total?.toLocaleString('es-GT', { minimumFractionDigits: 2 }) ?? '0');

      const mensajePersonalizado = mensajeTemplate
        .replace(/\{nombre\}/g, cliente.nombre ?? 'cliente')
        .replace(/\{numero\}/g, cot.numero)
        .replace(/\{total\}/g, cot.total?.toLocaleString('es-GT', { minimumFractionDigits: 2 }) ?? '0');

      // Cotización completa con marca; el mensaje personalizado va como
      // introducción arriba de la tabla de servicios.
      const template = construirTemplateCotizacion(cot, config, mensajePersonalizado);

      // Lote = el sistema actúa solo, sin nadie para elegir los CC → va SOLO al
      // destinatario principal, sin copias (regla de confidencialidad). El CC
      // manual queda exclusivamente para el envío/reenvío individual.
      await sendMail({
        from: from as any,
        to: cliente.email,
        subject,
        htmlBody: template.html,
      });

      // Actualizar estado a enviada si es borrador
      if (cot.estado === EstadoCotizacion.BORRADOR) {
        await db()
          .from('cotizaciones')
          .update({
            estado: EstadoCotizacion.ENVIADA,
            enviada_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      } else {
        // Si ya estaba enviada, solo actualizar timestamp
        await db()
          .from('cotizaciones')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', id);
      }

      enviadas.push(id);
    } catch (err: any) {
      const cot = await db().from('cotizaciones').select('numero').eq('id', id).single();
      errores.push({
        id,
        numero: cot.data?.numero ?? id.slice(0, 8),
        error: err.message ?? 'Error desconocido',
      });
    }
  }

  return { enviadas: enviadas.length, errores };
}

/**
 * Marca múltiples cotizaciones como aceptadas.
 */
export async function aceptarCotizacionesMasivo(ids: string[]): Promise<{
  aceptadas: number;
  errores: Array<{ id: string; numero: string; error: string }>;
}> {
  const aceptadas: string[] = [];
  const errores: Array<{ id: string; numero: string; error: string }> = [];

  for (const id of ids) {
    try {
      await aceptarCotizacion(id);
      aceptadas.push(id);
    } catch (err: any) {
      const cot = await db().from('cotizaciones').select('numero').eq('id', id).single();
      errores.push({
        id,
        numero: cot.data?.numero ?? id.slice(0, 8),
        error: err.message ?? 'Error desconocido',
      });
    }
  }

  return { aceptadas: aceptadas.length, errores };
}

// --- Envío programado ---

/**
 * Programa el envío automático de una cotización en borrador.
 */
export async function programarEnvio(id: string, fecha: string): Promise<Cotizacion> {
  const actual = await obtenerCotizacion(id);

  if (actual.estado !== EstadoCotizacion.BORRADOR) {
    throw new CotizacionError('Solo se puede programar el envío de cotizaciones en borrador');
  }

  const { data, error } = await db()
    .from('cotizaciones')
    .update({
      envio_programado: true,
      envio_programado_fecha: fecha,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al programar envío', error);
  return data as Cotizacion;
}

/**
 * Cancela el envío programado de una cotización.
 */
export async function cancelarEnvioProgramado(id: string): Promise<Cotizacion> {
  const { data, error } = await db()
    .from('cotizaciones')
    .update({
      envio_programado: false,
      envio_programado_fecha: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new CotizacionError('Error al cancelar envío programado', error);
  return data as Cotizacion;
}

/**
 * Envía todas las cotizaciones con envío programado vencido.
 * Llamado por el cron endpoint.
 */
export async function enviarCotizacionesProgramadas(): Promise<{ enviadas: number; errores: number }> {
  const { data: pendientes, error } = await db()
    .from('cotizaciones')
    .select('id')
    .eq('envio_programado', true)
    .eq('estado', EstadoCotizacion.BORRADOR)
    .lte('envio_programado_fecha', new Date().toISOString());

  if (error) throw new CotizacionError('Error al consultar cotizaciones programadas', error);
  if (!pendientes || pendientes.length === 0) return { enviadas: 0, errores: 0 };

  let enviadas = 0;
  let errores = 0;

  for (const cot of pendientes) {
    try {
      await enviarCotizacion(cot.id);
      // Limpiar flag de envío programado
      await db()
        .from('cotizaciones')
        .update({ envio_programado: false, envio_programado_fecha: null })
        .eq('id', cot.id);
      enviadas++;
    } catch (err: any) {
      console.error('[CronCotizaciones] Error enviando', cot.id + ':', err.message);
      errores++;
    }
  }

  return { enviadas, errores };
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

function generarCondicionesDefault(_config: Record<string, unknown>): string {
  // El título del bloque lo pone la plantilla ("Términos y Condiciones
  // Generales") — no repetirlo aquí como primera línea.
  return `I. ALCANCE DE LOS SERVICIOS. La presente cotización comprende exclusivamente los servicios profesionales descritos en el detalle anterior. Cualquier gestión, trámite o servicio adicional no contemplado expresamente deberá ser cotizado por separado.

II. HONORARIOS Y GASTOS. Los honorarios profesionales indicados no incluyen gastos de registro, timbres fiscales, timbres notariales, tasas judiciales, aranceles, publicaciones, ni cualquier otro desembolso ante entidades públicas o privadas, salvo que se indique expresamente en el desglose de la cotización.

III. FORMA DE PAGO. El monto total de los honorarios profesionales deberá cancelarse previo al inicio de las gestiones, salvo acuerdo en contrario por escrito. En caso de servicios que incluyan gastos ante terceros, estos deberán cubrirse por anticipado. El incumplimiento en los pagos faculta al Despacho a suspender las gestiones hasta regularizar el saldo.

IV. CONSULTAS Y ASESORÍA. La cotización incluye dos (2) consultas de seguimiento o aclaración de dudas por vía virtual (Microsoft Teams). Las consultas adicionales estarán sujetas a un costo adicional. No se incluye asesoría legal ilimitada ni consultas sobre materias ajenas al servicio contratado.

V. VIGENCIA. La presente cotización tiene una vigencia de treinta (30) días calendario contados a partir de su fecha de emisión. Transcurrido dicho plazo, los montos podrán ser actualizados.

VI. CONFIDENCIALIDAD. Toda la información proporcionada por el cliente será tratada con estricta confidencialidad conforme a las obligaciones del secreto profesional del Abogado y Notario.

VII. PLAZO DE EJECUCIÓN. Los plazos de ejecución dependerán de la naturaleza del trámite y de la respuesta oportuna de las entidades correspondientes. El Despacho no se responsabiliza por retrasos atribuibles a terceros, entidades públicas o al propio cliente.

VIII. ACEPTACIÓN. La aceptación de la presente cotización y/o el pago correspondiente constituye la conformidad del cliente con los presentes términos y condiciones.`;
}

// Términos y condiciones generales en INGLÉS (traducción aprobada por Amanda,
// jul-2026). Mismo contenido legal que el default ES; cláusula VI ancla el
// secreto profesional a la ley guatemalteca. Sin número de colegiado.
const CONDICIONES_EN_DEFAULT = `I. SCOPE OF SERVICES. This quote covers exclusively the professional services described in the itemization above. Any additional procedure, filing, or service not expressly contemplated herein shall be quoted separately.

II. FEES AND EXPENSES. The professional fees indicated do not include registration costs, fiscal stamps, notarial stamps, court fees, tariffs, publications, or any other disbursement payable to public or private entities, unless expressly stated in the itemization of this quote.

III. PAYMENT. The total amount of professional fees shall be paid prior to the commencement of work, unless otherwise agreed in writing. For services involving third-party expenses, such expenses must be covered in advance. Failure to make timely payments entitles the Firm to suspend all work until the outstanding balance is settled.

IV. CONSULTATIONS AND ADVICE. This quote includes two (2) follow-up or clarification consultations held virtually (Microsoft Teams). Additional consultations will be subject to a separate fee. Unlimited legal advice and consultations on matters unrelated to the contracted service are not included.

V. VALIDITY. This quote is valid for thirty (30) calendar days from its date of issuance. After that period, the amounts may be updated.

VI. CONFIDENTIALITY. All information provided by the client will be treated with strict confidentiality, in accordance with the professional secrecy obligations of attorneys and notaries under Guatemalan law.

VII. TIMEFRAME. Completion times depend on the nature of each procedure and on the timely response of the corresponding authorities. The Firm is not responsible for delays attributable to third parties, public entities, or the client.

VIII. ACCEPTANCE. Acceptance of this quote and/or the corresponding payment constitutes the client's agreement to these terms and conditions.`;

// Condiciones a usar al ENVIAR una cotización según idioma del cliente:
// - Cliente ES: el texto guardado, tal cual (sin cambio de comportamiento).
// - Cliente EN: si el texto guardado es el default ES (nuevo o viejo, detectado
//   por su primera cláusula/título) o está vacío → default EN aprobado.
//   Si Amanda escribió condiciones personalizadas → se respetan tal cual.
export function condicionesParaEnvio(
  idioma: string | null | undefined,
  condiciones?: string | null,
): string | undefined {
  const c = (condiciones ?? '').trim();
  if (idioma !== 'en') return c || undefined;
  const esDefaultEs =
    !c ||
    c.startsWith('TÉRMINOS Y CONDICIONES GENERALES') ||
    c.startsWith('I. ALCANCE DE LOS SERVICIOS');
  return esDefaultEs ? CONDICIONES_EN_DEFAULT : c;
}

// --- Estadísticas ---

/**
 * Resumen de cotizaciones para el dashboard.
 */
export async function resumenCotizaciones() {
  const hoy = fechaHoyGT();
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
  return fechaGT(d);
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
