// ============================================================================
// lib/types/notas-entrega.ts
// Notas de entrega/recepción de documentos (correlativo NE-NNNN).
// Comprobante NO fiscal que firman ambas partes al entregar/recibir documentos.
// ============================================================================

export type EstadoNotaEntrega = 'pendiente' | 'completada' | 'cancelada';

export interface NotaEntrega {
  id: string;
  numero: string;                    // 'NE-0001'
  cita_id: string | null;
  cliente_id: string | null;
  fecha: string;                     // 'YYYY-MM-DD'
  documentos_entregados: string | null;  // lo que el despacho entrega al cliente
  documentos_recibidos: string | null;   // lo que el cliente entrega al despacho
  notas: string | null;
  estado: EstadoNotaEntrega;
  pdf_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Joins
  cliente?: { id: string; codigo: string; nombre: string; nit: string | null } | null;
}

export interface CrearNotaEntregaInput {
  cliente_id: string;
  cita_id?: string | null;
  fecha?: string | null;
  documentos_entregados?: string | null;
  documentos_recibidos?: string | null;
  notas?: string | null;
  estado?: EstadoNotaEntrega;
}

export interface ActualizarNotaEntregaInput {
  fecha?: string | null;
  documentos_entregados?: string | null;
  documentos_recibidos?: string | null;
  notas?: string | null;
  estado?: EstadoNotaEntrega;
}
