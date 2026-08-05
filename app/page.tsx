import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

// Los últimos artículos se revalidan cada hora: la portada sigue siendo
// estática en vez de renderizarse en cada visita.
export const revalidate = 3600

interface PostPortada {
  id: string
  slug: string
  title: string
  published_at: string | null
  category: { name: string; slug: string } | null
}

async function ultimosPosts(): Promise<PostPortada[]> {
  try {
    // Llave anónima y sin cookies: RLS ya limita a los publicados, y así no se
    // fuerza el renderizado dinámico de la página.
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data } = await db
      .from('posts')
      .select('id, slug, title, published_at, category:categories(name, slug)')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(3)
    return (data ?? []) as unknown as PostPortada[]
  } catch {
    return []
  }
}

const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

export const metadata: Metadata = {
  title: 'Amanda Santizo — Abogada y Notaria | Derecho Civil y Empresarial, Guatemala',
  description:
    'Despacho jurídico boutique en Guatemala. Derecho civil y empresarial con enfoque transfronterizo: contratos, empresas y patrimonio que cruzan fronteras.',
  alternates: { canonical: '/' },
}

export default async function Home() {
  const posts = await ultimosPosts()

  const servicios = [
    {
      icon: '📄',
      title: 'Contratos',
      description: 'Redacción y revisión de contratos comerciales, laborales y civiles.',
      href: '/servicios#contratos',
    },
    {
      icon: '🏢',
      title: 'Derecho Empresarial',
      description: 'Constitución de sociedades, fusiones y asesoría corporativa.',
      href: '/servicios#empresarial',
    },
    {
      icon: '🌍',
      title: 'Asuntos Transfronterizos',
      description: 'Contratos, operaciones y patrimonio entre jurisdicciones.',
      href: '/servicios#internacional',
    },
    {
      icon: '🏛️',
      title: 'Litigio Corporativo',
      description: 'Disputas entre socios, cobro mercantil y defensa en juicio.',
      href: '/servicios#litigio-corporativo',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {/* Hero sin fotografía: la identidad la sostienen el color y la
          tipografía. Columna única centrada. */}
      <section className="relative min-h-[72vh] flex items-center bg-gradient-to-br from-navy via-navy-dark to-navy-light overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 text-center">
          <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
            Derecho Civil y Empresarial · Guatemala
          </span>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
            Derecho claro para{' '}
            <span className="text-cyan">decisiones inteligentes</span>
          </h1>
          <p className="text-xl text-slate-light mb-10 leading-relaxed max-w-2xl mx-auto">
            Soy Amanda Santizo, abogada y notaria. Dirijo un despacho jurídico
            boutique especializado en derecho civil y empresarial, con enfoque
            transfronterizo: contratos, empresas y patrimonio que cruzan fronteras.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/agendar"
              className="px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300 text-center"
            >
              Agenda una consulta
            </Link>
            <Link
              href="/servicios"
              className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-dark transition-all duration-300 text-center"
            >
              Ver servicios
            </Link>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-slate-lighter">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-azure/10 text-azure font-semibold rounded-full text-sm mb-4">
              Servicios
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-navy mb-4">
              ¿En qué puedo ayudarte?
            </h2>
            <p className="text-xl text-slate max-w-2xl mx-auto">
              Soluciones legales claras y estratégicas para cada etapa de tu negocio
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {servicios.map((servicio, index) => (
              <Link
                key={index}
                href={servicio.href}
                className="group bg-white rounded-2xl p-8 shadow-sm hover:shadow-xl transition-all duration-300 border border-transparent hover:border-cyan"
              >
                <div className="text-5xl mb-4">{servicio.icon}</div>
                <h3 className="font-display text-xl font-bold text-navy mb-3 group-hover:text-azure transition-colors">
                  {servicio.title}
                </h3>
                <p className="text-slate">{servicio.description}</p>
                {/* Texto en marino y dorado solo en el icono: el dorado sobre
                    blanco no alcanza el contraste de un texto pequeño. */}
                <div className="mt-4 flex items-center text-navy font-semibold">
                  <span>Ver más</span>
                  <svg className="w-4 h-4 ml-2 text-cyan group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Proceso de agendamiento */}
      <section className="py-20 bg-navy">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Su consulta, con hora reservada
          </h2>
          <p className="text-xl text-slate-light leading-relaxed mb-10">
            El despacho atiende con agenda. Usted elige día y hora, recibe
            confirmación y su enlace de reunión — sin llamadas de seguimiento ni
            esperas. Cada consulta tiene tiempo dedicado.
          </p>
          <Link
            href="/agendar"
            className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
          >
            Agende su consulta
          </Link>
        </div>
      </section>

      {/* About Preview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <img
                  src="/images/amanda-tv.jpg"
                  alt="Amanda Santizo en Canal Antigua"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-cyan rounded-xl p-4 shadow-xl">
                <p className="text-navy-dark font-bold">Visto en</p>
                <p className="text-navy-dark text-sm">Canal Antigua</p>
              </div>
            </div>

            <div>
              <span className="inline-block px-4 py-2 bg-azure/10 text-azure font-semibold rounded-full text-sm mb-4">
                Sobre mí
              </span>
              <h2 className="font-display text-4xl font-bold text-navy mb-6">
                Derecho que impulsa, no que frena
              </h2>
              <p className="text-lg text-slate mb-6 leading-relaxed">
                Creo firmemente que el derecho debería ser una herramienta para el crecimiento, 
                no un obstáculo. Por eso me especializo en traducir lo complejo en soluciones 
                claras y accionables.
              </p>
              <p className="text-lg text-slate mb-8 leading-relaxed">
                Como abogada y docente universitaria, combino la práctica legal con la educación 
                para empoderar a mis clientes.
              </p>
              <Link
                href="/sobre-mi"
                className="inline-flex items-center px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-azure transition-colors"
              >
                Conoce mi historia
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Últimos artículos. La portada de cada tarjeta es la imagen social que
          el sitio genera por artículo, que ya lleva el título impreso: por eso
          debajo solo van fecha y categoría, y el título viaja en el alt. */}
      {posts.length > 0 && (
        <section className="py-20 bg-slate-lighter">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-azure/10 text-azure font-semibold rounded-full text-sm mb-4">
                Blog
              </span>
              <h2 className="font-display text-4xl md:text-5xl font-bold text-navy">
                Últimos artículos
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="group bg-white rounded-2xl overflow-hidden border border-slate-light
                           hover:border-cyan hover:shadow-xl transition-all duration-300"
                >
                  <img
                    src={`/blog/${post.slug}/opengraph-image`}
                    alt={post.title}
                    width={1200}
                    height={630}
                    className="w-full h-auto"
                  />
                  <div className="flex items-center justify-between gap-3 px-5 py-4">
                    <span className="text-sm text-slate">
                      {post.published_at ? formatoFecha(post.published_at) : ''}
                    </span>
                    {post.category && (
                      <span className="px-3 py-1 bg-cyan/15 text-navy text-xs font-semibold rounded-full whitespace-nowrap">
                        {post.category.name}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            <div className="text-center mt-12">
              <Link
                href="/blog"
                className="inline-flex items-center px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-azure transition-colors"
              >
                Ver todos los artículos
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-azure to-cyan">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            ¿Listo para proteger tu negocio?
          </h2>
          <p className="text-xl text-navy-dark mb-8">
            Agenda una consulta y conversemos sobre cómo podemos ayudarte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/agendar"
              className="px-8 py-4 bg-navy-dark text-white font-semibold rounded-lg hover:bg-navy transition-all duration-300"
            >
              Agenda una consulta
            </Link>
            <Link
              href="/tienda"
              className="px-8 py-4 bg-white text-navy-dark font-semibold rounded-lg hover:bg-slate-lighter transition-all duration-300"
            >
              Ver plantillas legales
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
