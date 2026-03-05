export default function WhyChooseMe() {
  const reasons = [
    {
      number: '01',
      title: 'Experiencia Internacional',
      description: 'Especialización en Derecho Internacional Público con práctica en múltiples jurisdicciones.',
      icon: '🌍'
    },
    {
      number: '02',
      title: 'Enfoque Estratégico',
      description: 'No solo cumplimos la ley, la usamos como herramienta para impulsar tu crecimiento.',
      icon: '🎯'
    },
    {
      number: '03',
      title: 'Comunicación Clara',
      description: 'Traducimos lo complejo del derecho a un lenguaje accesible y práctico para ti.',
      icon: '💬'
    },
    {
      number: '04',
      title: 'Compromiso Educativo',
      description: 'Docente universitaria comprometida con compartir conocimiento y empoderar a través del derecho.',
      icon: '📚'
    }
  ]

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Columna izquierda: Texto */}
          <div>
            <span className="inline-block px-4 py-2 bg-cyan/10 text-cyan font-semibold rounded-full text-sm mb-4">
              ¿Por qué elegirme?
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-navy mb-6">
              Tu aliada legal para construir con confianza
            </h2>
            <p className="text-lg text-slate leading-relaxed mb-8">
              Con más de 10 años de experiencia y un enfoque centrado en resultados, 
              te acompaño en cada paso de tu camino legal y empresarial. Mi compromiso 
              es brindarte soluciones claras, estratégicas y efectivas.
            </p>

            <div className="flex items-center space-x-6 pb-8 border-b border-slate-light">
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-azure">200+</div>
                <div className="text-sm text-slate">Casos exitosos</div>
              </div>
              <div className="w-px h-12 bg-slate-light"></div>
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-azure">5</div>
                <div className="text-sm text-slate">Profesionales</div>
              </div>
              <div className="w-px h-12 bg-slate-light"></div>
              <div className="text-center">
                <div className="text-3xl font-display font-bold text-azure">10+</div>
                <div className="text-sm text-slate">Años de experiencia</div>
              </div>
            </div>

            <div className="mt-8">
              <button className="px-8 py-4 bg-azure text-white font-semibold rounded-lg
                               hover:bg-cyan transition-all duration-300 
                               hover:shadow-lg hover:shadow-cyan/50 transform hover:scale-105">
                Conoce más sobre mí
              </button>
            </div>
          </div>

          {/* Columna derecha: Razones */}
          <div className="space-y-6">
            {reasons.map((reason, index) => (
              <div
                key={index}
                className="group bg-slate-lighter rounded-xl p-6 hover:bg-white 
                         border border-transparent hover:border-cyan
                         transition-all duration-300 hover:shadow-lg"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="text-4xl">{reason.icon}</div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-cyan font-display font-bold text-sm">{reason.number}</span>
                      <h3 className="font-display text-xl font-bold text-navy group-hover:text-azure transition-colors">
                        {reason.title}
                      </h3>
                    </div>
                    <p className="text-slate leading-relaxed">
                      {reason.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}