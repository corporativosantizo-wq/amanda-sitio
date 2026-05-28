// ============================================================================
// lib/blog/render-content.ts
// Prepara el HTML del contenido de un post para renderizar en el blog público.
// - Sanitiza con sanitize-html (puro JS, server-side) — CRÍTICO contra XSS
//   aunque el contenido venga del admin. (DOMPurify requiere jsdom y rompe en
//   el runtime serverless de Next; sanitize-html es equivalente y fiable.)
// - Si el contenido es texto plano (posts antiguos), lo convierte a párrafos.
// ============================================================================

import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
    'h2', 'h3', 'ul', 'ol', 'li', 'blockquote',
    'a', 'img', 'hr', 'span',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function looksLikeHtml(s: string): boolean {
  return /<\/?(p|h2|h3|ul|ol|li|blockquote|strong|em|u|s|b|i|a|img|hr|br|span)\b[^>]*>/i.test(s);
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br/>')}</p>`)
    .join('');
}

/** Devuelve HTML sanitizado y listo para dangerouslySetInnerHTML. */
export function renderPostContent(content: string | null | undefined): string {
  const raw = (content ?? '').trim();
  if (!raw) return '';

  const html = looksLikeHtml(raw) ? raw : plainTextToHtml(raw);
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
