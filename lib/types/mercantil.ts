// ============================================================================
// lib/types/mercantil.ts
// Tipos para el módulo de Cumplimiento Mercantil (Registro Mercantil)
// ============================================================================

// ── Enums ─────────────────────────────────────────────────────────────────

export type CategoriaMercantil =
  | 'patente_comercio'
  | 'patente_sociedad'
  | 'inscripcion_empresa'
  | 'inscripcion_sociedad'
  | 'asamblea_ordinaria'
  | 'asamblea_extraordinaria'
  | 'convocatoria_asamblea'
  | 'acta_asamblea_libro'
  | 'acta_asamblea_notarial'
  | 'certificacion_acta'
  | 'emision_acciones'
  | 'modificacion_sociedad'
  | 'nombramiento_representante'
  | 'fusion'
  | 'disolucion'
  | 'sucursal'
  | 'otro';

export type EstadoTramiteMercantil =
  | 'pendiente'
  | 'en_proceso'
  | 'en_registro'
  | 'inscrito'
  | 'vigente'
  | 'vencido'
  | 'rechazado'
  | 'cancelado';

export type AccionHistorialMercantil =
  | 'creado'
  | 'enviado_registro'
  | 'observado'
  | 'subsanado'
  | 'inscrito'
  | 'renovado'
  | 'vencido'
  | 'otro';

// ── Interfaces ────────────────────────────────────────────────────────────

export interface TramiteMercantil {
  id: string;
  cliente_id: string;
  categoria: CategoriaMercantil;
  subtipo: string | null;
  estado: EstadoTramiteMercantil;
  numero_registro: string | null;
  fecha_tramite: string;
  fecha_inscripcion: string | null;
  fecha_vencimiento: string | null;
  es_recurrente: boolean;
  periodicidad_meses: number | null;
  alerta_dias_antes: number;
  numero_expediente_rm: string | null;
  notario_responsable: string | null;
  descripcion: string | null;
  notas: string | null;
  documento_url: string | null;
  archivo_pdf_url: string | null;
  archivo_pdf_nombre: string | null;
  archivo_docx_url: string | null;
  archivo_docx_nombre: string | null;
  created_at: string;
  updated_at: string;
}

export interface TramiteMercantilConCliente extends TramiteMercantil {
  cliente: { id: string; codigo: string; nombre: string; nit: string | null };
}

export interface TramiteMercantilInsert {
  cliente_id: string;
  categoria: CategoriaMercantil;
  subtipo?: string | null;
  estado?: EstadoTramiteMercantil;
  numero_registro?: string | null;
  fecha_tramite: string;
  fecha_inscripcion?: string | null;
  fecha_vencimiento?: string | null;
  es_recurrente?: boolean;
  periodicidad_meses?: number | null;
  alerta_dias_antes?: number;
  numero_expediente_rm?: string | null;
  notario_responsable?: string | null;
  descripcion?: string | null;
  notas?: string | null;
  documento_url?: string | null;
  archivo_pdf_url?: string | null;
  archivo_pdf_nombre?: string | null;
  archivo_docx_url?: string | null;
  archivo_docx_nombre?: string | null;
}

export type TramiteMercantilUpdate = Partial<TramiteMercantilInsert>;

export interface HistorialMercantil {
  id: string;
  tramite_id: string;
  fecha: string;
  accion: AccionHistorialMercantil;
  descripcion: string;
  documento_url: string | null;
  created_at: string;
}

export interface HistorialMercantilInsert {
  tramite_id: string;
  fecha: string;
  accion: AccionHistorialMercantil;
  descripcion: string;
  documento_url?: string | null;
}

// ── Labels ────────────────────────────────────────────────────────────────

export const CATEGORIA_MERCANTIL_LABEL: Record<CategoriaMercantil, string> = {
  patente_comercio: 'Patente de Comercio de Empresa',
  patente_sociedad: 'Patente de Comercio de Sociedad',
  inscripcion_empresa: 'Inscripción de Empresa Mercantil',
  inscripcion_sociedad: 'Inscripción de Sociedad',
  asamblea_ordinaria: 'Asamblea General Ordinaria',
  asamblea_extraordinaria: 'Asamblea General Extraordinaria',
  convocatoria_asamblea: 'Convocatoria de Asamblea',
  acta_asamblea_libro: 'Acta de Asamblea en Libro',
  acta_asamblea_notarial: 'Acta Notarial de Asamblea',
  certificacion_acta: 'Certificación Notarial de Acta',
  emision_acciones: 'Aviso de Emisión de Acciones',
  modificacion_sociedad: 'Modificación de Escritura Social',
  nombramiento_representante: 'Nombramiento de Representante Legal',
  fusion: 'Fusión de Sociedades',
  disolucion: 'Disolución y Liquidación',
  sucursal: 'Inscripción de Sucursal',
  otro: 'Otro',
};

export const CATEGORIA_MERCANTIL_SHORT: Record<CategoriaMercantil, string> = {
  patente_comercio: 'Patente Empresa',
  patente_sociedad: 'Patente Sociedad',
  inscripcion_empresa: 'Inscripción Empresa',
  inscripcion_sociedad: 'Inscripción Sociedad',
  asamblea_ordinaria: 'Asamblea Ordinaria',
  asamblea_extraordinaria: 'Asamblea Extraordinaria',
  convocatoria_asamblea: 'Convocatoria',
  acta_asamblea_libro: 'Acta en Libro',
  acta_asamblea_notarial: 'Acta Notarial',
  certificacion_acta: 'Certificación Acta',
  emision_acciones: 'Emisión Acciones',
  modificacion_sociedad: 'Modificación Sociedad',
  nombramiento_representante: 'Nombramiento',
  fusion: 'Fusión',
  disolucion: 'Disolución',
  sucursal: 'Sucursal',
  otro: 'Otro',
};

export const ESTADO_MERCANTIL_LABEL: Record<EstadoTramiteMercantil, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  en_registro: 'En Registro',
  inscrito: 'Inscrito',
  vigente: 'Vigente',
  vencido: 'Vencido',
  rechazado: 'Rechazado',
  cancelado: 'Cancelado',
};

export const ESTADO_MERCANTIL_COLOR: Record<EstadoTramiteMercantil, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  en_registro: 'bg-indigo-100 text-indigo-700',
  inscrito: 'bg-emerald-100 text-emerald-700',
  vigente: 'bg-green-100 text-green-700',
  vencido: 'bg-red-100 text-red-700',
  rechazado: 'bg-orange-100 text-orange-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

export const ACCION_MERCANTIL_LABEL: Record<AccionHistorialMercantil, string> = {
  creado: 'Creado',
  enviado_registro: 'Enviado a Registro',
  observado: 'Observado',
  subsanado: 'Subsanado',
  inscrito: 'Inscrito',
  renovado: 'Renovado',
  vencido: 'Vencido',
  otro: 'Otro',
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Categorías que tienen vencimiento automático */
export const CATEGORIAS_CON_VENCIMIENTO: CategoriaMercantil[] = [
  'patente_comercio',
  'patente_sociedad',
];

/** Categorías que son recurrentes por naturaleza */
export const CATEGORIAS_RECURRENTES: CategoriaMercantil[] = [
  'patente_comercio',
  'patente_sociedad',
  'asamblea_ordinaria',
];

/** Semáforo: calcula el color de cumplimiento */
export function getSemaforoMercantil(
  fechaVencimiento: string | null,
  estado: EstadoTramiteMercantil,
  alertaDias: number = 30,
): 'verde' | 'amarillo' | 'rojo' | 'gris' {
  if (estado === 'cancelado') return 'gris';
  if (estado === 'vencido') return 'rojo';
  if (estado === 'rechazado') return 'rojo';
  if (!fechaVencimiento) {
    if (estado === 'vigente' || estado === 'inscrito') return 'verde';
    return 'amarillo';
  }
  const hoy = new Date();
  const venc = new Date(fechaVencimiento);
  const diff = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000);
  if (diff < 0) return 'rojo';
  if (diff <= alertaDias) return 'amarillo';
  return 'verde';
}

export const SEMAFORO_COLOR = {
  verde: 'bg-green-100 text-green-700 border-green-200',
  amarillo: 'bg-amber-100 text-amber-700 border-amber-200',
  rojo: 'bg-red-100 text-red-700 border-red-200',
  gris: 'bg-gray-100 text-gray-500 border-gray-200',
} as const;

export const SEMAFORO_DOT = {
  verde: 'bg-green-500',
  amarillo: 'bg-amber-500',
  rojo: 'bg-red-500',
  gris: 'bg-gray-400',
} as const;
