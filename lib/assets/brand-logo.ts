// ============================================================================
// lib/assets/brand-logo.ts
// Logo de marca para headers de correo, embebido inline vía CID. El motor de
// envío (sendMail) detecta `cid:<CID>` en el cuerpo y adjunta el logo inline,
// de modo que las plantillas solo referencian el CID sin tocar el envío.
//
// Todos los CIDs apuntan al MISMO asset (el logo del despacho); usamos varios
// nombres por claridad semántica según la familia de plantilla:
//   - logoMarca   → wrapper compartido (citas, contabilidad, avisos, etc.)
//   - logoReporte → reporte de avance de cotización
// (audiencias gestiona su propio CID en su capa de envío.)
// ============================================================================

import { LOGO_AUDIENCIA_BASE64 } from './logo-audiencia-base64';

export const LOGO_MARCA_CID = 'logoMarca';

// CIDs que sendMail inyecta automáticamente si aparecen en el cuerpo.
export const BRAND_LOGO_CIDS = ['logoMarca', 'logoReporte'] as const;

export function brandLogoAttachment(contentId: string): {
  name: string; contentType: string; contentBytes: string; contentId: string; isInline: boolean;
} {
  return { name: 'logo.png', contentType: 'image/png', contentBytes: LOGO_AUDIENCIA_BASE64, contentId, isInline: true };
}
