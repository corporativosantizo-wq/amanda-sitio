'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/utils/admin-fetch'
import TagInput from '@/components/admin/TagInput'
import RichTextEditor from '@/components/admin/rich-text-editor'

const isEmptyHtml = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;| /g, '').trim() === ''

interface Category {
  id: string
  name: string
}

export default function NuevoPost() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
        // silencioso: el formulario sigue siendo usable
      }
    }
    fetchMeta()
  }, [])

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setForm({ ...form, title, slug: generateSlug(title) })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (isEmptyHtml(form.content)) {
      setError('El contenido es requerido.')
      return
    }

    setLoading(true)

    try {
      const res = await adminFetch('/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tags }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Error al crear artículo')
      }

      router.push('/admin/posts')
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/admin/posts" className="text-azure hover:text-cyan mb-2 inline-block">
          ← Volver a artículos
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy">Nuevo Artículo</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm max-w-3xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Título</label>
            <input
              type="text"
              value={form.title}
              onChange={handleTitleChange}
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
              placeholder="Breve descripción del artículo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Contenido</label>
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm({ ...form, content: html })}
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
            {loading ? 'Guardando...' : 'Crear Artículo'}
          </button>
        </div>
      </form>
    </div>
  )
}
