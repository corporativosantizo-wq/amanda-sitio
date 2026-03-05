import Link from 'next/link'

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Términos y Condiciones
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
            1. Aceptación de los Términos
          </h2>
          <p className="text-slate mb-4">
            Al acceder y utilizar el sitio web amandasantizo.com, aceptas estos términos y condiciones en su totalidad. Si no estás de acuerdo con estos términos, te pedimos que no utilices este sitio.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            2. Servicios Legales
          </h2>
          <p className="text-slate mb-4">
            Los servicios legales ofrecidos a través de este sitio están sujetos a:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>La celebración de un contrato de prestación de servicios específico</li>
            <li>La legislación aplicable en Guatemala y derecho internacional</li>
            <li>Las normas éticas y deontológicas de la profesión legal</li>
          </ul>
          <p className="text-slate mb-4">
            El contenido de este sitio web es meramente informativo y no constituye asesoría legal. Para obtener asesoría específica, es necesario agendar una consulta formal.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            3. Productos Digitales
          </h2>
          <p className="text-slate mb-4">
            Los productos digitales vendidos a través de nuestra tienda (plantillas, guías, documentos):
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Son para uso personal o empresarial del comprador únicamente</li>
            <li>No pueden ser redistribuidos, revendidos o compartidos</li>
            <li>Se entregan tal cual y deben ser revisados por un profesional antes de su uso formal</li>
            <li>No constituyen asesoría legal personalizada</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            4. Política de Reembolsos
          </h2>
          <p className="text-slate mb-4">
            Debido a la naturaleza digital de nuestros productos:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>No se aceptan devoluciones una vez descargado el producto</li>
            <li>Si el producto tiene defectos técnicos, se proporcionará un reemplazo o reembolso</li>
            <li>Las solicitudes de reembolso deben hacerse dentro de los 7 días posteriores a la compra</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            5. Propiedad Intelectual
          </h2>
          <p className="text-slate mb-4">
            Todo el contenido de este sitio web, incluyendo pero no limitado a:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Textos, artículos y publicaciones del blog</li>
            <li>Imágenes, gráficos y diseños</li>
            <li>Logotipos y marcas</li>
            <li>Plantillas y documentos</li>
          </ul>
          <p className="text-slate mb-4">
            Son propiedad de Amanda Santizo o de sus respectivos propietarios y están protegidos por las leyes de propiedad intelectual.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            6. Limitación de Responsabilidad
          </h2>
          <p className="text-slate mb-4">
            Amanda Santizo no será responsable por:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Daños directos o indirectos derivados del uso de la información de este sitio</li>
            <li>Decisiones tomadas basándose en el contenido informativo del sitio</li>
            <li>Interrupciones o errores técnicos del sitio web</li>
            <li>El uso inadecuado de las plantillas o documentos adquiridos</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            7. Confidencialidad
          </h2>
          <p className="text-slate mb-4">
            Toda la información compartida durante las consultas legales está protegida por el secreto profesional, conforme a las normas éticas de la abogacía.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            8. Enlaces a Terceros
          </h2>
          <p className="text-slate mb-4">
            Este sitio puede contener enlaces a sitios web de terceros. No somos responsables del contenido, políticas de privacidad o prácticas de estos sitios externos.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            9. Ley Aplicable
          </h2>
          <p className="text-slate mb-4">
            Estos términos se rigen por las leyes de la República de Guatemala. Cualquier disputa será sometida a los tribunales competentes de Guatemala.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            10. Modificaciones
          </h2>
          <p className="text-slate mb-4">
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en el sitio.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            11. Contacto
          </h2>
          <p className="text-slate mb-4">
            Para cualquier consulta sobre estos términos y condiciones:
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
            ¿Tienes preguntas sobre estos términos?
          </p>
          <Link
            href="/contacto"
            className="inline-block px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-azure transition-colors"
          >
            Contáctame
          </Link>
        </div>
      </section>
    </div>
  )
}
