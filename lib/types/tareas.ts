// ============================================================================
// lib/types/tareas.ts
// Tipos para Task Tracker / Bullet Journal
// ============================================================================

export enum TipoTarea {
  TAREA = 'tarea',
  EVENTO = 'evento',
  NOTA = 'nota',
}

export enum EstadoTarea {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  COMPLETADA = 'completada',
  MIGRADA = 'migrada',
  CANCELADA = 'cancelada',
}

export enum CategoriaTarea {
  COBROS = 'cobros',
  DOCUMENTOS = 'documentos',
  AUDIENCIAS = 'audiencias',
  TRAMITES = 'tramites',
  PERSONAL = 'personal',
  SEGUIMIENTO = 'seguimiento',
}

export enum AsignadoTarea {
  AMANDA = 'amanda',
  ASISTENTE = 'asistente',
  CONTADOR = 'contador',
  ASESORA = 'asesora',
}

// --- Interfaces ---

export interface Tarea {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoTarea;
  estado: EstadoTarea;
  prioridad: 'alta' | 'media' | 'baja';
  fecha_limite: string | null;
  fecha_completada: string | null;
  cliente_id: string | null;
  expediente_id: string | null;
  asignado_a: AsignadoTarea;
  categoria: CategoriaTarea;
  recurrente: boolean;
  recurrencia_tipo: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface TareaConCliente extends Tarea {
  cliente?: { id: string; nombre: string } | null;
}

export interface TareaInsert {
  titulo: string;
  descripcion?: string;
  tipo?: TipoTarea;
  estado?: EstadoTarea;
  prioridad?: 'alta' | 'media' | 'baja';
  fecha_limite?: string | null;
  cliente_id?: string | null;
  expediente_id?: string | null;
  asignado_a?: AsignadoTarea;
  categoria?: CategoriaTarea;
  recurrente?: boolean;
  recurrencia_tipo?: string | null;
  notas?: string | null;
}

// --- Labels ---

export const TIPO_TAREA_LABEL: Record<TipoTarea, string> = {
  [TipoTarea.TAREA]: 'Tarea',
  [TipoTarea.EVENTO]: 'Evento',
  [TipoTarea.NOTA]: 'Nota',
};

export const TIPO_TAREA_SYMBOL: Record<TipoTarea, string> = {
  [TipoTarea.TAREA]: '\u2022',
  [TipoTarea.EVENTO]: '\u25CB',
  [TipoTarea.NOTA]: '\u2014',
};

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  [EstadoTarea.PENDIENTE]: 'Pendiente',
  [EstadoTarea.EN_PROGRESO]: 'En progreso',
  [EstadoTarea.COMPLETADA]: 'Completada',
  [EstadoTarea.MIGRADA]: 'Migrada',
  [EstadoTarea.CANCELADA]: 'Cancelada',
};

export const ESTADO_TAREA_COLOR: Record<EstadoTarea, string> = {
  [EstadoTarea.PENDIENTE]: 'bg-amber-100 text-amber-700',
  [EstadoTarea.EN_PROGRESO]: 'bg-blue-100 text-blue-700',
  [EstadoTarea.COMPLETADA]: 'bg-green-100 text-green-700',
  [EstadoTarea.MIGRADA]: 'bg-purple-100 text-purple-700',
  [EstadoTarea.CANCELADA]: 'bg-gray-100 text-gray-500',
};

export const CATEGORIA_TAREA_LABEL: Record<CategoriaTarea, string> = {
  [CategoriaTarea.COBROS]: 'Cobros',
  [CategoriaTarea.DOCUMENTOS]: 'Documentos',
  [CategoriaTarea.AUDIENCIAS]: 'Audiencias',
  [CategoriaTarea.TRAMITES]: 'Tr\u00e1mites',
  [CategoriaTarea.PERSONAL]: 'Personal',
  [CategoriaTarea.SEGUIMIENTO]: 'Seguimiento',
};

export const CATEGORIA_TAREA_COLOR: Record<CategoriaTarea, string> = {
  [CategoriaTarea.COBROS]: 'bg-blue-100 text-blue-700',
  [CategoriaTarea.DOCUMENTOS]: 'bg-purple-100 text-purple-700',
  [CategoriaTarea.AUDIENCIAS]: 'bg-orange-100 text-orange-700',
  [CategoriaTarea.TRAMITES]: 'bg-teal-100 text-teal-700',
  [CategoriaTarea.PERSONAL]: 'bg-pink-100 text-pink-700',
  [CategoriaTarea.SEGUIMIENTO]: 'bg-cyan-100 text-cyan-700',
};

export const ASIGNADO_TAREA_LABEL: Record<AsignadoTarea, string> = {
  [AsignadoTarea.AMANDA]: 'Amanda',
  [AsignadoTarea.ASISTENTE]: 'Asistente IA',
  [AsignadoTarea.CONTADOR]: 'Contador',
  [AsignadoTarea.ASESORA]: 'Asesora',
};

export const ASIGNADO_TAREA_ICON: Record<AsignadoTarea, string> = {
  [AsignadoTarea.AMANDA]: '\uD83D\uDC69\u200D\uD83D\uDCBC',
  [AsignadoTarea.ASISTENTE]: '\uD83E\uDD16',
  [AsignadoTarea.CONTADOR]: '\uD83D\uDCB0',
  [AsignadoTarea.ASESORA]: '\uD83D\uDC69\u200D\u2696\uFE0F',
};

export const PRIORIDAD_COLOR: Record<string, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-amber-100 text-amber-700',
  baja: 'bg-green-100 text-green-700',
};
