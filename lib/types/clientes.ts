// ============================================================================
// lib/types/clientes.ts
// ============================================================================

import type {
  TipoPersona,
  EstadoCliente,
} from './enums';

// --- Clientes ---

export interface Cliente {
  id: string;
  codigo: string;
  tipo: TipoPersona;
  nombre: string;
  nit: string | null;
  dpi: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  fuente: string | null;
  estado: EstadoCliente;
  abogado_asignado: string;

  // Facturación (pueden diferir del nombre principal)
  razon_social_facturacion: string | null;
  nit_facturacion: string | null;
  direccion_facturacion: string | null;

  grupo_empresarial_id: string | null;

  datos_sensibles_encrypted: Record<string, unknown> | null;
  notas: string | null;

  created_at: string;
  updated_at: string;
}

export interface ClienteInsert {
  codigo?: string;
  tipo: TipoPersona;
  nombre: string;
  nit?: string | null;
  dpi?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  fuente?: string | null;
  estado?: EstadoCliente;
  abogado_asignado?: string;
  razon_social_facturacion?: string | null;
  nit_facturacion?: string | null;
  direccion_facturacion?: string | null;
  grupo_empresarial_id?: string | null;
  notas?: string | null;
  activo?: boolean;
}

export interface ClienteUpdate extends Partial<ClienteInsert> {}

// Cliente con conteos para la lista
export interface ClienteConResumen extends Cliente {
  expedientes_activos: number;
  facturas_pendientes: number;
  saldo_pendiente: number;
}

// --- Catálogo de Servicios ---

export interface CatalogoServicio {
  id: string;
  codigo: string;
  categoria: string;
  servicio: string;
  descripcion: string | null;
  precio_base: number;
  unidad: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

