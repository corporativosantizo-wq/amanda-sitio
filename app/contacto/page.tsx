'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ContactoPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    asunto: '',
    mensaje: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')
    
    try {
      const supabase = createClient()
      
      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          name: formData.nombre,
          email: formData.email,
          phone: formData.telefono || null,
          subject: formData.asunto,
          message: formData.mensaje,
        })
      
      if (insertError) {
        throw insertError
      }
      
      setSubmitted(true)
      setFormData({ nombre: '', email: '', telefono: '', asunto: '', mensaje: '' })
    } catch (err) {
      console.error('Error sending message:', err)
      setError('Hubo un error al enviar tu mensaje. Por favor intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const contactInfo = [
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      title: 'Oficina',
      content: '12 calle 1-25 zona 10',
      subcontent: 'Edificio Geminis 10, oficina 402',
      subcontent2: 'Ciudad de Guatemala',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      title: 'Correo electrónico',
      content: 'info@amandasantizo.com',
      link: 'mailto:info@amandasantizo.com',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      title: 'Horario de atención',
      content: 'Lunes a Viernes',
      subcontent: '9:00 AM - 6:00 PM',
    },
    {
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      title: 'WhatsApp',
      content: '(502) 3015-0618',
      link: 'https://wa.me/50230150618',
      subcontent: 'Respuesta en menos de 24h',
    },
  ]

  const asuntos = [
    'Consulta general',
    'Agendar consultoría',
    'Información sobre servicios',
    'Plantillas y documentos',
    'Capacitaciones empresariales',
    'Colaboración o alianza',
    'Otro',
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-navy via-navy-dark to-navy-light py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-96 h-96 bg-cyan rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-64 h-64 bg-azure rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 text-center">
          <span className="inline-block px-4 py-2 bg-cyan/20 text-cyan font-semibold rounded-full text-sm mb-6">
            Contacto
          </span>
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Hablemos de tu{' '}
            <span className="text-cyan">proyecto legal</span>
          </h1>
          <p className="text-xl text-slate-light max-w-2xl mx-auto">
            Estoy aquí para ayudarte. Cuéntame tu situación y encontremos juntos 
            la mejor solución legal para ti o tu empresa.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* Formulario */}
            <div>
              <h2 className="font-display text-3xl font-bold text-navy mb-2">
                Envíame un mensaje
              </h2>
              <p className="text-slate mb-8">
                Completa el formulario y te responderé en menos de 24 horas.
              </p>

              {submitted ? (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="font-display text-xl font-bold text-green-800 mb-2">
                    ¡Mensaje enviado!
                  </h3>
                  <p className="text-green-700 mb-4">
                    Gracias por contactarme. Te responderé pronto.
                  </p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="text-green-600 font-semibold hover:text-green-800 transition-colors"
                  >
                    Enviar otro mensaje
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                      {error}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-semibold text-navy mb-2">
                        Nombre completo *
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan transition-all outline-none"
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-semibold text-navy mb-2">
                        Correo electrónico *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan transition-all outline-none"
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="telefono" className="block text-sm font-semibold text-navy mb-2">
                        Teléfono (opcional)
                      </label>
                      <input
                        type="tel"
                        id="telefono"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan transition-all outline-none"
                        placeholder="+502 0000 0000"
                      />
                    </div>
                    <div>
                      <label htmlFor="asunto" className="block text-sm font-semibold text-navy mb-2">
                        Asunto *
                      </label>
                      <select
                        id="asunto"
                        name="asunto"
                        value={formData.asunto}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan transition-all outline-none bg-white"
                      >
                        <option value="">Selecciona un asunto</option>
                        {asuntos.map((asunto) => (
                          <option key={asunto} value={asunto}>
                            {asunto}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="mensaje" className="block text-sm font-semibold text-navy mb-2">
                      Mensaje *
                    </label>
                    <textarea
                      id="mensaje"
                      name="mensaje"
                      value={formData.mensaje}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan transition-all outline-none resize-none"
                      placeholder="Cuéntame en qué puedo ayudarte..."
                    />
                  </div>

                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="privacidad"
                      required
                      className="mt-1 w-4 h-4 text-cyan border-slate-light rounded focus:ring-cyan"
                    />
                    <label htmlFor="privacidad" className="ml-3 text-sm text-slate">
                      Acepto la{' '}
                      <Link href="/privacidad" className="text-azure hover:text-cyan transition-colors">
                        política de privacidad
                      </Link>{' '}
                      y el tratamiento de mis datos.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-8 py-4 bg-cyan text-navy-dark font-semibold rounded-lg
                             hover:bg-white hover:shadow-lg transition-all duration-300
                             disabled:opacity-50 disabled:cursor-not-allowed
                             flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <span>Enviar mensaje</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Información de contacto */}
            <div>
              <h2 className="font-display text-3xl font-bold text-navy mb-2">
                Información de contacto
              </h2>
              <p className="text-slate mb-8">
                También puedes contactarme directamente por cualquiera de estos medios.
              </p>

              <div className="space-y-6">
                {contactInfo.map((info, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-4 p-5 bg-slate-lighter rounded-xl hover:shadow-md transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-cyan/20 rounded-lg flex items-center justify-center text-cyan flex-shrink-0">
                      {info.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-navy mb-1">{info.title}</h3>
                      {info.link ? (
                        <a
                          href={info.link}
                          className="text-azure hover:text-cyan transition-colors font-medium"
                          target={info.link.startsWith('http') ? '_blank' : undefined}
                          rel={info.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                        >
                          {info.content}
                        </a>
                      ) : (
                        <p className="text-slate">{info.content}</p>
                      )}
                      {info.subcontent && (
                        <p className="text-slate text-sm">{info.subcontent}</p>
                      )}
                      {info.subcontent2 && (
                        <p className="text-slate text-sm">{info.subcontent2}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Redes Sociales */}
              <div className="mt-10 p-6 bg-gradient-to-br from-navy to-navy-dark rounded-2xl">
                <h3 className="font-display text-xl font-bold text-white mb-4">
                  Sígueme en redes
                </h3>
                <div className="flex space-x-4">
                  <a
                    href="https://www.instagram.com/abogadasantizo/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 bg-white/10 hover:bg-cyan rounded-lg flex items-center justify-center text-white hover:text-navy-dark transition-all duration-300"
                    aria-label="Instagram"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* CTA Consulta */}
              <div className="mt-8 p-6 bg-gradient-to-br from-azure to-cyan rounded-2xl text-center">
                <h3 className="font-display text-xl font-bold text-white mb-2">
                  ¿Prefieres hablar directamente?
                </h3>
                <p className="text-navy-dark mb-4">
                  Agenda una consulta inicial gratuita de 15 minutos.
                </p>
                <a 
                  href="https://wa.me/50230150618?text=Hola%20Amanda,%20me%20gustaría%20agendar%20una%20consulta."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-navy-dark text-white font-semibold rounded-lg hover:bg-navy transition-all duration-300"
                >
                  Agendar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ rápido */}
      <section className="py-16 bg-slate-lighter">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-bold text-navy text-center mb-10">
            Preguntas frecuentes
          </h2>
          
          <div className="space-y-4">
            {[
              {
                q: '¿Cuánto tiempo tardas en responder?',
                a: 'Respondo todos los mensajes en un máximo de 24 horas hábiles. Para urgencias, te recomiendo contactarme por WhatsApp.',
              },
              {
                q: '¿Ofreces consultas virtuales?',
                a: 'Sí, atiendo tanto de forma presencial en mi oficina como por videollamada. Tú eliges lo que te sea más cómodo.',
              },
              {
                q: '¿La primera consulta tiene costo?',
                a: 'Ofrezco una llamada inicial gratuita de 15 minutos para conocer tu caso y determinar cómo puedo ayudarte.',
              },
            ].map((faq, index) => (
              <details
                key={index}
                className="group bg-white rounded-xl overflow-hidden shadow-sm"
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer font-semibold text-navy hover:text-azure transition-colors">
                  {faq.q}
                  <svg className="w-5 h-5 text-cyan transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-5 pb-5 text-slate">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}