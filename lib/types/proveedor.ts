// ============================================================================
// lib/types/proveedor.ts
// ============================================================================

export type TipoProveedor =
  | 'freelance'
  | 'empresa'
  | 'consultor'
  | 'perito'
  | 'traductor'
  | 'notificador'
  | 'otro';

export interface Proveedor {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoProveedor;
  especialidad: string | null;
  nit: string | null;
  dpi: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  cuenta_nombre: string | null;
  tarifa_hora: number | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProveedorInsert {
  codigo?: string;
  nombre: string;
  tipo: TipoProveedor;
  especialidad?: string | null;
  nit?: string | null;
  dpi?: string | null;
  telefono?: string | null;
  email?: string | null;
  direccion?: string | null;
  banco?: string | null;
  tipo_cuenta?: string | null;
  numero_cuenta?: string | null;
  cuenta_nombre?: string | null;
  tarifa_hora?: number | null;
  notas?: string | null;
  activo?: boolean;
}
