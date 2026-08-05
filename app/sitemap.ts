// ============================================================================
// app/sitemap.ts
// Sitemap generado desde el contenido real: si un post se despublica o un
// producto se desactiva, deja de listarse solo. Nunca listar rutas privadas
// (/admin, /portal, /api) ni pantallas de post-transacción.
//
// Las categorías se derivan de los posts publicados, no de la tabla completa:
// hay categorías sin un solo post (entre ellas "derecho-internacional", que
// además contradice el posicionamiento actual).
// ============================================================================

import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';

// El sitemap se revalida cada hora; no necesita ser instantáneo.
export const revalidate = 3600;

const RUTAS_ESTATICAS: Array<{
  ruta: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { ruta: '', changeFrequency: 'monthly', priority: 1.0 },
  { ruta: '/servicios', changeFrequency: 'monthly', priority: 0.9 },
  { ruta: '/sobre-mi', changeFrequency: 'yearly', priority: 0.8 },
  { ruta: '/agendar', changeFrequency: 'monthly', priority: 0.8 },
  { ruta: '/contacto', changeFrequency: 'yearly', priority: 0.7 },
  { ruta: '/blog', changeFrequency: 'weekly', priority: 0.7 },
  { ruta: '/tienda', changeFrequency: 'weekly', priority: 0.7 },
  { ruta: '/tienda/cotizacion-a-medida', changeFrequency: 'yearly', priority: 0.5 },
  { ruta: '/privacidad', changeFrequency: 'yearly', priority: 0.2 },
  { ruta: '/terminos', changeFrequency: 'yearly', priority: 0.2 },
  { ruta: '/cookies', changeFrequency: 'yearly', priority: 0.2 },
];

function db() {
  // Llave anónima: solo lee lo que RLS ya expone al público (posts
  // publicados y productos activos).
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const ahora = new Date();

  const estaticas: MetadataRoute.Sitemap = RUTAS_ESTATICAS.map((r) => ({
    url: `${SITE_URL}${r.ruta}`,
    lastModified: ahora,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  try {
    const [posts, productos] = await Promise.all([
      db()
        .from('posts')
        .select('slug, updated_at, published_at, category:categories(slug)')
        .eq('status', 'published'),
      db()
        .from('products')
        .select('slug, updated_at')
        .eq('status', 'active')
        .eq('type', 'digital'),
    ]);

    const entradasPosts: MetadataRoute.Sitemap = (posts.data ?? [])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: new Date(p.updated_at ?? p.published_at ?? ahora),
        changeFrequency: 'yearly',
        priority: 0.6,
      }));

    // Solo categorías con al menos un post publicado.
    const slugsCategoria = new Set(
      (posts.data ?? [])
        .map((p) => (p.category as { slug?: string } | null)?.slug)
        .filter((s): s is string => Boolean(s)),
    );
    const entradasCategorias: MetadataRoute.Sitemap = [...slugsCategoria].map((slug) => ({
      url: `${SITE_URL}/blog/categoria/${slug}`,
      lastModified: ahora,
      changeFrequency: 'weekly',
      priority: 0.4,
    }));

    const entradasProductos: MetadataRoute.Sitemap = (productos.data ?? [])
      .filter((p) => p.slug)
      .map((p) => ({
        url: `${SITE_URL}/tienda/${p.slug}`,
        lastModified: new Date(p.updated_at ?? ahora),
        changeFrequency: 'monthly',
        priority: 0.5,
      }));

    return [...estaticas, ...entradasPosts, ...entradasCategorias, ...entradasProductos];
  } catch {
    // Si la base no responde, el sitemap sirve al menos las páginas fijas.
    return estaticas;
  }
}
