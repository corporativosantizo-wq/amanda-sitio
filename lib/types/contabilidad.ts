// ============================================================================
// lib/types/contabilidad.ts
// Cotizaciones, Facturas, Pagos, Gastos
// ============================================================================

import type {
  EstadoCotizacion,
  EstadoFactura,
  EstadoPago,
  TipoPago,
} from './enums';
import type { Cliente } from './clientes';

// --- Cotizaciones ---

export interface Cotizacion {
  id: string;
  numero: string;
  cliente_id: string;
  expediente_id: string | null;

  fecha_emision: string;
  fecha_vencimiento: string;
  estado: EstadoCotizacion;

  subtotal: number;
  iva_monto: number;
  total: number;

  condiciones: string | null;
  notas_internas: string | null;
  incluye_consultas: number;
  duracion_consulta_min: number;

  requiere_anticipo: boolean;
  anticipo_porcentaje: number;
  anticipo_monto: number;

  pdf_url: string | null;
  enviada_at: string | null;
  aceptada_at: string | null;

  token_respuesta: string | null;
  respondida_at: string | null;
  respuesta_notas: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CotizacionItem {
  id: string;
  cotizacion_id: string;
  servicio_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  orden: number;
  created_at: string;
}

export interface CotizacionItemInsert {
  servicio_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  orden?: number;
}

export interface CotizacionInsert {
  cliente_id: string;
  expediente_id?: string | null;
  fecha_emision?: string;
  condiciones?: string | null;
  notas_internas?: string | null;
  incluye_consultas?: number;
  duracion_consulta_min?: number;
  requiere_anticipo?: boolean;
  anticipo_porcentaje?: number;
  items: CotizacionItemInsert[];
}

export interface CotizacionUpdate {
  estado?: EstadoCotizacion;
  condiciones?: string | null;
  notas_internas?: string | null;
  incluye_consultas?: number;
  requiere_anticipo?: boolean;
  anticipo_porcentaje?: number;
  items?: CotizacionItemInsert[];
}

// Con joins para listas
export interface CotizacionConCliente extends Cotizacion {
  cliente: Pick<Cliente, 'id' | 'codigo' | 'nombre' | 'nit' | 'email'>;
  items: CotizacionItem[];
}

// --- Facturas ---

export interface Factura {
  id: string;
  numero: string;
  cotizacion_id: string | null;
  cliente_id: string;
  expediente_id: string | null;

  fecha_emision: string;
  fecha_vencimiento: string | null;
  estado: EstadoFactura;

  razon_social: string;
  nit: string;
  direccion_fiscal: string | null;

  subtotal: number;
  iva_monto: number;
  total: number;

  aplica_retencion: boolean;
  retencion_porcentaje: number;
  retencion_monto: number;
  monto_a_recibir: number;

  // Megaprint FEL
  fel_uuid: string | null;
  fel_numero_autorizacion: string | null;
  fel_serie: string | null;
  fel_numero_dte: string | null;
  fel_fecha_certificacion: string | null;
  fel_xml_url: string | null;
  fel_pdf_url: string | null;

  enviada_at: string | null;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FacturaItem {
  id: string;
  factura_id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  total: number;
  orden: number;
  created_at: string;
}

export interface FacturaInsert {
  cotizacion_id?: string | null;
  cliente_id: string;
  expediente_id?: string | null;
  razon_social: string;
  nit: string;
  direccion_fiscal?: string | null;
  fecha_vencimiento?: string | null;
  aplica_retencion?: boolean;
  items: Array<{
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    orden?: number;
  }>;
}

export interface FacturaConCliente extends Factura {
  cliente: Pick<Cliente, 'id' | 'codigo' | 'nombre' | 'email'>;
  items: FacturaItem[];
  pagos: Pago[];
}

// --- Pagos ---

export interface Pago {
  id: string;
  numero: string;
  factura_id: string | null;
  cotizacion_id: string | null;
  cobro_id: string | null;
  cliente_id: string;

  fecha_pago: string;
  monto: number;
  tipo: TipoPago;
  estado: EstadoPago;

  metodo: string;
  referencia_bancaria: string | null;
  comprobante_url: string | null;

  es_anticipo: boolean;
  porcentaje_anticipo: number | null;

  notas: string | null;
  confirmado_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PagoInsert {
  factura_id?: string | null;
  cotizacion_id?: string | null;
  cobro_id?: string | null;
  cliente_id: string;
  fecha_pago?: string;
  monto: number;
  tipo?: TipoPago;
  metodo?: string;
  referencia_bancaria?: string | null;
  comprobante_url?: string | null;
  es_anticipo?: boolean;
  porcentaje_anticipo?: number | null;
  notas?: string | null;
}

export interface PagoConRelaciones extends Pago {
  cliente: Pick<Cliente, 'id' | 'codigo' | 'nombre'>;
  factura: Pick<Factura, 'id' | 'numero' | 'total'> | null;
}

// --- Gastos ---

export interface CategoriaGasto {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
}

export interface Gasto {
  id: string;
  numero: string;
  categoria_id: string;
  expediente_id: string | null;

  fecha: string;
  descripcion: string;
  proveedor: string | null;
  monto: number;
  iva_incluido: boolean;
  iva_monto: number;

  tiene_factura: boolean;
  numero_factura: string | null;
  nit_proveedor: string | null;
  comprobante_url: string | null;

  es_deducible: boolean;
  notas: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface GastoInsert {
  categoria_id: string;
  expediente_id?: string | null;
  fecha?: string;
  descripcion: string;
  proveedor?: string | null;
  monto: number;
  iva_incluido?: boolean;
  tiene_factura?: boolean;
  numero_factura?: string | null;
  nit_proveedor?: string | null;
  comprobante_url?: string | null;
  es_deducible?: boolean;
  notas?: string | null;
}

export interface GastoConCategoria extends Gasto {
  categoria: CategoriaGasto;
}

// --- Cobros ---

export interface Cobro {
  id: string;
  numero_cobro: number;
  cliente_id: string;
  expediente_id: string | null;
  concepto: string;
  descripcion: string | null;
  monto: number;
  monto_pagado: number;
  saldo_pendiente: number;
  moneda: string;
  estado: 'borrador' | 'pendiente' | 'parcial' | 'pagado' | 'vencido' | 'cancelado';
  fecha_emision: string;
  fecha_vencimiento: string | null;
  dias_credito: number;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface CobroConCliente extends Cobro {
  cliente: { id: string; nombre: string; email: string | null };
}

export interface CobroInsert {
  cliente_id: string;
  expediente_id?: string | null;
  concepto: string;
  descripcion?: string | null;
  monto: number;
  dias_credito?: number;
  notas?: string | null;
}

export interface RecordatorioCobro {
  id: string;
  cobro_id: string;
  tipo: 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | 'urgente';
  fecha_envio: string;
  email_enviado: boolean;
  resultado: string | null;
  created_at: string;
}

// --- Dashboard Contable ---

export interface DashboardContable {
  ingresos_mes: number;
  gastos_mes: number;
  facturas_pendientes_count: number;
  facturas_pendientes_monto: number;
  facturas_vencidas_count: number;
  cotizaciones_activas_count: number;
  cotizaciones_por_vencer_count: number;
}

// --- Cálculos Fiscales ---

export interface CalculoRetencion {
  porcentaje: number;
  monto: number;
}

export interface DesgloseFiscal {
  subtotal: number;
  iva_porcentaje: number;
  iva_monto: number;
  total: number;
  retencion: CalculoRetencion | null;
  monto_a_recibir: number;
}
