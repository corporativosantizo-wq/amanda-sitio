import Link from 'next/link'

export default function Home() {
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
      title: 'Derecho Internacional',
      description: 'Operaciones transfronterizas, comercio exterior y arbitraje.',
      href: '/servicios#internacional',
    },
    {
      icon: '📚',
      title: 'Capacitaciones',
      description: 'Talleres y cursos para empresas y emprendedores.',
      href: '/servicios#capacitaciones',
    },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center bg-gradient-to-br from-navy via-navy-dark to-navy-light overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text content */}
          <div>
            <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
              Derecho Internacional · Guatemala
            </span>
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Derecho claro para{' '}
              <span className="text-cyan">decisiones inteligentes</span>
            </h1>
            <p className="text-xl text-slate-light mb-8 leading-relaxed">
              Soy Amanda Santizo, abogada especializada en derecho internacional. 
              Ayudo a emprendedores y empresas a proteger sus negocios y tomar 
              decisiones legales con confianza.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/contacto"
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

          {/* Image */}
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl">
              <img
                src="/images/amanda-platon.jpg"
                alt="Amanda Santizo - Abogada especializada en Derecho Internacional"
                className="w-full h-auto object-cover"
              />
            </div>
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
                <div className="mt-4 flex items-center text-cyan font-semibold">
                  <span>Ver más</span>
                  <svg className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
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

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-azure to-cyan">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            ¿Listo para proteger tu negocio?
          </h2>
          <p className="text-xl text-navy-dark mb-8">
            Agenda una consulta gratuita de 15 minutos y conversemos sobre cómo puedo ayudarte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contacto"
              className="px-8 py-4 bg-navy-dark text-white font-semibold rounded-lg hover:bg-navy transition-all duration-300"
            >
              Agenda consulta gratuita
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
