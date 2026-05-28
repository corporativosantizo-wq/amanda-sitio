// ============================================================================
// lib/utils/slug.ts
// Validación de slugs para URLs públicas (blog, etc).
// Bloquea path traversal (../), espacios y cualquier carácter peligroso:
// solo minúsculas, números y guiones simples, sin guion inicial/final.
// ============================================================================

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug);
}

/** Normaliza un texto libre a un slug seguro (minúsculas, sin acentos, guiones). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
