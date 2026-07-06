// ============================================================================
// lib/utils/idioma.ts
// Resolución del idioma de comunicaciones de un cliente.
//
// BLINDAJE (3 capas para que un cliente no marcado SIEMPRE reciba español):
//   1. DB: legal.clientes.idioma es NOT NULL DEFAULT 'es'
//   2. Este helper: cualquier valor ausente/desconocido resuelve a 'es'
//   3. plantillas() (lib/templates/seleccionar.ts): fallback por función a ES
// ============================================================================

export type IdiomaCliente = 'es' | 'en';
export type MonedaCliente = 'GTQ' | 'USD';

// Acepta el objeto cliente completo, parcial, null o undefined (citas de
// contactos no registrados, joins que no seleccionan la columna, etc.).
export function idiomaCliente(cliente?: { idioma?: string | null } | null): IdiomaCliente {
  return cliente?.idioma === 'en' ? 'en' : 'es';
}

export function monedaCliente(cliente?: { moneda?: string | null } | null): MonedaCliente {
  return cliente?.moneda === 'USD' ? 'USD' : 'GTQ';
}
