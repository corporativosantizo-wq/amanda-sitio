// ============================================================================
// lib/types/plantillas-correo.ts
//
// Tipos compartidos entre:
//   - Service (lib/services/comunicaciones.service.ts) — lectura desde BD
//   - Frontend (app/admin/email/comunicaciones/page.tsx) — render del form
//   - Endpoint lookup (app/api/admin/comunicaciones/lookup/route.ts) — respuesta
//
// La columna `legal.plantillas_correo.campos_extra` (jsonb) almacena un array de
// CampoExtra. La forma exacta del JSON es responsabilidad de quien edita la
// plantilla (admin), pero el código consumidor SOLO confía en este tipo.
//
// ── Convención: keys reservadas en CampoExtraLookup.populates ───────────────
//
// Solo las siguientes keys disparan side effects en el meta-state del correo:
//   - destinatario_email   → setDestinatarioEmail
//   - destinatario_nombre  → setClienteNombre + replace {nombre_cliente}
//   - cliente_id           → setClienteId
//   - cliente_nit          → replace {nit}
//
// Cualquier otra key (incluyendo "cliente_nombre", "cliente_email", etc.) va a
// camposExtra como string literal. Las plantillas DEBEN usar estos nombres
// canónicos en sus populates si quieren disparar los side effects.
// ============================================================================

/**
 * Tablas legales sobre las que se permite hacer lookup desde una plantilla.
 * Esta lista debe coincidir 1:1 con las keys de LOOKUP_CONFIG en el endpoint.
 * Agregar una tabla acá REQUIERE agregar también su entrada en LOOKUP_CONFIG.
 */
export type LookupSource = 'cotizaciones' | 'expedientes' | 'cobros' | 'facturas';

interface CampoExtraBase {
  key: string;
  label: string;
}

export interface CampoExtraSimple extends CampoExtraBase {
  type: 'text' | 'textarea' | 'date' | 'time' | 'url';
}

export interface CampoExtraLookup extends CampoExtraBase {
  type: 'lookup';
  /**
   * Tabla origen. Debe ser una de las whitelisted en LOOKUP_CONFIG. El JSON de
   * la plantilla NUNCA puede declarar columnas SQL libres — todo el mapeo está
   * fijo server-side por seguridad.
   */
  source: LookupSource;
  /**
   * Mapeo: { keyEnElForm: aliasServerSide }.
   *
   * - keyEnElForm: la key del campo donde se asigna el valor.
   * - aliasServerSide: identificador semántico definido en LOOKUP_CONFIG.fields[source].
   *
   * Algunas keys son meta-state del correo, NO campos del cuerpo:
   *   - destinatario_email     → setDestinatarioEmail
   *   - destinatario_nombre    → setClienteNombre + reemplaza {nombre_cliente}
   *   - cliente_id             → setClienteId
   *   - cliente_nit            → reemplaza {nit}
   *
   * Cualquier otra key se trata como campo regular (camposExtra[key] = value).
   */
  populates: Record<string, string>;
}

export type CampoExtra = CampoExtraSimple | CampoExtraLookup;

export interface PlantillaCorreo {
  id: string;
  nombre: string;
  slug: string | null;
  icono: string;
  categoria: string;
  asunto_template: string;
  cuerpo_template: string;
  cuenta_default: string;
  campos_extra: CampoExtra[];
  activo: boolean;
  orden: number;
}

/**
 * Respuesta del endpoint GET /api/admin/comunicaciones/lookup.
 * `populated_data` ya viene resuelto server-side; el cliente no hace joins.
 */
export interface LookupResult {
  /** Valor que va al campo de la plantilla. Pre-formateado server-side. */
  value: string;
  /** String pre-armado para mostrar en el dropdown del LookupField. */
  display: string;
  /** Diccionario alias → valor extraído del row. Drives populates de la plantilla. */
  populated_data: Record<string, any>;
}
