import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-navy text-slate-light border-t border-navy-light">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Columna 1: Sobre */}
          <div className="space-y-4">
            {/* Mismo sello negativo que el header, sin recuadro. Aquí hay más
                espacio, así que va a 80 px. */}
            <div className="space-y-3">
              <img
                src="/logo-sello-negativo.png"
                alt="Amanda Santizo — Abogada y Notaria"
                className="h-20 w-20"
              />
              <p className="text-cyan text-xs">Derecho Civil y Empresarial</p>
            </div>
            <p className="text-sm leading-relaxed">
              Despacho jurídico boutique en Guatemala. Derecho civil y empresarial para
              empresas y patrimonio con operaciones entre jurisdicciones.
            </p>
            <div className="flex space-x-4">
              <a href="https://www.instagram.com/abogadasantizo/" target="_blank" rel="noopener noreferrer"
                 className="text-slate-light hover:text-cyan transition-colors" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Columna 2: Navegación */}
          <div>
            <h3 className="text-white font-semibold mb-4">Navegación</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-cyan transition-colors">Inicio</Link></li>
              <li><Link href="/blog" className="hover:text-cyan transition-colors">Blog</Link></li>
              <li><Link href="/tienda" className="hover:text-cyan transition-colors">Tienda</Link></li>
              <li><Link href="/servicios" className="hover:text-cyan transition-colors">Servicios</Link></li>
              <li><Link href="/sobre-mi" className="hover:text-cyan transition-colors">Sobre mí</Link></li>
              <li><Link href="/contacto" className="hover:text-cyan transition-colors">Contacto</Link></li>
            </ul>
          </div>

          {/* Columna 3: Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/privacidad" className="hover:text-cyan transition-colors">Política de Privacidad</Link></li>
              <li><Link href="/terminos" className="hover:text-cyan transition-colors">Términos y Condiciones</Link></li>
              <li><Link href="/cookies" className="hover:text-cyan transition-colors">Política de Cookies</Link></li>
            </ul>
          </div>

          {/* Columna 4: Contacto */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contacto</h3>
            <ul className="space-y-2 text-sm">
              <li>Edificio Géminis 10, Torre Sur</li>
              <li>Oficina 402, zona 10</li>
              <li>Ciudad de Guatemala</li>
              <li className="pt-2">
                <Link href="/agendar" className="hover:text-cyan transition-colors">
                  Agendar una consulta
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-navy-light text-center text-sm">
          <p>&copy; {currentYear} Amanda Santizo. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  )
}