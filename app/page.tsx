export default function Home() {
  return (
    <main className="min-h-screen bg-navy-dark">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <h1 className="font-display text-5xl font-bold text-white mb-6">
          Amanda Santizo
        </h1>
        <p className="text-xl text-slate-light mb-8">
          Derecho claro para decisiones inteligentes
        </p>
        
        {/* Probar paleta de colores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
          <div className="h-24 bg-navy-dark rounded-lg flex items-center justify-center text-white text-sm font-semibold">
            Navy Dark
          </div>
          <div className="h-24 bg-navy rounded-lg flex items-center justify-center text-white text-sm font-semibold">
            Navy
          </div>
          <div className="h-24 bg-azure rounded-lg flex items-center justify-center text-white text-sm font-semibold">
            Azure
          </div>
          <div className="h-24 bg-cyan rounded-lg flex items-center justify-center text-navy-dark text-sm font-semibold">
            Cyan
          </div>
        </div>

        {/* Probar botones */}
        <div className="flex flex-col md:flex-row gap-4 mt-12">
          <button className="px-8 py-4 bg-azure text-white font-semibold rounded-lg
                           hover:bg-cyan transition-all duration-300 
                           hover:shadow-lg hover:shadow-cyan/50 transform hover:scale-105">
            Botón Principal
          </button>
          
          <button className="px-8 py-4 border-2 border-cyan text-cyan font-semibold rounded-lg
                           hover:bg-cyan hover:text-navy-dark transition-all duration-300">
            Botón Secundario
          </button>
        </div>

        {/* Probar tipografías */}
        <div className="mt-16 space-y-4">
          <h2 className="font-display text-3xl font-bold text-white">
            Título con Outfit (Display)
          </h2>
          <p className="font-sans text-lg text-slate-light leading-relaxed">
            Este es un párrafo con la fuente Inter. Es perfecta para lectura prolongada,
            muy legible y profesional. Ideal para artículos de blog y contenido legal.
          </p>
        </div>
      </div>
    </main>
  )
}