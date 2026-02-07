import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function PostPage({ params }: PageProps) {
  // Prevenir el caching de datos - siempre obtener datos frescos
  noStore()
  
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: post, error } = await supabase
    .from('posts')
    .select(`*, category:categories(name, slug)`)
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  
  if (error || !post) {
    notFound()
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16">
        <div className="max-w-4xl mx-auto px-6">
          <nav className="flex items-center space-x-2 text-sm mb-8">
            <Link href="/" className="text-slate-light hover:text-cyan">Inicio</Link>
            <span className="text-slate-light">/</span>
            <Link href="/blog" className="text-slate-light hover:text-cyan">Blog</Link>
          </nav>
          {post.category && (
            <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
              {post.category.name}
            </span>
          )}
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white mb-6">{post.title}</h1>
          <div className="flex items-center gap-4 text-slate-light">
            <span>Amanda Santizo</span>
            <span>•</span>
            <span>{post.published_at ? formatDate(post.published_at) : ''}</span>
          </div>
        </div>
      </section>
      <section className="py-12">
        <div className="max-w-3xl mx-auto px-6">
          {post.excerpt && <p className="text-xl text-slate mb-8">{post.excerpt}</p>}
          <div className="prose prose-lg text-slate whitespace-pre-line">{post.content}</div>
        </div>
      </section>
      <section className="py-16 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">¿Necesitas ayuda legal?</h2>
          <Link href="/contacto" className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg">
            Agenda una consulta
          </Link>
        </div>
      </section>
    </div>
  )
}