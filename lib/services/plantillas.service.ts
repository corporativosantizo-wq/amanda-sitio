// ============================================================================
// lib/services/plantillas.service.ts
// Lógica de negocio para gestión de plantillas de documentos
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { legalAmount } from '@/lib/templates/docx-utils';
import { fechaATextoLegal } from '@/lib/utils/fechas-letras';

const db = () => createAdminClient();

function storageClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Tipos ───────────────────────────────────────────────────────────────────

export interface CampoDefinicion {
  id: string;
  label: string;
  tipo: 'texto' | 'persona' | 'numero' | 'fecha' | 'dpi' | 'parrafo' | 'seleccion';
  requerido: boolean;
  opciones?: string[];
  placeholder?: string;
  descripcion?: string;
}

export interface PlantillaInsert {
  nombre: string;
  tipo: string;
  descripcion?: string;
  campos: CampoDefinicion[];
  estructura: string;
  archivo_original?: string;
}

interface ListParams {
  activa?: boolean;
  tipo?: string;
  busqueda?: string;
  page?: number;
  limit?: number;
}

export class PlantillaError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'PlantillaError';
    this.details = details;
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function crearPlantilla(input: PlantillaInsert) {
  if (!input.nombre?.trim()) throw new PlantillaError('Nombre es requerido');
  if (!input.estructura?.trim()) throw new PlantillaError('Estructura es requerida');

  const { data, error } = await db()
    .from('plantillas')
    .insert({
      nombre: input.nombre.trim(),
      tipo: input.tipo || 'general',
      descripcion: input.descripcion?.trim() || null,
      campos: input.campos || [],
      estructura: input.estructura,
      archivo_original: input.archivo_original || null,
      activa: true,
    })
    .select()
    .single();

  if (error) throw new PlantillaError('Error al crear plantilla', error);
  return data;
}

export async function listarPlantillas(params: ListParams = {}) {
  const { activa, tipo, busqueda, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  let query = db().from('plantillas').select('*', { count: 'exact' });

  if (activa !== undefined) query = query.eq('activa', activa);
  if (tipo) query = query.eq('tipo', tipo);
  if (busqueda) query = query.ilike('nombre', `%${busqueda}%`);

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw new PlantillaError('Error al listar plantillas', error);

  const total = count ?? 0;
  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function obtenerPlantilla(id: string) {
  const { data, error } = await db()
    .from('plantillas')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new PlantillaError(`Plantilla no encontrada: ${id}`, error);
  return data;
}

export async function actualizarPlantilla(id: string, updates: Partial<PlantillaInsert & { activa: boolean }>) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.nombre !== undefined) payload.nombre = updates.nombre;
  if (updates.tipo !== undefined) payload.tipo = updates.tipo;
  if (updates.descripcion !== undefined) payload.descripcion = updates.descripcion;
  if (updates.campos !== undefined) payload.campos = updates.campos;
  if (updates.estructura !== undefined) payload.estructura = updates.estructura;
  if (updates.activa !== undefined) payload.activa = updates.activa;

  const { data, error } = await db()
    .from('plantillas')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new PlantillaError('Error al actualizar plantilla', error);
  return data;
}

export async function eliminarPlantilla(id: string) {
  // Obtener para borrar archivo original de Storage
  const plantilla = await obtenerPlantilla(id);

  if (plantilla.archivo_original) {
    try {
      await storageClient().storage
        .from('documentos')
        .remove([plantilla.archivo_original]);
    } catch {
      console.warn(`[Plantillas] No se pudo eliminar archivo: ${plantilla.archivo_original}`);
    }
  }

  const { error } = await db()
    .from('plantillas')
    .delete()
    .eq('id', id);

  if (error) throw new PlantillaError('Error al eliminar plantilla', error);
}

// ── Para inyección en AI prompt ─────────────────────────────────────────────

export async function listarPlantillasActivas() {
  const { data, error } = await db()
    .from('plantillas')
    .select('id, nombre, tipo, descripcion, campos')
    .eq('activa', true)
    .order('nombre');

  if (error) {
    console.error('[Plantillas] Error listando activas:', error);
    return [];
  }
  return data || [];
}

// ── Generación desde plantilla custom ───────────────────────────────────────

export function generarDesdeCustomPlantilla(
  plantilla: { campos: any[]; estructura: string },
  datos: Record<string, any>
): string {
  let texto = plantilla.estructura;
  const camposMap = new Map(
    (plantilla.campos as CampoDefinicion[]).map((c: CampoDefinicion) => [c.id, c])
  );

  texto = texto.replace(/\{\{(\w+)\}\}/g, (_match: string, campoId: string) => {
    const campo = camposMap.get(campoId);
    const valor = datos[campoId];
    if (valor === undefined || valor === null || valor === '') return `{{${campoId}}}`;

    if (!campo) return String(valor);

    switch (campo.tipo) {
      case 'persona':
        return String(valor).toUpperCase();
      case 'numero': {
        const num = parseFloat(valor);
        if (!isNaN(num)) return legalAmount(num);
        return String(valor);
      }
      case 'fecha':
        return fechaATextoLegal(String(valor));
      case 'dpi':
        return String(valor);
      default:
        return String(valor);
    }
  });

  return texto;
}
