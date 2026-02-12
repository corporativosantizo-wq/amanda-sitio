// ============================================================================
// lib/services/documentos.service.ts
// Lógica de negocio para gestión documental
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';

const db = () => createAdminClient();

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export const TIPOS_DOCUMENTO = [
  { key: 'contrato_comercial', label: 'Contrato Comercial' },
  { key: 'escritura_publica', label: 'Escritura Pública' },
  { key: 'testimonio', label: 'Testimonio' },
  { key: 'acta_notarial', label: 'Acta Notarial' },
  { key: 'poder', label: 'Poder' },
  { key: 'contrato_laboral', label: 'Contrato Laboral' },
  { key: 'demanda_memorial', label: 'Demanda / Memorial' },
  { key: 'resolucion_judicial', label: 'Resolución Judicial' },
  { key: 'otro', label: 'Otro' },
] as const;

export interface DocumentoInsert {
  archivo_url: string;
  nombre_archivo: string;
  archivo_tamano: number;
  cliente_id?: string | null;
  nombre_original?: string;
}

export interface ClasificacionIA {
  tipo: string;
  titulo: string;
  descripcion?: string;
  fecha_documento?: string | null;
  numero_documento?: string | null;
  partes?: any[];
  cliente_nombre_detectado?: string | null;
  confianza_ia?: number;
  metadata?: Record<string, unknown>;
  cliente_id?: string | null;
}

interface ListParams {
  estado?: string;
  tipo?: string;
  cliente_id?: string;
  sin_cliente?: boolean;
  busqueda?: string;
  page?: number;
  limit?: number;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function crearDocumento(input: DocumentoInsert) {
  const payload: Record<string, unknown> = {
    archivo_url: input.archivo_url,
    nombre_archivo: input.nombre_archivo,
    archivo_tamano: input.archivo_tamano,
    nombre_original: input.nombre_original ?? input.nombre_archivo,
    titulo: input.nombre_archivo,
    tipo: 'otro',
    estado: 'pendiente',
  };
  if (input.cliente_id) payload.cliente_id = input.cliente_id;

  const { data, error } = await db()
    .from('documentos')
    .insert(payload)
    .select('id, nombre_archivo, archivo_url')
    .single();

  if (error) throw new DocumentoError('Error al crear documento', error);
  return data;
}

export async function clasificarDocumento(id: string, clasificacion: ClasificacionIA) {
  const updates: Record<string, unknown> = {
    tipo: clasificacion.tipo,
    titulo: clasificacion.titulo,
    descripcion: clasificacion.descripcion ?? null,
    fecha_documento: clasificacion.fecha_documento ?? null,
    numero_documento: clasificacion.numero_documento ?? null,
    partes: clasificacion.partes ?? [],
    cliente_nombre_detectado: clasificacion.cliente_nombre_detectado ?? null,
    confianza_ia: clasificacion.confianza_ia ?? 0,
    metadata: clasificacion.metadata ?? {},
    cliente_id: clasificacion.cliente_id ?? null,
    estado: 'clasificado',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db()
    .from('documentos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new DocumentoError('Error al clasificar documento', error);
  return data;
}

export async function aprobarDocumento(
  id: string,
  edits?: Partial<ClasificacionIA & { notas: string }>
) {
  // Obtener documento actual
  const { data: doc, error: fetchErr } = await db()
    .from('documentos')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchErr || !doc) throw new DocumentoError('Documento no encontrado');

  const clienteId = edits?.cliente_id ?? doc.cliente_id;
  const tipo = edits?.tipo ?? doc.tipo ?? 'otro';
  const oldPath = doc.archivo_url as string;
  const originalName = (doc.nombre_original ?? doc.nombre_archivo) as string;
  const extension = originalName.split('.').pop()?.toLowerCase() ?? 'pdf';

  const updates: Record<string, unknown> = {
    estado: 'aprobado',
    updated_at: new Date().toISOString(),
  };

  if (edits?.tipo) updates.tipo = edits.tipo;
  if (edits?.titulo) updates.titulo = edits.titulo;
  if (edits?.fecha_documento !== undefined) updates.fecha_documento = edits.fecha_documento;
  if (edits?.cliente_id) updates.cliente_id = edits.cliente_id;
  if (edits?.notas) updates.notas = edits.notas;

  // Move file to organized folder if client is assigned
  if (clienteId) {
    // Get client code
    const { data: cliente } = await db()
      .from('clientes')
      .select('codigo')
      .eq('id', clienteId)
      .single();

    const codigoCliente = (cliente?.codigo as string) ?? 'SIN-CODIGO';

    // Generate sequential document code
    const { count } = await db()
      .from('documentos')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clienteId)
      .not('codigo_documento', 'is', null);

    const secuencial = (count ?? 0) + 1;
    const tipoSlug = slugificarTipo(tipo);
    const codigoDoc = `${codigoCliente}-DOC-${String(secuencial).padStart(3, '0')}`;
    const nombreArchivo = `${codigoDoc}-${tipoSlug}.${extension}`;
    const newPath = `${codigoCliente}/${nombreArchivo}`;

    // Move the file
    if (oldPath !== newPath) {
      await moverArchivo(oldPath, newPath);
    }

    updates.archivo_url = newPath;
    updates.nombre_archivo = nombreArchivo;
    updates.codigo_documento = codigoDoc;
  }

  const { data, error } = await db()
    .from('documentos')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new DocumentoError('Error al aprobar documento', error);
  return data;
}

export async function rechazarDocumento(id: string, notas?: string) {
  const { data, error } = await db()
    .from('documentos')
    .update({
      estado: 'rechazado',
      notas: notas ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new DocumentoError('Error al rechazar documento', error);
  return data;
}

export async function listarDocumentos(params: ListParams = {}) {
  const { estado, tipo, cliente_id, sin_cliente, busqueda, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('documentos')
    .select('*, cliente:clientes!cliente_id(id, codigo, nombre)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) query = query.eq('estado', estado);
  if (tipo) query = query.eq('tipo', tipo);
  if (sin_cliente) query = query.is('cliente_id', null);
  else if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (busqueda) {
    query = query.or(
      `titulo.ilike.%${busqueda}%,nombre_archivo.ilike.%${busqueda}%,cliente_nombre_detectado.ilike.%${busqueda}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new DocumentoError('Error al listar documentos', error);

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerDocumento(id: string) {
  const { data, error } = await db()
    .from('documentos')
    .select('*, cliente:clientes!cliente_id(id, codigo, nombre)')
    .eq('id', id)
    .single();

  if (error || !data) throw new DocumentoError('Documento no encontrado', error);
  return data;
}

export async function eliminarDocumento(id: string) {
  const { data: doc } = await db()
    .from('documentos')
    .select('archivo_url, estado')
    .eq('id', id)
    .single();

  if (doc) {
    // Eliminar archivo de Storage
    const storage = storageClient().storage.from('documentos');
    await storage.remove([doc.archivo_url]);
  }

  const { error } = await db()
    .from('documentos')
    .delete()
    .eq('id', id);

  if (error) throw new DocumentoError('Error al eliminar documento', error);
}

// ── Fuzzy matching de clientes ──────────────────────────────────────────────

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcularSimilitud(a: string, b: string): number {
  const na = normalizar(a);
  const nb = normalizar(b);

  // Containment check
  if (na.includes(nb) || nb.includes(na)) return 0.8;

  // Token overlap (Jaccard)
  const tokensA = new Set(na.split(' ').filter((t: string) => t.length > 2));
  const tokensB = new Set(nb.split(' ').filter((t: string) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((t: string) => {
    if (tokensB.has(t)) intersection++;
  });

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

export async function buscarClienteFuzzy(
  nombreExtraido: string
): Promise<{ id: string; nombre: string; codigo: string; confianza: number } | null> {
  if (!nombreExtraido?.trim()) return null;

  const { data: clientes } = await db()
    .from('clientes')
    .select('id, nombre, codigo')
    .eq('activo', true);

  if (!clientes || clientes.length === 0) return null;

  let mejor: { id: string; nombre: string; codigo: string; confianza: number } | null = null;
  let mejorScore = 0;

  for (const c of clientes) {
    const score = calcularSimilitud(nombreExtraido, c.nombre as string);
    if (score > mejorScore && score >= 0.4) {
      mejorScore = score;
      mejor = {
        id: c.id as string,
        nombre: c.nombre as string,
        codigo: c.codigo as string,
        confianza: Math.round(score * 100) / 100,
      };
    }
  }

  return mejor;
}

export async function buscarClientePorNombreArchivo(
  filename: string
): Promise<{ id: string; nombre: string; codigo: string; confianza: number } | null> {
  if (!filename?.trim()) return null;

  // Extract potential name from filename: remove extension, replace separators with spaces
  const sinExt = filename.replace(/\.[^.]+$/, '');
  const humanized = sinExt
    .replace(/[_\-\.]+/g, ' ')
    .replace(/\d{6,}/g, '') // remove long numbers (dates, timestamps)
    .replace(/\b(dpi|nit|contrato|factura|recibo|escritura|acta|poder|doc|pdf|scan|copia)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (humanized.length < 3) return null;

  return buscarClienteFuzzy(humanized);
}

// ── Carpetas y nomenclatura ──────────────────────────────────────────────

export function slugificarTipo(tipo: string): string {
  const label = TIPOS_DOCUMENTO.find((t: any) => t.key === tipo)?.label ?? tipo;
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function clientesConDocumentos(): Promise<
  { cliente_id: string; codigo: string; nombre: string; total_docs: number }[]
> {
  // Get distinct client_ids that have documents
  const { data: docs } = await db()
    .from('documentos')
    .select('cliente_id, cliente:clientes!cliente_id(id, codigo, nombre)')
    .not('cliente_id', 'is', null)
    .order('created_at', { ascending: false });

  if (!docs?.length) return [];

  // Group by client
  const map = new Map<string, { codigo: string; nombre: string; total_docs: number }>();
  for (const d of docs) {
    const c = d.cliente as any;
    if (!c?.id) continue;
    const existing = map.get(c.id);
    if (existing) {
      existing.total_docs++;
    } else {
      map.set(c.id, { codigo: c.codigo ?? '', nombre: c.nombre ?? '', total_docs: 1 });
    }
  }

  return Array.from(map.entries()).map(([cliente_id, v]: [string, any]) => ({
    cliente_id,
    ...v,
  })).sort((a: any, b: any) => a.codigo.localeCompare(b.codigo));
}

export async function previewCodigoDocumento(clienteId: string, tipo: string): Promise<{
  codigo_documento: string;
  nombre_archivo: string;
  storage_path: string;
}> {
  const { data: cliente } = await db()
    .from('clientes')
    .select('codigo')
    .eq('id', clienteId)
    .single();

  const codigoCliente = (cliente?.codigo as string) ?? 'SIN-CODIGO';

  const { count } = await db()
    .from('documentos')
    .select('*', { count: 'exact', head: true })
    .eq('cliente_id', clienteId)
    .not('codigo_documento', 'is', null);

  const secuencial = (count ?? 0) + 1;
  const tipoSlug = slugificarTipo(tipo);
  const codigoDoc = `${codigoCliente}-DOC-${String(secuencial).padStart(3, '0')}`;
  const nombreArchivo = `${codigoDoc}-${tipoSlug}.pdf`;
  const storagePath = `${codigoCliente}/${nombreArchivo}`;

  return { codigo_documento: codigoDoc, nombre_archivo: nombreArchivo, storage_path: storagePath };
}

// ── Storage helpers ─────────────────────────────────────────────────────────

export function sanitizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
}

async function moverArchivo(oldPath: string, newPath: string) {
  const storage = storageClient().storage.from('documentos');

  const { error: copyErr } = await storage.copy(oldPath, newPath);
  if (copyErr) throw new DocumentoError('Error al mover archivo', copyErr);

  // Delete old (fire and forget, log if error)
  const { error: delErr } = await storage.remove([oldPath]);
  if (delErr) console.error('[Documentos] Warning: no se pudo eliminar archivo original:', delErr);
}

export async function descargarPDF(storagePath: string): Promise<Buffer> {
  const storage = storageClient().storage.from('documentos');
  const { data, error } = await storage.download(storagePath);
  if (error || !data) throw new DocumentoError('Error al descargar PDF', error);
  return Buffer.from(await data.arrayBuffer());
}

export async function generarSignedUrl(storagePath: string, expiresIn = 300): Promise<string> {
  const storage = storageClient().storage.from('documentos');
  const { data, error } = await storage.createSignedUrl(storagePath, expiresIn);
  if (error || !data) throw new DocumentoError('Error al generar URL firmada', error);
  return data.signedUrl;
}

// ── Extracción de texto de PDFs ─────────────────────────────────────────────

const MAX_TEXT_LENGTH = 50000;
const MAX_FILE_SIZE_OCR = 50 * 1024 * 1024; // 50 MB

function sanitizarTextoExtraido(texto: string): string {
  return texto
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[\uFFFE\uFFFF]/g, '');
}

export async function extraerYGuardarTexto(docId: string, archivoUrl: string): Promise<void> {
  try {
    const buffer = await descargarPDF(archivoUrl);

    if (buffer.length > MAX_FILE_SIZE_OCR) {
      console.log(`[OCR] Saltado ${archivoUrl} (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 50 MB)`);
      await db().from('documentos').update({ texto_extraido: '[archivo demasiado grande]' }).eq('id', docId);
      return;
    }

    const { PDFParse } = await import('pdf-parse');
    const pdf = new PDFParse({ data: buffer });
    let textoRaw: string;
    try {
      const result = await pdf.getText();
      textoRaw = (result.text || '').trim();
    } finally {
      await pdf.destroy();
    }

    const texto = sanitizarTextoExtraido(textoRaw);

    if (texto.length > 10) {
      await db().from('documentos').update({ texto_extraido: texto.slice(0, MAX_TEXT_LENGTH) }).eq('id', docId);
    } else {
      await db().from('documentos').update({ texto_extraido: '[sin texto extraible]' }).eq('id', docId);
    }
  } catch (err: any) {
    console.error(`[OCR] Error extrayendo texto de ${archivoUrl}:`, err.message);
    // No throw — extraction failure must not affect the upload
  }
}

// ── Stats para Clasificador ─────────────────────────────────────────────────

export async function obtenerStatsClasificador() {
  const [sinCliente, pendientes, clasificados, total] = await Promise.all([
    db().from('documentos').select('*', { count: 'exact', head: true }).is('cliente_id', null),
    db().from('documentos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente'),
    db().from('documentos').select('*', { count: 'exact', head: true }).eq('estado', 'clasificado'),
    db().from('documentos').select('*', { count: 'exact', head: true }),
  ]);

  return {
    sin_cliente: sinCliente.count ?? 0,
    pendientes: pendientes.count ?? 0,
    clasificados: clasificados.count ?? 0,
    total: total.count ?? 0,
  };
}

// ── Error ───────────────────────────────────────────────────────────────────

export class DocumentoError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'DocumentoError';
    this.details = details;
  }
}
