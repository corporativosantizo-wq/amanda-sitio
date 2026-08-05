// ============================================================================
// app/robots.ts
// robots.txt del sitio público. Las rutas privadas ya están protegidas por
// Clerk; esto solo evita que se indexen y que el crawler gaste presupuesto en
// pantallas de post-transacción.
// ============================================================================

import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api/',
          '/portal',
          '/sign-in',
          '/pagar/',
          '/cotizacion/',
          '/tienda/gracias',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
