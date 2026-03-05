'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TIPOS_DOCUMENTO = [
  'Contrato',
  'Escritura',
  'Memorial/Demanda',
  'Poder',
  'Acta Notarial',
  'Otro',
]

export default function CotizacionAMedidaPage() {
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    tipo: '',
    descripcion: '',
    urgente: false,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    try {
      const supabase = createClient()

      const message = [
        `Tipo de documento: ${formData.tipo}`,
        formData.urgente ? '⚠️ URGENTE' : '',
        '',
        formData.descripcion,
      ].filter(Boolean).join('\n')

      const { error: insertError } = await supabase
        .from('contacts')
        .insert({
          name: formData.nombre,
          email: formData.email,
          phone: formData.telefono || null,
          subject: 'Cotización a la medida',
          message,
        })

      if (insertError) throw insertError

      setSubmitted(true)
    } catch (err) {
      console.error('Error sending request:', err)
      setError('Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center py-20">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold text-navy mb-4">
            ¡Solicitud recibida!
          </h1>
          <p className="text-slate text-lg mb-8">
            Recibimos tu solicitud. Te enviaremos una cotización en máximo 24 horas hábiles.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tienda"
              className="px-6 py-3 border-2 border-navy text-navy font-semibold rounded-lg hover:bg-navy hover:text-white transition-all duration-300"
            >
              Volver a la tienda
            </Link>
            <Link
              href="/"
              className="px-6 py-3 text-slate hover:text-navy font-medium transition-colors"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-br from-navy via-navy-dark to-navy-light py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <nav className="flex items-center justify-center space-x-2 text-sm text-slate-light mb-8">
            <Link href="/" className="hover:text-cyan transition-colors">Inicio</Link>
            <span>/</span>
            <Link href="/tienda" className="hover:text-cyan transition-colors">Tienda</Link>
            <span>/</span>
            <span className="text-white">Cotización a la medida</span>
          </nav>
          <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
            Solicitar documento <span className="text-cyan">a la medida</span>
          </h1>
          <p className="text-lg text-slate-light max-w-2xl mx-auto">
            ¿No encuentras exactamente lo que necesitas? Creo documentos legales personalizados para tu situación específica.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <section className="py-16">
        <div className="max-w-2xl mx-auto px-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nombre */}
            <div>
              <label htmlFor="nombre" className="block text-sm font-semibold text-navy mb-2">
                Nombre completo *
              </label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                required
                value={formData.nombre}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan outline-none transition-colors"
                placeholder="Tu nombre completo"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-navy mb-2">
                Correo electrónico *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan outline-none transition-colors"
                placeholder="tu@email.com"
              />
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-sm font-semibold text-navy mb-2">
                Teléfono <span className="text-slate font-normal">(opcional)</span>
              </label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan outline-none transition-colors"
                placeholder="+502 1234 5678"
              />
            </div>

            {/* Tipo de documento */}
            <div>
              <label htmlFor="tipo" className="block text-sm font-semibold text-navy mb-2">
                Tipo de documento *
              </label>
              <select
                id="tipo"
                name="tipo"
                required
                value={formData.tipo}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan outline-none transition-colors bg-white"
              >
                <option value="">Selecciona un tipo</option>
                {TIPOS_DOCUMENTO.map((tipo) => (
                  <option key={tipo} value={tipo}>{tipo}</option>
                ))}
              </select>
            </div>

            {/* Descripción */}
            <div>
              <label htmlFor="descripcion" className="block text-sm font-semibold text-navy mb-2">
                Describe lo que necesitas *
              </label>
              <textarea
                id="descripcion"
                name="descripcion"
                required
                rows={5}
                value={formData.descripcion}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-light rounded-lg focus:ring-2 focus:ring-cyan focus:border-cyan outline-none transition-colors resize-y"
                placeholder="Ej: Necesito un contrato de arrendamiento para un local comercial en zona 10, con cláusulas de renovación automática y penalización por terminación anticipada..."
              />
            </div>

            {/* Urgente */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="urgente"
                name="urgente"
                checked={formData.urgente}
                onChange={(e) => setFormData({ ...formData, urgente: e.target.checked })}
                className="mt-1 w-4 h-4 text-cyan border-slate-light rounded focus:ring-cyan"
              />
              <label htmlFor="urgente" className="text-sm text-slate">
                <span className="font-semibold text-navy">Es urgente</span>
                <br />
                Necesito el documento lo antes posible (puede aplicar un cargo adicional por urgencia)
              </label>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-cyan text-navy-dark font-bold text-lg rounded-lg hover:bg-navy hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Enviando solicitud...' : 'Solicitar cotización'}
            </button>
          </form>

          {/* Info adicional */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            {[
              { icon: '⏱️', title: 'Respuesta rápida', desc: 'Máximo 24 horas hábiles' },
              { icon: '💬', title: 'Sin compromiso', desc: 'Cotización gratuita' },
              { icon: '✅', title: 'A tu medida', desc: 'Documento personalizado' },
            ].map((item, i) => (
              <div key={i} className="p-4">
                <span className="text-3xl">{item.icon}</span>
                <h3 className="font-semibold text-navy mt-2">{item.title}</h3>
                <p className="text-slate text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
