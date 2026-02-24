import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ComprarButton from '../ComprarButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductoPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  
  // Obtener producto
  const { data: product, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('slug', slug)
.eq('status', 'active')
    .single()
  
  if (error || !product) {
    notFound()
  }

  // Obtener productos relacionados (misma categoría)
  const { data: relacionados } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('category_id', product.category_id)
    .neq('id', product.id)
   .eq('status', 'active')
    .limit(3)

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <section className="bg-slate-lighter py-4">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/" className="text-slate hover:text-azure transition-colors">
              Inicio
            </Link>
            <span className="text-slate">/</span>
            <Link href="/tienda" className="text-slate hover:text-azure transition-colors">
              Tienda
            </Link>
            <span className="text-slate">/</span>
            <span className="text-navy font-medium">{product.name}</span>
          </nav>
        </div>
      </section>

      {/* Producto */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Imagen */}
            <div className="aspect-square bg-gradient-to-br from-azure/10 to-cyan/10 rounded-2xl flex items-center justify-center">
              {product.featured_image ? (
                <img 
                  src={product.featured_image} 
                  alt={product.name}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <span className="text-8xl">
                  {product.type === 'digital' ? '📄' : '💼'}
                </span>
              )}
            </div>

            {/* Info */}
            <div>
              {/* Categoría */}
              {product.category && (
                <span className="inline-block px-3 py-1 bg-azure/10 text-azure text-sm font-semibold rounded-full mb-4">
                  {product.category.name}
                </span>
              )}

              {/* Título */}
              <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mb-4">
                {product.name}
              </h1>

              {/* Descripción */}
              <p className="text-slate text-lg mb-6">
                {product.description}
              </p>

              {/* Precio */}
              <div className="flex items-center gap-4 mb-8">
                <span className="font-display text-4xl font-bold text-navy">
                  ${product.price}
                </span>
                {product.compare_price && (
                  <span className="text-slate line-through text-xl">
                    ${product.compare_price}
                  </span>
                )}
              </div>

              {/* Tipo de producto */}
              <div className="flex items-center gap-2 mb-8 text-slate">
                <span className="text-2xl">
                  {product.type === 'digital' ? '📥' : '📦'}
                </span>
                <span>
                  {product.type === 'digital' 
                    ? 'Producto digital - Descarga inmediata' 
                    : 'Servicio profesional'}
                </span>
              </div>

              {/* Botón de compra */}
              <div className="space-y-4">
                <ComprarButton productId={product.id} />
                <Link
                  href="/contacto"
                  className="block w-full py-4 border-2 border-navy text-navy font-bold text-lg rounded-lg hover:bg-navy hover:text-white transition-all duration-300 text-center"
                >
                  ¿Tienes dudas? Contáctame
                </Link>
              </div>

              {/* Beneficios */}
              <div className="mt-8 pt-8 border-t border-slate-light">
                <h3 className="font-display text-lg font-bold text-navy mb-4">
                  Lo que incluye:
                </h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-slate">
                    <span className="text-cyan">✓</span>
                    Documento profesional listo para usar
                  </li>
                  <li className="flex items-center gap-3 text-slate">
                    <span className="text-cyan">✓</span>
                    Formato editable (Word/PDF)
                  </li>
                  <li className="flex items-center gap-3 text-slate">
                    <span className="text-cyan">✓</span>
                    Instrucciones de uso incluidas
                  </li>
                  <li className="flex items-center gap-3 text-slate">
                    <span className="text-cyan">✓</span>
                    Soporte por correo electrónico
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contenido detallado */}
      {product.content && (
        <section className="py-12 bg-slate-lighter">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-navy mb-6">
              Descripción detallada
            </h2>
            <div className="prose prose-lg max-w-none text-slate whitespace-pre-line">
              {product.content}
            </div>
          </div>
        </section>
      )}

      {/* Productos relacionados */}
      {relacionados && relacionados.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-navy mb-8 text-center">
              También te puede interesar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relacionados.map((prod) => (
                <Link
                  key={prod.id}
                  href={`/tienda/${prod.slug}`}
                  className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-video bg-gradient-to-br from-azure/10 to-cyan/10 flex items-center justify-center">
                    {prod.featured_image ? (
                      <img 
                        src={prod.featured_image} 
                        alt={prod.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <span className="text-5xl">
                        {prod.type === 'digital' ? '📄' : '💼'}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg font-bold text-navy group-hover:text-azure transition-colors line-clamp-2 mb-2">
                      {prod.name}
                    </h3>
                    <span className="font-display text-xl font-bold text-navy">
                      ${prod.price}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-white mb-4">
            ¿Tienes dudas sobre este producto?
          </h2>
          <p className="text-slate-light mb-8">
            Escríbeme y te ayudo a determinar si es la mejor opción para tu situación.
          </p>
          <Link
            href="/contacto"
            className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-colors"
          >
            Contactar
          </Link>
        </div>
      </section>
    </div>
  )
}