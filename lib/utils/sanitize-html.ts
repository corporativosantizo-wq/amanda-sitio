'use client';

// ============================================================================
// lib/utils/sanitize-html.ts
// Sanitización de HTML para prevenir DOM-based XSS.
// Usa DOMPurify para limpiar output de formatMarkdown() antes de renderizar.
// ============================================================================

import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'strong', 'em', 'code', 'pre', 'br', 'hr', 'a', 'mark',
  'ul', 'ol', 'li', 'p', 'span', 'div',
];

const ALLOWED_ATTR = [
  'href', 'target', 'rel', 'style', 'class',
];

/**
 * Sanitiza HTML generado por formatMarkdown().
 * Permite solo tags seguros de formato y atributos controlados.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
