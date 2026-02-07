// ============================================================================
// lib/types/notariado.ts
// Escrituras, Testimonios, Actas, Autenticaciones, Avisos Trimestrales
// ============================================================================

import type {
  TipoInstrumento,
  EstadoEscritura,
  TipoTestimonio,
  EstadoTestimonio,
  EstadoAviso,
  TipoActa,
} from './enums';
import type { Cliente } from './clientes';

// --- Protocolo Anual ---

export interface ProtocoloAnual {
  id: string;
  anio: number;
  ultima_escritura_numero: number;
  escrituras_autorizadas: number;
  escrituras_canceladas: number;
  hojas_protocolo_usadas: number;
  estado: 'abierto' | 'cerrado';
  fecha_apertura: string | null;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
}

// --- Comparecientes (JSONB) ---

export interface Compareciente {
  nombre: string;
  dpi: string | null;
  calidad: string;          // vendedor, comprador, mandante, mandatario, otorgante, etc.
  representacion: string | null; // "en representación de EMPRESA S.A."
}

// --- Impuestos Aplicables (JSONB) ---

export interface ImpuestosAplicables {
  iva_actos?: number;
  timbre_compraventa?: number;
  arancel_registro_propiedad?: number;
  otros?: Array<{ nombre: string; monto: number }>;
}

// --- Escrituras ---

export interface Escritura {
  id: string;
  protocolo_anual_id: string;
  cliente_id: string | null;
  expediente_id: string | null;
  cotizacion_id: string | null;

  numero: number;
  numero_texto: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;

  tipo_instrumento: TipoInstrumento;
  tipo_instrumento_texto: string;
  descripcion: string | null;

  estado: EstadoEscritura;

  comparecientes: Compareciente[];
  objeto_acto: string | null;
  valor_acto: number | null;
  moneda: string;

  hojas_protocolo: number | null;
  hojas_fotocopia: number | null;

  // PDF escaneado
  pdf_escritura_url: string | null;
  pdf_subido_at: string | null;
  pdf_nombre_archivo: string | null;
  pdf_tamano_bytes: number | null;
  pdf_verificado: boolean;
  pdf_notas: string | null;

  // Timbres
  timbre_notarial: number;
  timbres_fiscales: number;
  timbre_razon: number;
  timbres_auto_calculados: boolean;
  timbres_notas: string | null;

  // Aranceles
  arancel_registro: number;
  impuestos_aplicables: ImpuestosAplicables;

  factura_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EscrituraInsert {
  protocolo_anual_id: string;
  cliente_id?: string | null;
  expediente_id?: string | null;
  cotizacion_id?: string | null;

  numero?: number | null;         // Null = auto-asignar
  numero_texto: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;

  tipo_instrumento: TipoInstrumento;
  tipo_instrumento_texto: string;
  descripcion?: string | null;
  estado?: EstadoEscritura;

  comparecientes: Compareciente[];
  objeto_acto?: string | null;
  valor_acto?: number | null;

  hojas_protocolo?: number | null;
  hojas_fotocopia?: number | null;

  notas?: string | null;
}

export interface EscrituraUpdate {
  estado?: EstadoEscritura;
  descripcion?: string | null;
  comparecientes?: Compareciente[];
  objeto_acto?: string | null;
  valor_acto?: number | null;
  hojas_protocolo?: number | null;
  hojas_fotocopia?: number | null;

  // Upload PDF
  pdf_escritura_url?: string | null;
  pdf_nombre_archivo?: string | null;
  pdf_tamano_bytes?: number | null;
  pdf_verificado?: boolean;
  pdf_notas?: string | null;

  // Corrección manual de timbres
  timbre_notarial?: number;
  timbres_fiscales?: number;
  timbre_razon?: number;
  timbres_auto_calculados?: boolean;
  timbres_notas?: string | null;

  arancel_registro?: number;
  impuestos_aplicables?: ImpuestosAplicables;

  factura_id?: string | null;
  notas?: string | null;
}

// Con joins
export interface EscrituraConRelaciones extends Escritura {
  cliente: Pick<Cliente, 'id' | 'codigo' | 'nombre'> | null;
  protocolo: Pick<ProtocoloAnual, 'id' | 'anio'>;
  testimonios: Testimonio[];
}

// Para la lista de escrituras (más liviano)
export interface EscrituraResumen {
  id: string;
  numero: number;
  numero_texto: string;
  fecha_autorizacion: string;
  tipo_instrumento: TipoInstrumento;
  tipo_instrumento_texto: string;
  estado: EstadoEscritura;
  cliente_nombre: string | null;
  pdf_escritura_url: string | null;
  testimonios_pendientes: number;
}

// --- Plantillas de Razón ---

export interface PlantillaRazon {
  id: string;
  tipo_instrumento: TipoInstrumento;
  tipo_testimonio: TipoTestimonio;
  plantilla: string;
  descripcion: string | null;
  es_default: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// Variables disponibles para renderizar plantillas
export interface PlantillaVariables {
  tipo_testimonio_texto: string;       // "ES TESTIMONIO" | "ES TESTIMONIO ESPECIAL"
  numero_texto: string;                // "CUARENTA Y NUEVE (49)"
  lugar_autorizacion: string;          // "Ciudad de Guatemala"
  departamento: string;                // "Guatemala"
  fecha_autorizacion_texto: string;    // "diecisiete de noviembre del año dos mil veinticinco"
  destinatario: string;                // "JULIO CÉSAR CATALÁN RICCO"
  articulo_codigo: string;             // "77"
  literal_codigo: string;              // "b"
  hojas_texto: string;                 // "DOS HOJAS"
  hojas_protocolo_texto: string;       // "siete"
  hojas_detalle: string;               // "la primera en su lado reverso..."
  tipo_acto_texto: string;             // "contrato de compraventa"
  objeto_acto: string;                 // "un bien inmueble..."
  timbre_texto: string;                // "Se hace constar que no está afecto..."
  fecha_emision_texto: string;         // "dieciocho de noviembre del año dos mil veinticinco"
  lugar_emision: string;               // "ciudad de Guatemala"
  notario_nombre: string;              // "SOAZIG AMANDA SANTIZO CALDERÓN"
}

// --- Testimonios ---

export interface Testimonio {
  id: string;
  escritura_id: string;
  tipo: TipoTestimonio;
  estado: EstadoTestimonio;
  plantilla_id: string | null;

  destinatario: string;
  texto_razon: string | null;
  texto_editado: boolean;

  hojas_fotocopia: number | null;
  hojas_detalle: string | null;
  hoja_bond: number;

  articulo_codigo: string;
  literal_codigo: string;

  timbre_razon: number;
  timbres_adicionales: number;
  timbre_notas: string | null;

  fecha_emision: string | null;
  fecha_entrega: string | null;

  pdf_url: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestimonioUpdate {
  estado?: EstadoTestimonio;
  destinatario?: string;
  texto_razon?: string | null;

  hojas_fotocopia?: number | null;
  hojas_detalle?: string | null;

  timbre_razon?: number;
  timbres_adicionales?: number;
  timbre_notas?: string | null;

  fecha_emision?: string | null;
  fecha_entrega?: string | null;
  notas?: string | null;
}

// Con la escritura para contexto
export interface TestimonioConEscritura extends Testimonio {
  escritura: Pick<Escritura,
    'id' | 'numero' | 'numero_texto' | 'fecha_autorizacion' |
    'lugar_autorizacion' | 'departamento' | 'tipo_instrumento' |
    'tipo_instrumento_texto' | 'estado' | 'pdf_escritura_url'
  >;
  cliente_nombre: string | null;
}

// --- Actas Notariales ---

export interface ActaNotarial {
  id: string;
  cliente_id: string | null;
  expediente_id: string | null;

  numero: number;
  anio: number;
  fecha: string;
  lugar: string;
  tipo: TipoActa;
  tipo_texto: string | null;

  requirente: string;
  requirente_dpi: string | null;
  hechos: string | null;
  contenido_completo: string | null;

  hojas: number;
  pdf_url: string | null;

  factura_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActaNotarialInsert {
  cliente_id?: string | null;
  expediente_id?: string | null;
  fecha?: string;
  lugar: string;
  tipo: TipoActa;
  tipo_texto?: string | null;
  requirente: string;
  requirente_dpi?: string | null;
  hechos?: string | null;
  contenido_completo?: string | null;
  hojas?: number;
  notas?: string | null;
}

// --- Autenticaciones ---

export interface Autenticacion {
  id: string;
  cliente_id: string | null;

  numero: number;
  anio: number;
  fecha: string;
  lugar: string;

  documento_autenticado: string;
  firmantes: Array<{ nombre: string; dpi: string | null }>;
  numero_firmas: number;

  pdf_url: string | null;
  factura_id: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutenticacionInsert {
  cliente_id?: string | null;
  fecha?: string;
  lugar: string;
  documento_autenticado: string;
  firmantes: Array<{ nombre: string; dpi: string | null }>;
  numero_firmas: number;
  notas?: string | null;
}

// --- Avisos Trimestrales ---

export interface AvisoTrimestral {
  id: string;
  anio: number;
  trimestre: 1 | 2 | 3 | 4;
  estado: EstadoAviso;

  escrituras_autorizadas: number;
  escrituras_canceladas: number;
  ultimo_instrumento_numero: number | null;
  ultimo_instrumento_numero_texto: string | null;
  ultimo_instrumento_tipo: string | null;
  ultimo_instrumento_lugar: string | null;
  ultimo_instrumento_fecha: string | null;
  ultimo_instrumento_fecha_texto: string | null;

  fecha_inicio_trimestre: string;
  fecha_fin_trimestre: string;
  fecha_limite_envio: string;

  texto_aviso: string | null;
  texto_editado: boolean;

  pdf_url: string | null;
  fecha_envio: string | null;
  fecha_confirmacion: string | null;
  metodo_envio: string | null;

  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Reglas de Timbres ---

export interface ReglaTimbres {
  id: string;
  tipo_instrumento: TipoInstrumento;
  nombre: string;
  descripcion: string | null;

  timbre_fijo: number | null;
  timbre_porcentaje: number | null;
  base_calculo: 'valor_acto' | 'capital_social' | 'fijo';
  exento: boolean;
  texto_razon: string | null;

  impuestos_adicionales: Record<string, unknown>;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

// --- Dashboard Notarial ---

export interface DashboardNotarial {
  anio: number;
  ultima_escritura_numero: number;
  escrituras_autorizadas: number;
  escrituras_canceladas: number;
  hojas_protocolo_usadas: number;
  testimonios_primer_pendientes: number;
  testimonios_especial_pendientes: number;
  ultimo_aviso_estado: EstadoAviso | null;
  proxima_fecha_limite_aviso: string | null;
}
