// ============================================================================
// lib/config/emisor.ts
// Datos centralizados del emisor (papeleo.legal / Amanda Santizo).
// Usado por PDFs (cotización, factura, recibo de caja) y emails.
//
// Para cambiar un dato sin tocar templates, sobrescribir vía env vars
// NEXT_PUBLIC_EMISOR_* en el deploy.
// ============================================================================

export const EMISOR = {
  nombreComercial: process.env.NEXT_PUBLIC_EMISOR_NOMBRE        ?? 'Despacho Jurídico Boutique',
  profesional:     process.env.NEXT_PUBLIC_EMISOR_PROFESIONAL   ?? 'Amanda Santizo — Abogada y Notaria',
  profesionalCorto: process.env.NEXT_PUBLIC_EMISOR_PROFESIONAL_CORTO ?? 'Licda. Amanda Santizo',
  colegiado:       process.env.NEXT_PUBLIC_EMISOR_COLEGIADO     ?? '19565',
  nit:             process.env.NEXT_PUBLIC_EMISOR_NIT           ?? '10441452-0',
  direccion:       process.env.NEXT_PUBLIC_EMISOR_DIRECCION     ?? '12 calle 1-25 zona 10, Edificio Géminis 10, Torre Sur, Oficina 402, Guatemala',
  telefono:        process.env.NEXT_PUBLIC_EMISOR_TELEFONO      ?? '(502) 2335-3613',
  email:           process.env.NEXT_PUBLIC_EMISOR_EMAIL         ?? 'contador@papeleo.legal',
  web:             process.env.NEXT_PUBLIC_EMISOR_WEB           ?? 'papeleo.legal',
} as const;

export type Emisor = typeof EMISOR;
