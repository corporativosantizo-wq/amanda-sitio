// ============================================================================
// lib/services/jurisprudencia.service.ts
// Lógica de negocio para gestión de tomos de jurisprudencia
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const db = () => createAdminClient();

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface TomoInsert {
  titulo: string;
  nombre_archivo: string;
  archivo_url: string;
  carpeta_id?: string | null;
}

interface ListParams {
  carpeta_id?: string;
  procesado?: boolean;
  q?: string;
  page?: number;
  limit?: number;
}

export interface Carpeta {
  id: string;
  nombre: string;
  icono: string | null;
  padre_id: string | null;
  orden: number | null;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listarTomos(params: ListParams = {}) {
  const { carpeta_id, procesado, q, page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;

  let query = db()
    .from('jurisprudencia_tomos')
    .select('*, carpeta:biblioteca_carpetas!carpeta_id(id, nombre)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (carpeta_id) query = query.eq('carpeta_id', carpeta_id);
  if (procesado !== undefined) query = query.eq('procesado', procesado);
  if (q) {
    query = query.or(`titulo.ilike.%${q}%,nombre_archivo.ilike.%${q}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new JurisprudenciaError('Error al listar tomos', error);

  return {
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    totalPages: Math.ceil((count ?? 0) / limit),
  };
}

export async function obtenerTomo(id: string) {
  const { data, error } = await db()
    .from('jurisprudencia_tomos')
    .select('*, carpeta:biblioteca_carpetas!carpeta_id(id, nombre)')
    .eq('id', id)
    .single();

  if (error || !data) throw new JurisprudenciaError('Tomo no encontrado', error);
  return data;
}

export async function crearTomo(input: TomoInsert) {
  const payload: Record<string, unknown> = {
    titulo: input.titulo,
    nombre_archivo: input.nombre_archivo,
    archivo_url: input.archivo_url,
    procesado: false,
  };
  if (input.carpeta_id) payload.carpeta_id = input.carpeta_id;

  const { data, error } = await db()
    .from('jurisprudencia_tomos')
    .insert(payload)
    .select('id, titulo, nombre_archivo, archivo_url')
    .single();

  if (error) throw new JurisprudenciaError('Error al crear tomo', error);
  return data;
}

export async function eliminarTomo(id: string) {
  const { data: tomo } = await db()
    .from('jurisprudencia_tomos')
    .select('archivo_url')
    .eq('id', id)
    .single();

  if (tomo) {
    const storage = storageClient().storage.from('jurisprudencia');
    await storage.remove([tomo.archivo_url]);
  }

  // Also delete any fragments
  await db()
    .from('jurisprudencia_fragmentos')
    .delete()
    .eq('tomo_id', id);

  const { error } = await db()
    .from('jurisprudencia_tomos')
    .delete()
    .eq('id', id);

  if (error) throw new JurisprudenciaError('Error al eliminar tomo', error);
}

// ── Carpetas ────────────────────────────────────────────────────────────────

export async function listarCarpetas(): Promise<Carpeta[]> {
  const { data, error } = await db()
    .from('biblioteca_carpetas')
    .select('id, nombre, icono, padre_id, orden')
    .order('orden', { ascending: true });

  if (error) throw new JurisprudenciaError('Error al listar carpetas', error);
  return (data as Carpeta[]) ?? [];
}

// ── Storage helpers ─────────────────────────────────────────────────────────

export async function generarSignedUrl(storagePath: string, expiresIn = 300): Promise<string> {
  const storage = storageClient().storage.from('jurisprudencia');
  const { data, error } = await storage.createSignedUrl(storagePath, expiresIn);
  if (error || !data) throw new JurisprudenciaError('Error al generar URL firmada', error);
  return data.signedUrl;
}

export { sanitizarNombre };

// ── Error ───────────────────────────────────────────────────────────────────

export class JurisprudenciaError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'JurisprudenciaError';
    this.details = details;
  }
}
