// ============================================================================
// lib/blog/render-content.ts
// Prepara el HTML del contenido de un post para renderizar en el blog público.
// - Sanitiza con DOMPurify (server-side) — CRÍTICO contra XSS aunque venga del admin.
// - Si el contenido es texto plano (posts antiguos), lo convierte a párrafos.
// ============================================================================

import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's',
  'h2', 'h3', 'ul', 'ol', 'li', 'blockquote',
  'a', 'img', 'hr', 'span',
];

const ALLOWED_ATTR = ['href', 'target', 'rel', 'src', 'alt', 'title', 'class'];

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

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
