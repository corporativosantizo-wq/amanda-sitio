// ============================================================================
// lib/services/notas-entrega.service.ts
// Notas de entrega/recepción de documentos (NE-NNNN). Comprobante NO fiscal que
// firman ambas partes. Se crea automáticamente al agendar una cita de entrega
// (estado 'pendiente') y se completa desde el admin antes de la cita.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { generarPDFNotaEntrega } from './pdf-nota-entrega';
import type {
  NotaEntrega,
  CrearNotaEntregaInput,
  ActualizarNotaEntregaInput,
} from '@/lib/types';

const db = () => createAdminClient();
const BUCKET = 'notas-entrega';

export class NotaEntregaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'NotaEntregaError';
    this.details = details;
  }
}

const SELECT = `
  id, numero, cita_id, cliente_id, fecha,
  documentos_entregados, documentos_recibidos, notas, estado, pdf_url,
  created_at, updated_at,
  cliente:clientes!cliente_id (id, codigo, nombre, nit)
`;

// ── Listar / Obtener ────────────────────────────────────────────────────────

interface ListParams {
  cliente_id?: string;
  cita_id?: string;
  estado?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

export async function listarNotasEntrega(params: ListParams = {}) {
  const { cliente_id, cita_id, estado, busqueda, page = 1, limit = 30 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('notas_entrega')
    .select(SELECT, { count: 'exact' })
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (cita_id)    query = query.eq('cita_id', cita_id);
  if (estado)     query = query.eq('estado', estado);
  if (busqueda)   query = query.ilike('numero', `%${busqueda}%`);

  const { data, error, count } = await query;
  if (error) throw new NotaEntregaError('Error al listar notas de entrega', error);
  return { data: (data ?? []) as unknown as NotaEntrega[], total: count ?? 0, page, limit };
}

export async function obtenerNotaEntrega(id: string): Promise<NotaEntrega> {
  const { data, error } = await db()
    .from('notas_entrega')
    .select(SELECT)
    .eq('id', id)
    .single();
  if (error || !data) throw new NotaEntregaError('Nota de entrega no encontrada', error);
  return data as unknown as NotaEntrega;
}

// ── Crear ───────────────────────────────────────────────────────────────────

export async function crearNotaEntrega(input: CrearNotaEntregaInput): Promise<NotaEntrega> {
  if (!input.cliente_id) throw new NotaEntregaError('cliente_id es requerido');

  // Correlativo NE atómico
  const neRes = await db().schema('public').rpc('next_sequence', { p_tipo: 'NE' }) as any;
  if (neRes.error) throw new NotaEntregaError('Error al generar correlativo NE', neRes.error);
  const numero = neRes.data as string;

  const fecha = input.fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  const { data: nota, error } = await db()
    .from('notas_entrega')
    .insert({
      numero,
      cita_id: input.cita_id ?? null,
      cliente_id: input.cliente_id,
      fecha,
      documentos_entregados: input.documentos_entregados ?? null,
      documentos_recibidos: input.documentos_recibidos ?? null,
      notas: input.notas ?? null,
      estado: input.estado ?? 'pendiente',
    })
    .select('id')
    .single();

  if (error || !nota) throw new NotaEntregaError('Error al crear la nota de entrega', error);

  await regenerarPDF(nota.id).catch((e) =>
    console.error('[notas-entrega] No se pudo generar el PDF inicial:', e?.message ?? e),
  );

  return obtenerNotaEntrega(nota.id);
}

// ── Actualizar (regenera PDF) ───────────────────────────────────────────────

export async function actualizarNotaEntrega(
  id: string,
  input: ActualizarNotaEntregaInput,
): Promise<NotaEntrega> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.fecha !== undefined && input.fecha) patch.fecha = input.fecha;
  if (input.documentos_entregados !== undefined) patch.documentos_entregados = input.documentos_entregados?.trim() || null;
  if (input.documentos_recibidos !== undefined) patch.documentos_recibidos = input.documentos_recibidos?.trim() || null;
  if (input.notas !== undefined) patch.notas = input.notas?.trim() || null;
  if (input.estado !== undefined) patch.estado = input.estado;

  const { error } = await db().from('notas_entrega').update(patch).eq('id', id);
  if (error) throw new NotaEntregaError('Error al actualizar la nota de entrega', error);

  await regenerarPDF(id).catch((e) =>
    console.error('[notas-entrega] No se pudo regenerar el PDF:', e?.message ?? e),
  );

  return obtenerNotaEntrega(id);
}

export async function eliminarNotaEntrega(id: string): Promise<void> {
  const nota = await obtenerNotaEntrega(id);
  const { error } = await db().from('notas_entrega').delete().eq('id', id);
  if (error) throw new NotaEntregaError('Error al eliminar la nota de entrega', error);
  if (nota.pdf_url) {
    await db().storage.from(BUCKET).remove([nota.pdf_url]).catch(() => {});
  }
}

// ── PDF ─────────────────────────────────────────────────────────────────────

async function regenerarPDF(id: string): Promise<void> {
  const nota = await obtenerNotaEntrega(id);
  const pdf = await generarPDFNotaEntrega({
    numero: nota.numero,
    fecha: nota.fecha,
    cliente: { nombre: nota.cliente?.nombre ?? 'Cliente', nit: nota.cliente?.nit ?? null },
    documentosEntregados: nota.documentos_entregados,
    documentosRecibidos: nota.documentos_recibidos,
    notas: nota.notas,
  });

  const year = new Date(nota.fecha + 'T12:00:00').getFullYear();
  const storagePath = `${year}/${nota.numero}.pdf`;
  const { error: upErr } = await db()
    .storage.from(BUCKET)
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true });
  if (upErr) throw new NotaEntregaError('Error al subir el PDF', upErr);

  if (nota.pdf_url !== storagePath) {
    await db().from('notas_entrega').update({ pdf_url: storagePath }).eq('id', id);
  }
}

export async function urlFirmadaPDFNota(id: string, expiresInSec = 60 * 60): Promise<string> {
  const nota = await obtenerNotaEntrega(id);
  if (!nota.pdf_url) {
    // Genera el PDF on-demand si aún no existe.
    await regenerarPDF(id);
    const refrescada = await obtenerNotaEntrega(id);
    if (!refrescada.pdf_url) throw new NotaEntregaError('La nota no tiene PDF');
    nota.pdf_url = refrescada.pdf_url;
  }
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(nota.pdf_url, expiresInSec);
  if (error || !data?.signedUrl) throw new NotaEntregaError('No se pudo generar URL firmada', error);
  return data.signedUrl;
}
