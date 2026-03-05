'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function EditarPost() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    status: 'draft',
  })

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/admin/posts/${params.id}`)
        if (!res.ok) throw new Error('No se pudo cargar el artículo')
        const data = await res.json()
        setForm({
          title: data.title || '',
          slug: data.slug || '',
          excerpt: data.excerpt || '',
          content: data.content || '',
          status: data.status || 'draft',
        })
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
      const res = await fetch(`/api/admin/posts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
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
    </div>
  )
}