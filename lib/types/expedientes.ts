// ============================================================================
// lib/types/expedientes.ts
// Tipos para el módulo de expedientes judiciales/fiscales/administrativos
// ============================================================================

import type { EstadoExpediente } from './enums';

// --- Enums como union types (matching Postgres enums) ---

export type OrigenExpediente = 'judicial' | 'fiscal' | 'administrativo';

export type TipoProceso =
  | 'civil' | 'penal' | 'laboral' | 'contencioso_administrativo'
  | 'constitucional' | 'amparo' | 'familia' | 'mercantil'
  | 'economico_coactivo' | 'internacional'
  | 'administrativo_sancionador' | 'administrativo_tributario';

export type FaseExpediente =
  // Fiscales
  | 'denuncia' | 'investigacion' | 'solicitud_desestimacion'
  | 'clausura_provisional' | 'acusacion' | 'criterio_oportunidad' | 'judicializado'
  // Administrativas
  | 'procedimiento_administrativo' | 'audiencia_administrativa'
  | 'resolucion_administrativa' | 'recurso_revocatoria' | 'recurso_reposicion'
  | 'casacion_administrativa' | 'derivado_coactivo' | 'finalizado_administrativo'
  // Judiciales
  | 'demanda' | 'emplazamiento' | 'excepciones' | 'conciliacion'
  | 'abierto_a_prueba' | 'alegatos' | 'auto_para_mejor_fallar'
  | 'sentencia_primera' | 'apelacion' | 'sentencia_segunda'
  | 'casacion' | 'amparo_fase' | 'ejecucion'
  // Generales
  | 'archivado' | 'finalizado';

export type RolClienteExpediente =
  | 'actor' | 'demandado' | 'tercero' | 'amicus_curiae'
  | 'denunciante' | 'denunciado' | 'sancionado' | 'contribuyente';

export type MonedaExpediente = 'GTQ' | 'USD' | 'EUR';

export type SedeActuacion = 'fiscal' | 'administrativa' | 'judicial';

export type TipoActuacion =
  | 'memorial' | 'resolucion' | 'audiencia' | 'notificacion'
  | 'sentencia' | 'recurso' | 'diligencia' | 'requerimiento_fiscal'
  | 'declaracion' | 'peritaje' | 'resolucion_administrativa'
  | 'providencia' | 'otro';

export type RealizadoPor =
  | 'bufete' | 'contraparte' | 'juzgado' | 'fiscalia'
  | 'entidad_administrativa' | 'otro';

export type TipoPlazo =
  | 'contestacion_demanda' | 'prueba' | 'alegatos' | 'apelacion'
  | 'casacion' | 'amparo' | 'evacuacion_audiencia' | 'vista'
  | 'recurso_revocatoria' | 'recurso_reposicion' | 'pago_multa'
  | 'cumplimiento_resolucion' | 'otro';

export type EstadoPlazo = 'pendiente' | 'cumplido' | 'vencido' | 'prorrogado';

export type TipoVinculo =
  | 'amparo' | 'apelacion' | 'casacion' | 'acumulacion'
  | 'incidente' | 'economico_coactivo' | 'judicializacion' | 'relacionado';

// --- Interfaces principales ---

export interface Expediente {
  id: string;
  numero_expediente: string | null;
  numero_mp: string | null;
  numero_administrativo: string | null;
  cliente_id: string;
  origen: OrigenExpediente;
  tipo_proceso: TipoProceso;
  subtipo: string | null;
  fase_actual: FaseExpediente;
  // Sede fiscal
  fiscalia: string | null;
  agente_fiscal: string | null;
  // Sede administrativa
  entidad_administrativa: string | null;
  dependencia: string | null;
  monto_multa: number | null;
  resolucion_administrativa: string | null;
  // Sede judicial
  juzgado: string | null;
  departamento: string | null;
  // Partes
  actor: string | null;
  demandado: string | null;
  rol_cliente: RolClienteExpediente | null;
  // Generales
  estado: EstadoExpediente;
  fecha_inicio: string;
  fecha_ultima_actuacion: string | null;
  fecha_finalizacion: string | null;
  descripcion: string | null;
  notas_internas: string | null;
  monto_pretension: number | null;
  moneda: MonedaExpediente;
  created_at: string;
  updated_at: string;
}

export interface ExpedienteInsert {
  numero_expediente?: string | null;
  numero_mp?: string | null;
  numero_administrativo?: string | null;
  cliente_id: string;
  origen: OrigenExpediente;
  tipo_proceso: TipoProceso;
  subtipo?: string | null;
  fase_actual: FaseExpediente;
  fiscalia?: string | null;
  agente_fiscal?: string | null;
  entidad_administrativa?: string | null;
  dependencia?: string | null;
  monto_multa?: number | null;
  resolucion_administrativa?: string | null;
  juzgado?: string | null;
  departamento?: string | null;
  actor?: string | null;
  demandado?: string | null;
  rol_cliente?: RolClienteExpediente | null;
  estado?: EstadoExpediente;
  fecha_inicio: string;
  fecha_ultima_actuacion?: string | null;
  fecha_finalizacion?: string | null;
  descripcion?: string | null;
  notas_internas?: string | null;
  monto_pretension?: number | null;
  moneda?: MonedaExpediente;
}

export interface ExpedienteUpdate extends Partial<ExpedienteInsert> {}

export interface ExpedienteConCliente extends Expediente {
  cliente: { id: string; codigo: string; nombre: string; nit: string | null };
  plazo_proximo?: { fecha_vencimiento: string; descripcion: string; dias_restantes: number } | null;
}

// --- Actuaciones procesales ---

export interface ActuacionProcesal {
  id: string;
  expediente_id: string;
  fecha: string;
  sede: SedeActuacion;
  tipo: TipoActuacion;
  descripcion: string;
  realizado_por: RealizadoPor;
  documento_url: string | null;
  created_at: string;
}

export interface ActuacionInsert {
  expediente_id: string;
  fecha: string;
  sede: SedeActuacion;
  tipo: TipoActuacion;
  descripcion: string;
  realizado_por: RealizadoPor;
  documento_url?: string | null;
}

// --- Plazos procesales ---

export interface PlazoProcesal {
  id: string;
  expediente_id: string;
  tipo_plazo: TipoPlazo;
  descripcion: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  dias_habiles: boolean;
  estado: EstadoPlazo;
  alerta_dias_antes: number;
  created_at: string;
}

export interface PlazoInsert {
  expediente_id: string;
  tipo_plazo: TipoPlazo;
  descripcion: string;
  fecha_inicio: string;
  fecha_vencimiento: string;
  dias_habiles?: boolean;
  estado?: EstadoPlazo;
  alerta_dias_antes?: number;
}

// --- Expedientes vinculados ---

export interface ExpedienteVinculado {
  id: string;
  expediente_origen_id: string;
  expediente_destino_id: string;
  tipo_vinculo: TipoVinculo;
  descripcion: string | null;
  created_at: string;
  expediente_destino?: Pick<Expediente, 'id' | 'numero_expediente' | 'numero_mp' | 'numero_administrativo' | 'origen' | 'tipo_proceso' | 'estado'>;
}

export interface VinculoInsert {
  expediente_origen_id: string;
  expediente_destino_id: string;
  tipo_vinculo: TipoVinculo;
  descripcion?: string | null;
}

// --- Labels para UI ---

export const ORIGEN_LABEL: Record<OrigenExpediente, string> = {
  judicial: 'Judicial',
  fiscal: 'Fiscal',
  administrativo: 'Administrativo',
};

export const ORIGEN_COLOR: Record<OrigenExpediente, string> = {
  judicial: 'bg-blue-100 text-blue-700',
  fiscal: 'bg-amber-100 text-amber-700',
  administrativo: 'bg-purple-100 text-purple-700',
};

export const TIPO_PROCESO_LABEL: Record<TipoProceso, string> = {
  civil: 'Civil',
  penal: 'Penal',
  laboral: 'Laboral',
  contencioso_administrativo: 'Contencioso Administrativo',
  constitucional: 'Constitucional',
  amparo: 'Amparo',
  familia: 'Familia',
  mercantil: 'Mercantil',
  economico_coactivo: 'Económico Coactivo',
  internacional: 'Internacional',
  administrativo_sancionador: 'Administrativo Sancionador',
  administrativo_tributario: 'Administrativo Tributario',
};

export const FASE_LABEL: Record<FaseExpediente, string> = {
  // Fiscales
  denuncia: 'Denuncia',
  investigacion: 'Investigación',
  solicitud_desestimacion: 'Solicitud de Desestimación',
  clausura_provisional: 'Clausura Provisional',
  acusacion: 'Acusación',
  criterio_oportunidad: 'Criterio de Oportunidad',
  judicializado: 'Judicializado',
  // Administrativas
  procedimiento_administrativo: 'Procedimiento Administrativo',
  audiencia_administrativa: 'Audiencia Administrativa',
  resolucion_administrativa: 'Resolución Administrativa',
  recurso_revocatoria: 'Recurso de Revocatoria',
  recurso_reposicion: 'Recurso de Reposición',
  casacion_administrativa: 'Casación Administrativa',
  derivado_coactivo: 'Derivado a Coactivo',
  finalizado_administrativo: 'Finalizado (Administrativo)',
  // Judiciales
  demanda: 'Demanda',
  emplazamiento: 'Emplazamiento',
  excepciones: 'Excepciones',
  conciliacion: 'Conciliación',
  abierto_a_prueba: 'Abierto a Prueba',
  alegatos: 'Alegatos',
  auto_para_mejor_fallar: 'Auto para Mejor Fallar',
  sentencia_primera: 'Sentencia 1ª Instancia',
  apelacion: 'Apelación',
  sentencia_segunda: 'Sentencia 2ª Instancia',
  casacion: 'Casación',
  amparo_fase: 'Amparo',
  ejecucion: 'Ejecución',
  // Generales
  archivado: 'Archivado',
  finalizado: 'Finalizado',
};

export const ESTADO_EXPEDIENTE_LABEL: Record<string, string> = {
  activo: 'Activo',
  suspendido: 'Suspendido',
  archivado: 'Archivado',
  finalizado: 'Finalizado',
};

export const ESTADO_EXPEDIENTE_COLOR: Record<string, string> = {
  activo: 'bg-green-100 text-green-700',
  suspendido: 'bg-amber-100 text-amber-700',
  archivado: 'bg-slate-100 text-slate-600',
  finalizado: 'bg-blue-100 text-blue-700',
};

export const ROL_CLIENTE_LABEL: Record<RolClienteExpediente, string> = {
  actor: 'Actor',
  demandado: 'Demandado',
  tercero: 'Tercero',
  amicus_curiae: 'Amicus Curiae',
  denunciante: 'Denunciante',
  denunciado: 'Denunciado',
  sancionado: 'Sancionado',
  contribuyente: 'Contribuyente',
};

export const SEDE_LABEL: Record<SedeActuacion, string> = {
  fiscal: 'Fiscalía',
  administrativa: 'Administrativa',
  judicial: 'Judicial',
};

export const TIPO_ACTUACION_LABEL: Record<TipoActuacion, string> = {
  memorial: 'Memorial',
  resolucion: 'Resolución',
  audiencia: 'Audiencia',
  notificacion: 'Notificación',
  sentencia: 'Sentencia',
  recurso: 'Recurso',
  diligencia: 'Diligencia',
  requerimiento_fiscal: 'Requerimiento Fiscal',
  declaracion: 'Declaración',
  peritaje: 'Peritaje',
  resolucion_administrativa: 'Resolución Administrativa',
  providencia: 'Providencia',
  otro: 'Otro',
};

export const REALIZADO_POR_LABEL: Record<RealizadoPor, string> = {
  bufete: 'Bufete',
  contraparte: 'Contraparte',
  juzgado: 'Juzgado',
  fiscalia: 'Fiscalía',
  entidad_administrativa: 'Entidad Administrativa',
  otro: 'Otro',
};

export const TIPO_PLAZO_LABEL: Record<TipoPlazo, string> = {
  contestacion_demanda: 'Contestación de Demanda',
  prueba: 'Prueba',
  alegatos: 'Alegatos',
  apelacion: 'Apelación',
  casacion: 'Casación',
  amparo: 'Amparo',
  evacuacion_audiencia: 'Evacuación de Audiencia',
  vista: 'Vista',
  recurso_revocatoria: 'Recurso de Revocatoria',
  recurso_reposicion: 'Recurso de Reposición',
  pago_multa: 'Pago de Multa',
  cumplimiento_resolucion: 'Cumplimiento de Resolución',
  otro: 'Otro',
};

export const ESTADO_PLAZO_LABEL: Record<EstadoPlazo, string> = {
  pendiente: 'Pendiente',
  cumplido: 'Cumplido',
  vencido: 'Vencido',
  prorrogado: 'Prorrogado',
};

export const ESTADO_PLAZO_COLOR: Record<EstadoPlazo, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  cumplido: 'bg-green-100 text-green-700',
  vencido: 'bg-red-100 text-red-700',
  prorrogado: 'bg-blue-100 text-blue-700',
};

export const TIPO_VINCULO_LABEL: Record<TipoVinculo, string> = {
  amparo: 'Amparo',
  apelacion: 'Apelación',
  casacion: 'Casación',
  acumulacion: 'Acumulación',
  incidente: 'Incidente',
  economico_coactivo: 'Económico Coactivo',
  judicializacion: 'Judicialización',
  relacionado: 'Relacionado',
};

// --- Fases por origen ---

export const FASES_FISCAL: FaseExpediente[] = [
  'denuncia', 'investigacion', 'solicitud_desestimacion',
  'clausura_provisional', 'acusacion', 'criterio_oportunidad', 'judicializado',
];

export const FASES_ADMINISTRATIVO: FaseExpediente[] = [
  'procedimiento_administrativo', 'audiencia_administrativa',
  'resolucion_administrativa', 'recurso_revocatoria', 'recurso_reposicion',
  'casacion_administrativa', 'derivado_coactivo', 'finalizado_administrativo',
];

export const FASES_JUDICIAL: FaseExpediente[] = [
  'demanda', 'emplazamiento', 'excepciones', 'conciliacion',
  'abierto_a_prueba', 'alegatos', 'auto_para_mejor_fallar',
  'sentencia_primera', 'apelacion', 'sentencia_segunda',
  'casacion', 'amparo_fase', 'ejecucion',
];

export const FASES_GENERAL: FaseExpediente[] = ['archivado', 'finalizado'];

export function getFasesForOrigen(origen: OrigenExpediente): FaseExpediente[] {
  switch (origen) {
    case 'fiscal': return [...FASES_FISCAL, ...FASES_GENERAL];
    case 'administrativo': return [...FASES_ADMINISTRATIVO, ...FASES_GENERAL];
    case 'judicial': return [...FASES_JUDICIAL, ...FASES_GENERAL];
  }
}

// --- Tipos de proceso por origen ---

export const TIPOS_PROCESO_FISCAL: TipoProceso[] = ['penal'];

export const TIPOS_PROCESO_ADMINISTRATIVO: TipoProceso[] = [
  'administrativo_sancionador', 'administrativo_tributario', 'economico_coactivo',
];

export const TIPOS_PROCESO_JUDICIAL: TipoProceso[] = [
  'civil', 'penal', 'laboral', 'contencioso_administrativo',
  'constitucional', 'amparo', 'familia', 'mercantil',
  'economico_coactivo', 'internacional',
];

// --- Departamentos de Guatemala ---

export const DEPARTAMENTOS_GUATEMALA = [
  'Guatemala', 'El Progreso', 'Sacatepéquez', 'Chimaltenango',
  'Escuintla', 'Santa Rosa', 'Sololá', 'Totonicapán',
  'Quetzaltenango', 'Suchitepéquez', 'Retalhuleu', 'San Marcos',
  'Huehuetenango', 'Quiché', 'Baja Verapaz', 'Alta Verapaz',
  'Petén', 'Izabal', 'Zacapa', 'Chiquimula',
  'Jalapa', 'Jutiapa',
];
