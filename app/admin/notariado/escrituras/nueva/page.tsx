// ============================================================================
// app/admin/notariado/escrituras/nueva/page.tsx
// Formulario para crear nueva escritura
// ============================================================================

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TipoInstrumento, TIPO_INSTRUMENTO_LABEL } from '@/lib/types/enums'

const DEPARTAMENTOS = [
  'Guatemala', 'Sacatepéquez', 'Chimaltenango', 'El Progreso',
  'Escuintla', 'Santa Rosa', 'Sololá', 'Totonicapán',
  'Quetzaltenango', 'Suchitepéquez', 'Retalhuleu', 'San Marcos',
  'Huehuetenango', 'Quiché', 'Baja Verapaz', 'Alta Verapaz',
  'Petén', 'Izabal', 'Zacapa', 'Chiquimula', 'Jalapa', 'Jutiapa',
]

const TIPO_OPTIONS = Object.entries(TIPO_INSTRUMENTO_LABEL).map(([value, label]) => ({
  value, label,
}))

interface Compareciente {
  nombre: string
  dpi: string
  calidad: string
}

export default function NuevaEscrituraPage() {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    tipo_instrumento: '' as string,
    tipo_instrumento_texto: '',
    descripcion: '',
    lugar_autorizacion: 'Guatemala',
    departamento: 'Guatemala',
    fecha_autorizacion: new Date().toISOString().split('T')[0],
    notas: '',
  })
  const [comparecientes, setComparecientes] = useState<Compareciente[]>([
    { nombre: '', dpi: '', calidad: 'otorgante' },
  ])

  const addCompareciente = () => {
    setComparecientes([...comparecientes, { nombre: '', dpi: '', calidad: 'otorgante' }])
  }

  const removeCompareciente = (idx: number) => {
    if (comparecientes.length <= 1) return
    setComparecientes(comparecientes.filter((_: Compareciente, i: number) => i !== idx))
  }

  const updateCompareciente = (idx: number, field: keyof Compareciente, value: string) => {
    setComparecientes(comparecientes.map((c: Compareciente, i: number) =>
      i === idx ? { ...c, [field]: value } : c
    ))
  }

  // Auto-set tipo_instrumento_texto when tipo changes
  const handleTipoChange = (value: string) => {
    const label = TIPO_INSTRUMENTO_LABEL[value as TipoInstrumento] ?? ''
    setForm({ ...form, tipo_instrumento: value, tipo_instrumento_texto: label })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Client-side validation
    if (!form.tipo_instrumento) {
      setError('Selecciona el tipo de instrumento')
      return
    }
    if (!form.departamento) {
      setError('Selecciona el departamento')
      return
    }
    const validComps = comparecientes.filter((c: Compareciente) => c.nombre.trim())
    if (validComps.length === 0) {
      setError('Agrega al menos un compareciente')
      return
    }
    for (const c of validComps) {
      if (!c.calidad.trim()) {
        setError(`Falta la calidad para "${c.nombre}"`)
        return
      }
    }

    setGuardando(true)
    try {
      const res = await fetch('/api/admin/notariado/escrituras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          comparecientes: validComps,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear escritura')
      }

      router.push('/admin/notariado/escrituras')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/admin/notariado/escrituras" className="text-[#2d6bcf] hover:text-[#1E40AF] text-sm">
          ← Volver a escrituras
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Nueva Escritura</h1>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 max-w-2xl flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <svg className="w-5 h-5 shrink-0 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 max-w-2xl space-y-6">
        {/* Tipo de instrumento */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de instrumento *</label>
          <select
            value={form.tipo_instrumento}
            onChange={(e) => handleTipoChange(e.target.value)}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
            required
          >
            <option value="">Seleccionar...</option>
            {TIPO_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Texto del tipo (editable) */}
        {form.tipo_instrumento && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción del instrumento *</label>
            <input
              type="text"
              value={form.tipo_instrumento_texto}
              onChange={(e) => setForm({ ...form, tipo_instrumento_texto: e.target.value })}
              placeholder='Ej: "compraventa de bien inmueble"'
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
              required
            />
            <p className="text-xs text-slate-400 mt-1">Texto que aparece en documentos oficiales</p>
          </div>
        )}

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción interna</label>
          <input
            type="text"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            placeholder="Ej: Compraventa de inmueble ubicado en zona 10"
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
          />
        </div>

        {/* Comparecientes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">Comparecientes *</label>
            <button type="button" onClick={addCompareciente}
              className="text-xs text-[#2d6bcf] hover:text-[#1E40AF] font-medium">
              + Agregar
            </button>
          </div>
          <div className="space-y-3">
            {comparecientes.map((c: Compareciente, i: number) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={c.nombre}
                    onChange={(e) => updateCompareciente(i, 'nombre', e.target.value)}
                    placeholder="Nombre completo"
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={c.dpi}
                      onChange={(e) => updateCompareciente(i, 'dpi', e.target.value)}
                      placeholder="DPI (opcional)"
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
                    />
                    <select
                      value={c.calidad}
                      onChange={(e) => updateCompareciente(i, 'calidad', e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
                    >
                      <option value="otorgante">Otorgante</option>
                      <option value="comprador">Comprador</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="mandante">Mandante</option>
                      <option value="mandatario">Mandatario</option>
                      <option value="donante">Donante</option>
                      <option value="donatario">Donatario</option>
                      <option value="testador">Testador</option>
                      <option value="representante_legal">Representante Legal</option>
                    </select>
                  </div>
                </div>
                {comparecientes.length > 1 && (
                  <button type="button" onClick={() => removeCompareciente(i)}
                    className="mt-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fecha y lugar */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de autorización *</label>
            <input
              type="date"
              value={form.fecha_autorizacion}
              onChange={(e) => setForm({ ...form, fecha_autorizacion: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lugar de autorización *</label>
            <input
              type="text"
              value={form.lugar_autorizacion}
              onChange={(e) => setForm({ ...form, lugar_autorizacion: e.target.value })}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
              required
            />
          </div>
        </div>

        {/* Departamento */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Departamento *</label>
          <select
            value={form.departamento}
            onChange={(e) => setForm({ ...form, departamento: e.target.value })}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
            required
          >
            <option value="">Seleccionar...</option>
            {DEPARTAMENTOS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notas internas</label>
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] outline-none text-sm"
          />
        </div>

        {/* Botones */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={guardando}
            className="px-6 py-3 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-all text-sm"
          >
            {guardando ? 'Guardando...' : 'Crear Escritura'}
          </button>
          <Link
            href="/admin/notariado/escrituras"
            className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
