// ============================================================================
// lib/utils/sanitize-email-html.ts
// Sanitiza el body_html de correos ENTRANTES (HTML de terceros, no confiable)
// antes de exponerlo por la API. Server-side con sanitize-html (DOMPurify
// requiere jsdom y rompe en el runtime serverless de Next — ver
// lib/blog/render-content.ts). La UI además lo renderiza dentro de un
// <iframe sandbox=""> — defensa en capas, no redundancia.
// Config más permisivo que el del blog: los correos usan tablas y estilos
// inline (el CSS no ejecuta JS y va aislado en el sandbox).
// ============================================================================

import sanitizeHtml from 'sanitize-html';

const SANITIZE_EMAIL_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's',
    'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'hr',
    'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
    'pre', 'code', 'font', 'center', 'small', 'sub', 'sup',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    table: ['colspan', 'rowspan', 'align', 'valign', 'width', 'cellpadding', 'cellspacing', 'border'],
    td: ['colspan', 'rowspan', 'align', 'valign', 'width'],
    th: ['colspan', 'rowspan', 'align', 'valign', 'width'],
    font: ['color', 'face', 'size'],
    '*': ['style'],
  },
  // Bloquea javascript:, data:, cid: (las imágenes cid: embebidas no
  // resolverían de todos modos fuera del cliente de correo).
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

/** Devuelve el HTML del correo sanitizado, o '' si no hay contenido. */
export function sanitizeEmailHtml(dirty: string | null | undefined): string {
  const raw = (dirty ?? '').trim();
  if (!raw) return '';
  return sanitizeHtml(raw, SANITIZE_EMAIL_OPTIONS);
}
