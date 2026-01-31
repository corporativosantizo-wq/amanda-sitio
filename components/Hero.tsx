export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-navy-dark via-navy to-navy-light overflow-hidden">
      {/* Decoración de fondo - Elementos geométricos */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 right-20 w-72 h-72 bg-cyan rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-azure rounded-full blur-3xl"></div>
      </div>

      {/* Grid sutil de fondo */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>

      {/* Contenido principal */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          
          {/* Columna izquierda: Texto */}
          <div className="space-y-8">
            {/* Badge/Etiqueta */}
            <div className="inline-flex items-center space-x-2 bg-navy-light/50 backdrop-blur-sm 
                          px-4 py-2 rounded-full border border-cyan/30">
              <div className="w-2 h-2 bg-cyan rounded-full animate-pulse"></div>
              <span className="text-cyan text-sm font-medium">Derecho Internacional</span>
            </div>

            {/* Título principal */}
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight">
              Derecho claro para{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-azure to-cyan">
                decisiones inteligentes
              </span>
            </h1>

            {/* Subtítulo */}
            <p className="text-xl text-slate-light leading-relaxed max-w-xl">
              Acompañamiento legal estratégico para emprendedores y empresas que construyen el futuro. 
              Soluciones jurídicas claras, efectivas y orientadas a resultados.
            </p>

            {/* Botones de acción */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button className="group px-8 py-4 bg-azure text-white font-semibold rounded-lg
                               hover:bg-cyan transition-all duration-300 
                               hover:shadow-2xl hover:shadow-cyan/50 transform hover:scale-105
                               flex items-center justify-center space-x-2">
                <span>Agenda tu consulta</span>
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" 
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>
              
              <button className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg
                               hover:bg-cyan hover:text-navy-dark transition-all duration-300
                               flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Descarga guía gratuita</span>
              </button>
            </div>

            {/* Stats/Números */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-navy-light/30">
              <div>
                <div className="text-3xl font-display font-bold text-cyan">200+</div>
                <div className="text-sm text-slate-light mt-1">Casos atendidos</div>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-cyan">5</div>
                <div className="text-sm text-slate-light mt-1">Abogados</div>
              </div>
              <div>
                <div className="text-3xl font-display font-bold text-cyan">10+</div>
                <div className="text-sm text-slate-light mt-1">Años de experiencia</div>
              </div>
            </div>
          </div>

          {/* Columna derecha: Imagen/Ilustración */}
          <div className="relative">
            {/* Contenedor de imagen con efectos */}
            <div className="relative">
              {/* Card flotante con efecto 3D */}
              <div className="relative bg-gradient-to-br from-navy to-navy-light rounded-2xl p-8 
                            border border-cyan/20 shadow-2xl shadow-cyan/10
                            transform hover:scale-105 transition-all duration-500">
                
                {/* Placeholder para imagen - Aquí irá tu foto profesional */}
                <div className="aspect-square rounded-xl bg-gradient-to-br from-azure/20 to-cyan/20 
                              flex items-center justify-center border border-cyan/30">
                  <div className="text-center space-y-4">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-azure to-cyan rounded-full 
                                  flex items-center justify-center">
                      <span className="text-white font-display font-bold text-5xl">AS</span>
                    </div>
                    <p className="text-slate-light text-sm">
                      Tu foto profesional aquí
                    </p>
                  </div>
                </div>

                {/* Decoración - badges flotantes */}
                <div className="absolute -top-4 -right-4 bg-cyan text-navy-dark px-4 py-2 rounded-lg 
                              font-semibold text-sm shadow-lg transform rotate-3">
                  ⭐ 5 años en DIP
                </div>
                
                <div className="absolute -bottom-4 -left-4 bg-azure text-white px-4 py-2 rounded-lg 
                              font-semibold text-sm shadow-lg transform -rotate-3">
                  📚 Docente universitaria
                </div>
              </div>

              {/* Círculos decorativos */}
              <div className="absolute -z-10 top-10 right-10 w-40 h-40 bg-cyan/20 rounded-full blur-2xl"></div>
              <div className="absolute -z-10 bottom-10 left-10 w-40 h-40 bg-azure/20 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}