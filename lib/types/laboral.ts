// ============================================================================
// lib/types/laboral.ts
// Tipos para el módulo de Cumplimiento Laboral
// ============================================================================

// ── Enums ─────────────────────────────────────────────────────────────────

export type CategoriaLaboral =
  | 'contrato_individual'
  | 'contrato_temporal'
  | 'contrato_profesional'
  | 'reglamento_interno'
  | 'registro_contrato_igt'
  | 'libro_salarios'
  | 'pacto_colectivo'
  | 'otro';

export type EstadoTramiteLaboral =
  | 'pendiente'
  | 'en_elaboracion'
  | 'firmado'
  | 'registrado'
  | 'vigente'
  | 'vencido'
  | 'cancelado';

export type AccionHistorialLaboral =
  | 'creado'
  | 'elaborado'
  | 'firmado'
  | 'enviado_igt'
  | 'registrado'
  | 'renovado'
  | 'vencido'
  | 'cancelado'
  | 'otro';

// ── Interfaces ────────────────────────────────────────────────────────────

export interface TramiteLaboral {
  id: string;
  cliente_id: string;
  categoria: CategoriaLaboral;
  estado: EstadoTramiteLaboral;
  nombre_empleado: string | null;
  puesto: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  fecha_registro_igt: string | null;
  numero_registro_igt: string | null;
  salario: number | null;
  moneda: 'GTQ' | 'USD';
  es_temporal: boolean;
  duracion_meses: number | null;
  alerta_dias_antes: number;
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

export interface TramiteLaboralConCliente extends TramiteLaboral {
  cliente: { id: string; codigo: string; nombre: string; nit: string | null };
}

export interface TramiteLaboralInsert {
  cliente_id: string;
  categoria: CategoriaLaboral;
  estado?: EstadoTramiteLaboral;
  nombre_empleado?: string | null;
  puesto?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  fecha_registro_igt?: string | null;
  numero_registro_igt?: string | null;
  salario?: number | null;
  moneda?: 'GTQ' | 'USD';
  es_temporal?: boolean;
  duracion_meses?: number | null;
  alerta_dias_antes?: number;
  descripcion?: string | null;
  notas?: string | null;
  documento_url?: string | null;
  archivo_pdf_url?: string | null;
  archivo_pdf_nombre?: string | null;
  archivo_docx_url?: string | null;
  archivo_docx_nombre?: string | null;
}

export type TramiteLaboralUpdate = Partial<TramiteLaboralInsert>;

export interface HistorialLaboral {
  id: string;
  tramite_id: string;
  fecha: string;
  accion: AccionHistorialLaboral;
  descripcion: string;
  documento_url: string | null;
  created_at: string;
}

export interface HistorialLaboralInsert {
  tramite_id: string;
  fecha: string;
  accion: AccionHistorialLaboral;
  descripcion: string;
  documento_url?: string | null;
}

// ── Labels ────────────────────────────────────────────────────────────────

export const CATEGORIA_LABORAL_LABEL: Record<CategoriaLaboral, string> = {
  contrato_individual: 'Contrato Individual de Trabajo',
  contrato_temporal: 'Contrato Temporal',
  contrato_profesional: 'Contrato de Servicios Profesionales',
  reglamento_interno: 'Reglamento Interno de Trabajo',
  registro_contrato_igt: 'Registro de Contrato ante IGT',
  libro_salarios: 'Libro de Salarios',
  pacto_colectivo: 'Pacto Colectivo de Condiciones de Trabajo',
  otro: 'Otro',
};

export const CATEGORIA_LABORAL_SHORT: Record<CategoriaLaboral, string> = {
  contrato_individual: 'Contrato Individual',
  contrato_temporal: 'Contrato Temporal',
  contrato_profesional: 'Servicios Prof.',
  reglamento_interno: 'Reglamento Interno',
  registro_contrato_igt: 'Registro IGT',
  libro_salarios: 'Libro Salarios',
  pacto_colectivo: 'Pacto Colectivo',
  otro: 'Otro',
};

export const ESTADO_LABORAL_LABEL: Record<EstadoTramiteLaboral, string> = {
  pendiente: 'Pendiente',
  en_elaboracion: 'En Elaboración',
  firmado: 'Firmado',
  registrado: 'Registrado',
  vigente: 'Vigente',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
};

export const ESTADO_LABORAL_COLOR: Record<EstadoTramiteLaboral, string> = {
  pendiente: 'bg-slate-100 text-slate-700',
  en_elaboracion: 'bg-blue-100 text-blue-700',
  firmado: 'bg-indigo-100 text-indigo-700',
  registrado: 'bg-emerald-100 text-emerald-700',
  vigente: 'bg-green-100 text-green-700',
  vencido: 'bg-red-100 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
};

export const ACCION_LABORAL_LABEL: Record<AccionHistorialLaboral, string> = {
  creado: 'Creado',
  elaborado: 'Elaborado',
  firmado: 'Firmado',
  enviado_igt: 'Enviado a IGT',
  registrado: 'Registrado',
  renovado: 'Renovado',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
  otro: 'Otro',
};

export const MONEDA_LABORAL_LABEL: Record<'GTQ' | 'USD', string> = {
  GTQ: 'Quetzales (GTQ)',
  USD: 'Dólares (USD)',
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** Categorías que tienen fecha fin (contratos temporales) */
export const CATEGORIAS_CON_FECHA_FIN: CategoriaLaboral[] = [
  'contrato_temporal',
  'contrato_profesional',
];

/** Categorías que requieren registro IGT */
export const CATEGORIAS_CON_REGISTRO_IGT: CategoriaLaboral[] = [
  'contrato_individual',
  'contrato_temporal',
  'registro_contrato_igt',
  'reglamento_interno',
];

/** Semáforo: calcula el color de cumplimiento laboral */
export function getSemaforoLaboral(
  fechaFin: string | null,
  estado: EstadoTramiteLaboral,
  alertaDias: number = 30,
): 'verde' | 'amarillo' | 'rojo' | 'gris' {
  if (estado === 'cancelado') return 'gris';
  if (estado === 'vencido') return 'rojo';
  if (!fechaFin) {
    if (estado === 'vigente' || estado === 'registrado') return 'verde';
    return 'amarillo';
  }
  const hoy = new Date();
  const fin = new Date(fechaFin);
  const diff = Math.ceil((fin.getTime() - hoy.getTime()) / 86400000);
  if (diff < 0) return 'rojo';
  if (diff <= alertaDias) return 'amarillo';
  return 'verde';
}

export const SEMAFORO_LABORAL_COLOR = {
  verde: 'bg-green-100 text-green-700 border-green-200',
  amarillo: 'bg-amber-100 text-amber-700 border-amber-200',
  rojo: 'bg-red-100 text-red-700 border-red-200',
  gris: 'bg-gray-100 text-gray-500 border-gray-200',
} as const;

export const SEMAFORO_LABORAL_DOT = {
  verde: 'bg-green-500',
  amarillo: 'bg-amber-500',
  rojo: 'bg-red-500',
  gris: 'bg-gray-400',
} as const;
