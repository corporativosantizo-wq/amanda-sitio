import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Servicios legales | Amanda Santizo, Abogada — Guatemala',
  description:
    'Contratos, derecho corporativo, litigio civil y asuntos interjurisdiccionales. Servicios legales para empresas con operaciones dentro y fuera de Guatemala.',
}

interface ServiceProduct {
  id: string
  name: string
  description: string
  price: number
}

export default async function ServiciosPage() {
  // Obtener servicios de la BD
  const supabase = await createClient()
  const { data: dbServicios } = await supabase
    .from('products')
    .select('id, name, description, price')
    .eq('status', 'active')
    .eq('type', 'service')
    .order('price', { ascending: true })

  const servicios = [
    {
      id: 'consultoria',
      title: 'Consultoría Legal Estratégica',
      subtitle: 'Asesoría personalizada para tus decisiones clave',
      icon: '⚖️',
      description: 'Acompañamiento legal integral enfocado en resultados. Te ayudo a navegar situaciones complejas con claridad y estrategia.',
      features: [
        'Consultoría por hora o paquetes',
        'Análisis de riesgo legal',
        'Estrategia de negociación',
        'Due diligence',
        'Opiniones legales especializadas',
      ],
      pricing: '$150 por hora — presencial',
      ideal: 'Ideal para: Empresas que necesitan una opinión legal antes de decidir',
    },
    {
      id: 'empresarial',
      title: 'Derecho Empresarial',
      subtitle: 'Soluciones legales para tu empresa',
      icon: '🏢',
      description: 'Desde la constitución hasta la operación diaria, te brindo el soporte legal que tu empresa necesita para crecer con solidez.',
      features: [
        'Constitución de sociedades',
        'Contratos comerciales',
        'Fusiones y adquisiciones',
        'Compliance corporativo',
        'Gobierno corporativo',
        'Resolución de conflictos societarios',
      ],
      pricing: 'Registro de sociedad desde $1,600',
      ideal: 'Ideal para: Empresas establecidas, nuevos negocios, inversionistas',
    },
    {
      id: 'internacional',
      title: 'Asuntos Interjurisdiccionales',
      subtitle: 'Cuando su operación cruza fronteras',
      icon: '🌍',
      description: 'Contratos, operaciones y patrimonio que cruzan fronteras. Estructura legal para que su negocio funcione en más de una jurisdicción.',
      features: [
        'Contratos internacionales',
        'Operaciones entre jurisdicciones',
        'Patrimonio y sucesiones transfronterizas',
        'Sociedades con socios o activos en el exterior',
        'Ejecución de resoluciones extranjeras',
        'Arbitraje comercial',
      ],
      pricing: 'Cotización por proyecto',
      ideal: 'Ideal para: Empresas con operaciones dentro y fuera de Guatemala',
    },
    {
      id: 'propiedad-intelectual',
      title: 'Propiedad Intelectual',
      subtitle: 'Protege tus activos intangibles',
      icon: '💡',
      description: 'Registro y protección de marcas, patentes y derechos de autor. Asegura que tu innovación esté legalmente protegida.',
      features: [
        'Registro de marcas',
        'Búsqueda de antecedentes',
        'Defensa de marca',
        'Contratos de licencia',
        'Estrategia de protección IP',
      ],
      pricing: 'Cotización según el alcance',
      ideal: 'Ideal para: Empresas que protegen su marca dentro y fuera del país',
    },
    {
      id: 'contratos',
      title: 'Redacción y Revisión de Contratos',
      subtitle: 'Acuerdos claros que protegen tus intereses',
      icon: '📄',
      description: 'Creación y revisión de contratos personalizados. Aseguro que cada cláusula trabaje a tu favor.',
      features: [
        'Contratos de servicios',
        'NDAs y confidencialidad',
        'Contratos laborales',
        'Términos y condiciones',
        'Políticas de privacidad',
        'Contratos de compraventa',
      ],
      pricing: 'Cotización según el alcance',
      ideal: 'Ideal para: Empresas y profesionales que contratan con terceros',
    },
    {
      id: 'capacitaciones',
      title: 'Capacitaciones y Academia',
      subtitle: 'Empoderamiento a través del conocimiento legal',
      icon: '📚',
      description: 'Talleres, cursos y capacitaciones diseñados para empoderar equipos y profesionales con conocimiento legal práctico.',
      features: [
        'Talleres corporativos in-house',
        'Cursos online especializados',
        'Docencia universitaria',
        'Webinars y conferencias',
        'Material educativo descargable',
      ],
      pricing: 'Cotización según el alcance',
      ideal: 'Ideal para: Equipos corporativos y áreas legales internas',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="max-w-3xl">
            <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
              Servicios Legales
            </span>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-6">
              Soluciones legales diseñadas para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-azure to-cyan">
                tu crecimiento
              </span>
            </h1>
            <p className="text-xl text-slate-light leading-relaxed mb-8">
              Desde consultoría estratégica hasta capacitaciones especializadas.
              Cada servicio está diseñado para darte claridad, protección y confianza
              en cada decisión legal.
            </p>
            <Link
              href="/agendar"
              className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300 hover:shadow-lg transform hover:scale-105"
            >
              Agenda una consulta
            </Link>
          </div>
        </div>
      </section>

      {/* Servicios destacados */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="space-y-16">
            {servicios.map((servicio, index) => (
              <div
                key={servicio.id}
                className={`flex flex-col lg:flex-row gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                {/* Contenido */}
                <div className="flex-1">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-azure to-cyan rounded-2xl text-4xl mb-6">
                    {servicio.icon}
                  </div>

                  <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-3">
                    {servicio.title}
                  </h2>
                  <p className="text-azure text-lg font-semibold mb-4">
                    {servicio.subtitle}
                  </p>
                  <p className="text-slate text-lg leading-relaxed mb-6">
                    {servicio.description}
                  </p>

                  <div className="mb-6">
                    <h3 className="font-semibold text-navy mb-3">Incluye:</h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {servicio.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start">
                          <svg className="w-5 h-5 text-cyan mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-slate">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-6 border-t border-slate-light">
                    <div>
                      <div className="text-2xl font-display font-bold text-azure">
                        {servicio.pricing}
                      </div>
                      <div className="text-sm text-slate mt-1">{servicio.ideal}</div>
                    </div>
                    <Link
                      href="/contacto"
                      className="ml-auto px-6 py-3 bg-azure text-white font-semibold rounded-lg hover:bg-cyan transition-all duration-300 hover:shadow-lg flex items-center space-x-2"
                    >
                      <span>Consultar</span>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>

                <div className="flex-1 max-w-md">
                  <div className="bg-gradient-to-br from-slate-lighter to-white rounded-2xl p-8 shadow-xl border border-slate-light">
                    <div className="aspect-square bg-gradient-to-br from-azure/10 to-cyan/10 rounded-xl flex items-center justify-center">
                      <div className="text-8xl opacity-20">{servicio.icon}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Servicios de la BD */}
      {(dbServicios ?? []).length > 0 && (
        <section className="py-20 bg-slate-lighter">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-12">
              <span className="inline-block px-4 py-2 bg-azure/10 text-azure font-semibold rounded-full text-sm mb-4">
                Servicios Profesionales
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-navy mb-4">
                Contrata directamente
              </h2>
              <p className="text-slate text-lg max-w-2xl mx-auto">
                Servicios legales con precio de referencia. Solicita una cotización personalizada
                según la complejidad de tu caso.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(dbServicios as ServiceProduct[]).map((svc) => (
                <div
                  key={svc.id}
                  className="bg-white rounded-2xl border border-slate-light p-6 hover:border-cyan hover:shadow-xl transition-all duration-300 flex flex-col"
                >
                  <h3 className="font-display text-xl font-bold text-navy mb-3">
                    {svc.name}
                  </h3>
                  <p className="text-slate text-sm leading-relaxed mb-6 flex-1">
                    {svc.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-light">
                    <div>
                      <span className="text-sm font-medium text-slate">Desde </span>
                      <span className="text-xl font-bold text-navy">
                        ${Number(svc.price).toLocaleString('en-US')}
                      </span>
                    </div>
                    <Link
                      href="/tienda/cotizacion-a-medida"
                      className="px-5 py-2.5 bg-azure text-white font-semibold rounded-lg hover:bg-cyan transition-all duration-300 text-sm flex items-center space-x-2"
                    >
                      <span>Consultar</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            ¿No estás seguro qué servicio necesitas?
          </h2>
          <p className="text-xl text-slate-light mb-8">
            Agenda una consulta inicial y le orientamos sobre el camino a seguir.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/agendar"
              className="inline-block px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
            >
              Agenda una consulta
            </Link>
            <Link
              href="/contacto"
              className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-dark transition-all duration-300 flex items-center justify-center"
            >
              Enviar mensaje
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
