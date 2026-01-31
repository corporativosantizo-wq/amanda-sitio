import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  
  // Obtener post
  const { data: post, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  
  if (error || !post) {
    notFound()
  }

  // Obtener posts relacionados (misma categoría)
  const { data: relacionados } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('category_id', post.category_id)
    .neq('id', post.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(3)

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm mb-8">
            <Link href="/" className="text-slate-light hover:text-cyan transition-colors">
              Inicio
            </Link>
            <span className="text-slate-light">/</span>
            <Link href="/blog" className="text-slate-light hover:text-cyan transition-colors">
              Blog
            </Link>
            {post.category && (
              <>
                <span className="text-slate-light">/</span>
                <span className="text-cyan">{post.category.name}</span>
              </>
            )}
          </nav>

          {/* Categoría */}
          {post.category && (
            <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
              {post.category.name}
            </span>
          )}

          {/* Título */}
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 text-slate-light">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-cyan rounded-full flex items-center justify-center">
                <span className="text-navy-dark font-bold">AS</span>
              </div>
              <span>Amanda Santizo</span>
            </div>
            <span>•</span>
            <span>{post.published_at ? formatDate(post.published_at) : 'Sin fecha'}</span>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-6">
          {/* Imagen destacada */}
          {post.featured_image && (
            <div className="aspect-[16/9] rounded-2xl overflow-hidden mb-10 -mt-20 relative z-10 shadow-xl">
              <img 
                src={post.featured_image} 
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-xl text-slate leading-relaxed mb-8 font-medium">
              {post.excerpt}
            </p>
          )}

          {/* Contenido principal */}
          <div className="prose prose-lg max-w-none">
            <div className="text-slate leading-relaxed whitespace-pre-line">
              {post.content}
            </div>
          </div>

          {/* Tags / Compartir */}
          <div className="mt-12 pt-8 border-t border-slate-light">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {post.category && (
                <Link
                  href={`/blog/categoria/${post.category.slug}`}
                  className="inline-flex items-center px-4 py-2 bg-slate-lighter text-navy font-medium rounded-full hover:bg-cyan hover:text-navy-dark transition-all"
                >
                  <span className="mr-2">🏷️</span>
                  {post.category.name}
                </Link>
              )}
              
              <div className="flex items-center gap-3">
                <span className="text-slate text-sm">Compartir:</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`https://amandasantizo.com/blog/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-slate-lighter hover:bg-cyan rounded-full flex items-center justify-center text-navy hover:text-navy-dark transition-all"
                  aria-label="Compartir en Twitter"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`https://amandasantizo.com/blog/${post.slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-slate-lighter hover:bg-cyan rounded-full flex items-center justify-center text-navy hover:text-navy-dark transition-all"
                  aria-label="Compartir en LinkedIn"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(post.title + ' - https://amandasantizo.com/blog/' + post.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 bg-slate-lighter hover:bg-cyan rounded-full flex items-center justify-center text-navy hover:text-navy-dark transition-all"
                  aria-label="Compartir en WhatsApp"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Autor */}
      <section className="py-12 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <div className="bg-white rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-24 h-24 bg-gradient-to-br from-azure to-cyan rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-display font-bold text-3xl">AS</span>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-navy mb-2">
                Amanda Santizo
              </h3>
              <p className="text-slate mb-4">
                Abogada especializada en Derecho Internacional Público. Ayudo a emprendedores 
                y empresas a tomar decisiones legales inteligentes.
              </p>
              <Link
                href="/sobre-mi"
                className="text-azure font-semibold hover:text-cyan transition-colors"
              >
                Conoce más sobre mí →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Posts relacionados */}
      {relacionados && relacionados.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-navy mb-8 text-center">
              Artículos relacionados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relacionados.map((relPost) => (
                <Link
                  key={relPost.id}
                  href={`/blog/${relPost.slug}`}
                  className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-[16/9] bg-gradient-to-br from-slate-lighter to-slate-light flex items-center justify-center">
                    {relPost.featured_image ? (
                      <img 
                        src={relPost.featured_image} 
                        alt={relPost.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-4xl">📝</span>
                    )}
                  </div>
                  <div className="p-5">
                    <span className="text-sm text-slate">
                      {relPost.published_at ? formatDate(relPost.published_at) : ''}
                    </span>
                    <h3 className="font-display text-lg font-bold text-navy mt-1 group-hover:text-azure transition-colors line-clamp-2">
                      {relPost.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            ¿Necesitas ayuda legal?
          </h2>
          <p className="text-slate-light mb-8">
            Si este artículo te fue útil y necesitas asesoría personalizada, estoy aquí para ayudarte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contacto"
              className="px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
            >
              Agenda una consulta
            </Link>
            <Link
              href="/tienda"
              className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-dark transition-all duration-300"
            >
              Ver plantillas legales
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
