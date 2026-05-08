// ============================================================================
// lib/services/recibos-caja.service.ts
// Lógica del Recibo de Caja: comprobante NO fiscal de pagos de gastos del
// trámite. Paralelo a factura/honorarios.
//
// Flujo registrarPagoGastos:
//   1. Validar (cotización existe, monto coincide con monto_gastos, sin duplicado)
//   2. Generar correlativo RC-NNNN (atómico vía next_sequence)
//   3. Insertar pago en `pagos` (tipo='gastos_tramite', confirmado)
//   4. Generar PDF
//   5. Subir PDF a bucket recibos-caja/{año}/{numero}.pdf
//   6. Insertar registro en recibos_caja
//   7. Enviar email (best-effort: si falla, registrar email_error)
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { generarPDFReciboCaja } from './pdf-recibo-caja';
import { enviarComprobantePorEmail } from './comprobantes-email';
import { emailWrapper } from '@/lib/templates/emails';
import {
  EstadoPago,
  TipoPago,
  type ReciboCaja,
  type ReciboCajaConRelaciones,
  type RegistrarPagoGastosInput,
  type CrearReciboManualInput,
} from '@/lib/types';
import { EMISOR } from '@/lib/config/emisor';

const db = () => createAdminClient();

export class ReciboCajaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    // Apenda mensaje + code + hint del error de Supabase/PG si vienen, para que
    // el banner del form no muestre un mensaje genérico sino el detalle real.
    let fullMessage = message;
    if (details && typeof details === 'object') {
      const d = details as { message?: string; code?: string; hint?: string };
      const parts: string[] = [];
      if (d.message) parts.push(d.message);
      if (d.code)    parts.push(`[${d.code}]`);
      if (d.hint)    parts.push(d.hint);
      if (parts.length > 0) fullMessage = `${message}: ${parts.join(' ')}`;
    }
    super(fullMessage);
    this.name = 'ReciboCajaError';
    this.details = details;
    console.error(`[ReciboCajaError] ${fullMessage}`, details ?? '');
  }
}

// ── Listar / Obtener ────────────────────────────────────────────────────────

interface ListParams {
  cliente_id?: string;
  cotizacion_id?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

export async function listarRecibos(params: ListParams = {}) {
  const { cliente_id, cotizacion_id, desde, hasta, busqueda, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('recibos_caja')
    .select(`
      id, numero, monto, fecha_emision, concepto,
      pdf_url, email_enviado_at, email_error, notas,
      cotizacion_id, cliente_id, pago_id, created_at, updated_at,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email),
      cotizacion:cotizaciones!cotizacion_id (id, numero)
    `, { count: 'exact' })
    .order('fecha_emision', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cliente_id)    query = query.eq('cliente_id', cliente_id);
  if (cotizacion_id) query = query.eq('cotizacion_id', cotizacion_id);
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
    .select(`
      *,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, email),
      cotizacion:cotizaciones!cotizacion_id (id, numero)
    `)
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

// ── Registrar pago de gastos (transacción "best-effort") ────────────────────

export async function registrarPagoGastos(input: RegistrarPagoGastosInput): Promise<ReciboCajaConRelaciones> {
  // 1. Validaciones básicas
  if (!input.cotizacion_id) {
    throw new ReciboCajaError('cotizacion_id es requerido');
  }
  if (!input.monto || input.monto <= 0) {
    throw new ReciboCajaError('El monto debe ser mayor a 0');
  }

  // 2. Fetch cotización + cliente + expediente
  const { data: cot, error: cotErr } = await db()
    .from('cotizaciones')
    .select(`
      id, numero, monto_gastos, expediente_id, cliente_id,
      cliente:clientes!cliente_id (id, codigo, nombre, nit, dpi, direccion, email),
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

  // 3. Asegurar que no existe recibo previo para esta cotización
  const existente = await obtenerReciboPorCotizacion(input.cotizacion_id);
  if (existente) {
    throw new ReciboCajaError(`Ya existe el recibo ${existente.numero} para esta cotización`);
  }

  // 4. Generar correlativos atómicos (RC + PAG) en paralelo
  const [rcRes, pagRes] = await Promise.all([
    db().schema('public').rpc('next_sequence', { p_tipo: 'RC' }) as any,
    db().schema('public').rpc('next_sequence', { p_tipo: 'PAG' }) as any,
  ]);
  if (rcRes.error) throw new ReciboCajaError('Error al generar correlativo RC', rcRes.error);
  if (pagRes.error) throw new ReciboCajaError('Error al generar correlativo PAG', pagRes.error);
  const numeroRecibo = rcRes.data as string;
  const numeroPago = pagRes.data as string;

  // 5. Insertar pago (estado=confirmado directamente; tipo gastos_tramite)
  const fechaPago = input.fecha_pago ?? new Date().toISOString().split('T')[0];
  const { data: pago, error: pagoErr } = await db()
    .from('pagos')
    .insert({
      numero: numeroPago,
      factura_id: null,                        // no aplica para gastos
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

  // 6. Generar PDF
  const concepto = expediente?.numero
    ? `Gastos de trámite — ${expediente.numero}`
    : `Gastos de trámite — Cotización ${cot.numero}`;
  const fechaEmisionISO = new Date().toISOString();

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generarPDFReciboCaja({
      numero: numeroRecibo,
      fechaEmision: fechaEmisionISO,
      monto: input.monto,
      concepto,
      cliente: {
        nombre: cliente.nombre,
        nit: cliente.nit,
        dpi: cliente.dpi,
        direccion: cliente.direccion,
      },
      cotizacionNumero: cot.numero,
      expedienteNumero: expediente?.numero ?? null,
    });
  } catch (err) {
    await rollbackPago(pago.id);
    throw new ReciboCajaError('Error al generar el PDF del recibo', err);
  }

  // 7. Upload PDF a bucket
  const year = new Date().getFullYear();
  const storagePath = `${year}/${numeroRecibo}.pdf`;
  const { error: upErr } = await db()
    .storage.from('recibos-caja')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (upErr) {
    await rollbackPago(pago.id);
    throw new ReciboCajaError('Error al subir el PDF a storage', upErr);
  }

  // 8. Insertar registro en recibos_caja
  const { data: recibo, error: recErr } = await db()
    .from('recibos_caja')
    .insert({
      numero: numeroRecibo,
      cotizacion_id: input.cotizacion_id,
      cliente_id: cliente.id,
      pago_id: pago.id,
      monto: input.monto,
      fecha_emision: fechaEmisionISO,
      concepto,
      pdf_url: storagePath,
      notas: input.notas ?? null,
    })
    .select('id')
    .single();

  if (recErr || !recibo) {
    await Promise.allSettled([
      db().storage.from('recibos-caja').remove([storagePath]),
      rollbackPago(pago.id),
    ]);
    throw new ReciboCajaError('Error al registrar el recibo', recErr);
  }

  // 9. Email (best-effort: el recibo ya está creado, no se rompe el flujo)
  await intentarEnviarEmail(recibo.id, {
    destinatarioEmail: cliente.email ?? null,
    clienteNombre: cliente.nombre,
    numero: numeroRecibo,
    monto: input.monto,
    concepto,
    pdfBuffer,
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
//
// Diseño minimal post-rollback: sólo valida + genera correlativo + PDF +
// upload + INSERT. NO envía email ni registra historial. Si falla cualquier
// paso, intenta limpiar el storage. NO setea created_by (Clerk userId no es
// UUID; trazabilidad va por audit log).

export async function crearReciboManual(
  input: CrearReciboManualInput,
): Promise<ReciboCajaConRelaciones> {
  // 1. Validaciones de input
  if (!input.cliente_id) throw new ReciboCajaError('cliente_id es requerido');
  if (!input.monto || input.monto <= 0) throw new ReciboCajaError('El monto debe ser mayor a 0');
  if (!input.concepto?.trim()) throw new ReciboCajaError('El concepto es requerido');

  // La fecha del form llega como YYYY-MM-DD. Se interpreta como mediodía en
  // Guatemala (UTC-6) para que al mostrarla en cualquier timezone GT siga
  // siendo el mismo día. Si llega vacía, usa "ahora".
  const fechaEmisionISO = input.fecha_emision
    ? new Date(`${input.fecha_emision}T12:00:00-06:00`).toISOString()
    : new Date().toISOString();
  const limiteFuturo = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (new Date(fechaEmisionISO).getTime() > limiteFuturo) {
    throw new ReciboCajaError('La fecha de emisión no puede ser más de 30 días en el futuro');
  }

  // 2. Validar cliente
  const { data: cliente, error: cliErr } = await db()
    .from('clientes')
    .select('id, codigo, nombre, nit, dpi, direccion, email, estado')
    .eq('id', input.cliente_id)
    .single();
  if (cliErr || !cliente) {
    console.error('[crearReciboManual] cliente no encontrado', { cliente_id: input.cliente_id, error: cliErr });
    throw new ReciboCajaError('Cliente no encontrado', cliErr);
  }
  if ((cliente as any).estado === 'inactivo') {
    throw new ReciboCajaError('El cliente está inactivo');
  }

  // 3. Validar cotización (si se pasó) y que pertenezca al cliente
  let cotizacion: { id: string; numero: string; expediente_id: string | null } | null = null;
  if (input.cotizacion_id) {
    const { data: cot, error: cotErr } = await db()
      .from('cotizaciones')
      .select('id, numero, cliente_id, expediente_id')
      .eq('id', input.cotizacion_id)
      .single();
    if (cotErr || !cot) {
      throw new ReciboCajaError('Cotización no encontrada', cotErr);
    }
    if (cot.cliente_id !== input.cliente_id) {
      throw new ReciboCajaError('La cotización no pertenece al cliente seleccionado');
    }
    cotizacion = { id: cot.id, numero: cot.numero, expediente_id: cot.expediente_id };
  }

  // 4. Correlativo RC atómico
  const rcRes = await db().schema('public').rpc('next_sequence', { p_tipo: 'RC' }) as any;
  if (rcRes.error) {
    console.error('[crearReciboManual] next_sequence(RC) falló', rcRes.error);
    throw new ReciboCajaError('Error al generar correlativo RC', rcRes.error);
  }
  const numeroRecibo = rcRes.data as string;

  // 5. Expediente para el concepto del PDF
  let expedienteNumero: string | null = null;
  if (cotizacion?.expediente_id) {
    const { data: exp } = await db()
      .from('expedientes')
      .select('numero')
      .eq('id', cotizacion.expediente_id)
      .maybeSingle();
    expedienteNumero = exp?.numero ?? null;
  }

  // 6. Generar PDF
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generarPDFReciboCaja({
      numero: numeroRecibo,
      fechaEmision: fechaEmisionISO,
      monto: input.monto,
      concepto: input.concepto.trim(),
      cliente: {
        nombre: (cliente as any).nombre,
        nit: (cliente as any).nit,
        dpi: (cliente as any).dpi,
        direccion: (cliente as any).direccion,
      },
      cotizacionNumero: cotizacion?.numero ?? null,
      expedienteNumero,
    });
  } catch (err) {
    console.error('[crearReciboManual] generarPDFReciboCaja falló', err);
    throw new ReciboCajaError('Error al generar el PDF del recibo', err);
  }

  // 7. Upload PDF
  const year = new Date(fechaEmisionISO).getFullYear();
  const storagePath = `${year}/${numeroRecibo}.pdf`;
  const { error: upErr } = await db()
    .storage.from('recibos-caja')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (upErr) {
    console.error('[crearReciboManual] storage upload falló', upErr);
    throw new ReciboCajaError('Error al subir el PDF a storage', upErr);
  }

  // 8. INSERT recibos_caja (origen=manual; SIN created_by)
  const { data: recibo, error: recErr } = await db()
    .from('recibos_caja')
    .insert({
      numero: numeroRecibo,
      cotizacion_id: cotizacion?.id ?? null,
      cliente_id: (cliente as any).id,
      pago_id: null,
      origen: 'manual',
      monto: input.monto,
      fecha_emision: fechaEmisionISO,
      concepto: input.concepto.trim(),
      pdf_url: storagePath,
      notas: input.notas ?? null,
    })
    .select('id')
    .single();

  if (recErr || !recibo) {
    console.error('[crearReciboManual] INSERT recibos_caja falló', {
      numero: numeroRecibo, cliente_id: (cliente as any).id, error: recErr,
    });
    await db().storage.from('recibos-caja').remove([storagePath]).catch(() => {});
    throw new ReciboCajaError('Error al registrar el recibo manual', recErr);
  }

  return obtenerRecibo(recibo.id);
}

// ── Email (envío + reintento) ───────────────────────────────────────────────

interface IntentoEmailParams {
  destinatarioEmail: string | null;
  clienteNombre: string;
  numero: string;
  monto: number;
  concepto: string;
  pdfBuffer: Buffer;
}

async function intentarEnviarEmail(reciboId: string, params: IntentoEmailParams): Promise<void> {
  if (!params.destinatarioEmail) {
    await db()
      .from('recibos_caja')
      .update({
        email_error: 'El cliente no tiene email registrado',
        updated_at: new Date().toISOString(),
      })
      .eq('id', reciboId);
    return;
  }

  try {
    await enviarComprobantePorEmail({
      tipo: 'recibo_caja',
      destinatario: params.destinatarioEmail,
      asunto: `Recibo de Caja ${params.numero} — Gastos de trámite`,
      cuerpoHtml: emailWrapper(buildCuerpoHtml(params)),
      pdfBuffer: params.pdfBuffer,
      nombreArchivo: `${params.numero}.pdf`,
    });

    await db()
      .from('recibos_caja')
      .update({
        email_enviado_at: new Date().toISOString(),
        email_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reciboId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recibos-caja] Error al enviar email para recibo', reciboId, msg);
    await db()
      .from('recibos_caja')
      .update({
        email_error: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reciboId);
  }
}

function buildCuerpoHtml(p: { clienteNombre: string; numero: string; monto: number; concepto: string }): string {
  const montoStr = `Q ${p.monto.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `
    <h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Recibo de Caja ${p.numero}</h2>
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
      Estimado/a <strong>${escapeHtml(p.clienteNombre)}</strong>,
    </p>
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
      Le agradecemos el pago de los gastos del trámite. Adjunto encontrará el
      Recibo de Caja correspondiente:
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
      Recordatorio: este Recibo de Caja respalda el pago de gastos del trámite
      y NO sustituye a la factura fiscal de honorarios profesionales.
    </p>
    <p style="margin:24px 0 0;color:#334155;font-size:13px;">
      Saludos cordiales,<br>
      <strong>${escapeHtml(EMISOR.profesional)}</strong>
    </p>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Envío manual personalizado desde la UI (modal con Para/CC/Asunto/Mensaje) ─

export interface EnviarEmailReciboInput {
  to: string;          // email destinatario único (validado por el route)
  cc?: string[];       // lista ya parseada y validada
  asunto: string;
  mensaje: string;     // texto plano desde el textarea
}

export async function enviarEmailReciboPersonalizado(
  reciboId: string,
  input: EnviarEmailReciboInput,
): Promise<void> {
  const recibo = await obtenerRecibo(reciboId);
  if (!recibo.pdf_url) {
    throw new ReciboCajaError('El recibo no tiene PDF en storage');
  }

  const { data: pdfBlob, error: dlErr } = await db()
    .storage.from('recibos-caja')
    .download(recibo.pdf_url);

  if (dlErr || !pdfBlob) {
    throw new ReciboCajaError('No se pudo descargar el PDF del recibo', dlErr);
  }

  const pdfBuffer = Buffer.from(await pdfBlob.arrayBuffer());
  const cuerpoHtml = emailWrapper(textoToHtml(input.mensaje));

  try {
    await enviarComprobantePorEmail({
      tipo: 'recibo_caja',
      destinatario: input.to,
      cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
      asunto: input.asunto,
      cuerpoHtml,
      pdfBuffer,
      nombreArchivo: `${recibo.numero}.pdf`,
    });

    await db()
      .from('recibos_caja')
      .update({
        email_enviado_at: new Date().toISOString(),
        email_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reciboId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[recibos-caja] Error al enviar email personalizado', reciboId, msg);
    await db()
      .from('recibos_caja')
      .update({
        email_error: msg.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reciboId);
    throw new ReciboCajaError(`Error al enviar email: ${msg}`);
  }
}

function textoToHtml(texto: string): string {
  const escaped = escapeHtml(texto);
  const conSaltos = escaped.replace(/\n/g, '<br>');
  return `<div style="color:#334155;font-size:14px;line-height:1.6;white-space:normal;">${conSaltos}</div>`;
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
