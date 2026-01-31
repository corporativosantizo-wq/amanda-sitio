import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductActions from './ProductActions'

export default async function AdminProductos() {
  const supabase = await createClient()

  const { data: products, error } = await supabase
    .from('products')
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
          <h1 className="font-display text-3xl font-bold text-navy">Productos</h1>
          <p className="text-slate mt-1">Gestiona los productos de tu tienda</p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="flex items-center space-x-2 px-5 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan-light transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Nuevo producto</span>
        </Link>
      </div>

      {/* Products table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {products && products.length > 0 ? (
          <table className="w-full">
            <thead className="bg-slate-lighter">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Producto</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Categoría</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Precio</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Tipo</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-navy">Estado</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-navy">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-light">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-lighter transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-slate-lighter rounded-lg flex items-center justify-center text-2xl">
                        {product.category?.slug === 'plantillas' && '📄'}
                        {product.category?.slug === 'packs' && '📚'}
                        {product.category?.slug === 'cursos' && '🎓'}
                        {product.category?.slug === 'servicios' && '💼'}
                        {!product.category && '📦'}
                      </div>
                      <div>
                        <Link 
                          href={`/admin/productos/${product.id}`}
                          className="font-semibold text-navy hover:text-azure transition-colors"
                        >
                          {product.name}
                        </Link>
                        <p className="text-sm text-slate truncate max-w-xs">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {product.category ? (
                      <span className="px-3 py-1 bg-cyan/10 text-cyan text-sm font-medium rounded-full">
                        {product.category.name}
                      </span>
                    ) : (
                      <span className="text-slate">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-baseline space-x-2">
                      <span className="font-semibold text-navy">${product.price}</span>
                      {product.compare_price && (
                        <span className="text-sm text-slate line-through">${product.compare_price}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      product.type === 'digital'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}>
                      {product.type === 'digital' ? 'Digital' : 'Servicio'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      product.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {product.status === 'active' ? 'Activo' : 'Borrador'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ProductActions product={product} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16 text-slate">
            <svg className="w-16 h-16 mx-auto mb-4 text-slate-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <h3 className="font-display text-xl font-bold text-navy mb-2">No hay productos</h3>
            <p className="mb-4">Crea tu primer producto para empezar</p>
            <Link
              href="/admin/productos/nuevo"
              className="inline-flex items-center space-x-2 px-5 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan-light transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Nuevo producto</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
