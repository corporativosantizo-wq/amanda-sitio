import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PostActions from './PostActions'

export default async function AdminPosts() {
  const supabase = await createClient()

  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .order('created_at', { ascending: false })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Artículos</h1>
          <p className="text-slate mt-1">Gestiona los artículos de tu blog</p>
        </div>
        <Link
          href="/admin/posts/nuevo"
          className="flex items-center space-x-2 px-5 py-3 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo artículo</span>
        </Link>
      </div>

      {/* Posts table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {posts && posts.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-lighter">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Título</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Categoría</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Estado</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Fecha</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-navy">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-light">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-lighter transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <Link 
                        href={`/admin/posts/${post.id}`}
                        className="font-semibold text-navy hover:text-azure transition-colors"
                      >
                        {post.title}
                      </Link>
                      <p className="text-sm text-slate truncate max-w-md">{post.excerpt}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {post.category ? (
                      <span className="px-3 py-1 bg-azure/10 text-azure text-sm font-medium rounded-full">
                        {post.category.name}
                      </span>
                    ) : (
                      <span className="text-slate">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      post.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {post.status === 'published' ? 'Publicado' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate">
                    {formatDate(post.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <PostActions post={post} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-slate">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            <h3 className="font-display text-xl font-bold text-navy mb-2">No hay artículos</h3>
            <p className="mb-4">Crea tu primer artículo para empezar</p>
            <Link
              href="/admin/posts/nuevo"
              className="inline-flex items-center space-x-2 px-5 py-3 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nuevo artículo</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
