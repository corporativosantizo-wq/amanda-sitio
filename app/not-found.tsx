import Link from 'next/link'

// 404 global. Se renderiza dentro del root layout. Mantenerla simple y sin
// dependencias de auth para que su prerender nunca falle el build.
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-20">
      <span className="text-6xl mb-4" aria-hidden>🔍</span>
      <p className="text-cyan font-semibold tracking-wide mb-2">Error 404</p>
      <h1 className="font-display text-3xl md:text-4xl font-bold text-navy mb-3">
        Página no encontrada
      </h1>
      <p className="text-slate max-w-md mb-8">
        La página que buscas no existe o fue movida. Revisa la dirección o vuelve al inicio.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-5 py-2.5 bg-cyan text-navy-dark font-semibold rounded-full hover:bg-cyan/90 transition-colors"
        >
          Volver al inicio
        </Link>
        <Link
          href="/blog"
          className="px-5 py-2.5 bg-slate-lighter text-slate font-semibold rounded-full hover:bg-slate-light transition-colors"
        >
          Ir al blog
        </Link>
      </div>
    </div>
  )
}
