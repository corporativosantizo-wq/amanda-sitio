'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EditarProducto() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    price: '',
    compare_price: '',
    status: 'active',
  })

  useEffect(() => {
    const fetchProduct = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', params.id)
        .single()
      
      if (data) {
        setForm({
          name: data.name || '',
          slug: data.slug || '',
          description: data.description || '',
          price: data.price?.toString() || '',
          compare_price: data.compare_price?.toString() || '',
          status: data.status || 'active',
        })
      }
      setFetching(false)
    }
    fetchProduct()
  }, [params.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const supabase = createClient()
    
    const { error } = await supabase
      .from('products')
      .update({
        name: form.name,
        slug: form.slug,
        description: form.description,
        price: parseFloat(form.price),
        compare_price: form.compare_price ? parseFloat(form.compare_price) : null,
        status: form.status,
      })
      .eq('id', params.id)

    if (error) {
      alert('Error al actualizar: ' + error.message)
      setLoading(false)
    } else {
      router.push('/admin/productos')
    }
  }

  if (fetching) {
    return <div className="p-8">Cargando...</div>
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <Link href="/admin/productos" className="text-azure hover:text-cyan mb-2 inline-block">
          ← Volver a productos
        </Link>
        <h1 className="font-display text-3xl font-bold text-navy">Editar Producto</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 shadow-sm max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-navy mb-2">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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
            <label className="block text-sm font-medium text-navy mb-2">Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Precio ($)</label>
              <input
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-2">Precio anterior</label>
              <input
                type="number"
                step="0.01"
                value={form.compare_price}
                onChange={(e) => setForm({ ...form, compare_price: e.target.value })}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-2">Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan outline-none"
            >
              <option value="active">Activo</option>
              <option value="draft">Borrador</option>
            </select>
          </div>

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