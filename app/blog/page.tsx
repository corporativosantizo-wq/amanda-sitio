import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
// Force redeploy - Feb 3
export default async function BlogPage() {
  const supabase = await createClient()
  
  // Obtener posts publicados
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
  
  // Obtener categorías del blog
  const { data: categorias } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'blog')
    .order('name')

  if (error) {
  console.error('Error fetching posts:', error)
  return <div className="p-10 text-red-500">Error: {error.message}</div>
}
  }

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
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
            Blog Legal
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Conocimiento legal{' '}
            <span className="text-cyan">para tu negocio</span>
          </h1>
          <p className="text-xl text-slate-light max-w-2xl mx-auto">
            Artículos, guías y recursos para que tomes decisiones informadas 
            y protejas lo que estás construyendo.
          </p>
        </div>
      </section>

      {/* Categorías */}
      {categorias && categorias.length > 0 && (
        <section className="py-8 border-b border-slate-light">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <Link
                href="/blog"
                className="px-4 py-2 bg-cyan text-navy-dark font-medium rounded-full transition-all"
              >
                Todos
              </Link>
              {categorias.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/blog/categoria/${cat.slug}`}
                  className="px-4 py-2 bg-slate-lighter text-slate hover:bg-slate-light font-medium rounded-full transition-all"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Posts */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          
          {posts && posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all duration-300"
                >
                  {/* Imagen */}
                  <div className="aspect-[16/9] bg-gradient-to-br from-slate-lighter to-slate-light relative overflow-hidden">
                    {post.featured_image ? (
                      <img 
                        src={post.featured_image} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-16 h-16 bg-navy/10 rounded-xl flex items-center justify-center">
                          <span className="text-3xl">📝</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Categoría badge */}
                    {post.category && (
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-cyan text-navy-dark text-xs font-bold rounded-full">
                          {post.category.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    {/* Fecha */}
                    <span className="text-sm text-slate">
                      {post.published_at ? formatDate(post.published_at) : 'Sin fecha'}
                    </span>

                    {/* Título */}
                    <h2 className="font-display text-xl font-bold text-navy mt-2 mb-3 group-hover:text-azure transition-colors line-clamp-2">
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-slate text-sm mb-4 line-clamp-3">
                      {post.excerpt || post.content?.substring(0, 150) + '...'}
                    </p>

                    {/* Leer más */}
                    <span className="inline-flex items-center text-azure font-semibold group-hover:text-cyan transition-colors">
                      Leer artículo
                      <svg className="w-4 h-4 ml-2 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-lighter rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">📝</span>
              </div>
              <h3 className="font-display text-xl font-bold text-navy mb-2">
                Próximamente más artículos
              </h3>
              <p className="text-slate mb-6">
                Estoy preparando contenido de valor para ti. ¡Vuelve pronto!
              </p>
              <Link
                href="/contacto"
                className="inline-block px-6 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white hover:shadow-lg transition-all"
              >
                Suscríbete para recibir actualizaciones
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Newsletter CTA */}
      <section className="py-16 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Quieres recibir contenido legal en tu correo?
          </h2>
          <p className="text-slate-light text-lg mb-8">
            Suscríbete y recibe artículos, guías y recursos exclusivos para proteger tu negocio.
          </p>
          <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
            <input
              type="email"
              placeholder="Tu correo electrónico"
              className="flex-1 px-4 py-3 rounded-lg focus:ring-2 focus:ring-cyan outline-none"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all"
            >
              Suscribirme
            </button>
          </form>
          <p className="text-slate-light text-sm mt-4">
            Sin spam. Puedes darte de baja cuando quieras.
          </p>
        </div>
      </section>
    </div>
  )
}