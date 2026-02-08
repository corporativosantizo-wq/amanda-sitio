'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useFetch, useMutate } from '@/lib/hooks/use-fetch'
import type { CobroConCliente } from '@/lib/types'

// ── Types ───────────────────────────────────────────────────────────────────

interface Resumen {
  total_pendiente: number
  total_vencido: number
  por_vencer_7d: number
  cobrado_mes: number
  count_pendientes: number
  count_vencidos: number
  count_por_vencer: number
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

// ═══════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════

export default function ContabilidadPage() {
  const [filtro, setFiltro] = useState('pendientes')
  const [showNuevo, setShowNuevo] = useState(false)
  const [showPago, setShowPago] = useState<CobroConCliente | null>(null)
  const [clienteSearch, setClienteSearch] = useState('')

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
          <SummaryCard icon="🟢" label="Cobrado este mes" value={Q(resumen.cobrado_mes)} sub="Pagos confirmados" color="text-green-700" bg="bg-green-50" />
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

      {/* Table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Concepto</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3 text-right">Saldo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cobros.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  No hay cobros para mostrar
                </td>
              </tr>
            ) : (
              cobros.map((c: CobroConCliente) => {
                const hoy = new Date().toISOString().split('T')[0]
                const esVencido = c.fecha_vencimiento && c.fecha_vencimiento < hoy && c.estado !== 'pagado' && c.estado !== 'cancelado'
                return (
                  <tr key={c.id} className={`hover:bg-gray-50 ${esVencido ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">COB-{String(c.numero_cobro).padStart(3, '0')}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.cliente?.nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">{c.concepto}</td>
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
                    <td className="px-4 py-3">
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

// ── Modal: Nuevo Cobro ──────────────────────────────────────────────────────

function NuevoCobroModal({ onClose, onCreated, mutate }: {
  onClose: () => void
  onCreated: () => void
  mutate: any
}) {
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [diasCredito, setDiasCredito] = useState('15')
  const [notas, setNotas] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const { data: clientesData } = useFetch<{ data: any[] }>(
    clienteSearch.length >= 2 ? `/api/admin/clientes?q=${encodeURIComponent(clienteSearch)}&limit=5` : null
  )

  const handleSubmit = async () => {
    if (!clienteId || !concepto || !monto) return
    setSaving(true)
    await mutate('/api/admin/cobros', {
      method: 'POST',
      body: {
        cliente_id: clienteId,
        concepto,
        monto: parseFloat(monto),
        dias_credito: parseInt(diasCredito) || 15,
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
          <label className="text-xs text-gray-500 font-medium">Cliente</label>
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
          <label className="text-xs text-gray-500 font-medium">Concepto</label>
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
            <label className="text-xs text-gray-500 font-medium">Monto (Q)</label>
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
            <input
              type="number"
              value={diasCredito}
              onChange={(e) => setDiasCredito(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-teal-500"
            />
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
            disabled={!clienteId || !concepto || !monto || saving}
            className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creando...' : 'Crear y enviar cobro'}
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
