// ============================================================================
// lib/site.ts
// URL canónica pública del sitio. Usada para QR, og:image y enlaces de compartir.
// ============================================================================

export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://amandasantizo.com'
).replace(/\/+$/, '');

export const SITE_NAME = 'Amanda Santizo';
export const SITE_TAGLINE = 'Abogada y Notaria';

export function postUrl(slug: string): string {
  return `${SITE_URL}/blog/${slug}`;
}
