// ============================================================================
// lib/types/audiencias.ts
// Tipos y labels del módulo de Audiencias (tabla legal.audiencias).
// ============================================================================

export type ModalidadAudiencia = 'presencial' | 'virtual' | 'hibrida';

export type EstadoAudiencia =
  | 'programada' | 'confirmada' | 'realizada'
  | 'suspendida' | 'reprogramada' | 'cancelada';

export const MODALIDAD_AUDIENCIA_LABEL: Record<ModalidadAudiencia, string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrida: 'Híbrida',
};

export const ESTADO_AUDIENCIA_LABEL: Record<EstadoAudiencia, string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  realizada: 'Realizada',
  suspendida: 'Suspendida',
  reprogramada: 'Reprogramada',
  cancelada: 'Cancelada',
};

// Plataformas sugeridas para audiencias virtuales/híbridas.
export const PLATAFORMAS_AUDIENCIA = ['zoom', 'teams', 'meet', 'otro'] as const;
export type PlataformaAudiencia = (typeof PLATAFORMAS_AUDIENCIA)[number];

export const PLATAFORMA_AUDIENCIA_LABEL: Record<PlataformaAudiencia, string> = {
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  meet: 'Google Meet',
  otro: 'Otra',
};

// Payload de creación. fecha_hora_inicio / fecha_hora_fin van como ISO con
// offset explícito de Guatemala (-06:00); ver nota de huso en el formulario.
export interface AudienciaInsert {
  expediente_id?: string | null;
  cliente_id?: string | null;
  titulo?: string | null;
  tipo_audiencia?: string | null;
  modalidad: ModalidadAudiencia;
  fecha_hora_inicio: string;
  fecha_hora_fin?: string | null;
  juzgado?: string | null;
  sala?: string | null;
  ubicacion?: string | null;
  enlace_virtual?: string | null;
  plataforma?: string | null;
  instrucciones?: string | null;
  notas_internas?: string | null;
  // CC visible específico de esta audiencia. En el envío (Fase 3) se suma al
  // CC fijo del cliente (legal.clientes.emails_cc), deduplicando.
  emails_cc?: string[] | null;
  estado?: EstadoAudiencia;
}

export interface Audiencia {
  id: string;
  expediente_id: string | null;
  cliente_id: string | null;
  titulo: string | null;
  tipo_audiencia: string | null;
  modalidad: ModalidadAudiencia;
  fecha_hora_inicio: string;
  fecha_hora_fin: string | null;
  juzgado: string | null;
  sala: string | null;
  ubicacion: string | null;
  enlace_virtual: string | null;
  plataforma: string | null;
  instrucciones: string | null;
  emails_cc: string[] | null;
  estado: EstadoAudiencia;
  ics_sequence: number;
  notas_internas: string | null;
  created_at: string;
  updated_at: string;
  // Embebidos opcionales (cuando se piden con join).
  cliente?: { id: string; codigo: string; nombre: string; email: string | null } | null;
  expediente?: { id: string; numero_expediente: string | null } | null;
}
