import Link from 'next/link'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-navy text-slate-light border-t border-navy-light">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Columna 1: Sobre */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-azure to-cyan rounded-lg flex items-center justify-center">
                <span className="text-white font-display font-bold text-lg">AS</span>
              </div>
              <div>
                <h3 className="text-white font-display font-bold">Amanda Santizo</h3>
                <p className="text-cyan text-xs">Derecho Internacional</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              Derecho claro para decisiones inteligentes. Acompañamiento legal estratégico 
              para emprendedores y empresas.
            </p>
            <div className="flex space-x-4">
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
                 className="text-slate-light hover:text-cyan transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                 className="text-slate-light hover:text-cyan transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
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

          {/* Columna 4: Newsletter */}
          <div>
            <h3 className="text-white font-semibold mb-4">Newsletter</h3>
            <p className="text-sm mb-4">Recibe actualizaciones legales y recursos gratuitos</p>
            <form className="space-y-2">
              <input
                type="email"
                placeholder="tu@email.com"
                className="w-full px-4 py-2 rounded-lg bg-navy-light border border-navy-light 
                         focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/50
                         text-white placeholder-slate-light transition-all"
              />
              <button className="w-full px-4 py-2 bg-azure text-white font-semibold rounded-lg
                               hover:bg-cyan hover:shadow-lg hover:shadow-cyan/50 
                               transition-all duration-300">
                Suscribirse
              </button>
            </form>
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