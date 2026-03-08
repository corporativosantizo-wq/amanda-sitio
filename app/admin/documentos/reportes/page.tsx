'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useFetch } from '@/lib/hooks/use-fetch'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  PieChart, Pie, LineChart, Line,
} from 'recharts'

// ── Activity/Productivity types ─────────────────────────────────────────────

interface ActividadEvent {
  fecha: string
  hora: string
  accion: string
  modulo?: string
  detalle?: string
}

interface DescansoSchedule {
  tipo: string
  hora_inicio: string
  duracion_minutos: number
}

interface ActividadResponse {
  actividad: ActividadEvent[]
  documentos: { id: string; created_at?: string; titulo?: string }[]
  descansos: DescansoSchedule[]
}

// ── Types ───────────────────────────────────────────────────────────────────

interface DiaData {
  fecha: string
  documentos: number
  paginas: number
  clientes_distintos: number
  clasificados_ia: number
  mb_subidos: number
  promedio_mb: number
  archivos_grandes: number
  hora_entrada: string | null
  hora_salida: string | null
  horas_trabajadas: number
  docs_por_hora: number
}

interface TipoData { tipo: string; cantidad: number }
interface UsuarioData { usuario: string; cantidad: number }
interface StorageStats { total_mb: number; total_gb: number; promedio_mb: number; max_mb: number }
interface TamanoDistrib { menos_100kb: number; kb100_500: number; kb500_1mb: number; mb1_5: number; mb5_10: number; mas_10mb: number }

interface ReporteResponse {
  metricas: {
    total_global: number; total_rango: number; escaneados_hoy: number
    promedio_diario: number; esta_semana: number; total_paginas: number
  }
  por_dia: DiaData[]
  por_tipo: TipoData[]
  por_usuario: UsuarioData[]
  por_tamano: TamanoDistrib
  storage: StorageStats
  usuarios: string[]
  desde: string
  hasta: string
}

const TIPO_LABELS: Record<string, string> = {
  contrato_comercial: 'Contrato Comercial', escritura_publica: 'Escritura Pública',
  testimonio: 'Testimonio', acta_notarial: 'Acta Notarial', poder: 'Poder',
  contrato_laboral: 'Contrato Laboral', demanda_memorial: 'Demanda / Memorial',
  resolucion_judicial: 'Resolución Judicial', otro: 'Otro', sin_tipo: 'Sin tipo',
}

const USUARIO_LABELS: Record<string, string> = {
  'contador@papeleo.legal': 'Asistente (Contador)',
  'info@amandasantizo.com': 'Amanda Santizo',
  'amanda@papeleo.legal': 'Amanda (Papeleo)',
  'corporativosantizo@gmail.com': 'Corporativo',
  'desconocido': 'Sin asignar',
}
function labelUsuario(email: string): string { return USUARIO_LABELS[email] ?? email }

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6B7280']

const TAMANO_LABELS: { key: keyof TamanoDistrib; label: string }[] = [
  { key: 'menos_100kb', label: '< 100 KB' }, { key: 'kb100_500', label: '100-500 KB' },
  { key: 'kb500_1mb', label: '500 KB-1 MB' }, { key: 'mb1_5', label: '1-5 MB' },
  { key: 'mb5_10', label: '5-10 MB' }, { key: 'mas_10mb', label: '> 10 MB' },
]

const RANGOS = [
  { value: '7', label: 'Última semana' }, { value: '14', label: 'Últimos 14 días' },
  { value: '30', label: 'Último mes' }, { value: '60', label: 'Últimos 2 meses' },
  { value: '90', label: 'Últimos 3 meses' },
]

function fechaLabel(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
}

/** Convert "HH:MM" to minutes since midnight */
function horaToMin(h: string | null): number {
  if (!h) return 0
  const [hh, mm] = h.split(':').map(Number)
  return hh * 60 + mm
}

/** Average of HH:MM strings */
function promedioHora(horas: (string | null)[]): string {
  const valid = horas.filter((h): h is string => !!h)
  if (valid.length === 0) return '--:--'
  const avg = valid.reduce((s, h) => s + horaToMin(h), 0) / valid.length
  const hh = Math.floor(avg / 60)
  const mm = Math.round(avg % 60)
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

// ═══════════════════════════════════════════════════════════════════════════

export default function DocumentosReportePage() {
  const [tab, setTab] = useState<'escaneo' | 'productividad'>('escaneo')
  const [rangoDias, setRangoDias] = useState('30')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [usuarioFiltro, setUsuarioFiltro] = useState('')

  const desde = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (parseInt(rangoDias) - 1))
    return d.toISOString().split('T')[0]
  }, [rangoDias])
  const hasta = new Date().toISOString().split('T')[0]

  const params = new URLSearchParams({ desde, hasta })
  if (tipoFiltro) params.set('tipo', tipoFiltro)
  if (usuarioFiltro) params.set('usuario', usuarioFiltro)

  const { data, loading } = useFetch<ReporteResponse>(`/api/admin/documentos/reporte?${params}`)

  const m = data?.metricas
  const porDia = data?.por_dia ?? []
  const porTipo = data?.por_tipo ?? []
  const porUsuario = data?.por_usuario ?? []
  const usuarios = data?.usuarios ?? []
  const storage = data?.storage
  const porTamano = data?.por_tamano
  const promedio = m?.promedio_diario ?? 0

  // Days with actual work
  const diasConDatos = porDia.filter((d: DiaData) => d.documentos > 0)

  // Last 14 days for table
  const ultimos14 = porDia.slice(-14)
  const totales14 = ultimos14.reduce(
    (acc: any, d: DiaData) => ({
      documentos: acc.documentos + d.documentos,
      mb: acc.mb + (d.mb_subidos ?? 0),
      grandes: acc.grandes + (d.archivos_grandes ?? 0),
      clientes: acc.clientes + d.clientes_distintos,
      horas: acc.horas + (d.horas_trabajadas ?? 0),
    }),
    { documentos: 0, mb: 0, grandes: 0, clientes: 0, horas: 0 }
  )

  // Rendimiento metrics
  const avgDocsHora = diasConDatos.length > 0
    ? Math.round(diasConDatos.reduce((s: number, d: DiaData) => s + (d.docs_por_hora ?? 0), 0) / diasConDatos.length * 10) / 10
    : 0
  const mejorRendimiento = diasConDatos.reduce(
    (best: DiaData | null, d: DiaData) => (!best || (d.docs_por_hora ?? 0) > (best.docs_por_hora ?? 0) ? d : best), null
  )
  const avgEntrada = promedioHora(diasConDatos.map((d: DiaData) => d.hora_entrada))
  const avgSalida = promedioHora(diasConDatos.map((d: DiaData) => d.hora_salida))
  const avgHorasTrabajadas = diasConDatos.length > 0
    ? Math.round(diasConDatos.reduce((s: number, d: DiaData) => s + (d.horas_trabajadas ?? 0), 0) / diasConDatos.length * 10) / 10
    : 0

  // Scorecard: best day by docs
  const mejorDia = porDia.reduce(
    (best: DiaData | null, d: DiaData) => (!best || d.documentos > best.documentos ? d : best), null
  )

  // Size distribution for pie chart
  const tamanoData = porTamano
    ? TAMANO_LABELS.map(t => ({ name: t.label, value: porTamano[t.key] ?? 0 })).filter(t => t.value > 0)
    : []

  const descargarReporte = () => {
    if (!data) return
    const desdeLabel = new Date(data.desde + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })
    const hastaLabel = new Date(data.hasta + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })

    let texto = `Reporte de escaneo — ${desdeLabel} al ${hastaLabel}\n`
    if (usuarioFiltro) texto += `Usuario: ${labelUsuario(usuarioFiltro)}\n`
    texto += `${'='.repeat(80)}\n\n`
    texto += `Total: ${m!.total_rango} documentos | Promedio: ${m!.promedio_diario}/día\n`
    texto += `Escaneados hoy: ${m!.escaneados_hoy} | Esta semana: ${m!.esta_semana}\n`
    texto += `Total histórico: ${m!.total_global}\n`
    if (storage) texto += `Almacenamiento: ${storage.total_gb} GB | Promedio: ${storage.promedio_mb} MB/archivo\n`
    texto += `Rendimiento: ${avgDocsHora} docs/hora | Entrada: ${avgEntrada} | Salida: ${avgSalida} | ${avgHorasTrabajadas}h/día\n\n`

    texto += `Detalle por día:\n${'-'.repeat(95)}\n`
    texto += `${'Fecha'.padEnd(14)}${'Docs'.padStart(5)}${'MB'.padStart(9)}${'>10MB'.padStart(6)}${'Entrada'.padStart(9)}${'Salida'.padStart(9)}${'Horas'.padStart(7)}${'D/h'.padStart(6)}${'Clientes'.padStart(10)}\n`
    for (const d of porDia) {
      if (d.documentos === 0) continue
      texto += `${d.fecha.padEnd(14)}${String(d.documentos).padStart(5)}${String(d.mb_subidos ?? 0).padStart(9)}${String(d.archivos_grandes ?? 0).padStart(6)}${(d.hora_entrada ?? '--').padStart(9)}${(d.hora_salida ?? '--').padStart(9)}${String(d.horas_trabajadas ?? 0).padStart(7)}${String(d.docs_por_hora ?? 0).padStart(6)}${String(d.clientes_distintos).padStart(10)}\n`
    }

    texto += `\nPor tipo:\n${'-'.repeat(40)}\n`
    for (const t of porTipo) texto += `${(TIPO_LABELS[t.tipo] ?? t.tipo).padEnd(28)}${String(t.cantidad).padStart(6)}\n`

    if (porTamano) {
      texto += `\nPor tamaño:\n${'-'.repeat(40)}\n`
      for (const t of TAMANO_LABELS) { const v = porTamano[t.key] ?? 0; if (v > 0) texto += `${t.label.padEnd(28)}${String(v).padStart(6)}\n` }
    }

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `reporte-escaneo-${data.desde}-${data.hasta}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/documentos" className="text-sm text-slate-400 hover:text-slate-600">Documentos</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-600 font-medium">Reportes</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        </div>
        {tab === 'escaneo' && (
          <button onClick={descargarReporte} disabled={!data} className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 disabled:opacity-40 transition">
            Descargar reporte
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button onClick={() => setTab('escaneo')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'escaneo' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Escaneo
        </button>
        <button onClick={() => setTab('productividad')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'productividad' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          Productividad
        </button>
      </div>

      {tab === 'productividad' ? (
        <ProductividadTab />
      ) : (
      <>
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-white rounded-lg border p-1">
          {RANGOS.map(r => (
            <button key={r.value} onClick={() => setRangoDias(r.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${rangoDias === r.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white outline-none">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).filter(([k]) => k !== 'sin_tipo').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={usuarioFiltro} onChange={e => setUsuarioFiltro(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white outline-none">
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u} value={u}>{labelUsuario(u)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Cargando reporte...</div>
      ) : !data ? (
        <div className="py-20 text-center text-red-500">Error al cargar datos</div>
      ) : (
        <>
          {/* Scorecard — when a user is selected */}
          {usuarioFiltro && m && mejorDia && (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-blue-900 mb-2">Productividad de {labelUsuario(usuarioFiltro)}</h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
                <span><strong>Total:</strong> {m.total_global.toLocaleString('es-GT')} docs</span>
                <span><strong>Promedio:</strong> {m.promedio_diario}/día</span>
                <span><strong>Mejor día:</strong> {new Date(mejorDia.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })} ({mejorDia.documentos.toLocaleString('es-GT')})</span>
                <span><strong>Esta semana:</strong> {m.esta_semana} docs</span>
                <span><strong>Hoy:</strong> {m.escaneados_hoy} docs</span>
                {storage && <span><strong>Almacenamiento:</strong> {storage.total_gb} GB</span>}
              </div>
            </div>
          )}

          {/* Summary cards — row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card label="Total escaneados" value={m!.total_global.toLocaleString('es-GT')} icon="📚" />
            <Card label="Escaneados hoy" value={String(m!.escaneados_hoy)} icon="📄" highlight={m!.escaneados_hoy >= promedio} />
            <Card label={`Promedio diario (${rangoDias}d)`} value={String(m!.promedio_diario)} icon="📊" />
            <Card label="Esta semana" value={String(m!.esta_semana)} icon="📅" />
            {storage && <Card label="Almacenamiento total" value={`${storage.total_gb} GB`} icon="💾" sub={`${storage.promedio_mb} MB/archivo`} />}
          </div>

          {/* Summary cards — row 2: rendimiento + horario */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="border rounded-xl p-4 bg-violet-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">⚡</span>
                <span className="text-xs text-violet-600 font-medium">Rendimiento promedio</span>
              </div>
              <p className="text-2xl font-bold text-violet-900">{avgDocsHora} <span className="text-sm font-medium">docs/hora</span></p>
              {mejorRendimiento && mejorRendimiento.docs_por_hora > 0 && (
                <p className="text-[10px] text-violet-500 mt-1">
                  Mejor: {new Date(mejorRendimiento.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })} ({mejorRendimiento.docs_por_hora} d/h)
                </p>
              )}
            </div>
            <div className="border rounded-xl p-4 bg-amber-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🕐</span>
                <span className="text-xs text-amber-600 font-medium">Horario de trabajo</span>
              </div>
              <div className="flex items-baseline gap-3">
                <div>
                  <p className="text-xs text-amber-500">Entrada</p>
                  <p className="text-xl font-bold text-amber-900">{avgEntrada}</p>
                </div>
                <span className="text-amber-300 text-lg">→</span>
                <div>
                  <p className="text-xs text-amber-500">Salida</p>
                  <p className="text-xl font-bold text-amber-900">{avgSalida}</p>
                </div>
              </div>
              <p className="text-[10px] text-amber-500 mt-1">{avgHorasTrabajadas}h productivas/día promedio</p>
            </div>
            <div className="border rounded-xl p-4 bg-emerald-50">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📈</span>
                <span className="text-xs text-emerald-600 font-medium">Resumen del rango</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">{m!.total_rango} <span className="text-sm font-medium">docs</span></p>
              <p className="text-[10px] text-emerald-500 mt-1">
                {diasConDatos.length} días laborados de {porDia.length} | {Math.round(porDia.reduce((s: number, d: DiaData) => s + (d.mb_subidos ?? 0), 0))} MB subidos
              </p>
            </div>
          </div>

          {/* Per-user breakdown */}
          {!usuarioFiltro && porUsuario.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Documentos por usuario</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {porUsuario.map((u: UsuarioData, i: number) => (
                  <button key={u.usuario} onClick={() => setUsuarioFiltro(u.usuario)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition text-left">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-sm font-medium text-slate-700">{labelUsuario(u.usuario)}</span>
                    </div>
                    <span className="text-lg font-bold text-slate-900">{u.cantidad.toLocaleString('es-GT')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart: documents per day */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              Documentos por día{usuarioFiltro && <span className="text-slate-400 font-normal"> — {labelUsuario(usuarioFiltro)}</span>}
            </h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis dataKey="fecha" tickFormatter={fechaLabel} tick={{ fontSize: 11, fill: '#94a3b8' }} interval={Math.max(0, Math.floor(porDia.length / 10) - 1)} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip labelFormatter={(v: any) => new Date(String(v) + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  formatter={(v: any, name: any) => [v, name === 'documentos' ? 'Documentos' : name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <ReferenceLine y={promedio} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Prom: ${promedio}`, position: 'right', fontSize: 11, fill: '#64748b' }} />
                <Bar dataKey="documentos" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {porDia.map((d: DiaData, i: number) => (
                    <Cell key={i} fill={d.documentos >= promedio ? '#3B82F6' : '#EF4444'} opacity={d.documentos === 0 ? 0.15 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Two charts side by side */}
          <div className="grid grid-cols-2 gap-6">
            {/* Bar chart: MB per day */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">MB subidos por día</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="fecha" tickFormatter={fechaLabel} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.max(0, Math.floor(porDia.length / 8) - 1)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip labelFormatter={(v: any) => new Date(String(v) + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    formatter={(v: any) => [`${v} MB`, 'Volumen']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="mb_subidos" fill="#3B82F6" radius={[3, 3, 0, 0]} maxBarSize={20} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line chart: docs/hora per day */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-4">Docs/hora por día</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={diasConDatos} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis dataKey="fecha" tickFormatter={fechaLabel} tick={{ fontSize: 10, fill: '#94a3b8' }} interval={Math.max(0, Math.floor(diasConDatos.length / 8) - 1)} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip labelFormatter={(v: any) => new Date(String(v) + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    formatter={(v: any) => [`${v} docs/h`, 'Rendimiento']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <ReferenceLine y={avgDocsHora} stroke="#8B5CF6" strokeDasharray="4 4" label={{ value: `Prom: ${avgDocsHora}`, position: 'right', fontSize: 10, fill: '#7C3AED' }} />
                  <Line type="monotone" dataKey="docs_por_hora" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3, fill: '#8B5CF6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detail table */}
          <div className="bg-white border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b">
              <h2 className="text-sm font-semibold text-slate-700">Últimos 14 días — detalle</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-2.5 text-left w-7"></th>
                    <th className="px-3 py-2.5 text-left">Fecha</th>
                    <th className="px-3 py-2.5 text-right">Docs</th>
                    <th className="px-3 py-2.5 text-right">MB</th>
                    <th className="px-3 py-2.5 text-right">Prom MB</th>
                    <th className="px-3 py-2.5 text-right">&gt;10MB</th>
                    <th className="px-3 py-2.5 text-center">Entrada</th>
                    <th className="px-3 py-2.5 text-center">Salida</th>
                    <th className="px-3 py-2.5 text-right">Horas</th>
                    <th className="px-3 py-2.5 text-right">D/h</th>
                    <th className="px-3 py-2.5 text-right">Clientes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ultimos14.map((d: DiaData) => {
                    const icono = d.documentos > 20 ? '🟢' : d.documentos >= 10 ? '🟡' : d.documentos > 0 ? '🔴' : '⚪'
                    return (
                      <tr key={d.fecha} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-center">{icono}</td>
                        <td className="px-3 py-2 text-slate-700 font-medium">
                          {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-900">{d.documentos}</td>
                        <td className="px-3 py-2 text-right text-blue-600 font-medium">{d.mb_subidos ?? 0}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{d.promedio_mb ?? 0}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{d.archivos_grandes ?? 0}</td>
                        <td className="px-3 py-2 text-center text-slate-600 font-mono text-xs">{d.hora_entrada ?? '—'}</td>
                        <td className="px-3 py-2 text-center text-slate-600 font-mono text-xs">{d.hora_salida ?? '—'}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{d.horas_trabajadas ?? 0}</td>
                        <td className="px-3 py-2 text-right text-violet-600 font-semibold">{d.docs_por_hora ?? 0}</td>
                        <td className="px-3 py-2 text-right text-slate-500">{d.clientes_distintos}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-3 py-2.5"></td>
                    <td className="px-3 py-2.5 text-slate-700">Total / Prom</td>
                    <td className="px-3 py-2.5 text-right text-slate-900">{totales14.documentos}</td>
                    <td className="px-3 py-2.5 text-right text-blue-700">{Math.round(totales14.mb * 10) / 10}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{totales14.documentos > 0 ? Math.round(totales14.mb / totales14.documentos * 10) / 10 : 0}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{totales14.grandes}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600 font-mono text-xs">{avgEntrada}</td>
                    <td className="px-3 py-2.5 text-center text-slate-600 font-mono text-xs">{avgSalida}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{Math.round(totales14.horas * 10) / 10}</td>
                    <td className="px-3 py-2.5 text-right text-violet-700">{totales14.horas > 0 ? Math.round(totales14.documentos / totales14.horas * 10) / 10 : 0}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{totales14.clientes}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom row: type pie + size distribution */}
          <div className="grid grid-cols-2 gap-6">
            {/* Pie chart: by type */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Por tipo de documento</h2>
              {porTipo.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={porTipo.map((t: TipoData) => ({ name: TIPO_LABELS[t.tipo] ?? t.tipo, value: t.cantidad }))}
                        dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                        {porTipo.map((_: TipoData, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Documentos']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {porTipo.map((t: TipoData, i: number) => (
                      <div key={t.tipo} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-600">{TIPO_LABELS[t.tipo] ?? t.tipo}</span>
                        </div>
                        <span className="font-semibold text-slate-800">{t.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-sm text-slate-400 italic py-8 text-center">Sin datos</p>}
            </div>

            {/* File size distribution */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribución por tamaño</h2>
              {tamanoData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={tamanoData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={2}>
                        {tamanoData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Archivos']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {tamanoData.map((t: any, i: number) => {
                      const total = tamanoData.reduce((s: number, x: any) => s + x.value, 0)
                      const pct = total > 0 ? Math.round((t.value / total) * 100) : 0
                      return (
                        <div key={t.name} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-slate-600 w-20">{t.name}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                          <span className="font-semibold text-slate-700 w-14 text-right">{t.value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : <p className="text-sm text-slate-400 italic py-8 text-center">Sin datos</p>}
            </div>
          </div>
        </>
      )}
      </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ProductividadTab — Activity timeline, metrics, weekly table, alerts
// ═══════════════════════════════════════════════════════════════════════════

const PROD_RANGOS = [
  { value: '7', label: '7 días' }, { value: '14', label: '14 días' },
  { value: '30', label: '30 días' },
]

const TIMELINE_START = 8 // 8 AM
const TIMELINE_END = 18 // 6 PM
const TIMELINE_HOURS = TIMELINE_END - TIMELINE_START // 10 hours

function ProductividadTab() {
  const [rangoDias, setRangoDias] = useState('7')
  const [fechaDetalle, setFechaDetalle] = useState('')
  const email = 'contador@papeleo.legal'

  const desde = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (parseInt(rangoDias) - 1))
    return d.toISOString().split('T')[0]
  }, [rangoDias])
  const hasta = new Date().toISOString().split('T')[0]

  // Weekly summary data
  const weekParams = new URLSearchParams({ email, desde, hasta })
  const { data: weekData, loading: weekLoading } = useFetch<ActividadResponse>(`/api/admin/actividad?${weekParams}`)

  // Day detail data (when a day is selected)
  const dayParams = fechaDetalle ? new URLSearchParams({ email, fecha: fechaDetalle }) : null
  const { data: dayData, loading: dayLoading } = useFetch<ActividadResponse>(
    dayParams ? `/api/admin/actividad?${dayParams}` : null
  )

  // Process weekly data into per-day summaries
  const daySummaries = useMemo(() => {
    if (!weekData) return []
    const byDate: Record<string, ActividadEvent[]> = {}
    for (const ev of weekData.actividad) {
      if (!byDate[ev.fecha]) byDate[ev.fecha] = []
      byDate[ev.fecha].push(ev)
    }
    // Count docs per date
    const docsByDate: Record<string, number> = {}
    for (const doc of weekData.documentos) {
      const f = doc.created_at?.slice(0, 10)
      if (f) docsByDate[f] = (docsByDate[f] ?? 0) + 1
    }

    const summaries: DaySummary[] = []
    // Generate all dates in range
    const start = new Date(desde + 'T12:00:00')
    const end = new Date(hasta + 'T12:00:00')
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const fecha = d.toISOString().split('T')[0]
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
      if (weekday === 'Sat' || weekday === 'Sun') continue

      const events = byDate[fecha] ?? []
      const docs = docsByDate[fecha] ?? 0
      if (events.length === 0 && docs === 0) {
        summaries.push({ fecha, entrada: null, salida: null, activoMin: 0, idleMin: 0, efectivoMin: 0, docs: 0, docsHora: 0, events: [] })
        continue
      }

      // Calculate times
      const timestamps = events.map((e: ActividadEvent) => new Date(e.hora).getTime()).sort((a: number, b: number) => a - b)
      const entrada = timestamps.length > 0 ? new Date(timestamps[0]) : null
      const salida = timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]) : null

      // Calculate idle time from idle_start/idle_end pairs
      let idleMs = 0
      let idleStartTime: number | null = null
      for (const ev of events) {
        if (ev.accion === 'idle_start') {
          idleStartTime = new Date(ev.hora).getTime()
        } else if (ev.accion === 'idle_end' && idleStartTime) {
          idleMs += new Date(ev.hora).getTime() - idleStartTime
          idleStartTime = null
        }
      }
      // If still idle at end of day
      if (idleStartTime && salida) {
        idleMs += salida.getTime() - idleStartTime
      }

      const totalMs = entrada && salida ? salida.getTime() - entrada.getTime() : 0
      const activoMs = totalMs - idleMs
      const activoMin = Math.round(activoMs / 60000)
      const idleMin = Math.round(idleMs / 60000)
      const efectivoMin = Math.max(0, activoMin)
      const efectivoHoras = efectivoMin / 60
      const docsHora = efectivoHoras > 0 ? Math.round(docs / efectivoHoras * 10) / 10 : 0

      const entradaStr = entrada
        ? entrada.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false })
        : null
      const salidaStr = salida
        ? salida.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit', hour12: false })
        : null

      summaries.push({ fecha, entrada: entradaStr, salida: salidaStr, activoMin, idleMin, efectivoMin, docs, docsHora, events })
    }
    return summaries
  }, [weekData, desde, hasta])

  // Today or selected day detail
  const selectedDay = fechaDetalle
    ? daySummaries.find((d: DaySummary) => d.fecha === fechaDetalle)
    : daySummaries[daySummaries.length - 1]

  const selectedEvents = fechaDetalle && dayData ? dayData.actividad : selectedDay?.events ?? []
  const selectedDocs = fechaDetalle && dayData ? dayData.documentos : []
  const selectedDescansos = weekData?.descansos ?? []

  // Alerts
  const alerts = useMemo(() => {
    const result: { tipo: 'warning' | 'danger'; msg: string }[] = []
    for (const d of daySummaries) {
      if (d.docs === 0 && d.entrada !== null) {
        result.push({ tipo: 'warning', msg: `${formatFechaCorta(d.fecha)}: Conectado pero 0 documentos escaneados` })
      }
      if (d.idleMin > 60) {
        result.push({ tipo: 'warning', msg: `${formatFechaCorta(d.fecha)}: ${d.idleMin} min inactivo (>${Math.round(d.idleMin / 60 * 10) / 10}h)` })
      }
      if (d.entrada && horaToMin(d.entrada) > 9 * 60 + 15) {
        result.push({ tipo: 'danger', msg: `${formatFechaCorta(d.fecha)}: Entrada tardía a las ${d.entrada}` })
      }
      if (d.docsHora > 0 && d.docsHora < 5) {
        result.push({ tipo: 'warning', msg: `${formatFechaCorta(d.fecha)}: Rendimiento bajo (${d.docsHora} docs/hora)` })
      }
    }
    return result.slice(0, 10)
  }, [daySummaries])

  // Build timeline segments for selected day
  const timelineSegments = useMemo(() => {
    if (!selectedEvents || selectedEvents.length === 0) return []
    return buildTimeline(selectedEvents, selectedDescansos)
  }, [selectedEvents, selectedDescansos])

  if (weekLoading) return <div className="py-20 text-center text-slate-400">Cargando datos de productividad...</div>

  const activeDays = daySummaries.filter((d: DaySummary) => d.docs > 0 || d.entrada !== null)
  const avgDocs = activeDays.length > 0 ? Math.round(activeDays.reduce((s: number, d: DaySummary) => s + d.docs, 0) / activeDays.length) : 0
  const avgEfectivo = activeDays.length > 0 ? Math.round(activeDays.reduce((s: number, d: DaySummary) => s + d.efectivoMin, 0) / activeDays.length) : 0
  const avgDocsHora = activeDays.length > 0 ? Math.round(activeDays.reduce((s: number, d: DaySummary) => s + d.docsHora, 0) / activeDays.length * 10) / 10 : 0

  const displayDay = selectedDay
  const displayFecha = displayDay?.fecha ?? hasta

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-white rounded-lg border p-1">
          {PROD_RANGOS.map(r => (
            <button key={r.value} onClick={() => setRangoDias(r.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${rangoDias === r.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-slate-500">
          Trabajador: <strong className="text-slate-700">Brandon (Asistente)</strong>
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card label="Promedio docs/día" value={String(avgDocs)} icon="📄" />
        <Card label="Tiempo efectivo/día" value={`${Math.floor(avgEfectivo / 60)}h ${avgEfectivo % 60}m`} icon="🕐" />
        <Card label="Promedio docs/hora" value={String(avgDocsHora)} icon="⚡" />
        <Card label="Días laborados" value={`${activeDays.length}/${daySummaries.length}`} icon="📅" />
      </div>

      {/* Day timeline */}
      <div className="bg-white border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700">
            Timeline del día — {new Date(displayFecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h2>
          {fechaDetalle && (
            <button onClick={() => setFechaDetalle('')} className="text-xs text-blue-600 hover:underline">
              Ver hoy
            </button>
          )}
        </div>

        {/* Timeline bar */}
        <div className="relative">
          {/* Hour labels */}
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            {Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => (
              <span key={i}>{String(TIMELINE_START + i).padStart(2, '0')}:00</span>
            ))}
          </div>
          {/* Bar */}
          <div className="relative h-8 bg-slate-100 rounded-lg overflow-hidden">
            {timelineSegments.map((seg: TimelineSegment, i: number) => (
              <div key={i} title={seg.label}
                className={`absolute top-0 h-full ${seg.color}`}
                style={{ left: `${seg.startPct}%`, width: `${Math.max(seg.widthPct, 0.3)}%` }}
              />
            ))}
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-2 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Activo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-400 inline-block" /> Descanso</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Idle</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-200 inline-block" /> Sin actividad</span>
          </div>
        </div>

        {/* Day metrics */}
        {displayDay && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mt-4 pt-4 border-t">
            <MiniStat label="Entrada" value={displayDay.entrada ?? '—'} />
            <MiniStat label="Salida" value={displayDay.salida ?? '—'} />
            <MiniStat label="Tiempo activo" value={formatMin(displayDay.activoMin)} />
            <MiniStat label="Tiempo idle" value={formatMin(displayDay.idleMin)} warn={displayDay.idleMin > 60} />
            <MiniStat label="Tiempo efectivo" value={formatMin(displayDay.efectivoMin)} />
            <MiniStat label="Documentos" value={String(displayDay.docs)} />
            <MiniStat label="Docs/hora" value={String(displayDay.docsHora)} />
          </div>
        )}
      </div>

      {/* Weekly table */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b">
          <h2 className="text-sm font-semibold text-slate-700">Tabla semanal</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <th className="px-3 py-2.5 text-left w-7"></th>
                <th className="px-3 py-2.5 text-left">Fecha</th>
                <th className="px-3 py-2.5 text-center">Entrada</th>
                <th className="px-3 py-2.5 text-center">Salida</th>
                <th className="px-3 py-2.5 text-right">Activo</th>
                <th className="px-3 py-2.5 text-right">Idle</th>
                <th className="px-3 py-2.5 text-right">Efectivo</th>
                <th className="px-3 py-2.5 text-right">Docs</th>
                <th className="px-3 py-2.5 text-right">D/h</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daySummaries.map((d: DaySummary) => {
                const icono = d.docs > 20 ? '🟢' : d.docs >= 10 ? '🟡' : d.docs > 0 ? '🔴' : d.entrada ? '⚠️' : '⚪'
                const isSelected = d.fecha === (fechaDetalle || displayDay?.fecha)
                return (
                  <tr key={d.fecha} onClick={() => setFechaDetalle(d.fecha)}
                    className={`cursor-pointer hover:bg-blue-50 transition ${isSelected ? 'bg-blue-50' : ''}`}>
                    <td className="px-3 py-2 text-center">{icono}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium">
                      {new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{d.entrada ?? '—'}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-slate-600">{d.salida ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-500">{formatMin(d.activoMin)}</td>
                    <td className={`px-3 py-2 text-right ${d.idleMin > 60 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>{formatMin(d.idleMin)}</td>
                    <td className="px-3 py-2 text-right text-slate-700 font-medium">{formatMin(d.efectivoMin)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-900">{d.docs}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${d.docsHora >= 10 ? 'text-green-600' : d.docsHora >= 5 ? 'text-violet-600' : d.docsHora > 0 ? 'text-red-600' : 'text-slate-400'}`}>{d.docsHora}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Alertas</h2>
          <div className="space-y-2">
            {alerts.map((a: { tipo: string; msg: string }, i: number) => (
              <div key={i} className={`px-3 py-2 rounded-lg text-sm ${a.tipo === 'danger' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                {a.tipo === 'danger' ? '🔴' : '⚠️'} {a.msg}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Productivity helpers ────────────────────────────────────────────────────

interface DaySummary {
  fecha: string
  entrada: string | null
  salida: string | null
  activoMin: number
  idleMin: number
  efectivoMin: number
  docs: number
  docsHora: number
  events: ActividadEvent[]
}

interface TimelineSegment {
  startPct: number
  widthPct: number
  color: string
  label: string
}

function formatMin(min: number): string {
  if (min === 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatFechaCorta(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
}

function buildTimeline(events: ActividadEvent[], descansos: DescansoSchedule[]): TimelineSegment[] {
  const totalMinutes = TIMELINE_HOURS * 60
  const segments: TimelineSegment[] = []

  // Add break segments
  for (const d of descansos) {
    const [h, m] = d.hora_inicio.split(':').map(Number)
    const startMin = (h - TIMELINE_START) * 60 + m
    const endMin = startMin + d.duracion_minutos
    if (startMin >= 0 && startMin < totalMinutes) {
      segments.push({
        startPct: (startMin / totalMinutes) * 100,
        widthPct: (Math.min(d.duracion_minutos, totalMinutes - startMin) / totalMinutes) * 100,
        color: 'bg-yellow-400',
        label: `${d.tipo} (${d.hora_inicio})`,
      })
    }
  }

  // Build activity segments from events
  let lastActiveTime: number | null = null
  let idleStart: number | null = null

  for (const ev of events) {
    const evTime = new Date(ev.hora)
    const gtH = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', hour: 'numeric', hour12: false }).format(evTime), 10)
    const gtM = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', minute: 'numeric' }).format(evTime), 10)
    const evMin = (gtH - TIMELINE_START) * 60 + gtM

    if (evMin < 0 || evMin >= totalMinutes) continue

    if (ev.accion === 'idle_start') {
      // Close active segment
      if (lastActiveTime !== null) {
        const width = evMin - lastActiveTime
        if (width > 0) {
          segments.push({
            startPct: (lastActiveTime / totalMinutes) * 100,
            widthPct: (width / totalMinutes) * 100,
            color: 'bg-green-500',
            label: `Activo`,
          })
        }
      }
      idleStart = evMin
      lastActiveTime = null
    } else if (ev.accion === 'idle_end') {
      if (idleStart !== null) {
        const width = evMin - idleStart
        if (width > 0) {
          segments.push({
            startPct: (idleStart / totalMinutes) * 100,
            widthPct: (width / totalMinutes) * 100,
            color: 'bg-red-400',
            label: `Idle (${width} min)`,
          })
        }
      }
      idleStart = null
      lastActiveTime = evMin
    } else {
      // Regular activity (page_view, doc_upload, etc.)
      if (idleStart === null) {
        if (lastActiveTime === null) {
          lastActiveTime = evMin
        }
        // Extend active segment (will be closed by next idle or end)
      }
    }
  }

  // Close final active segment
  if (lastActiveTime !== null) {
    const lastEv = events[events.length - 1]
    const lastTime = new Date(lastEv.hora)
    const lastH = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', hour: 'numeric', hour12: false }).format(lastTime), 10)
    const lastM = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guatemala', minute: 'numeric' }).format(lastTime), 10)
    const lastMin = (lastH - TIMELINE_START) * 60 + lastM
    const width = lastMin - lastActiveTime
    if (width > 0 && lastMin <= totalMinutes) {
      segments.push({
        startPct: (lastActiveTime / totalMinutes) * 100,
        widthPct: (width / totalMinutes) * 100,
        color: 'bg-green-500',
        label: 'Activo',
      })
    }
  }

  return segments
}

function MiniStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold ${warn ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}

// ── Card ────────────────────────────────────────────────────────────────────

function Card({ label, value, icon, highlight, sub }: {
  label: string; value: string; icon: string; highlight?: boolean; sub?: string
}) {
  return (
    <div className={`border rounded-xl p-4 ${highlight === false ? 'bg-red-50' : highlight === true ? 'bg-green-50' : 'bg-white'}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}
