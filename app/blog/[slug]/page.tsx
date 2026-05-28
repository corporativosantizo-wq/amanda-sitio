import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import { SITE_NAME, postUrl } from '@/lib/site'
import { ShareButtons, BlogShareDock } from '@/components/blog/ShareButtons'
import { renderPostContent } from '@/lib/blog/render-content'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: post } = await supabase
    .from('posts')
    .select('title, excerpt, slug')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!post) return {}

  const url = postUrl(post.slug)
  const description = post.excerpt ?? undefined

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url,
      siteName: SITE_NAME,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
    },
  }
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

  const url = postUrl(post.slug)

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">
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
          <div
            className="prose prose-lg max-w-none
              prose-p:text-slate prose-p:mb-4 prose-p:leading-relaxed
              prose-headings:font-display
              prose-h2:text-navy prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:pb-2 prose-h2:border-b-2 prose-h2:border-cyan
              prose-h3:text-navy prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-6
              prose-a:text-cyan-dark prose-a:no-underline hover:prose-a:text-cyan hover:prose-a:underline
              prose-blockquote:border-l-4 prose-blockquote:border-cyan prose-blockquote:bg-slate-lighter prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-slate
              prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 prose-li:text-slate prose-li:my-1
              prose-strong:text-navy
              prose-img:rounded-lg prose-img:mx-auto prose-img:shadow-sm"
            dangerouslySetInnerHTML={{ __html: renderPostContent(post.content) }}
          />

          {/* Compartir — al final del artículo */}
          <div className="mt-12 pt-8 border-t border-slate-light">
            <ShareButtons url={url} title={post.title} />
          </div>
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

      <BlogShareDock url={url} title={post.title} />
    </div>
  )
}