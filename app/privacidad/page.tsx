import Link from 'next/link'

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">
            Política de Privacidad
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
            1. Información que Recopilamos
          </h2>
          <p className="text-slate mb-4">
            En Amanda Santizo - Derecho Internacional, recopilamos información que nos proporcionas directamente cuando:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Completas el formulario de contacto</li>
            <li>Te suscribes a nuestro boletín</li>
            <li>Realizas una compra en nuestra tienda</li>
            <li>Solicitas una consulta legal</li>
          </ul>
          <p className="text-slate mb-4">
            Esta información puede incluir: nombre, correo electrónico, número de teléfono, empresa y detalles de tu consulta.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            2. Uso de la Información
          </h2>
          <p className="text-slate mb-4">
            Utilizamos la información recopilada para:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Responder a tus consultas y solicitudes</li>
            <li>Proporcionar servicios legales solicitados</li>
            <li>Enviar información relevante sobre nuestros servicios (si lo has autorizado)</li>
            <li>Procesar transacciones y enviar productos digitales</li>
            <li>Mejorar nuestro sitio web y servicios</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            3. Protección de Datos
          </h2>
          <p className="text-slate mb-4">
            Implementamos medidas de seguridad técnicas y organizativas para proteger tu información personal contra acceso no autorizado, alteración, divulgación o destrucción.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            4. Compartir Información
          </h2>
          <p className="text-slate mb-4">
            No vendemos, comercializamos ni transferimos tu información personal a terceros, excepto:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Proveedores de servicios que nos ayudan a operar el sitio (hosting, procesamiento de pagos)</li>
            <li>Cuando sea requerido por ley</li>
            <li>Para proteger nuestros derechos legales</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            5. Tus Derechos
          </h2>
          <p className="text-slate mb-4">
            Tienes derecho a:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Acceder a tus datos personales</li>
            <li>Rectificar datos inexactos</li>
            <li>Solicitar la eliminación de tus datos</li>
            <li>Oponerte al procesamiento de tus datos</li>
            <li>Retirar tu consentimiento en cualquier momento</li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            6. Cookies
          </h2>
          <p className="text-slate mb-4">
            Nuestro sitio utiliza cookies para mejorar tu experiencia. Para más información, consulta nuestra{' '}
            <Link href="/cookies" className="text-azure hover:text-cyan">
              Política de Cookies
            </Link>.
          </p>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            7. Contacto
          </h2>
          <p className="text-slate mb-4">
            Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en:
          </p>
          <ul className="text-slate mb-6 list-disc pl-6 space-y-2">
            <li>Email: info@amandasantizo.com</li>
            <li>A través de nuestro <Link href="/contacto" className="text-azure hover:text-cyan">formulario de contacto</Link></li>
          </ul>

          <h2 className="font-display text-2xl font-bold text-navy mt-8 mb-4">
            8. Cambios a esta Política
          </h2>
          <p className="text-slate mb-4">
            Nos reservamos el derecho de actualizar esta política de privacidad en cualquier momento. Te notificaremos sobre cambios significativos publicando la nueva política en esta página.
          </p>

        </div>
      </section>

      {/* CTA */}
      <section className="py-12 bg-slate-lighter">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-slate mb-4">
            ¿Tienes dudas sobre cómo manejamos tu información?
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
