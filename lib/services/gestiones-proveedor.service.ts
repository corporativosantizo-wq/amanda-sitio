// ============================================================================
// lib/services/gestiones-proveedor.service.ts
// Lógica de negocio para gestiones asignadas a proveedores y su seguimiento.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

// Fecha de hoy en zona horaria de Guatemala (YYYY-MM-DD), consistente con el
// resto de la app (crons, cobros, etc.).
export function hoyGuatemala(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

export type EstadoGestion =
  | 'pendiente' | 'en_proceso' | 'completado' | 'suspendido' | 'cancelado';

export type ViaSeguimiento =
  | 'email' | 'telefono' | 'presencial' | 'whatsapp' | 'teams';

export const ESTADOS_GESTION: EstadoGestion[] =
  ['pendiente', 'en_proceso', 'completado', 'suspendido', 'cancelado'];

export const VIAS_SEGUIMIENTO: ViaSeguimiento[] =
  ['email', 'telefono', 'presencial', 'whatsapp', 'teams'];

export interface SeguimientoProveedor {
  id: string;
  gestion_id: string;
  fecha: string;
  descripcion: string;
  via: ViaSeguimiento | null;
  respuesta: string | null;
  created_at: string | null;
}

export interface GestionProveedor {
  id: string;
  proveedor_id: string;
  cliente_id: string | null;
  numero_expediente: string | null;
  nombre_gestion: string;
  entidad: string | null;
  descripcion: string | null;
  estado: EstadoGestion;
  fecha_asignacion: string | null;
  fecha_limite: string | null;
  ultimo_seguimiento: string | null;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
  cliente?: { id: string; nombre: string } | null;
  seguimientos?: SeguimientoProveedor[];
}

export interface CrearGestionInput {
  proveedor_id: string;
  cliente_id?: string | null;
  numero_expediente?: string | null;
  nombre_gestion: string;
  entidad?: string | null;
  descripcion?: string | null;
  estado?: EstadoGestion;
  fecha_asignacion?: string | null;
  fecha_limite?: string | null;
  notas?: string | null;
}

export class GestionError extends Error {
  public details: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'GestionError';
    this.details = details;
  }
}

const SELECT = `
  id, proveedor_id, cliente_id, numero_expediente, nombre_gestion, entidad,
  descripcion, estado, fecha_asignacion, fecha_limite, ultimo_seguimiento,
  notas, created_at, updated_at,
  cliente:clientes!gestiones_proveedor_cliente_id_fkey (id, nombre),
  seguimientos:seguimientos_proveedor!seguimientos_proveedor_gestion_id_fkey (
    id, gestion_id, fecha, descripcion, via, respuesta, created_at
  )
`;

// Ordena los seguimientos de cada gestión por fecha descendente (más reciente
// primero) — PostgREST no garantiza orden en los embeds.
function ordenarSeguimientos(g: GestionProveedor): GestionProveedor {
  if (Array.isArray(g.seguimientos)) {
    g.seguimientos.sort((a, b) => (b.fecha < a.fecha ? -1 : b.fecha > a.fecha ? 1 : 0));
  }
  return g;
}

export async function listarGestionesPorProveedor(
  proveedorId: string,
): Promise<GestionProveedor[]> {
  const { data, error } = await db()
    .from('gestiones_proveedor')
    .select(SELECT)
    .eq('proveedor_id', proveedorId)
    .order('fecha_asignacion', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new GestionError('Error al listar gestiones', error);
  return ((data ?? []) as GestionProveedor[]).map(ordenarSeguimientos);
}

export async function obtenerGestion(id: string): Promise<GestionProveedor> {
  const { data, error } = await db()
    .from('gestiones_proveedor')
    .select(SELECT)
    .eq('id', id)
    .single();

  if (error || !data) throw new GestionError('Gestión no encontrada', error);
  return ordenarSeguimientos(data as GestionProveedor);
}

export async function crearGestion(input: CrearGestionInput): Promise<GestionProveedor> {
  if (!input.proveedor_id) throw new GestionError('proveedor_id es obligatorio');
  if (!input.nombre_gestion?.trim()) throw new GestionError('El nombre de la gestión es obligatorio');

  const { data, error } = await db()
    .from('gestiones_proveedor')
    .insert({
      proveedor_id: input.proveedor_id,
      cliente_id: input.cliente_id ?? null,
      numero_expediente: input.numero_expediente?.trim() || null,
      nombre_gestion: input.nombre_gestion.trim(),
      entidad: input.entidad?.trim() || null,
      descripcion: input.descripcion?.trim() || null,
      estado: input.estado ?? 'pendiente',
      fecha_asignacion: input.fecha_asignacion || hoyGuatemala(),
      fecha_limite: input.fecha_limite || null,
      notas: input.notas?.trim() || null,
    })
    .select(SELECT)
    .single();

  if (error) throw new GestionError('Error al crear gestión', error);
  return ordenarSeguimientos(data as GestionProveedor);
}

export async function actualizarGestion(
  id: string,
  input: Partial<CrearGestionInput>,
): Promise<GestionProveedor> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const campos: (keyof CrearGestionInput)[] = [
    'cliente_id', 'numero_expediente', 'nombre_gestion', 'entidad',
    'descripcion', 'estado', 'fecha_asignacion', 'fecha_limite', 'notas',
  ];
  for (const key of campos) {
    if (input[key] !== undefined) {
      const v = input[key];
      updates[key] = typeof v === 'string' ? (v.trim() || null) : v;
    }
  }
  // nombre_gestion no puede quedar null
  if (updates.nombre_gestion === null) delete updates.nombre_gestion;

  const { data, error } = await db()
    .from('gestiones_proveedor')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single();

  if (error) throw new GestionError('Error al actualizar gestión', error);
  return ordenarSeguimientos(data as GestionProveedor);
}

export async function eliminarGestion(id: string): Promise<void> {
  // Los seguimientos se borran por ON DELETE CASCADE.
  const { error } = await db().from('gestiones_proveedor').delete().eq('id', id);
  if (error) throw new GestionError('Error al eliminar gestión', error);
}

// ── Seguimientos ───────────────────────────────────────────────────────────

export interface CrearSeguimientoInput {
  fecha?: string | null;
  descripcion: string;
  via?: ViaSeguimiento | null;
  respuesta?: string | null;
}

export async function crearSeguimiento(
  gestionId: string,
  input: CrearSeguimientoInput,
): Promise<SeguimientoProveedor> {
  if (!input.descripcion?.trim()) throw new GestionError('La descripción es obligatoria');
  const fecha = input.fecha || hoyGuatemala();

  const { data, error } = await db()
    .from('seguimientos_proveedor')
    .insert({
      gestion_id: gestionId,
      fecha,
      descripcion: input.descripcion.trim(),
      via: input.via ?? null,
      respuesta: input.respuesta?.trim() || null,
    })
    .select('id, gestion_id, fecha, descripcion, via, respuesta, created_at')
    .single();

  if (error) throw new GestionError('Error al registrar seguimiento', error);

  // Actualizar ultimo_seguimiento de la gestión con la fecha más reciente.
  await actualizarUltimoSeguimiento(gestionId);

  return data as SeguimientoProveedor;
}

// Recalcula ultimo_seguimiento como el MAX(fecha) de los seguimientos de la
// gestión (o null si no hay). Robusto ante seguimientos con fecha pasada.
async function actualizarUltimoSeguimiento(gestionId: string): Promise<void> {
  const { data } = await db()
    .from('seguimientos_proveedor')
    .select('fecha')
    .eq('gestion_id', gestionId)
    .order('fecha', { ascending: false })
    .limit(1);

  const ultimo = data && data.length > 0 ? data[0].fecha : null;
  await db()
    .from('gestiones_proveedor')
    .update({ ultimo_seguimiento: ultimo, updated_at: new Date().toISOString() })
    .eq('id', gestionId);
}

// Registra un seguimiento idéntico para varias gestiones a la vez. Usado al
// enviar el correo de seguimiento a un proveedor (un seguimiento por gestión
// incluida). Devuelve cuántos se registraron.
export async function crearSeguimientosBulk(
  gestionIds: string[],
  input: CrearSeguimientoInput,
): Promise<number> {
  if (!gestionIds.length) return 0;
  if (!input.descripcion?.trim()) throw new GestionError('La descripción es obligatoria');
  const fecha = input.fecha || hoyGuatemala();

  const rows = gestionIds.map((gestion_id) => ({
    gestion_id,
    fecha,
    descripcion: input.descripcion.trim(),
    via: input.via ?? null,
    respuesta: input.respuesta?.trim() || null,
  }));

  const { error } = await db().from('seguimientos_proveedor').insert(rows);
  if (error) throw new GestionError('Error al registrar seguimientos', error);

  for (const id of gestionIds) {
    await actualizarUltimoSeguimiento(id);
  }
  return gestionIds.length;
}
