// ============================================================================
// lib/services/recibos-caja.service.ts
// Recibo de Caja: comprobante NO fiscal de pagos de gastos del trámite y de
// otros recibos manuales sueltos (anticipos, reembolsos, etc.).
//
// Flujo automático (registrarPagoGastos): pago + recibo + PDF + upload + email
// con CC fijos del cliente.
//
// Flujo manual (crearReciboManual): solo recibo + PDF + upload (sin email,
// sin pago); el email se dispara por separado vía enviarEmail.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { generarPDFReciboCaja } from './pdf-recibo-caja';
import {
  enviarComprobantePorEmail,
  normalizarEmails,
  isValidEmail,
} from './comprobantes-email';
import { emailWrapper } from '@/lib/templates/emails';
import {
  EstadoPago,
  TipoPago,
  type ReciboCaja,
  type ReciboCajaConRelaciones,
  type ReciboCajaEnvio,
  type RegistrarPagoGastosInput,
  type CrearReciboManualInput,
} from '@/lib/types';
import { EMISOR } from '@/lib/config/emisor';

const db = () => createAdminClient();

export class ReciboCajaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'ReciboCajaError';
    this.details = details;
  }
}

// ── Listar / Obtener ────────────────────────────────────────────────────────

interface ListParams {
  cliente_id?: string;
  cotizacion_id?: string;
  origen?: 'automatico' | 'manual';
  desde?: string;
  hasta?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

const RECIBO_SELECT = `
  id, numero, monto, fecha_emision, concepto, origen,
  pdf_url, email_enviado_at, email_error, notas,
  cotizacion_id, cliente_id, pago_id, created_by, created_at, updated_at,
  cliente:clientes!cliente_id (id, codigo, nombre, nit, email, emails_cc_recibos),
  cotizacion:cotizaciones!cotizacion_id (id, numero)
`;

export async function listarRecibos(params: ListParams = {}) {
  const { cliente_id, cotizacion_id, origen, desde, hasta, busqueda, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('recibos_caja')
    .select(RECIBO_SELECT, { count: 'exact' })
    .order('fecha_emision', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cliente_id)    query = query.eq('cliente_id', cliente_id);
  if (cotizacion_id) query = query.eq('cotizacion_id', cotizacion_id);
  if (origen)        query = query.eq('origen', origen);
  if (desde)         query = query.gte('fecha_emision', desde);
  if (hasta)         query = query.lte('fecha_emision', hasta);
  if (busqueda)      query = query.ilike('numero', `%${busqueda}%`);

  const { data, error, count } = await query;
  if (error) throw new ReciboCajaError('Error al listar recibos', error);

  return {
    data: (data ?? []) as unknown as ReciboCajaConRelaciones[],
    total: count ?? 0,
    page,
    limit,
  };
}

export async function obtenerRecibo(id: string): Promise<ReciboCajaConRelaciones> {
  const { data, error } = await db()
    .from('recibos_caja')
    .select(RECIBO_SELECT)
    .eq('id', id)
    .single();

  if (error || !data) throw new ReciboCajaError('Recibo no encontrado', error);
  return data as unknown as ReciboCajaConRelaciones;
}

export async function obtenerReciboPorCotizacion(cotizacionId: string): Promise<ReciboCaja | null> {
  const { data } = await db()
    .from('recibos_caja')
    .select('*')
    .eq('cotizacion_id', cotizacionId)
    .maybeSingle();
  return (data ?? null) as ReciboCaja | null;
}

export async function listarEnvios(reciboId: string): Promise<ReciboCajaEnvio[]> {
  const { data, error } = await db()
    .from('recibos_caja_envios')
    .select('*')
    .eq('recibo_id', reciboId)
    .order('enviado_at', { ascending: false });

  if (error) throw new ReciboCajaError('Error al listar envíos', error);
  return (data ?? []) as ReciboCajaEnvio[];
}

// ── Generar y subir PDF (helper interno) ────────────────────────────────────

interface GenerarPDFInput {
  numero: string;
  fechaEmision: string;
  monto: number;
  concepto: string;
  cliente: { nombre: string; nit?: string | null; dpi?: string | null; direccion?: string | null };
  cotizacionNumero?: string | null;
  expedienteNumero?: string | null;
}

async function generarYSubirPDF(input: GenerarPDFInput): Promise<{ pdfBuffer: Buffer; storagePath: string }> {
  const pdfBuffer = await generarPDFReciboCaja(input);
  const year = new Date(input.fechaEmision).getFullYear();
  const storagePath = `${year}/${input.numero}.pdf`;
  const { error } = await db()
    .storage.from('recibos-caja')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (error) throw new ReciboCajaError('Error al subir el PDF a storage', error);
  return { pdfBuffer, storagePath };
}

// ── Flujo automático: registrar pago de gastos de una cotización ────────────

export async function registrarPagoGastos(input: RegistrarPagoGastosInput): Promise<ReciboCajaConRelaciones> {
  if (!input.cotizacion_id) throw new ReciboCajaError('cotizacion_id es requerido');
  if (!input.monto || input.monto <= 0) throw new ReciboCajaError('El monto debe ser mayor a 0');

  // Fetch cotización + cliente + expediente
  const { data: cot, error: cotErr } = await db()
    .from('cotizaciones')
    .select(`
      id, numero, monto_gastos, expediente_id, cliente_id,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, dpi, direccion, email, emails_cc_recibos),
      expediente:expedientes!expediente_id (id, numero)
    `)
    .eq('id', input.cotizacion_id)
    .single();

  if (cotErr || !cot) throw new ReciboCajaError('Cotización no encontrada', cotErr);

  const cliente = (cot as any).cliente;
  const expediente = (cot as any).expediente;
  if (!cliente) throw new ReciboCajaError('La cotización no tiene cliente asociado');

  const montoGastos = Number(cot.monto_gastos ?? 0);
  if (montoGastos <= 0) {
    throw new ReciboCajaError('La cotización no tiene gastos del trámite registrados');
  }
  if (Math.abs(input.monto - montoGastos) > 0.005) {
    throw new ReciboCajaError(
      `El monto del pago (Q${input.monto.toFixed(2)}) debe coincidir con los gastos del trámite (Q${montoGastos.toFixed(2)})`
    );
  }

  const existente = await obtenerReciboPorCotizacion(input.cotizacion_id);
  if (existente) {
    throw new ReciboCajaError(`Ya existe el recibo ${existente.numero} para esta cotización`);
  }

  // Correlativos atómicos
  const [rcRes, pagRes] = await Promise.all([
    db().schema('public').rpc('next_sequence', { p_tipo: 'RC' }) as any,
    db().schema('public').rpc('next_sequence', { p_tipo: 'PAG' }) as any,
  ]);
  if (rcRes.error)  throw new ReciboCajaError('Error al generar correlativo RC', rcRes.error);
  if (pagRes.error) throw new ReciboCajaError('Error al generar correlativo PAG', pagRes.error);
  const numeroRecibo = rcRes.data as string;
  const numeroPago = pagRes.data as string;

  const fechaPago = input.fecha_pago ?? new Date().toISOString().split('T')[0];
  const { data: pago, error: pagoErr } = await db()
    .from('pagos')
    .insert({
      numero: numeroPago,
      factura_id: null,
      cotizacion_id: input.cotizacion_id,
      cliente_id: cliente.id,
      fecha_pago: fechaPago,
      monto: input.monto,
      tipo: TipoPago.GASTOS_TRAMITE,
      estado: EstadoPago.CONFIRMADO,
      confirmado_at: new Date().toISOString(),
      metodo: input.metodo ?? 'transferencia',
      referencia_bancaria: input.referencia_bancaria ?? null,
      es_anticipo: false,
      notas: input.notas ?? null,
    })
    .select('id')
    .single();

  if (pagoErr || !pago) throw new ReciboCajaError('Error al registrar el pago', pagoErr);

  const concepto = expediente?.numero
    ? `Gastos de trámite — ${expediente.numero}`
    : `Gastos de trámite — Cotización ${cot.numero}`;
  const fechaEmisionISO = new Date().toISOString();

  let pdfData: { pdfBuffer: Buffer; storagePath: string };
  try {
    pdfData = await generarYSubirPDF({
      numero: numeroRecibo,
      fechaEmision: fechaEmisionISO,
      monto: input.monto,
      concepto,
      cliente: { nombre: cliente.nombre, nit: cliente.nit, dpi: cliente.dpi, direccion: cliente.direccion },
      cotizacionNumero: cot.numero,
      expedienteNumero: expediente?.numero ?? null,
    });
  } catch (err) {
    await rollbackPago(pago.id);
    throw err;
  }

  const { data: recibo, error: recErr } = await db()
    .from('recibos_caja')
    .insert({
      numero: numeroRecibo,
      cotizacion_id: input.cotizacion_id,
      cliente_id: cliente.id,
      pago_id: pago.id,
      origen: 'automatico',
      monto: input.monto,
      fecha_emision: fechaEmisionISO,
      concepto,
      pdf_url: pdfData.storagePath,
      notas: input.notas ?? null,
    })
    .select('id')
    .single();

  if (recErr || !recibo) {
    await Promise.allSettled([
      db().storage.from('recibos-caja').remove([pdfData.storagePath]),
      rollbackPago(pago.id),
    ]);
    throw new ReciboCajaError('Error al registrar el recibo', recErr);
  }

  // Email automático: incluye CC fijos del cliente
  const ccDefault = normalizarEmails(cliente.emails_cc_recibos ?? []);
  await enviarEmailRecibo({
    reciboId: recibo.id,
    to: cliente.email ?? '',
    cc: ccDefault,
    pdfBuffer: pdfData.pdfBuffer,
    snapshot: {
      numero: numeroRecibo,
      clienteNombre: cliente.nombre,
      monto: input.monto,
      concepto,
    },
    enviadoPor: null,    // emisión automática del sistema
  });

  return obtenerRecibo(recibo.id);
}

async function rollbackPago(pagoId: string): Promise<void> {
  try {
    await db().from('pagos').delete().eq('id', pagoId);
  } catch (e) {
    console.error('[recibos-caja] No se pudo rollback el pago', pagoId, e);
  }
}

// ── Flujo manual: crear recibo suelto (sin pago, sin email) ─────────────────

export async function crearReciboManual(
  input: CrearReciboManualInput,
  createdBy?: { id?: string | null; email?: string | null } | null,
): Promise<ReciboCajaConRelaciones> {
  if (!input.cliente_id) throw new ReciboCajaError('cliente_id es requerido');
  if (!input.monto || input.monto <= 0) throw new ReciboCajaError('El monto debe ser mayor a 0');
  if (!input.concepto?.trim()) throw new ReciboCajaError('El concepto es requerido');

  // Fecha: default hoy. Validar que no sea muy en el futuro.
  const fechaEmisionISO = input.fecha_emision
    ? new Date(input.fecha_emision).toISOString()
    : new Date().toISOString();
  const limiteFuturo = Date.now() + 30 * 24 * 60 * 60 * 1000; // +30 días
  if (new Date(fechaEmisionISO).getTime() > limiteFuturo) {
    throw new ReciboCajaError('La fecha de emisión no puede ser más de 30 días en el futuro');
  }

  // Validar cliente
  const { data: cliente, error: cliErr } = await db()
    .from('clientes')
    .select('id, codigo, nombre, nit, dpi, direccion, email, emails_cc_recibos, estado')
    .eq('id', input.cliente_id)
    .single();
  if (cliErr || !cliente) throw new ReciboCajaError('Cliente no encontrado', cliErr);
  if ((cliente as any).estado === 'inactivo') {
    throw new ReciboCajaError('El cliente está inactivo');
  }

  // Validar cotización (si se pasa)
  let cotizacion: { id: string; numero: string; expediente_id: string | null } | null = null;
  if (input.cotizacion_id) {
    const { data: cot, error: cotErr } = await db()
      .from('cotizaciones')
      .select('id, numero, cliente_id, expediente_id')
      .eq('id', input.cotizacion_id)
      .single();
    if (cotErr || !cot) throw new ReciboCajaError('Cotización no encontrada', cotErr);
    if (cot.cliente_id !== input.cliente_id) {
      throw new ReciboCajaError('La cotización no pertenece al cliente seleccionado');
    }
    cotizacion = { id: cot.id, numero: cot.numero, expediente_id: cot.expediente_id };
  }

  // Correlativo RC
  const rcRes = await db().schema('public').rpc('next_sequence', { p_tipo: 'RC' }) as any;
  if (rcRes.error) throw new ReciboCajaError('Error al generar correlativo RC', rcRes.error);
  const numeroRecibo = rcRes.data as string;

  // PDF
  let expedienteNumero: string | null = null;
  if (cotizacion?.expediente_id) {
    const { data: exp } = await db()
      .from('expedientes')
      .select('numero')
      .eq('id', cotizacion.expediente_id)
      .maybeSingle();
    expedienteNumero = exp?.numero ?? null;
  }

  const pdfData = await generarYSubirPDF({
    numero: numeroRecibo,
    fechaEmision: fechaEmisionISO,
    monto: input.monto,
    concepto: input.concepto.trim(),
    cliente: { nombre: cliente.nombre, nit: cliente.nit, dpi: cliente.dpi, direccion: cliente.direccion },
    cotizacionNumero: cotizacion?.numero ?? null,
    expedienteNumero,
  });

  const { data: recibo, error: recErr } = await db()
    .from('recibos_caja')
    .insert({
      numero: numeroRecibo,
      cotizacion_id: cotizacion?.id ?? null,
      cliente_id: cliente.id,
      pago_id: null,
      origen: 'manual',
      monto: input.monto,
      fecha_emision: fechaEmisionISO,
      concepto: input.concepto.trim(),
      pdf_url: pdfData.storagePath,
      notas: input.notas ?? null,
      created_by: createdBy?.id ?? null,
    })
    .select('id')
    .single();

  if (recErr || !recibo) {
    await db().storage.from('recibos-caja').remove([pdfData.storagePath]).catch(() => {});
    throw new ReciboCajaError('Error al registrar el recibo manual', recErr);
  }

  return obtenerRecibo(recibo.id);
}

// ── Vincular / desvincular cotización ───────────────────────────────────────

export async function vincularCotizacion(reciboId: string, cotizacionId: string | null): Promise<ReciboCajaConRelaciones> {
  const recibo = await obtenerRecibo(reciboId);

  if (cotizacionId) {
    const { data: cot, error } = await db()
      .from('cotizaciones')
      .select('id, cliente_id, numero')
      .eq('id', cotizacionId)
      .single();
    if (error || !cot) throw new ReciboCajaError('Cotización no encontrada', error);
    if (cot.cliente_id !== recibo.cliente_id) {
      throw new ReciboCajaError('La cotización no pertenece al cliente del recibo');
    }
  }

  const { error } = await db()
    .from('recibos_caja')
    .update({ cotizacion_id: cotizacionId, updated_at: new Date().toISOString() })
    .eq('id', reciboId);
  if (error) throw new ReciboCajaError('Error al vincular cotización', error);

  return obtenerRecibo(reciboId);
}

// ── Regenerar PDF (útil tras cambiar branding/datos del emisor) ─────────────

export async function regenerarPDF(reciboId: string): Promise<{ pdf_url: string }> {
  const recibo = await obtenerRecibo(reciboId);
  const cliente = recibo.cliente as any;

  // Datos extra: cliente completo + expediente si hay cotización
  const { data: cliFull } = await db()
    .from('clientes').select('nombre, nit, dpi, direccion').eq('id', recibo.cliente_id).single();

  let expedienteNumero: string | null = null;
  if (recibo.cotizacion_id) {
    const { data: cot } = await db()
      .from('cotizaciones').select('expediente_id, numero').eq('id', recibo.cotizacion_id).single();
    if (cot?.expediente_id) {
      const { data: exp } = await db().from('expedientes').select('numero').eq('id', cot.expediente_id).maybeSingle();
      expedienteNumero = exp?.numero ?? null;
    }
  }

  const { storagePath } = await generarYSubirPDF({
    numero: recibo.numero,
    fechaEmision: recibo.fecha_emision,
    monto: Number(recibo.monto),
    concepto: recibo.concepto,
    cliente: {
      nombre: cliFull?.nombre ?? cliente.nombre,
      nit:    cliFull?.nit    ?? cliente.nit,
      dpi:    cliFull?.dpi,
      direccion: cliFull?.direccion,
    },
    cotizacionNumero: recibo.cotizacion?.numero ?? null,
    expedienteNumero,
  });

  // El storagePath debería ser igual al previo (mismo numero+año). Aún así, persiste.
  if (storagePath !== recibo.pdf_url) {
    await db()
      .from('recibos_caja')
      .update({ pdf_url: storagePath, updated_at: new Date().toISOString() })
      .eq('id', reciboId);
  }

  return { pdf_url: storagePath };
}

// ── Envío de email (núcleo unificado: auto + manual + reintento) ────────────

interface EnviarEmailParams {
  reciboId: string;
  to: string;
  cc?: string[];
  asunto?: string;
  cuerpoHtml?: string;
  /** Si se pasa, se usa para el body por defecto y para asunto */
  snapshot?: { numero: string; clienteNombre: string; monto: number; concepto: string };
  /** Buffer del PDF; si no se pasa, se descarga del bucket */
  pdfBuffer?: Buffer;
  /** Email del admin que disparó el envío (para audit). null = sistema/auto */
  enviadoPor: string | null;
}

export async function enviarEmailRecibo(params: EnviarEmailParams): Promise<void> {
  const recibo = await obtenerRecibo(params.reciboId);

  // Si no llegó snapshot, lo armamos del recibo
  const snap = params.snapshot ?? {
    numero: recibo.numero,
    clienteNombre: recibo.cliente.nombre,
    monto: Number(recibo.monto),
    concepto: recibo.concepto,
  };

  const to = (params.to ?? '').trim();
  const ccList = normalizarEmails(params.cc ?? []);
  const asunto = (params.asunto?.trim() || `Recibo de Caja ${snap.numero} — ${EMISOR.nombreComercial} ${EMISOR.profesionalCorto}`);
  const cuerpoHtml = params.cuerpoHtml?.trim() || emailWrapper(buildCuerpoHtmlDefault(snap));

  // Descargar PDF si no se pasó (caso reintento o envío desde detalle)
  let pdfBuffer = params.pdfBuffer;
  if (!pdfBuffer) {
    if (!recibo.pdf_url) throw new ReciboCajaError('El recibo no tiene PDF en storage');
    const { data: blob, error } = await db().storage.from('recibos-caja').download(recibo.pdf_url);
    if (error || !blob) throw new ReciboCajaError('No se pudo descargar el PDF', error);
    pdfBuffer = Buffer.from(await blob.arrayBuffer());
  }

  // Validaciones
  if (!to) {
    await registrarEnvio(params.reciboId, {
      to: '', cc: ccList, asunto,
      enviadoPor: params.enviadoPor, exito: false,
      error: 'Sin destinatario (cliente sin email)',
    });
    await db().from('recibos_caja').update({
      email_error: 'El cliente no tiene email registrado',
      updated_at: new Date().toISOString(),
    }).eq('id', params.reciboId);
    return;
  }
  if (!isValidEmail(to)) {
    throw new ReciboCajaError(`Email destinatario inválido: ${to}`);
  }

  try {
    await enviarComprobantePorEmail({
      tipo: 'recibo_caja',
      destinatario: to,
      cc: ccList,
      asunto,
      cuerpoHtml,
      pdfBuffer,
      nombreArchivo: `${snap.numero}.pdf`,
    });

    await registrarEnvio(params.reciboId, {
      to, cc: ccList, asunto,
      enviadoPor: params.enviadoPor, exito: true, error: null,
    });

    await db().from('recibos_caja').update({
      email_enviado_at: new Date().toISOString(),
      email_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', params.reciboId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recibos-caja] Error al enviar email para recibo', params.reciboId, msg);

    await registrarEnvio(params.reciboId, {
      to, cc: ccList, asunto,
      enviadoPor: params.enviadoPor, exito: false, error: msg.slice(0, 1000),
    });

    await db().from('recibos_caja').update({
      email_error: msg.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq('id', params.reciboId);
  }
}

interface RegistrarEnvioParams {
  to: string;
  cc: string[];
  asunto: string;
  enviadoPor: string | null;
  exito: boolean;
  error: string | null;
}

async function registrarEnvio(reciboId: string, p: RegistrarEnvioParams): Promise<void> {
  await db().from('recibos_caja_envios').insert({
    recibo_id:     reciboId,
    enviado_a:     p.to,
    cc:            p.cc,
    enviado_por:   p.enviadoPor,
    asunto:        p.asunto,
    exito:         p.exito,
    error_mensaje: p.error,
  });
}

// ── Default body / helpers HTML ─────────────────────────────────────────────

function buildCuerpoHtmlDefault(p: { clienteNombre: string; numero: string; monto: number; concepto: string }): string {
  const montoStr = `Q ${p.monto.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `
    <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Recibo de Caja ${p.numero}</h2>
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
      Estimado/a <strong>${escapeHtml(p.clienteNombre)}</strong>,
    </p>
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
      Adjunto encontrará el Recibo de Caja correspondiente:
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;width:100%;">
      <tr>
        <td style="padding:12px 16px;background:#F8FAFC;border-left:3px solid #22D3EE;border-radius:6px;">
          <p style="margin:0 0 6px;color:#64748B;font-size:12px;letter-spacing:0.5px;">CONCEPTO</p>
          <p style="margin:0 0 12px;color:#0F172A;font-size:14px;font-weight:600;">${escapeHtml(p.concepto)}</p>
          <p style="margin:0 0 6px;color:#64748B;font-size:12px;letter-spacing:0.5px;">MONTO</p>
          <p style="margin:0;color:#0F172A;font-size:18px;font-weight:700;">${montoStr}</p>
        </td>
      </tr>
    </table>
    <p style="margin:16px 0;color:#64748B;font-size:12px;line-height:1.6;">
      Recordatorio: este Recibo de Caja es un comprobante NO fiscal y no sustituye
      a la factura fiscal de honorarios profesionales.
    </p>
    <p style="margin:24px 0 0;color:#334155;font-size:13px;">
      Saludos cordiales,<br>
      <strong>${escapeHtml(EMISOR.profesional)}</strong>
    </p>
  `;
}

/**
 * Plantilla HTML por defecto para el cuerpo del email del recibo.
 * Exportada para que la UI pueda pre-rellenar el modal de envío.
 */
export function plantillaCuerpoEmailRecibo(p: { clienteNombre: string; numero: string; monto: number; concepto: string }): string {
  return buildCuerpoHtmlDefault(p);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Reenvío rápido (sin args; usa defaults) — wrapper de compat ─────────────

export async function reenviarEmailRecibo(reciboId: string, enviadoPor: string | null = null): Promise<void> {
  const recibo = await obtenerRecibo(reciboId);
  const ccDefault = normalizarEmails(recibo.cliente.emails_cc_recibos ?? []);
  await enviarEmailRecibo({
    reciboId,
    to: recibo.cliente.email ?? '',
    cc: ccDefault,
    enviadoPor,
  });
}

// ── Signed URL para descarga ────────────────────────────────────────────────

export async function urlFirmadaPDF(reciboId: string, expiresInSec = 60 * 60): Promise<string> {
  const recibo = await obtenerRecibo(reciboId);
  if (!recibo.pdf_url) throw new ReciboCajaError('El recibo no tiene PDF');

  const { data, error } = await db()
    .storage.from('recibos-caja')
    .createSignedUrl(recibo.pdf_url, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new ReciboCajaError('No se pudo generar URL firmada', error);
  }
  return data.signedUrl;
}
