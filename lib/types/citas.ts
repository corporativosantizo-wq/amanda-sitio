// ============================================================================
// lib/types/citas.ts
// Tipos e interfaces para el sistema de citas
// ============================================================================

export type TipoCita =
  | 'consulta_nueva'
  | 'seguimiento'
  | 'audiencia'
  | 'reunion'
  | 'bloqueo_personal'
  | 'evento_libre';

// Tipos que solo se crean desde admin (sin validación de slots/rate limit)
export const ADMIN_ONLY_TIPOS: ReadonlySet<TipoCita> = new Set([
  'audiencia',
  'reunion',
  'bloqueo_personal',
  'evento_libre',
]);

// Bullet Journal: trabajo profundo termina a las 2pm
export const DEEP_WORK_END_HOUR = 14;

export type EstadoCita = 'pendiente' | 'confirmada' | 'cancelada' | 'completada' | 'no_asistio';

export interface Cita {
  id: string;
  cliente_id: string | null;
  expediente_id: string | null;
  tipo: TipoCita;
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  estado: EstadoCita;
  costo: number;
  outlook_event_id: string | null;
  teams_link: string | null;
  categoria_outlook: string | null;
  recordatorio_24h_enviado: boolean;
  recordatorio_1h_enviado: boolean;
  email_confirmacion_enviado: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
  // Join
  cliente?: { id: string; codigo: string; nombre: string; email: string | null } | null;
}

export interface CitaInsert {
  cliente_id?: string | null;
  expediente_id?: string | null;
  tipo: TipoCita;
  titulo: string;
  descripcion?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  costo?: number;
  notas?: string;
  isOnlineMeeting?: boolean;
}

export interface BloqueoCalendario {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string | null;
  created_at: string;
}

export interface BloqueoInsert {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo?: string;
}

export interface SlotDisponible {
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
}

export interface HorarioConfig {
  dias: readonly number[];
  hora_inicio: string;
  hora_fin: string;
  duracion_max: number;
  duracion_min: number;
  costo: number;
  categoria_outlook: string;
  color_admin: string;
}

export const HORARIOS: Record<TipoCita, HorarioConfig> = {
  consulta_nueva: {
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '08:00',
    hora_fin: '18:00',
    duracion_max: 60,
    duracion_min: 30,
    costo: 500,
    categoria_outlook: 'Azul',
    color_admin: '#3B82F6',
  },
  seguimiento: {
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '14:00',
    hora_fin: '18:00',
    duracion_max: 15,
    duracion_min: 15,
    costo: 0,
    categoria_outlook: 'Verde',
    color_admin: '#10B981',
  },
  audiencia: {
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '06:00',
    hora_fin: '21:00',
    duracion_max: 480,
    duracion_min: 30,
    costo: 0,
    categoria_outlook: 'Rojo',
    color_admin: '#EF4444',
  },
  reunion: {
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '08:00',
    hora_fin: '18:00',
    duracion_max: 240,
    duracion_min: 30,
    costo: 0,
    categoria_outlook: 'Amarillo',
    color_admin: '#F59E0B',
  },
  bloqueo_personal: {
    dias: [0, 1, 2, 3, 4, 5, 6],
    hora_inicio: '00:00',
    hora_fin: '23:59',
    duracion_max: 1440,
    duracion_min: 15,
    costo: 0,
    categoria_outlook: 'Gris',
    color_admin: '#6B7280',
  },
  evento_libre: {
    dias: [1, 2, 3, 4, 5],
    hora_inicio: '08:00',
    hora_fin: '18:00',
    duracion_max: 240,
    duracion_min: 30,
    costo: 0,
    categoria_outlook: 'Púrpura',
    color_admin: '#8B5CF6',
  },
} as const;
