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
  storage_path: string;
  nombre_archivo: string;
  tamano_bytes: number;
}

export interface ClasificacionIA {
  tipo: string;
  titulo: string;
  descripcion?: string;
  fecha_documento?: string | null;
  numero_documento?: string | null;
  partes?: any[];
  nombre_cliente_extraido?: string | null;
  confianza_ia?: number;
  metadata?: Record<string, unknown>;
  cliente_id?: string | null;
}

interface ListParams {
  estado?: string;
  tipo?: string;
  cliente_id?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function crearDocumento(input: DocumentoInsert) {
  const { data, error } = await db()
    .from('documentos')
    .insert({
      storage_path: input.storage_path,
      nombre_archivo: input.nombre_archivo,
      tamano_bytes: input.tamano_bytes,
      estado: 'pendiente',
    })
    .select('id, nombre_archivo, storage_path')
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
    nombre_cliente_extraido: clasificacion.nombre_cliente_extraido ?? null,
    confianza_ia: clasificacion.confianza_ia ?? 0,
    metadata: clasificacion.metadata ?? {},
    cliente_id: clasificacion.cliente_id ?? null,
    estado: 'clasificado',
    clasificado_at: new Date().toISOString(),
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
  const oldPath = doc.storage_path as string;
  const fileName = doc.nombre_archivo as string;

  // Mover archivo si tiene cliente asignado
  let newPath = oldPath;
  if (clienteId && oldPath.startsWith('pendientes/')) {
    newPath = `clientes/${clienteId}/${tipo}/${Date.now()}_${sanitizarNombre(fileName)}`;
    await moverArchivo(oldPath, newPath);
  }

  const updates: Record<string, unknown> = {
    estado: 'aprobado',
    storage_path: newPath,
    aprobado_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (edits?.tipo) updates.tipo = edits.tipo;
  if (edits?.titulo) updates.titulo = edits.titulo;
  if (edits?.fecha_documento !== undefined) updates.fecha_documento = edits.fecha_documento;
  if (edits?.cliente_id) updates.cliente_id = edits.cliente_id;
  if (edits?.notas) updates.notas = edits.notas;

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
  const { estado, tipo, cliente_id, busqueda, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('documentos')
    .select('*, cliente:clientes!cliente_id(id, codigo, nombre)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (estado) query = query.eq('estado', estado);
  if (tipo) query = query.eq('tipo', tipo);
  if (cliente_id) query = query.eq('cliente_id', cliente_id);
  if (busqueda) {
    query = query.or(
      `titulo.ilike.%${busqueda}%,nombre_archivo.ilike.%${busqueda}%,nombre_cliente_extraido.ilike.%${busqueda}%`
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
    .select('storage_path, estado')
    .eq('id', id)
    .single();

  if (doc) {
    // Eliminar archivo de Storage
    const storage = storageClient().storage.from('documentos');
    await storage.remove([doc.storage_path]);
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

// ── Error ───────────────────────────────────────────────────────────────────

export class DocumentoError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'DocumentoError';
    this.details = details;
  }
}
