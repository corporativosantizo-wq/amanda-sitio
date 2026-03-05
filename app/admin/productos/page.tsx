import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProductosAdmin() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    redirect('/admin/login')
  }

  const { data: products } = await supabase
    .from('products')
    .select('*, category:categories(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Productos</h1>
          <p className="text-slate mt-1">Gestiona los productos de tu tienda</p>
        </div>
        <Link
          href="/admin/productos/nuevo"
          className="px-5 py-3 bg-cyan text-navy-dark font-semibold rounded-lg hover:opacity-80 transition-colors flex items-center gap-2"
        >
          + Nuevo producto
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-lighter">
            <tr>
              <th className="text-left p-4 font-semibold text-navy">Producto</th>
              <th className="text-left p-4 font-semibold text-navy">Categoría</th>
              <th className="text-left p-4 font-semibold text-navy">Precio</th>
              <th className="text-left p-4 font-semibold text-navy">Estado</th>
              <th className="text-left p-4 font-semibold text-navy">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {products && products.map((product) => (
              <tr key={product.id} className="border-t border-slate-light">
                <td className="p-4">
                  <div className="font-semibold text-navy">{product.name}</div>
                  <div className="text-sm text-slate truncate max-w-md">{product.description}</div>
                </td>
                <td className="p-4">
                  <span className="px-3 py-1 bg-azure/10 text-azure text-sm rounded-full">
                    {product.category?.name || 'Sin categoría'}
                  </span>
                </td>
                <td className="p-4 font-semibold text-navy">${product.price}</td>
                <td className="p-4">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    product.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-slate-lighter text-slate'
                  }`}>
                    {product.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/tienda/${product.slug}`} target="_blank" className="p-2 hover:bg-slate-lighter rounded">
                      👁️
                    </Link>
                    <Link href={`/admin/productos/${product.id}`} className="p-2 hover:bg-slate-lighter rounded">
                      ✏️
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {(!products || products.length === 0) && (
          <div className="text-center py-12 text-slate">
            No hay productos aún
          </div>
        )}
      </div>
    </div>
  )
}