'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const TIPOS_ACTO = [
  'Compraventa',
  'Donación',
  'Mandato',
  'Sociedad Anónima',
  'Sociedad de Responsabilidad Limitada',
  'Poder General',
  'Poder Especial',
  'Testamento',
  'Mutuo',
  'Arrendamiento',
  'Capitulaciones Matrimoniales',
  'Unión de Hecho',
  'Cancelación',
  'Protocolación',
  'Otro',
]

export default function NuevaEscrituraPage() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [form, setForm] = useState({
    tipo_acto: '',
    descripcion: '',
    otorgantes: '',
    lugar_autorizacion: 'Guatemala',
    fecha_autorizacion: new Date().toISOString().split('T')[0],
    notas: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)

    try {
      const otorgantesArray = form.otorgantes
        .split('\n')
        .map(o => o.trim())
        .filter(Boolean)
        .map(nombre => ({ nombre, dpi: '', rol: 'otorgante' }))

      const res = await fetch('/api/admin/notariado/escrituras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          otorgantes: otorgantesArray,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear escritura')
      }

      router.push('/admin/notariado/escrituras')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/notariado/escrituras" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Volver a escrituras
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Nueva Escritura</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-6">
        {/* Tipo de acto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de acto *</label>
          <select
            value={form.tipo_acto}
            onChange={(e) => setForm({ ...form, tipo_acto: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          >
            <option value="">Seleccionar...</option>
            {TIPOS_ACTO.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Ej: Compraventa de inmueble ubicado en zona 10"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Otorgantes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Otorgantes (uno por línea) *</label>
          <textarea
            value={form.otorgantes}
            onChange={(e) => setForm({ ...form, otorgantes: e.target.value })}
            placeholder={"Juan Pérez García\nMaría López Rodríguez"}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        {/* Fecha y lugar */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de autorización *</label>
            <input
              type="date"
              value={form.fecha_autorizacion}
              onChange={(e) => setForm({ ...form, fecha_autorizacion: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lugar de autorización *</label>
            <input
              type="text"
              value={form.lugar_autorizacion}
              onChange={(e) => setForm({ ...form, lugar_autorizacion: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Crear Escritura'}
          </button>
          <Link
            href="/admin/notariado/escrituras"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
