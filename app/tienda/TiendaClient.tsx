'use client'

import { useState } from 'react'
import Link from 'next/link'

interface Producto {
  id: string
  name: string
  slug: string
  description: string
  price: number
  compare_price: number | null
  type: string
  is_featured: boolean
  is_new: boolean
  featured_image: string | null
  category: {
    name: string
    slug: string
  } | null
}

interface Categoria {
  id: string
  name: string
  slug: string
}

interface Props {
  productos: Producto[]
  categorias: Categoria[]
}

export default function TiendaClient({ productos, categorias }: Props) {
  const [categoriaActiva, setCategoriaActiva] = useState('todos')
  const [ordenar, setOrdenar] = useState('destacados')

  const productosFiltrados = productos
    .filter(p => categoriaActiva === 'todos' || p.category?.slug === categoriaActiva)
    .sort((a, b) => {
      if (ordenar === 'precio-asc') return a.price - b.price
      if (ordenar === 'precio-desc') return b.price - a.price
      if (ordenar === 'destacados') return (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0)
      return 0
    })

  const categoriasConTodos = [
    { id: 'todos', name: 'Todos', slug: 'todos' },
    ...categorias
  ]

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
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
            Tienda Legal
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Soluciones legales{' '}
            <span className="text-cyan">listas para usar</span>
          </h1>
          <p className="text-xl text-slate-light max-w-2xl mx-auto">
            Plantillas profesionales, cursos y servicios diseñados para proteger 
            tu negocio y ahorrarte tiempo y dinero.
          </p>
        </div>
      </section>

      {/* Filtros y Productos */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Barra de filtros */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-10">
            
            {/* Categorías */}
            <div className="flex flex-wrap gap-2">
              {categoriasConTodos.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaActiva(cat.slug)}
                  className={`px-4 py-2 rounded-full font-medium transition-all duration-300 flex items-center space-x-2
                    ${categoriaActiva === cat.slug 
                      ? 'bg-cyan text-navy-dark' 
                      : 'bg-slate-lighter text-slate hover:bg-slate-light'
                    }`}
                >
                  <span>{getIcono(cat.slug)}</span>
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>

            {/* Ordenar */}
            <div className="flex items-center space-x-3">
              <label className="text-slate text-sm">Ordenar por:</label>
              <select
                value={ordenar}
                onChange={(e) => setOrdenar(e.target.value)}
                className="px-4 py-2 border border-slate-light rounded-lg bg-white text-navy font-medium focus:ring-2 focus:ring-cyan focus:border-cyan outline-none"
              >
                <option value="destacados">Destacados</option>
                <option value="precio-asc">Precio: menor a mayor</option>
                <option value="precio-desc">Precio: mayor a menor</option>
              </select>
            </div>
          </div>

          {/* Contador de resultados */}
          <p className="text-slate mb-6">
            Mostrando <span className="font-semibold text-navy">{productosFiltrados.length}</span> productos
          </p>

          {/* Grid de productos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {productosFiltrados.map((producto) => (
              <Link
                key={producto.id}
                href={`/tienda/${producto.slug}`}
                className="group bg-white rounded-2xl border border-slate-light overflow-hidden hover:border-cyan hover:shadow-xl transition-all duration-300"
              >
                {/* Imagen */}
                <div className="aspect-[4/3] bg-gradient-to-br from-slate-lighter to-slate-light relative overflow-hidden">
                  {/* Placeholder de imagen */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 bg-navy/10 rounded-xl flex items-center justify-center">
                      <span className="text-4xl">
                        {getIcono(producto.category?.slug || '')}
                      </span>
                    </div>
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
                        OFERTA
                      </span>
                    )}
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-navy/80 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="px-6 py-3 bg-cyan text-navy-dark font-semibold rounded-lg transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                      Ver detalles
                    </span>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-6">
                  {/* Categoría */}
                  <span className="text-xs font-semibold text-azure uppercase tracking-wide">
                    {producto.category?.name || 'Producto'}
                  </span>

                  {/* Nombre */}
                  <h3 className="font-display text-xl font-bold text-navy mt-2 mb-3 group-hover:text-azure transition-colors">
                    {producto.name}
                  </h3>

                  {/* Descripción */}
                  <p className="text-slate text-sm mb-4 line-clamp-2">
                    {producto.description}
                  </p>

                  {/* Precio */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-navy">
                        ${producto.price}
                      </span>
                      {producto.compare_price && (
                        <span className="text-sm text-slate line-through">
                          ${producto.compare_price}
                        </span>
                      )}
                    </div>
                    
                    {/* Tipo de entrega */}
                    <span className={`text-xs font-medium px-3 py-1 rounded-full
                      ${producto.type === 'digital' 
                        ? 'bg-cyan/20 text-cyan' 
                        : 'bg-azure/20 text-azure'
                      }`}
                    >
                      {producto.type === 'digital' ? '⚡ Descarga' : '📅 Agendar'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Empty state */}
          {productosFiltrados.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-slate-lighter rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🔍</span>
              </div>
              <h3 className="font-display text-xl font-bold text-navy mb-2">
                No hay productos en esta categoría
              </h3>
              <p className="text-slate mb-4">
                Prueba seleccionando otra categoría
              </p>
              <button
                onClick={() => setCategoriaActiva('todos')}
                className="text-azure font-semibold hover:text-cyan transition-colors"
              >
                Ver todos los productos
              </button>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-white mb-4">
            ¿No encuentras lo que buscas?
          </h2>
          <p className="text-slate-light text-lg mb-8">
            Puedo crear documentos legales personalizados para tu situación específica.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contacto"
              className="px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
            >
              Solicitar cotización
            </Link>
            <Link
              href="/servicios"
              className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-dark transition-all duration-300"
            >
              Ver servicios personalizados
            </Link>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="py-12 bg-slate-lighter">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { icono: '🔒', titulo: 'Pago seguro', desc: 'Transacciones encriptadas' },
              { icono: '⚡', titulo: 'Descarga inmediata', desc: 'Acceso al instante' },
              { icono: '✅', titulo: 'Calidad garantizada', desc: 'Documentos profesionales' },
              { icono: '💬', titulo: 'Soporte incluido', desc: 'Resuelvo tus dudas' },
            ].map((badge, index) => (
              <div key={index} className="flex flex-col items-center">
                <span className="text-3xl mb-2">{badge.icono}</span>
                <h4 className="font-semibold text-navy">{badge.titulo}</h4>
                <p className="text-slate text-sm">{badge.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
