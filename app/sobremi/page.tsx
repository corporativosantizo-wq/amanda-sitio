import Link from 'next/link'

export default function SobreMiPage() {
  const credenciales = [
    {
      icon: '🎓',
      title: 'Formación Académica',
      items: [
        'Licenciatura en Ciencias Jurídicas y Sociales',
        'Especialización en Derecho Internacional Público',
        'Diplomados en Derecho Empresarial',
      ],
    },
    {
      icon: '💼',
      title: 'Experiencia Profesional',
      items: [
        'Amplia trayectoria en práctica legal',
        'Casos atendidos exitosamente',
        'Despacho propio con equipo de trabajo',
      ],
    },
    {
      icon: '📚',
      title: 'Docencia',
      items: [
        'Docente de Derecho Internacional Público',
        'Creadora de plataformas educativas',
        'Capacitaciones corporativas',
      ],
    },
  ]

  const valores = [
    {
      title: 'Claridad',
      description: 'Traduzco lo complejo del derecho a un lenguaje que entiendas y puedas aplicar.',
      icon: '💬',
    },
    {
      title: 'Estrategia',
      description: 'No solo cumplimos la ley, la usamos como herramienta para impulsar tu crecimiento.',
      icon: '🎯',
    },
    {
      title: 'Compromiso',
      description: 'Tu éxito es mi éxito. Me involucro profundamente en cada caso.',
      icon: '🤝',
    },
    {
      title: 'Innovación',
      description: 'Combino la práctica legal tradicional con tecnología y nuevas metodologías.',
      icon: '💡',
    },
  ]

  const timeline = [
    {
      year: '2015',
      title: 'Inicios en la práctica legal',
      description: 'Comencé mi carrera en un bufete especializado en derecho corporativo.',
    },
    {
      year: '2018',
      title: 'Especialización Internacional',
      description: 'Me especialicé en derecho internacional público, trabajando en casos transfronterizos.',
    },
    {
      year: '2020',
      title: 'Despacho propio',
      description: 'Fundé mi propio despacho con enfoque en emprendedores y empresas en crecimiento.',
    },
    {
      year: '2022',
      title: 'Docencia Universitaria',
      description: 'Comencé a impartir clases de Derecho Internacional Público.',
    },
    {
      year: '2024',
      title: 'Transformación Digital',
      description: 'Lancé plataformas educativas y expandí servicios online.',
    },
  ]

  const contenidoQueConsumo = [
    {
      tipo: 'Think Tank',
      nombre: 'GuateLibre',
      descripcion: 'Ideas de libertad para Guatemala',
      url: 'https://www.guatelibre.org',
      icon: '🇬🇹',
    },
    {
      tipo: 'Think Tank',
      nombre: 'Atlas Network',
      descripcion: 'Red global de organizaciones por la libertad económica',
      url: 'https://www.atlasnetwork.org',
      icon: '🌎',
    },
    {
      tipo: 'Think Tank',
      nombre: 'Instituto Juan de Mariana',
      descripcion: 'Think tank liberal en España',
      url: 'https://www.juandemariana.org',
      icon: '🇪🇸',
    },
    {
      tipo: 'X (Twitter)',
      nombre: '@selibregt',
      descripcion: 'Contenido sobre libertad en Guatemala',
      url: 'https://x.com/selibregt',
      icon: '𝕏',
    },
    {
      tipo: 'X (Twitter)',
      nombre: '@247prensad',
      descripcion: 'Noticias y análisis',
      url: 'https://x.com/247prensad',
      icon: '𝕏',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
                Sobre mí
              </span>
              <h1 className="font-display text-5xl md:text-6xl font-bold text-white mb-6">
                Amanda Santizo
              </h1>
              <p className="text-2xl text-azure font-semibold mb-6">
                Abogada especializada en Derecho Internacional Público
              </p>
              <p className="text-xl text-slate-light leading-relaxed mb-8">
                He acompañado a emprendedores y empresas en sus decisiones legales más importantes. 
                Mi misión es democratizar el acceso al derecho, haciéndolo claro, estratégico 
                y orientado a resultados.
              </p>
              <div className="flex gap-4">
                <Link
                  href="/contacto"
                  className="px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-white transition-all duration-300"
                >
                  Agenda una consulta
                </Link>
                <Link
                  href="/contacto"
                  className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg hover:bg-cyan hover:text-navy-dark transition-all duration-300 flex items-center justify-center"
                >
                  Contáctame
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl border-4 border-cyan/20">
                <img
                  src="/images/amanda-tv.jpg"
                  alt="Amanda Santizo en Canal Antigua"
                  className="w-full h-auto object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-xl">
                <p className="text-navy font-bold">Visto en</p>
                <p className="text-azure font-semibold">Canal Antigua</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-lighter">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-navy text-center mb-12">
            Mi Historia
          </h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg text-slate leading-relaxed mb-6">
              Mi camino en el derecho comenzó con una simple pero poderosa convicción: 
              <strong className="text-navy"> el derecho no debería ser un obstáculo, sino una herramienta 
              para el crecimiento</strong>. Vi demasiados emprendedores y empresas frenados por confusión 
              legal, contratos mal redactados o simplemente por no saber qué preguntar.
            </p>
            <p className="text-lg text-slate leading-relaxed mb-6">
              Después de trabajar en bufetes tradicionales, decidí crear un espacio diferente. 
              Un lugar donde el derecho se explica con claridad, donde cada cliente entiende no solo el 
              "qué" sino el "por qué" de cada decisión legal.
            </p>
            <p className="text-lg text-slate leading-relaxed mb-6">
              Hoy lidero un despacho con un equipo de trabajo comprometido, y comparto mi conocimiento 
              como docente universitaria. Pero lo que más me llena es ver a mis clientes tomar decisiones 
              con confianza, sabiendo que están legalmente protegidos y estratégicamente posicionados.
            </p>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-navy text-center mb-12">
            Credenciales y Experiencia
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {credenciales.map((cred, index) => (
              <div
                key={index}
                className="bg-slate-lighter rounded-2xl p-8 hover:shadow-xl transition-all duration-300 border border-transparent hover:border-cyan"
              >
                <div className="text-5xl mb-4">{cred.icon}</div>
                <h3 className="font-display text-xl font-bold text-navy mb-4">
                  {cred.title}
                </h3>
                <ul className="space-y-2">
                  {cred.items.map((item, idx) => (
                    <li key={idx} className="flex items-start">
                      <svg className="w-5 h-5 text-cyan mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-slate">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-navy to-navy-dark">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-white text-center mb-16">
            Mi Trayectoria
          </h2>
          <div className="space-y-8">
            {timeline.map((item, index) => (
              <div key={index} className="flex gap-8 items-start">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-cyan rounded-full flex items-center justify-center">
                    <span className="font-display text-navy-dark font-bold text-xl">
                      {item.year}
                    </span>
                  </div>
                </div>
                <div className="flex-1 bg-navy-light/30 backdrop-blur-sm rounded-xl p-6 border border-cyan/20">
                  <h3 className="font-display text-xl font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-light">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-navy text-center mb-4">
            Mis Valores
          </h2>
          <p className="text-center text-slate text-lg mb-12 max-w-2xl mx-auto">
            Los principios que guían mi práctica legal y mi relación con cada cliente
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {valores.map((valor, index) => (
              <div
                key={index}
                className="text-center p-8 rounded-2xl bg-slate-lighter hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-cyan"
              >
                <div className="text-5xl mb-4">{valor.icon}</div>
                <h3 className="font-display text-xl font-bold text-navy mb-3">
                  {valor.title}
                </h3>
                <p className="text-slate text-sm leading-relaxed">
                  {valor.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-slate-lighter">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="font-display text-4xl font-bold text-navy text-center mb-4">
            Voces que sigo
          </h2>
          <p className="text-center text-slate text-lg mb-12 max-w-2xl mx-auto">
            Creo en las ideas de libertad individual, mercados libres y gobierno limitado. 
            Estas son algunas fuentes que me inspiran y que recomiendo.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contenidoQueConsumo.map((item, index) => (
              <a
                key={index}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-2xl p-6 hover:shadow-xl transition-all duration-300 border border-transparent hover:border-cyan"
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{item.icon}</div>
                  <div className="flex-1">
                    <span className="text-xs font-semibold text-cyan uppercase tracking-wide">
                      {item.tipo}
                    </span>
                    <h3 className="font-display text-lg font-bold text-navy group-hover:text-azure transition-colors mt-1">
                      {item.nombre}
                    </h3>
                    <p className="text-slate text-sm mt-2">
                      {item.descripcion}
                    </p>
                  </div>
                  <svg 
                    className="w-5 h-5 text-slate group-hover:text-cyan transition-colors flex-shrink-0" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-azure to-cyan">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white mb-6">
            Trabajemos juntos
          </h2>
          <p className="text-xl text-navy-dark mb-8">
            Si buscas claridad legal, estrategia y un acompañamiento genuino, 
            estoy aquí para ayudarte.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/contacto"
              className="px-8 py-4 bg-navy-dark text-white font-semibold rounded-lg hover:bg-navy transition-all duration-300"
            >
              Agenda consulta gratuita
            </Link>
            <Link
              href="/servicios"
              className="px-8 py-4 bg-white text-navy-dark font-semibold rounded-lg hover:bg-slate-lighter transition-all duration-300"
            >
              Ver servicios
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
