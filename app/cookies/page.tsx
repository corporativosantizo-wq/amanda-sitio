import Link from 'next/link'

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Política de Cookies
          </h1>
          <p className="text-slate-light">
            Última actualización: Enero 2026
          </p>
        </div>
      </section>

      {/* Contenido */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-6 prose prose-lg">
          
          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            1. ¿Qué son las Cookies?
          </h2>
          <p className="text-slate mb-4">
            Las cookies son pequeños archivos de texto que se almacenan en tu dispositivo cuando visitas un sitio web. Se utilizan ampliamente para hacer que los sitios web funcionen de manera más eficiente y proporcionar información a los propietarios del sitio.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            2. Tipos de Cookies que Utilizamos
          </h2>
          
          <h3 className="font-display text-xl font-bold text-navy mt-6 mb-3">
            Cookies Esenciales
          </h3>
          <p className="text-slate mb-4">
            Son necesarias para el funcionamiento básico del sitio web. Incluyen cookies que permiten:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Navegar por el sitio y usar sus funciones</li>
            <li>Recordar información que has introducido en formularios</li>
            <li>Mantener tu sesión activa</li>
          </ul>

          <h3 className="font-display text-xl font-bold text-navy mt-6 mb-3">
            Cookies de Rendimiento
          </h3>
          <p className="text-slate mb-4">
            Nos ayudan a entender cómo los visitantes interactúan con nuestro sitio, recopilando información de forma anónima:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Páginas más visitadas</li>
            <li>Tiempo de permanencia en el sitio</li>
            <li>Errores que puedan ocurrir</li>
          </ul>

          <h3 className="font-display text-xl font-bold text-navy mt-6 mb-3">
            Cookies de Funcionalidad
          </h3>
          <p className="text-slate mb-4">
            Permiten recordar tus preferencias para proporcionarte una experiencia personalizada:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Idioma preferido</li>
            <li>Región o ubicación</li>
            <li>Preferencias de visualización</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            3. Cookies de Terceros
          </h2>
          <p className="text-slate mb-4">
            Nuestro sitio puede utilizar servicios de terceros que establecen sus propias cookies:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li><strong>Vercel Analytics:</strong> Para análisis de rendimiento del sitio</li>
            <li><strong>Stripe:</strong> Para procesar pagos de forma segura</li>
            <li><strong>Supabase:</strong> Para gestión de datos y autenticación</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            4. Control de Cookies
          </h2>
          <p className="text-slate mb-4">
            Puedes controlar y gestionar las cookies de varias formas:
          </p>
          
          <h3 className="font-display text-xl font-bold text-navy mt-6 mb-3">
            Configuración del Navegador
          </h3>
          <p className="text-slate mb-4">
            La mayoría de los navegadores te permiten:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Ver las cookies almacenadas y eliminarlas individualmente</li>
            <li>Bloquear cookies de terceros</li>
            <li>Bloquear todas las cookies</li>
            <li>Eliminar todas las cookies al cerrar el navegador</li>
          </ul>

          <h3 className="font-display text-xl font-bold text-navy mt-6 mb-3">
            Enlaces a Configuración de Navegadores
          </h3>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-azure hover:text-cyan">Google Chrome</a></li>
            <li><a href="https://support.mozilla.org/es/kb/cookies-informacion-que-los-sitios-web-guardan-en-" target="_blank" rel="noopener noreferrer" className="text-azure hover:text-cyan">Mozilla Firefox</a></li>
            <li><a href="https://support.apple.com/es-es/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-azure hover:text-cyan">Safari</a></li>
            <li><a href="https://support.microsoft.com/es-es/microsoft-edge/eliminar-las-cookies-en-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-azure hover:text-cyan">Microsoft Edge</a></li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            5. Consecuencias de Desactivar Cookies
          </h2>
          <p className="text-slate mb-4">
            Si decides desactivar las cookies, ten en cuenta que:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Algunas funciones del sitio pueden no funcionar correctamente</li>
            <li>No podremos recordar tus preferencias</li>
            <li>El proceso de compra puede verse afectado</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            6. Actualizaciones de esta Política
          </h2>
          <p className="text-slate mb-4">
            Podemos actualizar esta política de cookies periódicamente para reflejar cambios en las cookies que utilizamos o por otras razones operativas, legales o regulatorias.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            7. Contacto
          </h2>
          <p className="text-slate mb-4">
            Si tienes preguntas sobre nuestra política de cookies:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Email: info@amandasantizo.com</li>
            <li>A través de nuestro <Link href="/contacto" className="text-azure hover:text-cyan">formulario de contacto</Link></li>
          </ul>

        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-slate-lighter">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-slate mb-4">
            Para más información sobre cómo protegemos tu privacidad
          </p>
          <Link
            href="/privacidad"
            className="inline-block px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-azure transition-colors"
          >
            Ver Política de Privacidad
          </Link>
        </div>
      </section>
    </div>
  )
}
