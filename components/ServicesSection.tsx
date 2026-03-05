import Link from 'next/link'

export default function ServicesSection() {
  const services = [
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Derecho Empresarial',
      description: 'Constitución de empresas, contratos comerciales, compliance corporativo y asesoría estratégica para tu negocio.',
      features: ['Constitución de sociedades', 'Contratos comerciales', 'Compliance', 'Fusiones y adquisiciones'],
      link: '/servicios/empresarial'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Derecho Internacional',
      description: 'Tratados comerciales, resolución de conflictos internacionales, importación/exportación y derecho diplomático.',
      features: ['Tratados internacionales', 'Comercio exterior', 'Resolución de conflictos', 'Derecho diplomático'],
      link: '/servicios/internacional'
    },
    {
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      title: 'Capacitaciones & Academia',
      description: 'Formación especializada en derecho internacional público, talleres corporativos y cursos online para profesionales.',
      features: ['Cursos online', 'Talleres corporativos', 'Docencia universitaria', 'Material educativo'],
      link: '/servicios/capacitaciones'
    }
  ]

  return (
    <section className="py-20 bg-slate-lighter">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-azure/10 text-azure font-semibold rounded-full text-sm mb-4">
            Servicios
          </span>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-navy mb-4">
            ¿En qué puedo ayudarte?
          </h2>
          <p className="text-lg text-slate max-w-2xl mx-auto">
            Soluciones legales integrales diseñadas para impulsar tu crecimiento y proteger tus intereses
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl 
                       transition-all duration-300 hover:-translate-y-2 border border-transparent 
                       hover:border-cyan cursor-pointer"
            >
              {/* Icon */}
              <div className="w-16 h-16 bg-gradient-to-br from-azure to-cyan rounded-xl 
                            flex items-center justify-center text-white mb-6
                            group-hover:scale-110 transition-transform duration-300">
                {service.icon}
              </div>

              {/* Title */}
              <h3 className="font-display text-2xl font-bold text-navy mb-4 group-hover:text-azure transition-colors">
                {service.title}
              </h3>

              {/* Description */}
              <p className="text-slate mb-6 leading-relaxed">
                {service.description}
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {service.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center text-sm text-slate">
                    <svg className="w-5 h-5 text-cyan mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Link */}
              <Link 
                href={service.link}
                className="inline-flex items-center text-azure font-semibold group-hover:text-cyan transition-colors"
              >
                Conocer más
                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}