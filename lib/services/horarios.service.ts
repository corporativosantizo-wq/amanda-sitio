// ============================================================================
// lib/services/horarios.service.ts
// Ventanas de agendamiento de citas, leídas de legal.config_horarios.
//
// Una fila por tipo+modalidad: modalidad NULL = configuración base del tipo;
// una fila con modalidad la sobreescribe cuando la cita se pide con esa
// modalidad. Las columnas *_publico definen la ventana de OFERTA del flujo
// público (/agendar y /api/public/*); NULL = igual que la fila.
//
// Si la tabla no se puede leer, se usa el espejo en código
// (HORARIOS / HORARIOS_MODALIDAD / HORARIOS_PUBLICO en lib/types/citas.ts),
// que tiene exactamente los mismos valores que el seed de la migración.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  HORARIOS,
  HORARIOS_MODALIDAD,
  HORARIOS_PUBLICO,
  TipoCita,
  ModalidadCita,
} from '@/lib/types';

export type CanalHorario = 'interno' | 'publico';

export interface HorarioEfectivo {
  dias: readonly number[]; // convención JS Date.getDay(): 0=Dom .. 6=Sáb
  hora_inicio: string; // 'HH:mm'
  hora_fin: string; // 'HH:mm'
  duracion_slot: number; // minutos
  costo: number;
}

interface FilaConfigHorario {
  tipo: string;
  modalidad: string | null;
  dias_habiles: number[];
  hora_inicio: string; // 'HH:MM:SS' (Postgres time)
  hora_fin: string;
  duracion_slot: number;
  costo: number | string;
  activo: boolean;
  dias_habiles_publico: number[] | null;
  hora_inicio_publico: string | null;
  hora_fin_publico: string | null;
}

// Cache en memoria por instancia serverless: la config cambia poco y cada
// request de disponibilidad la necesita. 60s para que un UPDATE en la tabla
// se refleje rápido sin redeploy.
const CACHE_TTL_MS = 60_000;
let cache: { filas: FilaConfigHorario[]; expiresAt: number } | null = null;

const hhmm = (t: string) => t.substring(0, 5);

async function cargarFilas(): Promise<FilaConfigHorario[] | null> {
  if (cache && cache.expiresAt > Date.now()) return cache.filas;
  const { data, error } = await createAdminClient()
    .from('config_horarios')
    .select('*')
    .eq('activo', true);
  if (error || !data || data.length === 0) {
    console.error(
      '[Horarios] No se pudo leer legal.config_horarios — usando defaults de código:',
      error?.message ?? 'sin filas activas',
    );
    // Si había cache vencido, mejor eso que el fallback estático.
    return cache?.filas ?? null;
  }
  cache = { filas: data as FilaConfigHorario[], expiresAt: Date.now() + CACHE_TTL_MS };
  return cache.filas;
}

// Espejo en código de la tabla (mismos valores que el seed). Solo se usa si la
// tabla no se puede leer. Las modalidades solo aplican a seguimiento, igual que
// las filas (tipo='seguimiento', modalidad=...) de la tabla.
function fallbackConstantes(
  tipo: TipoCita,
  modalidad: ModalidadCita | undefined,
  canal: CanalHorario,
): HorarioEfectivo | null {
  const base = HORARIOS[tipo];
  if (!base) return null;
  const mod = tipo === 'seguimiento' && modalidad ? HORARIOS_MODALIDAD[modalidad] : undefined;
  const efectivo: HorarioEfectivo = {
    dias: mod?.dias ?? base.dias,
    hora_inicio: mod?.hora_inicio ?? base.hora_inicio,
    hora_fin: mod?.hora_fin ?? base.hora_fin,
    duracion_slot: mod?.duracion ?? base.duracion_min,
    costo: base.costo,
  };
  if (canal === 'publico' && !mod) {
    const pub = HORARIOS_PUBLICO[tipo];
    if (pub) {
      return {
        ...efectivo,
        dias: pub.dias ?? efectivo.dias,
        hora_inicio: pub.hora_inicio ?? efectivo.hora_inicio,
        hora_fin: pub.hora_fin ?? efectivo.hora_fin,
      };
    }
  }
  return efectivo;
}

/**
 * Ventana de agendamiento efectiva para un tipo (+modalidad) de cita.
 * canal 'publico' aplica además la ventana de oferta pública (*_publico).
 * Devuelve null solo si el tipo no existe ni en la tabla ni en los defaults.
 */
export async function obtenerHorarioEfectivo(
  tipo: TipoCita,
  modalidad?: ModalidadCita,
  canal: CanalHorario = 'interno',
): Promise<HorarioEfectivo | null> {
  const filas = await cargarFilas();
  if (!filas) return fallbackConstantes(tipo, modalidad, canal);

  const base = filas.find((f) => f.tipo === tipo && f.modalidad === null);
  const mod = modalidad ? filas.find((f) => f.tipo === tipo && f.modalidad === modalidad) : undefined;
  const fila = mod ?? base;
  if (!fila) return fallbackConstantes(tipo, modalidad, canal);

  const efectivo: HorarioEfectivo = {
    dias: fila.dias_habiles,
    hora_inicio: hhmm(fila.hora_inicio),
    hora_fin: hhmm(fila.hora_fin),
    duracion_slot: fila.duracion_slot,
    costo: Number(fila.costo),
  };
  if (canal === 'publico') {
    if (fila.dias_habiles_publico?.length) efectivo.dias = fila.dias_habiles_publico;
    if (fila.hora_inicio_publico) efectivo.hora_inicio = hhmm(fila.hora_inicio_publico);
    if (fila.hora_fin_publico) efectivo.hora_fin = hhmm(fila.hora_fin_publico);
  }
  return efectivo;
}

/**
 * Días ofrecidos al público por combinación tipo(+modalidad), para que el
 * formulario /agendar filtre el calendario desde la tabla (no desde una copia
 * hardcodeada en el cliente). Claves: 'consulta_nueva', 'seguimiento:virtual',
 * 'seguimiento:entrega_documentos', 'seguimiento:firma_documentos'.
 */
export async function diasPublicos(): Promise<Record<string, readonly number[]>> {
  const combos: Array<{ key: string; tipo: TipoCita; modalidad?: ModalidadCita }> = [
    { key: 'consulta_nueva', tipo: 'consulta_nueva' },
    { key: 'seguimiento:virtual', tipo: 'seguimiento', modalidad: 'virtual' },
    { key: 'seguimiento:entrega_documentos', tipo: 'seguimiento', modalidad: 'entrega_documentos' },
    { key: 'seguimiento:firma_documentos', tipo: 'seguimiento', modalidad: 'firma_documentos' },
  ];
  const out: Record<string, readonly number[]> = {};
  for (const c of combos) {
    const cfg = await obtenerHorarioEfectivo(c.tipo, c.modalidad, 'publico');
    if (cfg) out[c.key] = cfg.dias;
  }
  return out;
}
