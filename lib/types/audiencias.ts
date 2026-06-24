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

export const MODALIDAD_AUDIENCIA_COLOR: Record<ModalidadAudiencia, string> = {
  presencial: 'bg-amber-100 text-amber-700',
  virtual: 'bg-blue-100 text-blue-700',
  hibrida: 'bg-violet-100 text-violet-700',
};

export const ESTADO_AUDIENCIA_COLOR: Record<EstadoAudiencia, string> = {
  programada: 'bg-slate-100 text-slate-600',
  confirmada: 'bg-blue-100 text-blue-700',
  realizada: 'bg-emerald-100 text-emerald-700',
  suspendida: 'bg-amber-100 text-amber-700',
  reprogramada: 'bg-violet-100 text-violet-700',
  cancelada: 'bg-red-100 text-red-700',
};

// Formatea un timestamptz al huso de Guatemala (UTC-6, sin horario de verano).
export function formatAudienciaFecha(iso: string | null, conHora = true): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    day: '2-digit', month: 'short', year: 'numeric',
    ...(conHora ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });
}

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
  // ID del evento en el Outlook de Amanda (evento interno, sin attendees).
  // NULL = aún no sincronizada. Ver audiencias-outlook.service.ts.
  outlook_event_id: string | null;
  created_at: string;
  updated_at: string;
  // Embebidos opcionales (cuando se piden con join).
  cliente?: { id: string; codigo: string; nombre: string; email?: string | null; emails_cc?: string[] | null } | null;
  expediente?: { id: string; numero_expediente: string | null } | null;
}
