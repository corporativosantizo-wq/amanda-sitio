'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useFetch, useMutate } from '@/lib/hooks/use-fetch'
import type { CobroConCliente, Pago, RecordatorioCobro } from '@/lib/types'

// ── Types ───────────────────────────────────────────────────────────────────

interface Resumen {
  total_pendiente: number
  total_vencido: number
  por_vencer_7d: number
  cobrado_mes: number
  count_pendientes: number
  count_vencidos: number
  count_por_vencer: number
  count_cobrado_mes: number
}

interface CobroDetalle extends CobroConCliente {
  pagos: Pago[]
  recordatorios: RecordatorioCobro[]
}

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  pendiente: 'bg-amber-100 text-amber-700',
  parcial: 'bg-blue-100 text-blue-700',
  pagado: 'bg-green-100 text-green-700',
  vencido: 'bg-red-100 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

const METODOS = [
  { value: 'transferencia_gyt', label: 'Transferencia G&T' },
  { value: 'transferencia_bi', label: 'Transferencia BI' },
  { value: 'deposito_gyt', label: 'Depósito G&T' },
  { value: 'deposito_bi', label: 'Depósito BI' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'otro', label: 'Otro' },
]

const Q = (n: number) => `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`

function diasVencido(fechaVencimiento: string | null): number {
  if (!fechaVencimiento) return 0
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento + 'T12:00:00')
  const diff = Math.floor((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
  return diff
}

function estadoVisual(c: CobroConCliente): { icon: string; color: string } {
  if (c.estado === 'pagado') return { icon: '✅', color: 'text-green-600' }
  if (c.estado === 'cancelado') return { icon: '⚪', color: 'text-gray-400' }
  const dias = diasVencido(c.fecha_vencimiento)
  if (dias > 0) return { icon: '🔴', color: 'text-red-600' }
  if (dias >= -7) return { icon: '🟡', color: 'text-amber-600' }
  return { icon: '🟢', color: 'text-green-600' }
}

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export default function ContabilidadPage() {
  const [filtro, setFiltro] = useState('pendientes')
  const [showNuevo, setShowNuevo] = useState(false)
  const [showPago, setShowPago] = useState<CobroConCliente | null>(null)
  const [showDetalle, setShowDetalle] = useState<string | null>(null)

  // API params based on filter
  const apiParams = filtro === 'todos' ? '' :
    filtro === 'pendientes' ? '&estado=pendiente' :
    filtro === 'vencidos' ? '&estado=vencidos' :
    filtro === 'parcial' ? '&estado=parcial' :
    filtro === 'pagados' ? '&estado=pagado' : ''

  const { data: resumen, refetch: refetchResumen } = useFetch<Resumen>('/api/admin/cobros?resumen=true')
  const { data: cobrosData, refetch: refetchCobros } = useFetch<{ data: CobroConCliente[]; total: number }>(
    `/api/admin/cobros?limit=100${apiParams}`
  )
  const { mutate } = useMutate()

  const cobros = cobrosData?.data ?? []

  const refetchAll = () => { refetchResumen(); refetchCobros() }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cobros y Pagos</h1>
          <p className="text-sm text-gray-500 mt-1">Cuentas por cobrar del despacho</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/contabilidad/cotizaciones" className="px-3 py-2 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            Cotizaciones
          </Link>
          <Link href="/admin/contabilidad/facturas" className="px-3 py-2 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            Facturas
          </Link>
          <Link href="/admin/contabilidad/gastos" className="px-3 py-2 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            Gastos
          </Link>
          <Link href="/admin/contabilidad/reportes" className="px-3 py-2 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-50">
            Reportes
          </Link>
          <button
            onClick={() => setShowNuevo(true)}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition"
          >
            + Nuevo cobro
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {resumen && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard icon="💰" label="Total pendiente" value={Q(resumen.total_pendiente)} sub={`${resumen.count_pendientes} cobros`} color="text-slate-800" bg="bg-white" />
          <SummaryCard icon="🔴" label="Vencidos" value={Q(resumen.total_vencido)} sub={`${resumen.count_vencidos} cobros`} color="text-red-700" bg="bg-red-50" />
          <SummaryCard icon="🟡" label="Por vencer (7 días)" value={Q(resumen.por_vencer_7d)} sub={`${resumen.count_por_vencer} cobros`} color="text-amber-700" bg="bg-amber-50" />
          <SummaryCard icon="🟢" label="Cobrado este mes" value={Q(resumen.cobrado_mes)} sub={`${resumen.count_cobrado_mes} pagos confirmados`} color="text-green-700" bg="bg-green-50" />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {['todos', 'pendientes', 'vencidos', 'parcial', 'pagados'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition ${
              filtro === f ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Quick add */}
      <CobroRapido
        onCreated={refetchAll}
        onOpenForm={() => setShowNuevo(true)}
        mutate={mutate}
      />

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3 text-right">Días</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cobros.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-400">
                  No hay cobros para mostrar
                </td>
              </tr>
            ) : (
              cobros.map((c: CobroConCliente) => {
                const vis = estadoVisual(c)
                const dias = diasVencido(c.fecha_vencimiento)
                const esVencido = dias > 0 && c.estado !== 'pagado' && c.estado !== 'cancelado'
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50 cursor-pointer ${esVencido ? 'bg-red-50/40' : ''}`}
                    onClick={() => setShowDetalle(c.id)}
                  >
                    <td className="px-4 py-3 text-center">{vis.icon}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">COB-{String(c.numero_cobro).padStart(3, '0')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{c.concepto}</td>
                    <td className="px-4 py-3 text-right font-medium">{Q(c.monto)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{c.monto_pagado > 0 ? Q(c.monto_pagado) : '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{Q(c.saldo_pendiente)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${ESTADO_BADGE[c.estado] ?? 'bg-gray-100'}`}>
                        {c.estado.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {c.fecha_vencimiento
                        ? new Date(c.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className={`px-4 py-3 text-right text-xs font-mono ${esVencido ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                      {c.estado === 'pagado' || c.estado === 'cancelado' ? '—' : dias > 0 ? `+${dias}` : dias === 0 ? 'Hoy' : `${dias}`}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        {c.estado !== 'pagado' && c.estado !== 'cancelado' && (
                          <>
                            <button
                              onClick={() => setShowPago(c)}
                              className="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded-md hover:bg-green-200 font-medium"
                            >
                              Pago
                            </button>
                            <button
                              onClick={async () => {
                                await mutate(`/api/admin/cobros/${c.id}`, {
                                  method: 'POST',
                                  body: { accion: 'enviar_recordatorio' },
                                  onSuccess: () => refetchAll(),
                                })
                              }}
                              className="px-2 py-1 text-[10px] bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 font-medium"
                            >
                              Cobrar
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setShowDetalle(c.id)}
                          className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 font-medium"
                        >
                          Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Nuevo Cobro */}
      {showNuevo && (
        <NuevoCobroModal
          onClose={() => setShowNuevo(false)}
          onCreated={() => { setShowNuevo(false); refetchAll() }}
          mutate={mutate}
        />
      )}

      {/* Modal: Registrar Pago */}
      {showPago && (
        <RegistrarPagoModal
          cobro={showPago}
          onClose={() => setShowPago(null)}
          onSaved={() => { setShowPago(null); refetchAll() }}
          mutate={mutate}
        />
      )}

      {/* Modal: Detalle de Cobro */}
      {showDetalle && (
        <CobroDetalleModal
          cobroId={showDetalle}
          onClose={() => setShowDetalle(null)}
          onPago={(cobro) => { setShowDetalle(null); setShowPago(cobro) }}
          onUpdated={refetchAll}
          mutate={mutate}
        />
      )}
    </div>
  )
}

// ── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, color, bg }: {
  icon: string; label: string; value: string; sub: string; color: string; bg: string
}) {
  return (
    <div className={`${bg} border rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>
    </div>
  )
}

// ── Cobro Rápido ────────────────────────────────────────────────────────────

interface ParsedCobro {
  clienteNombre: string | null
  clienteId: string | null
  monto: number
  concepto: string
  fechaVence: string
}

function parsearCobroRapido(input: string): ParsedCobro | null {
  // Extract monto: Q3,000 or Q3000 or Q3,000.50 or Q 3000
  const montoMatch = input.match(/Q\s?([\d,]+(?:\.\d{1,2})?)/i)
  if (!montoMatch) return null

  const montoStr = montoMatch[1].replace(/,/g, '')
  const monto = parseFloat(montoStr)
  if (isNaN(monto) || monto <= 0) return null

  // Remove the monto from input to parse the rest
  const sinMonto = input.replace(montoMatch[0], '').trim()

  // Split by common separators: " - ", " – ", " — "
  const partes = sinMonto.split(/\s*[-–—]\s*/).map((p: string) => p.trim()).filter(Boolean)

  let clienteNombre: string | null = null
  let concepto = ''

  if (partes.length >= 2) {
    // First part is likely client, rest is concepto
    clienteNombre = partes[0]
    concepto = partes.slice(1).join(' - ')
  } else if (partes.length === 1) {
    const parte = partes[0]
    // Heuristic: if it looks like a name (2+ capitalized words), treat as client
    const words = parte.split(/\s+/)
    const looksLikeName = words.length >= 2 && words.every((w: string) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    if (looksLikeName) {
      clienteNombre = parte
    } else {
      concepto = parte
    }
  }

  // Calculate vencimiento (30 days from today)
  const vence = new Date()
  vence.setDate(vence.getDate() + 30)
  const fechaVence = vence.toISOString().split('T')[0]

  return { clienteNombre, clienteId: null, monto, concepto, fechaVence }
}

function CobroRapido({ onCreated, onOpenForm, mutate }: {
  onCreated: () => void
  onOpenForm: () => void
  mutate: any
}) {
  const [input, setInput] = useState('')
  const [preview, setPreview] = useState<ParsedCobro | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [matchedCliente, setMatchedCliente] = useState<{ id: string; nombre: string } | null>(null)
  const [searchingCliente, setSearchingCliente] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const buscarCliente = useCallback(async (nombre: string): Promise<{ id: string; nombre: string } | null> => {
    if (!nombre || nombre.length < 2) return null
    try {
      const res = await fetch(`/api/admin/clientes?q=${encodeURIComponent(nombre)}&limit=1`)
      if (!res.ok) return null
      const json = await res.json()
      if (json.data && json.data.length > 0) {
        return { id: json.data[0].id, nombre: json.data[0].nombre }
      }
    } catch {}
    return null
  }, [])

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !input.trim()) return
    e.preventDefault()
    setError('')

    const parsed = parsearCobroRapido(input.trim())
    if (!parsed) {
      setError('Incluye el monto con Q (ej: Q3,000)')
      return
    }

    // Try to match client
    if (parsed.clienteNombre) {
      setSearchingCliente(true)
      const match = await buscarCliente(parsed.clienteNombre)
      setSearchingCliente(false)
      if (match) {
        parsed.clienteId = match.id
        setMatchedCliente(match)
      } else {
        setMatchedCliente(null)
      }
    }

    setPreview(parsed)
  }

  const handleCrear = async () => {
    if (!preview) return
    setSaving(true)
    await mutate('/api/admin/cobros', {
      method: 'POST',
      body: {
        cliente_id: preview.clienteId || null,
        concepto: preview.concepto || (preview.clienteNombre ? `Cobro - ${preview.clienteNombre}` : 'Cobro pendiente'),
        monto: preview.monto,
        dias_credito: 30,
        notas: null,
      },
      onSuccess: () => {
        setInput('')
        setPreview(null)
        setMatchedCliente(null)
        onCreated()
      },
    })
    setSaving(false)
  }

  const handleCancelar = () => {
    setPreview(null)
    setMatchedCliente(null)
    setError('')
    inputRef.current?.focus()
  }

  const fechaVenceLabel = preview
    ? new Date(preview.fechaVence + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''

  return (
    <div className="mb-4">
      {/* Input row */}
      {!preview && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              placeholder="Cobro rápido: Roberto Salazar - Contrato arrendamiento - Q3,000"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition ${
                error ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-teal-500 bg-white'
              }`}
            />
            {searchingCliente && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">Buscando...</span>
            )}
          </div>
          <button
            onClick={onOpenForm}
            title="Formulario completo"
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-teal-600 transition text-sm font-bold"
          >
            +
          </button>
        </div>
      )}

      {/* Error */}
      {error && !preview && (
        <p className="text-xs text-red-500 mt-1.5 ml-1">{error}</p>
      )}

      {/* Preview */}
      {preview && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-teal-900">
              <span className="font-medium">Cobro:</span>{' '}
              {matchedCliente ? (
                <span className="font-semibold">{matchedCliente.nombre}</span>
              ) : preview.clienteNombre ? (
                <span>{preview.clienteNombre} <span className="text-teal-600 text-xs">(no encontrado en BD)</span></span>
              ) : null}
              {(matchedCliente || preview.clienteNombre) && ' — '}
              <span className="font-bold">{Q(preview.monto)}</span>
              {preview.concepto && ` — ${preview.concepto}`}
              {' — '}
              <span className="text-teal-700">Vence {fechaVenceLabel}</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleCrear}
              disabled={saving}
              className="px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? '...' : 'Crear'}
            </button>
            <button
              onClick={onOpenForm}
              className="px-3 py-1.5 bg-white text-teal-700 text-xs font-semibold rounded-lg border border-teal-300 hover:bg-teal-100"
            >
              Editar
            </button>
            <button
              onClick={handleCancelar}
              className="px-3 py-1.5 text-teal-600 text-xs font-semibold rounded-lg hover:bg-teal-100"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal: Detalle de Cobro ────────────────────────────────────────────────

function CobroDetalleModal({ cobroId, onClose, onPago, onUpdated, mutate }: {
  cobroId: string
  onClose: () => void
  onPago: (cobro: CobroConCliente) => void
  onUpdated: () => void
  mutate: any
}) {
  const { data: cobro, refetch } = useFetch<CobroDetalle>(`/api/admin/cobros/${cobroId}`)
  const [sending, setSending] = useState(false)

  if (!cobro) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-400">Cargando...</p>
        </div>
      </div>
    )
  }

  const porcentaje = cobro.monto > 0 ? Math.min((cobro.monto_pagado / cobro.monto) * 100, 100) : 0
  const vis = estadoVisual(cobro)
  const dias = diasVencido(cobro.fecha_vencimiento)
  const esVencido = dias > 0 && cobro.estado !== 'pagado' && cobro.estado !== 'cancelado'
  const esPagado = cobro.estado === 'pagado'

  const handleRecordatorio = async () => {
    setSending(true)
    await mutate(`/api/admin/cobros/${cobroId}`, {
      method: 'POST',
      body: { accion: 'enviar_recordatorio' },
      onSuccess: () => { refetch(); onUpdated() },
    })
    setSending(false)
  }

  const handleMarcarPagado = async () => {
    await mutate(`/api/admin/cobros/${cobroId}`, {
      method: 'PATCH',
      body: { estado: 'pagado' },
      onSuccess: () => { refetch(); onUpdated() },
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">{vis.icon}</span>
                <h2 className="text-lg font-bold text-gray-900">
                  COB-{String(cobro.numero_cobro).padStart(3, '0')}
                </h2>
                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${ESTADO_BADGE[cobro.estado]}`}>
                  {cobro.estado.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{cobro.concepto}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Client & dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Cliente</p>
              <p className="text-sm font-semibold text-gray-900">{cobro.cliente?.nombre ?? '—'}</p>
              {cobro.cliente?.email && <p className="text-xs text-gray-400">{cobro.cliente.email}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Vencimiento</p>
              <p className={`text-sm font-semibold ${esVencido ? 'text-red-600' : 'text-gray-900'}`}>
                {cobro.fecha_vencimiento
                  ? new Date(cobro.fecha_vencimiento + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Sin fecha'}
                {esVencido && <span className="text-xs ml-2 text-red-500">({dias} días vencido)</span>}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-xs text-gray-500 font-medium">Progreso de pago</p>
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-green-600">{Q(cobro.monto_pagado)}</span>
                <span className="mx-1">/</span>
                <span className="font-semibold text-gray-700">{Q(cobro.monto)}</span>
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${esPagado ? 'bg-green-500' : porcentaje > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                style={{ width: `${porcentaje}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <p className="text-[10px] text-gray-400">{porcentaje.toFixed(0)}% pagado</p>
              <p className="text-[10px] text-gray-400">Saldo: {Q(cobro.saldo_pendiente)}</p>
            </div>
          </div>

          {/* Pagos list */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Pagos registrados ({cobro.pagos?.length ?? 0})</p>
            {cobro.pagos && cobro.pagos.length > 0 ? (
              <div className="border rounded-lg divide-y">
                {cobro.pagos.map((p: Pago) => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{Q(p.monto)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.fecha_pago + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.metodo && <span className="ml-2">{p.metodo.replace(/_/g, ' ')}</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                        p.estado === 'confirmado' ? 'bg-green-100 text-green-700' :
                        p.estado === 'rechazado' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {p.estado}
                      </span>
                      {p.referencia_bancaria && (
                        <p className="text-[10px] text-gray-400 mt-0.5">Ref: {p.referencia_bancaria}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Sin pagos registrados</p>
            )}
          </div>

          {/* Recordatorios history */}
          {cobro.recordatorios && cobro.recordatorios.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Historial de recordatorios</p>
              <div className="space-y-1">
                {cobro.recordatorios.map((r: RecordatorioCobro) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{r.email_enviado ? '📧' : '⚠️'}</span>
                    <span className="capitalize">{r.tipo.replace(/_/g, ' ')}</span>
                    <span className="text-gray-300">·</span>
                    <span>{new Date(r.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}</span>
                    {r.resultado && <span className="text-gray-300">· {r.resultado}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {cobro.notas && (
            <div>
              <p className="text-xs text-gray-500 font-medium mb-1">Notas</p>
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{cobro.notas}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {cobro.estado !== 'cancelado' && (
          <div className="p-6 border-t bg-gray-50 rounded-b-2xl flex items-center gap-2 flex-wrap">
            {!esPagado && (
              <>
                <button
                  onClick={() => onPago(cobro)}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700"
                >
                  Registrar pago
                </button>
                <button
                  onClick={handleRecordatorio}
                  disabled={sending}
                  className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {sending ? 'Enviando...' : 'Enviar recordatorio'}
                </button>
                <button
                  onClick={handleMarcarPagado}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700"
                >
                  Marcar como pagado
                </button>
              </>
            )}
            {esPagado && !cobro.factura_solicitada && (
              <button
                onClick={async () => {
                  await mutate(`/api/admin/cobros/${cobroId}`, {
                    method: 'PATCH',
                    body: { factura_solicitada: true, factura_solicitada_at: new Date().toISOString() },
                    onSuccess: () => { refetch(); onUpdated() },
                  })
                }}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700"
              >
                Solicitar factura a RE
              </button>
            )}
            {esPagado && cobro.factura_solicitada && (
              <span className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-semibold rounded-lg">
                Factura solicitada ✓
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Modal: Nuevo Cobro ──────────────────────────────────────────────────────

function NuevoCobroModal({ onClose, onCreated, mutate }: {
  onClose: () => void
  onCreated: () => void
  mutate: any
}) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [diasCredito, setDiasCredito] = useState('30')
  const [notas, setNotas] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: clientesData } = useFetch<{ data: any[] }>(
    clienteSearch.length >= 2 ? `/api/admin/clientes?q=${encodeURIComponent(clienteSearch)}&limit=5` : null
  )

  const handleSubmit = async () => {
    if (!concepto || !monto) return
    setSaving(true)
    await mutate('/api/admin/cobros', {
      method: 'POST',
      body: {
        cliente_id: clienteId || null,
        concepto,
        monto: parseFloat(monto),
        dias_credito: parseInt(diasCredito) || 30,
        notas: notas || null,
      },
      onSuccess: onCreated,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Nuevo Cobro</h2>

        {/* Cliente search */}
        <div className="mb-3">
          <label className="text-xs text-gray-500 font-medium">Cliente (opcional)</label>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={clienteSearch}
            onChange={(e) => { setClienteSearch(e.target.value); setClienteId('') }}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
          />
          {clientesData?.data && clientesData.data.length > 0 && !clienteId && (
            <div className="border rounded-lg mt-1 bg-white shadow-sm max-h-32 overflow-y-auto">
              {clientesData.data.map((cl: any) => (
                <button
                  key={cl.id}
                  onClick={() => { setClienteId(cl.id); setClienteSearch(cl.nombre) }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-teal-50 flex justify-between"
                >
                  <span className="font-medium">{cl.nombre}</span>
                  <span className="text-gray-400 text-xs">{cl.email ?? ''}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-500 font-medium">Concepto *</label>
          <input
            type="text"
            placeholder="Ej: Constitución de sociedad"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Monto (Q) *</label>
            <input
              type="number"
              step="0.01"
              placeholder="5000.00"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Días de crédito</label>
            <select
              value={diasCredito}
              onChange={(e) => setDiasCredito(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
            >
              <option value="15">15 días</option>
              <option value="30">30 días</option>
              <option value="45">45 días</option>
              <option value="60">60 días</option>
              <option value="90">90 días</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 font-medium">Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500 resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!concepto || !monto || saving}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creando...' : 'Crear cobro'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal: Registrar Pago ───────────────────────────────────────────────────

function RegistrarPagoModal({ cobro, onClose, onSaved, mutate }: {
  cobro: CobroConCliente
  onClose: () => void
  onSaved: () => void
  mutate: any
}) {
  const [monto, setMonto] = useState(cobro.saldo_pendiente.toString())
  const [metodo, setMetodo] = useState('transferencia_gyt')
  const [referencia, setReferencia] = useState('')
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!monto || parseFloat(monto) <= 0) return
    setSaving(true)
    await mutate(`/api/admin/cobros/${cobro.id}`, {
      method: 'POST',
      body: {
        accion: 'registrar_pago',
        monto: parseFloat(monto),
        metodo,
        referencia_bancaria: referencia || null,
        fecha_pago: fechaPago,
      },
      onSuccess: onSaved,
    })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Registrar Pago</h2>
        <p className="text-sm text-gray-500 mb-4">
          COB-{String(cobro.numero_cobro).padStart(3, '0')} · {cobro.cliente?.nombre} · Saldo: {Q(cobro.saldo_pendiente)}
        </p>

        <div className="mb-3">
          <label className="text-xs text-gray-500 font-medium">Monto (Q)</label>
          <input
            type="number"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
          />
        </div>

        <div className="mb-3">
          <label className="text-xs text-gray-500 font-medium">Método de pago</label>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value)}
            className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
          >
            {METODOS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-500 font-medium">Referencia bancaria</label>
            <input
              type="text"
              placeholder="Número de boleta"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Fecha de pago</label>
            <input
              type="date"
              value={fechaPago}
              onChange={(e) => setFechaPago(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!monto || parseFloat(monto) <= 0 || saving}
            className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Registrando...' : 'Confirmar pago'}
          </button>
        </div>
      </div>
    </div>
  )
}

