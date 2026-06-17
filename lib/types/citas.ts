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

// Modalidad de la cita. El flujo público solo usa 'virtual' y 'entrega_documentos';
// 'presencial' y 'virtual_y_entrega' quedan disponibles para uso interno (admin).
export type ModalidadCita = 'virtual' | 'presencial' | 'entrega_documentos' | 'virtual_y_entrega' | 'firma_documentos';

export const MODALIDAD_INFO: Record<ModalidadCita, { label: string; icono: string; usaTeams: boolean; usaOficina: boolean }> = {
  virtual:            { label: 'Virtual por Teams',        icono: '💻',   usaTeams: true,  usaOficina: false },
  entrega_documentos: { label: 'Entrega de documentos',    icono: '📦',   usaTeams: false, usaOficina: true  },
  firma_documentos:   { label: 'Firma de documentos',      icono: '✍️',   usaTeams: false, usaOficina: true  },
  virtual_y_entrega:  { label: 'Virtual + Entrega',         icono: '💻📦', usaTeams: true,  usaOficina: true  },
  presencial:         { label: 'Presencial en oficina',     icono: '🏢',   usaTeams: false, usaOficina: true  },
};

// Horarios públicos por modalidad de seguimiento. La entrega y la firma de
// documentos se atienden en oficina (Mariano), de lunes a viernes 9 AM–4 PM; la
// firma usa slots de 30 min y la entrega de 15. El seguimiento virtual sigue el
// horario base de HORARIOS.seguimiento (lo atiende Amanda, mar/mié).
export interface HorarioModalidad {
  dias: readonly number[];
  hora_inicio: string;
  hora_fin: string;
  duracion: number;
}

export const HORARIOS_MODALIDAD: Partial<Record<ModalidadCita, HorarioModalidad>> = {
  entrega_documentos: { dias: [1, 2, 3, 4, 5], hora_inicio: '09:00', hora_fin: '16:00', duracion: 15 },
  firma_documentos:   { dias: [1, 2, 3, 4, 5], hora_inicio: '09:00', hora_fin: '16:00', duracion: 30 },
};

// Dirección de la oficina (entregas presenciales). Centralizada para emails/PDF.
export const DIRECCION_OFICINA =
  '12 calle 1-25 zona 10, Edificio Géminis 10 Torre Sur, Oficina 402, Guatemala';

export interface Cita {
  id: string;
  cliente_id: string | null;
  expediente_id: string | null;
  tipo: TipoCita;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  estado: EstadoCita;
  modalidad: ModalidadCita;
  documentos_entrega: string | null;
  // Solicitudes de entrega/firma: fecha/hora que el cliente pidió (inmutable)
  // y sus indicaciones adicionales. Null para citas que no nacen como solicitud.
  fecha_solicitada: string | null;
  hora_solicitada: string | null;
  comentarios_cliente: string | null;
  // Citas personales privadas de Amanda: bloquean el horario pero el detalle real
  // (detalle_privado) solo va a su Telegram privado y se borra tras el recordatorio.
  es_personal_privada: boolean;
  detalle_privado: string | null;
  recordatorio_personal_enviado: boolean;
  // Audiencias judiciales (tipo='audiencia').
  audiencia_materia: string | null;
  audiencia_expediente: string | null;
  audiencia_diligencia: string | null;
  audiencia_juzgado: string | null;
  // Destinatarios propios del recordatorio (si tiene valor, reemplaza email+CC del cliente).
  audiencia_destinatarios: string[] | null;
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
  modalidad?: ModalidadCita;
  documentos_entrega?: string | null;
  isOnlineMeeting?: boolean;
  // Solicitudes (entrega/firma): se persisten para que el admin las gestione.
  estado?: EstadoCita;
  fecha_solicitada?: string | null;
  hora_solicitada?: string | null;
  comentarios_cliente?: string | null;
  // Cita personal privada de Amanda.
  es_personal_privada?: boolean;
  detalle_privado?: string | null;
  // Audiencias judiciales (tipo='audiencia').
  audiencia_materia?: string | null;
  audiencia_expediente?: string | null;
  audiencia_diligencia?: string | null;
  audiencia_juzgado?: string | null;
  audiencia_destinatarios?: string[] | null;
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
