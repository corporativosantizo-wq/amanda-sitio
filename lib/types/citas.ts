// ============================================================================
// lib/types/citas.ts
// Tipos e interfaces para el sistema de citas
// ============================================================================

export type TipoCita = 'consulta_nueva' | 'seguimiento';

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
    dias: [1, 3, 5],
    hora_inicio: '07:00',
    hora_fin: '12:15',
    duracion_max: 60,
    duracion_min: 30,
    costo: 75,
    categoria_outlook: 'Azul',
    color_admin: '#3B82F6',
  },
  seguimiento: {
    dias: [2, 3],
    hora_inicio: '14:00',
    hora_fin: '18:00',
    duracion_max: 15,
    duracion_min: 15,
    costo: 0,
    categoria_outlook: 'Verde',
    color_admin: '#10B981',
  },
} as const;
