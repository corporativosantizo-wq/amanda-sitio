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
