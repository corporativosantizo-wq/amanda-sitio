// ============================================================================
// lib/services/tramites.service.ts
// CRUD de trámites + avances vinculados a cotizaciones, e "Informar al cliente"
// (envía un email con la línea de tiempo de avances no notificados y los marca
//  como notificados al confirmar éxito del envío).
//
// Adjuntos: bucket "documentos" bajo prefijo "tramite-avances/{tramite_id}/".
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { emailWrapper } from '@/lib/templates/emails';
import { sendMail } from './outlook.service';
import {
  type Tramite,
  type TramiteAvance,
  type TramiteConDetalle,
  type CrearTramiteInput,
  type ActualizarTramiteInput,
  type CrearAvanceInput,
  type EstadoTramite,
} from '@/lib/types';

const db = () => createAdminClient();
const BUCKET = 'documentos';
const PREFIX = 'tramite-avances';

export class TramiteError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    let full = message;
    if (details && typeof details === 'object') {
      const d = details as { message?: string; code?: string; hint?: string };
      const parts: string[] = [];
      if (d.message) parts.push(d.message);
      if (d.code)    parts.push(`[${d.code}]`);
      if (d.hint)    parts.push(d.hint);
      if (parts.length > 0) full = `${message}: ${parts.join(' ')}`;
    }
    super(full);
    this.name = 'TramiteError';
    this.details = details;
    console.error(`[TramiteError] ${full}`, details ?? '');
  }
}

// ── Listar / Obtener ────────────────────────────────────────────────────────

export async function listarTramitesDeCotizacion(
  cotizacionId: string,
): Promise<TramiteConDetalle[]> {
  const { data: tramites, error: tErr } = await db()
    .from('tramites')
    .select('id, cotizacion_id, nombre, estado, orden, created_at, updated_at')
    .eq('cotizacion_id', cotizacionId)
    .order('orden', { ascending: true })
    .order('created_at', { ascending: true });
  if (tErr) throw new TramiteError('Error al listar trámites', tErr);

  const tramiteIds = (tramites ?? []).map((t: { id: string }) => t.id);
  if (tramiteIds.length === 0) return [];

  const [avRes, itRes] = await Promise.all([
    db()
      .from('tramite_avances')
      .select('id, tramite_id, fecha, descripcion, documento_url, notificado, notificado_at, created_at')
      .in('tramite_id', tramiteIds)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    db()
      .from('cotizacion_items')
      .select('id, descripcion, total, orden, tramite_id')
      .in('tramite_id', tramiteIds)
      .order('orden', { ascending: true }),
  ]);

  if (avRes.error) throw new TramiteError('Error al listar avances', avRes.error);
  if (itRes.error) throw new TramiteError('Error al listar items', itRes.error);

  const avancesPorTramite = new Map<string, TramiteAvance[]>();
  for (const a of (avRes.data ?? []) as TramiteAvance[]) {
    const arr = avancesPorTramite.get(a.tramite_id) ?? [];
    arr.push(a);
    avancesPorTramite.set(a.tramite_id, arr);
  }

  const itemsPorTramite = new Map<string, Array<{ id: string; descripcion: string; total: number; orden: number }>>();
  for (const it of (itRes.data ?? []) as Array<{ id: string; descripcion: string; total: number; orden: number; tramite_id: string }>) {
    const arr = itemsPorTramite.get(it.tramite_id) ?? [];
    arr.push({ id: it.id, descripcion: it.descripcion, total: Number(it.total), orden: it.orden });
    itemsPorTramite.set(it.tramite_id, arr);
  }

  return (tramites ?? []).map((t: Tramite) => ({
    ...t,
    avances: avancesPorTramite.get(t.id) ?? [],
    items:   itemsPorTramite.get(t.id) ?? [],
  }));
}

export async function obtenerTramite(id: string): Promise<TramiteConDetalle> {
  const { data: t, error } = await db()
    .from('tramites')
    .select('id, cotizacion_id, nombre, estado, orden, created_at, updated_at')
    .eq('id', id)
    .single();
  if (error || !t) throw new TramiteError('Trámite no encontrado', error);

  const [avances, items] = await Promise.all([
    listarAvances(id),
    listarItemsDeTramite(id),
  ]);
  return { ...(t as Tramite), avances, items };
}

async function listarItemsDeTramite(tramiteId: string) {
  const { data, error } = await db()
    .from('cotizacion_items')
    .select('id, descripcion, total, orden')
    .eq('tramite_id', tramiteId)
    .order('orden', { ascending: true });
  if (error) throw new TramiteError('Error al listar items del trámite', error);
  type ItRow = { id: string; descripcion: string; total: number | string; orden: number };
  return (data ?? []).map((it: ItRow) => ({
    id: it.id, descripcion: it.descripcion, total: Number(it.total), orden: it.orden,
  }));
}

// ── Crear / Actualizar / Eliminar trámite ──────────────────────────────────

export async function crearTramite(input: CrearTramiteInput): Promise<Tramite> {
  if (!input.cotizacion_id) throw new TramiteError('cotizacion_id es requerido');
  const nombre = input.nombre.trim();
  if (!nombre) throw new TramiteError('El nombre es obligatorio');

  // Calcular siguiente orden = max(orden) + 1 (al final)
  const { data: maxOrden } = await db()
    .from('tramites')
    .select('orden')
    .eq('cotizacion_id', input.cotizacion_id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();
  const orden = (maxOrden?.orden ?? -1) + 1;

  const { data: t, error } = await db()
    .from('tramites')
    .insert({
      cotizacion_id: input.cotizacion_id,
      nombre,
      estado: input.estado ?? 'pendiente',
      orden,
    })
    .select('id, cotizacion_id, nombre, estado, orden, created_at, updated_at')
    .single();
  if (error || !t) throw new TramiteError('Error al crear trámite', error);

  // Si vienen item_ids, asignarlos al nuevo trámite (validar que pertenezcan a la cotización)
  if (input.item_ids && input.item_ids.length > 0) {
    const { error: upErr } = await db()
      .from('cotizacion_items')
      .update({ tramite_id: t.id })
      .in('id', input.item_ids)
      .eq('cotizacion_id', input.cotizacion_id);
    if (upErr) throw new TramiteError('Error al asignar items al trámite', upErr);
  }

  return t as Tramite;
}

export async function actualizarTramite(
  id: string,
  input: ActualizarTramiteInput,
): Promise<Tramite> {
  const patch: Record<string, unknown> = {};
  if (input.nombre !== undefined) {
    const n = input.nombre.trim();
    if (!n) throw new TramiteError('El nombre no puede estar vacío');
    patch.nombre = n;
  }
  if (input.estado !== undefined) patch.estado = input.estado;
  if (input.orden  !== undefined) patch.orden  = input.orden;

  if (Object.keys(patch).length === 0) {
    const { data, error } = await db()
      .from('tramites')
      .select('id, cotizacion_id, nombre, estado, orden, created_at, updated_at')
      .eq('id', id)
      .single();
    if (error || !data) throw new TramiteError('Trámite no encontrado', error);
    return data as Tramite;
  }

  const { data, error } = await db()
    .from('tramites')
    .update(patch)
    .eq('id', id)
    .select('id, cotizacion_id, nombre, estado, orden, created_at, updated_at')
    .single();
  if (error || !data) throw new TramiteError('Error al actualizar trámite', error);
  return data as Tramite;
}

export async function eliminarTramite(id: string): Promise<void> {
  // ON DELETE CASCADE en avances; ON DELETE SET NULL en cotizacion_items.tramite_id.
  // Limpiar best-effort cualquier adjunto en storage.
  const { data: avances } = await db()
    .from('tramite_avances')
    .select('documento_url')
    .eq('tramite_id', id);
  const paths = ((avances ?? []) as Array<{ documento_url: string | null }>)
    .map(a => a.documento_url)
    .filter((p): p is string => !!p);
  if (paths.length > 0) {
    await db().storage.from(BUCKET).remove(paths).catch((err: unknown) =>
      console.error('[tramites] Error al eliminar adjuntos del trámite', id, err),
    );
  }

  const { error } = await db().from('tramites').delete().eq('id', id);
  if (error) throw new TramiteError('Error al eliminar trámite', error);
}

// ── Fusionar trámites ───────────────────────────────────────────────────────
// Mueve todos los items y avances de `sourceId` a `targetId`, luego elimina
// `sourceId`. Útil para casos como COT-000034 donde quedan 2 trámites por
// persona (contrato + acta) y el usuario quiere uno solo.

export async function fusionarTramites(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) {
    throw new TramiteError('No se puede fusionar un trámite consigo mismo');
  }

  const [src, tgt] = await Promise.all([
    db().from('tramites').select('id, cotizacion_id').eq('id', sourceId).single(),
    db().from('tramites').select('id, cotizacion_id').eq('id', targetId).single(),
  ]);
  if (src.error || !src.data) throw new TramiteError('Trámite origen no encontrado', src.error);
  if (tgt.error || !tgt.data) throw new TramiteError('Trámite destino no encontrado', tgt.error);
  if (src.data.cotizacion_id !== tgt.data.cotizacion_id) {
    throw new TramiteError('Solo se pueden fusionar trámites de la misma cotización');
  }

  // 1. Mover items
  const { error: itemErr } = await db()
    .from('cotizacion_items')
    .update({ tramite_id: targetId })
    .eq('tramite_id', sourceId);
  if (itemErr) throw new TramiteError('Error al mover items en fusión', itemErr);

  // 2. Mover avances
  const { error: avErr } = await db()
    .from('tramite_avances')
    .update({ tramite_id: targetId })
    .eq('tramite_id', sourceId);
  if (avErr) throw new TramiteError('Error al mover avances en fusión', avErr);

  // 3. Eliminar trámite origen (ya quedó vacío)
  const { error: delErr } = await db().from('tramites').delete().eq('id', sourceId);
  if (delErr) throw new TramiteError('Error al eliminar trámite origen tras fusión', delErr);
}

// ── Avances: listar / crear / eliminar ─────────────────────────────────────

export async function listarAvances(tramiteId: string): Promise<TramiteAvance[]> {
  const { data, error } = await db()
    .from('tramite_avances')
    .select('id, tramite_id, fecha, descripcion, documento_url, notificado, notificado_at, created_at')
    .eq('tramite_id', tramiteId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new TramiteError('Error al listar avances', error);
  return (data ?? []) as TramiteAvance[];
}

export async function crearAvance(input: CrearAvanceInput): Promise<TramiteAvance> {
  const descripcion = input.descripcion.trim();
  if (!descripcion) throw new TramiteError('La descripción del avance es obligatoria');

  // Validar que el trámite exista
  const { data: t, error: tErr } = await db()
    .from('tramites')
    .select('id')
    .eq('id', input.tramite_id)
    .single();
  if (tErr || !t) throw new TramiteError('Trámite no encontrado', tErr);

  const { data, error } = await db()
    .from('tramite_avances')
    .insert({
      tramite_id:    input.tramite_id,
      fecha:         input.fecha ?? new Date().toISOString().slice(0, 10),
      descripcion,
      documento_url: input.documento_path ?? null,
    })
    .select('id, tramite_id, fecha, descripcion, documento_url, notificado, notificado_at, created_at')
    .single();
  if (error || !data) throw new TramiteError('Error al crear avance', error);
  return data as TramiteAvance;
}

export async function subirAdjuntoAvance(
  tramiteId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  const ts = Date.now();
  const path = `${PREFIX}/${tramiteId}/${ts}_${safeName}`;
  const { error } = await db()
    .storage.from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });
  if (error) throw new TramiteError('Error al subir adjunto', error);
  return path;
}

export async function urlFirmadaAdjunto(
  documentoPath: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(documentoPath, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new TramiteError('No se pudo generar URL firmada del adjunto', error);
  }
  return data.signedUrl;
}

export async function eliminarAvance(id: string): Promise<void> {
  const { data: av } = await db()
    .from('tramite_avances')
    .select('documento_url')
    .eq('id', id)
    .maybeSingle();

  const { error } = await db().from('tramite_avances').delete().eq('id', id);
  if (error) throw new TramiteError('Error al eliminar avance', error);

  if (av?.documento_url) {
    await db().storage.from(BUCKET).remove([av.documento_url]).catch((err: unknown) =>
      console.error('[tramites] Error al eliminar adjunto del avance', id, err),
    );
  }
}

// ── Informar al cliente (email con avances pendientes) ─────────────────────
//
// Toma TODOS los avances notificado=false de TODOS los trámites de la
// cotización, los agrupa por trámite, arma el cuerpo HTML y envía. Si el
// envío es exitoso, marca esos avances como notificados (atómico al éxito).

export interface InformarAvanceInput {
  cotizacionId: string;
  to: string;
  cc?: string[];
  asunto: string;
  mensaje: string;          // texto plano editado por el usuario
}

const ESTADO_LABEL: Record<EstadoTramite, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Completado',
  suspendido: 'Suspendido',
};

export async function informarAvanceAlCliente(input: InformarAvanceInput): Promise<{ avancesNotificados: number }> {
  if (!input.to.trim())      throw new TramiteError('Falta destinatario (Para)');
  if (!input.asunto.trim())  throw new TramiteError('Falta asunto');
  if (!input.mensaje.trim()) throw new TramiteError('Falta mensaje');

  // Validar que la cotización exista
  const { data: cot, error: cotErr } = await db()
    .from('cotizaciones')
    .select('id, numero')
    .eq('id', input.cotizacionId)
    .single();
  if (cotErr || !cot) throw new TramiteError('Cotización no encontrada', cotErr);

  // Tomar avances pendientes (snapshot para marcar después)
  const { data: avancesPendientes, error: apErr } = await db()
    .from('tramite_avances')
    .select(`
      id, tramite_id, fecha, descripcion, notificado,
      tramite:tramites!tramite_id (id, nombre, estado, cotizacion_id, orden)
    `)
    .eq('notificado', false)
    .order('fecha', { ascending: true });
  if (apErr) throw new TramiteError('Error al consultar avances pendientes', apErr);

  // Filtrar a los de esta cotización (la query con join no filtra; lo hacemos en memoria)
  type Row = {
    id: string; tramite_id: string; fecha: string; descripcion: string;
    tramite: { id: string; nombre: string; estado: EstadoTramite; cotizacion_id: string; orden: number } | null;
  };
  const filtrados = ((avancesPendientes ?? []) as unknown as Row[]).filter(
    a => a.tramite?.cotizacion_id === input.cotizacionId,
  );

  if (filtrados.length === 0) {
    throw new TramiteError('No hay avances pendientes de notificar para esta cotización');
  }

  const avanceIds = filtrados.map(a => a.id);

  // Enviar email
  const cuerpoHtml = emailWrapper(textoToHtml(input.mensaje));
  try {
    await sendMail({
      from: 'asistente@papeleo.legal',
      to: input.to.trim(),
      cc: input.cc && input.cc.length > 0 ? input.cc : undefined,
      subject: input.asunto.trim(),
      htmlBody: cuerpoHtml,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TramiteError(`Error al enviar email: ${msg}`);
  }

  // Marcar avances como notificados
  const { error: markErr } = await db()
    .from('tramite_avances')
    .update({ notificado: true, notificado_at: new Date().toISOString() })
    .in('id', avanceIds);
  if (markErr) {
    // Email ya salió. Logueamos pero no fallamos al usuario para no confundirlo.
    console.error('[tramites] Email enviado pero falló marcar como notificado', markErr);
  }

  return { avancesNotificados: avanceIds.length };
}

// Pre-llena el cuerpo del email a partir de los avances pendientes,
// agrupando por trámite. Usado por el endpoint que sirve la data al modal.
export async function generarBorradorInforme(cotizacionId: string): Promise<{
  asunto: string;
  cuerpo: string;
  hayAvancesPendientes: boolean;
  totalAvances: number;
  cliente: { id: string; nombre: string; email: string | null } | null;
  numero: string;
}> {
  const { data: cot, error: cotErr } = await db()
    .from('cotizaciones')
    .select(`
      id, numero,
      cliente:clientes!cliente_id (id, nombre, email)
    `)
    .eq('id', cotizacionId)
    .single();
  if (cotErr || !cot) throw new TramiteError('Cotización no encontrada', cotErr);

  const tramites = await listarTramitesDeCotizacion(cotizacionId);
  const conPendientes = tramites
    .map(t => ({ ...t, pendientes: t.avances.filter(a => !a.notificado) }))
    .filter(t => t.pendientes.length > 0);

  const totalAvances = conPendientes.reduce((sum, t) => sum + t.pendientes.length, 0);
  const cliente = (cot as unknown as { cliente: { id: string; nombre: string; email: string | null } | null }).cliente ?? null;
  const numero  = cot.numero;

  const clienteNombre = cliente?.nombre ?? 'Cliente';
  const lineas: string[] = [];
  lineas.push(`Estimado/a ${clienteNombre},`);
  lineas.push('');
  lineas.push(`Le informamos sobre el avance de los trámites correspondientes a la cotización ${numero}:`);
  lineas.push('');
  for (const t of conPendientes) {
    lineas.push(`▸ ${t.nombre} — Estado: ${ESTADO_LABEL[t.estado]}`);
    // Avances en orden cronológico ascendente para reporte
    const ordenados = [...t.pendientes].sort((a, b) => a.fecha.localeCompare(b.fecha));
    for (const a of ordenados) {
      lineas.push(`  • ${formatearFechaCorta(a.fecha)} — ${a.descripcion}`);
    }
    lineas.push('');
  }
  lineas.push('Quedamos a su disposición para cualquier consulta.');
  lineas.push('');
  lineas.push('Atentamente,');
  lineas.push('Amanda Santizo — Despacho Jurídico');

  return {
    asunto: `Avance de trámites — Cotización ${numero}`,
    cuerpo: lineas.join('\n'),
    hayAvancesPendientes: totalAvances > 0,
    totalAvances,
    cliente,
    numero,
  };
}

function formatearFechaCorta(yyyymmdd: string): string {
  // Interpretado a mediodía GT para no perder un día por shift de UTC
  const d = new Date(`${yyyymmdd}T12:00:00-06:00`);
  return d.toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textoToHtml(texto: string): string {
  const escaped = escapeHtml(texto);
  const conSaltos = escaped.replace(/\n/g, '<br>');
  return `<div style="color:#334155;font-size:14px;line-height:1.6;white-space:normal;">${conSaltos}</div>`;
}

// (re-export para que el route que envía adjuntos pueda usar la misma config)
export const TRAMITE_BUCKET = BUCKET;
export const TRAMITE_PREFIX = PREFIX;
