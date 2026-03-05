// ============================================================================
// lib/templates/types.ts
// Tipos para datos de cada plantilla de documento legal
// ============================================================================

export type TipoDocumentoGenerable =
  | 'arrendamiento'
  | 'laboral'
  | 'agot'
  | 'acta_notarial_certificacion'
  | 'amparo'
  | 'rendicion_cuentas'
  | 'sumario_nulidad'
  | 'oposicion_desestimacion';

export interface PersonaFisica {
  nombre: string;
  edad?: string;
  estado_civil?: string;
  nacionalidad?: string;
  profesion?: string;
  dpi?: string;
  direccion?: string;
}

export interface DatosArrendamiento {
  numero_escritura?: number;
  fecha?: string; // YYYY-MM-DD
  lugar?: string;
  arrendante: PersonaFisica;
  arrendatario: PersonaFisica;
  fiador?: PersonaFisica;
  inmueble_descripcion: string;
  inmueble_direccion: string;
  finca?: string;
  folio?: string;
  libro?: string;
  plazo_meses: number;
  renta_mensual: number;
  deposito?: number;
  fecha_inicio?: string;
  condiciones_especiales?: string[];
  representante_legal?: {
    nombre: string;
    calidad: string;
    inscripcion?: string;
  };
}

export interface DatosLaboral {
  trabajador: PersonaFisica;
  patrono: {
    empresa: string;
    representante?: string;
    datos_inscripcion?: string;
    direccion?: string;
  };
  puesto: string;
  fecha_inicio: string;
  salario_mensual: number;
  bonificacion_incentivo?: number;
  horario: string;
  jornada?: string;
  lugar_trabajo: string;
  funciones?: string[];
}

export interface SocioAccionista {
  nombre: string;
  calidad?: string;
}

export interface PuntoAgenda {
  tipo: string; // descripción del punto
  detalle: string;
}

export interface DatosAGOT {
  entidad: string;
  numero_acta?: number;
  fecha: string;
  hora?: string;
  direccion_sede: string;
  socios: SocioAccionista[];
  presidente: string;
  secretario: string;
  puntos: PuntoAgenda[];
}

export interface DatosActaNotarialCertificacion {
  notario?: string;
  fecha: string;
  hora?: string;
  lugar: string;
  requirente: PersonaFisica;
  calidad_requirente?: string;
  entidad: string;
  numero_acta: number;
  fecha_acta: string;
  punto_certificado: string;
  contenido_literal: string;
  registro_cancelar?: string;
  registro_otorgar?: string;
}

export interface DatosAmparo {
  tribunal?: string;
  amparista: PersonaFisica;
  autoridad_impugnada: string;
  acto_reclamado: string;
  legitimacion_activa: string;
  temporaneidad?: string;
  derecho_amenazado: string;
  disposiciones_violadas: string[];
  casos_procedencia: string[];
  terceros_interesados?: string[];
  hechos: string[];
  peticion: string[];
}

export interface DatosRendicionCuentas {
  juzgado: string;
  demandante: PersonaFisica;
  demandado: PersonaFisica;
  relacion_juridica: string;
  hechos: string[];
  fundamento_derecho: string[];
  peticion: string[];
}

export interface DatosSumarioNulidad {
  juzgado: string;
  actor: PersonaFisica;
  demandado: PersonaFisica;
  acto_impugnado: string;
  terceros_interesados?: string[];
  hechos: string[];
  fundamento_derecho: string[];
  peticion: string[];
}

export interface DatosOposicionDesestimacion {
  expediente: string;
  tribunal: string;
  querellante: PersonaFisica;
  auxilio_profesional?: string;
  motivo_comparecencia: string;
  hechos: string[];
  fundamento_derecho: string[];
  peticion: string[];
}
