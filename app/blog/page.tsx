import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  const supabase = await createClient()
  
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`*, category:categories(name, slug)`)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  const { data: categorias } = await supabase
    .from('categories')
    .select('*')
    .eq('type', 'blog')
    .order('name')

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
            Blog Legal
          </span>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Conocimiento legal <span className="text-cyan">para tu negocio</span>
          </h1>
          <p className="text-xl text-slate-light max-w-2xl mx-auto">
            Artículos, guías y recursos para que tomes decisiones informadas.
          </p>
        </div>
      </section>

      {categorias && categorias.length > 0 && (
        <section className="py-8 border-b border-slate-light">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap gap-3 justify-center">
              <Link href="/blog" className="px-4 py-2 bg-cyan text-navy-dark font-medium rounded-full">
                Todos
              </Link>
              {categorias.map((cat) => (
                <Link key={cat.id} href={`/blog/categoria/${cat.slug}`}
                  className="px-4 py-2 bg-slate-lighter text-slate hover:bg-slate-light font-medium rounded-full">
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          {posts && posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all">
                  <div className="aspect-[16/9] bg-gradient-to-br from-slate-lighter to-slate-light flex items-center justify-center relative">
                    {post.featured_image ? (
                      <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-4xl">📝</span>
                    )}
                    {post.category && (
                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 bg-cyan text-navy-dark text-xs font-bold rounded-full">
                          {post.category.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <span className="text-sm text-slate">
                      {post.published_at ? formatDate(post.published_at) : ''}
                    </span>
                    <h2 className="font-display text-xl font-bold text-navy mt-2 mb-3 group-hover:text-azure line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-slate text-sm mb-4 line-clamp-3">
                      {post.excerpt || post.content?.substring(0, 150) + '...'}
                    </p>
                    <span className="text-azure font-semibold group-hover:text-cyan">
                      Leer artículo →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <span className="text-4xl">📝</span>
              <h3 className="font-display text-xl font-bold text-navy mt-4">Próximamente más artículos</h3>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}