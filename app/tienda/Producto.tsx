import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function ProductoPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  
  // Obtener producto
  const { data: producto, error } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .single()
  
  if (error || !producto) {
    notFound()
  }

  // Obtener productos relacionados
  const { data: relacionados } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(name, slug)
    `)
    .eq('category_id', producto.category_id)
    .neq('id', producto.id)
    .eq('status', 'active')
    .limit(3)

  const getIcono = (slug: string) => {
    switch (slug) {
      case 'plantillas': return '📄'
      case 'packs': return '📚'
      case 'cursos': return '🎓'
      case 'servicios': return '💼'
      default: return '📦'
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumb */}
      <div className="bg-slate-lighter py-4">
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
            <span className="text-navy font-medium">{producto.name}</span>
          </nav>
        </div>
      </div>

      {/* Producto */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Imagen */}
            <div className="relative">
              <div className="aspect-square bg-gradient-to-br from-slate-lighter to-slate-light rounded-2xl flex items-center justify-center sticky top-24">
                <div className="text-center">
                  <div className="w-32 h-32 bg-navy/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <span className="text-6xl">
                      {getIcono(producto.category?.slug || '')}
                    </span>
                  </div>
                  <p className="text-slate text-sm">Vista previa del producto</p>
                </div>
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {producto.is_new && (
                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                      NUEVO
                    </span>
                  )}
                  {producto.compare_price && (
                    <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full">
                      -{Math.round((1 - producto.price / producto.compare_price) * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Info */}
            <div>
              {/* Categoría */}
              <span className="text-sm font-semibold text-azure uppercase tracking-wide">
                {producto.category?.name || 'Producto'}
              </span>

              {/* Nombre */}
              <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mt-2 mb-4">
                {producto.name}
              </h1>

              {/* Descripción corta */}
              <p className="text-lg text-slate mb-6">
                {producto.description}
              </p>

              {/* Precio */}
              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-4xl font-bold text-navy">
                  ${producto.price}
                </span>
                {producto.compare_price && (
                  <span className="text-xl text-slate line-through">
                    ${producto.compare_price}
                  </span>
                )}
                {producto.compare_price && (
                  <span className="px-3 py-1 bg-red-100 text-red-600 text-sm font-semibold rounded-full">
                    Ahorras ${producto.compare_price - producto.price}
                  </span>
                )}
              </div>

              {/* Tipo de entrega */}
              <div className="flex items-center gap-2 mb-8 p-4 bg-slate-lighter rounded-xl">
                <span className="text-2xl">
                  {producto.type === 'digital' ? '⚡' : '📅'}
                </span>
                <div>
                  <p className="font-semibold text-navy">
                    {producto.type === 'digital' ? 'Descarga inmediata' : 'Servicio por agendar'}
                  </p>
                  <p className="text-sm text-slate">
                    {producto.type === 'digital' 
                      ? 'Recibirás el archivo en tu correo al instante' 
                      : 'Después de la compra, agendaremos tu sesión'}
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button className="flex-1 px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white hover:shadow-lg transition-all duration-300 flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Añadir al carrito</span>
                </button>
                <button className="flex-1 px-8 py-4 bg-navy text-white font-semibold rounded-lg hover:bg-navy-dark transition-all duration-300">
                  Comprar ahora
                </button>
              </div>

              {/* Incluye */}
              {producto.includes && producto.includes.length > 0 && (
                <div className="border-t border-slate-light pt-6 mb-6">
                  <h3 className="font-display text-lg font-bold text-navy mb-4">
                    ¿Qué incluye?
                  </h3>
                  <ul className="space-y-3">
                    {producto.includes.map((item: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-cyan mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-slate">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Para quién */}
              {producto.for_who && producto.for_who.length > 0 && (
                <div className="border-t border-slate-light pt-6">
                  <h3 className="font-display text-lg font-bold text-navy mb-4">
                    ¿Para quién es?
                  </h3>
                  <ul className="space-y-3">
                    {producto.for_who.map((item: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 text-azure mr-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-slate">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Descripción larga */}
          {producto.long_description && (
            <div className="mt-16 max-w-3xl">
              <h2 className="font-display text-2xl font-bold text-navy mb-6">
                Descripción completa
              </h2>
              <div className="prose prose-lg max-w-none text-slate">
                <p>{producto.long_description}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Garantía */}
      <section className="py-12 bg-slate-lighter">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="w-20 h-20 bg-cyan/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-4xl">🛡️</span>
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-navy mb-2">
                Garantía de satisfacción
              </h3>
              <p className="text-slate">
                Si el producto no cumple tus expectativas, te devuelvo el 100% de tu dinero 
                dentro de los primeros 7 días. Sin preguntas.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Productos relacionados */}
      {relacionados && relacionados.length > 0 && (
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="font-display text-2xl font-bold text-navy mb-8">
              También te puede interesar
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {relacionados.map((prod) => (
                <Link
                  key={prod.id}
                  href={`/tienda/${prod.slug}`}
                  className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-gradient-to-br from-slate-lighter to-slate-light flex items-center justify-center">
                    <span className="text-5xl">
                      {getIcono(prod.category?.slug || '')}
                    </span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-lg font-bold text-navy group-hover:text-azure transition-colors mb-2">
                      {prod.name}
                    </h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-navy">${prod.price}</span>
                      {prod.compare_price && (
                        <span className="text-sm text-slate line-through">${prod.compare_price}</span>
                      )}
                    </div>
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
            className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
          >
            Contactar
          </Link>
        </div>
      </section>
    </div>
  )
}
