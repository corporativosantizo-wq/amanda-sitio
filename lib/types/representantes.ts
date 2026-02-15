// ============================================================================
// lib/types/representantes.ts
// Tipos para representantes legales y grupos empresariales
// ============================================================================

export type CargoRepresentante = 'administrador_unico' | 'presidente_consejo' | 'gerente_general' | 'gerente_operativo';
export type CategoriaRepresentante = 'direccion' | 'gestion';

export const CARGOS_DIRECCION: CargoRepresentante[] = ['administrador_unico', 'presidente_consejo'];
export const CARGOS_GESTION: CargoRepresentante[] = ['gerente_general', 'gerente_operativo'];

export const CARGO_LABELS: Record<CargoRepresentante, string> = {
  administrador_unico: 'Administrador Unico',
  presidente_consejo: 'Presidente del Consejo de Administracion',
  gerente_general: 'Gerente General',
  gerente_operativo: 'Gerente Operativo',
};

export interface RepresentanteLegal {
  id: string;
  nombre_completo: string;
  email: string | null;
  telefono: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmpresaRepresentante {
  id: string;
  empresa_id: string;
  representante_id: string;
  cargo: CargoRepresentante;
  created_at: string;
  representante?: RepresentanteLegal;
  empresa?: { id: string; codigo: string; nombre: string };
}

export interface GrupoEmpresarial {
  id: string;
  nombre: string;
  created_at: string;
  updated_at: string;
  empresas?: { id: string; codigo: string; nombre: string }[];
}

export interface RepresentanteInput {
  cargo: CargoRepresentante;
  nombre_completo: string;
  email?: string | null;
  representante_id?: string;
}
