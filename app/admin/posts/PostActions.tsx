'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Post {
  id: string
  title: string
  slug: string
  status: string
}

export default function PostActions({ post }: { post: Post }) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const toggleStatus = async () => {
    const supabase = createClient()
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    
    await supabase
      .from('posts')
      .update({ 
        status: newStatus,
        published_at: newStatus === 'published' ? new Date().toISOString() : null
      })
      .eq('id', post.id)
    
    router.refresh()
  }

  const deletePost = async () => {
    if (!confirm('¿Estás segura de que quieres eliminar este artículo?')) return
    
    setIsDeleting(true)
    const supabase = createClient()
    
    await supabase
      .from('posts')
      .delete()
      .eq('id', post.id)
    
    router.refresh()
  }

  return (
    <div className="flex items-center justify-end space-x-2">
      {/* View on site */}
      {post.status === 'published' && (
        <a
          href={`/blog/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-slate hover:text-azure hover:bg-slate-lighter rounded-lg transition-colors"
          title="Ver en el sitio"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}

      {/* Edit */}
      <Link
        href={`/admin/posts/${post.id}`}
        className="p-2 text-slate hover:text-azure hover:bg-slate-lighter rounded-lg transition-colors"
        title="Editar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </Link>

      {/* Toggle status */}
      <button
        onClick={toggleStatus}
        className={`p-2 rounded-lg transition-colors ${
          post.status === 'published'
            ? 'text-green-600 hover:text-orange-500 hover:bg-slate-lighter'
            : 'text-orange-500 hover:text-green-600 hover:bg-slate-lighter'
        }`}
        title={post.status === 'published' ? 'Cambiar a borrador' : 'Publicar'}
      >
        {post.status === 'published' ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>

      {/* Delete */}
      <button
        onClick={deletePost}
        disabled={isDeleting}
        className="p-2 text-slate hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
        title="Eliminar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  )
}
