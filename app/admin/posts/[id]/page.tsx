'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/utils/admin-fetch'
import { ShareButtons } from '@/components/blog/ShareButtons'
import TagInput from '@/components/admin/TagInput'
import { postUrl } from '@/lib/site'

interface Category {
  id: string
  name: string
}

export default function EditarPost() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
    category_id: '',
  })

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await adminFetch('/api/admin/posts/meta')
        if (!res.ok) return
        const data = await res.json()
        setCategories(data.categories || [])
        setTagSuggestions((data.tags || []).map((t: { name: string }) => t.name))
      } catch {
        // silencioso
      }
    }
    fetchMeta()
  }, [])

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await adminFetch(`/api/admin/posts/${params.id}`)
        if (!res.ok) throw new Error('No se pudo cargar el artículo')
        const data = await res.json()
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          content: data.content || '',
          status: data.status || 'draft',
          category_id: data.category_id || '',
        })
        setTags(Array.isArray(data.tags) ? data.tags : [])
      } catch (err: any) {
        setError(err.message)
      }
      setFetching(false)
    }
    fetchPost()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await adminFetch(`/api/admin/posts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar')
      }

      router.push('/admin/posts')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el post '${form.title}'? Esta acción no se puede deshacer.`)) {
      return
    }
    if (
      form.status === 'published' &&
      !confirm('Este post está publicado y es visible públicamente. ¿Deseas eliminarlo de todas formas?')
    ) {
      return
    }

    setDeleting(true)
    setError('')

    const res = await adminFetch(`/api/admin/posts/${params.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'No se pudo eliminar el artículo')
      setDeleting(false)
      return
    }

    router.push('/admin/posts')
  }

  if (fetching) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/admin/posts" className="text-azure hover:text-cyan mb-2 inline-block">
          ← Volver a artículos
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy">Editar Artículo</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm max-w-3xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Slug (URL)</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Categoría</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none bg-white"
              required
            >
              <option value="" disabled>Selecciona una categoría…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Etiquetas</label>
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Extracto</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Contenido</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={12}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
            >
              <option value="draft">Borrador</option>
              <option value="published">Publicado</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-navy hover:text-white transition-all disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>

      {form.status === 'published' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm max-w-3xl mt-6 space-y-6">
          {/* Imagen para Instagram */}
          <div>
            <h2 className="font-display text-lg font-bold text-navy mb-1">📷 Generar imagen para Instagram</h2>
            <p className="text-sm text-slate mb-4">Tarjeta lista para publicar con título, QR y marca.</p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/api/admin/posts/${params.id}/social-image?format=feed`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors"
              >
                📷 Feed (1080×1080)
              </a>
              <a
                href={`/api/admin/posts/${params.id}/social-image?format=story`}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors"
              >
                📱 Stories (1080×1920)
              </a>
            </div>
          </div>

          {/* Compartir en redes */}
          <div className="pt-6 border-t border-slate-light">
            <h2 className="font-display text-lg font-bold text-navy mb-3">Compartir artículo</h2>
            <ShareButtons url={postUrl(form.slug)} title={form.title} />
          </div>
        </div>
      )}

      {/* Zona de peligro: eliminar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm max-w-3xl mt-6 border border-red-100">
        <h2 className="font-display text-lg font-bold text-red-700 mb-1">Eliminar artículo</h2>
        <p className="text-sm text-slate mb-4">Esta acción no se puede deshacer.</p>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          {deleting ? 'Eliminando...' : 'Eliminar'}
        </button>
      </div>
    </div>
  )
}
