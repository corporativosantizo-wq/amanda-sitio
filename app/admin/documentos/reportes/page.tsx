'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useFetch } from '@/lib/hooks/use-fetch'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
  PieChart, Pie,
} from 'recharts'

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
}

interface TipoData {
  tipo: string
  cantidad: number
}

interface UsuarioData {
  usuario: string
  cantidad: number
}

interface StorageStats {
  total_mb: number
  total_gb: number
  promedio_mb: number
  max_mb: number
}

interface TamanoDistrib {
  menos_100kb: number
  kb100_500: number
  kb500_1mb: number
  mb1_5: number
  mb5_10: number
  mas_10mb: number
}

interface ReporteResponse {
  metricas: {
    total_global: number
    total_rango: number
    escaneados_hoy: number
    promedio_diario: number
    esta_semana: number
    total_paginas: number
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
  contrato_comercial: 'Contrato Comercial',
  escritura_publica: 'Escritura Pública',
  testimonio: 'Testimonio',
  acta_notarial: 'Acta Notarial',
  poder: 'Poder',
  contrato_laboral: 'Contrato Laboral',
  demanda_memorial: 'Demanda / Memorial',
  resolucion_judicial: 'Resolución Judicial',
  otro: 'Otro',
  sin_tipo: 'Sin tipo',
}

const USUARIO_LABELS: Record<string, string> = {
  'contador@papeleo.legal': 'Asistente (Contador)',
  'info@amandasantizo.com': 'Amanda Santizo',
  'amanda@papeleo.legal': 'Amanda (Papeleo)',
  'corporativosantizo@gmail.com': 'Corporativo',
  'desconocido': 'Sin asignar',
}

function labelUsuario(email: string): string {
  return USUARIO_LABELS[email] ?? email
}

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6B7280']

const TAMANO_LABELS: { key: keyof TamanoDistrib; label: string }[] = [
  { key: 'menos_100kb', label: '< 100 KB' },
  { key: 'kb100_500', label: '100-500 KB' },
  { key: 'kb500_1mb', label: '500 KB-1 MB' },
  { key: 'mb1_5', label: '1-5 MB' },
  { key: 'mb5_10', label: '5-10 MB' },
  { key: 'mas_10mb', label: '> 10 MB' },
]

const RANGOS = [
  { value: '7', label: 'Última semana' },
  { value: '14', label: 'Últimos 14 días' },
  { value: '30', label: 'Último mes' },
  { value: '60', label: 'Últimos 2 meses' },
  { value: '90', label: 'Últimos 3 meses' },
]

function fechaLabel(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })
}

// ═══════════════════════════════════════════════════════════════════════════

export default function DocumentosReportePage() {
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

  // Last 14 days for detailed table
  const ultimos14 = porDia.slice(-14)
  const totales14 = ultimos14.reduce(
    (acc: any, d: DiaData) => ({
      documentos: acc.documentos + d.documentos,
      paginas: acc.paginas + d.paginas,
      clientes: acc.clientes + d.clientes_distintos,
      clasificados: acc.clasificados + d.clasificados_ia,
      mb: acc.mb + (d.mb_subidos ?? 0),
      grandes: acc.grandes + (d.archivos_grandes ?? 0),
    }),
    { documentos: 0, paginas: 0, clientes: 0, clasificados: 0, mb: 0, grandes: 0 }
  )

  // Scorecard: find best day
  const mejorDia = porDia.reduce(
    (best: DiaData | null, d: DiaData) => (!best || d.documentos > best.documentos ? d : best),
    null
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
    texto += `${'='.repeat(70)}\n\n`
    texto += `Total: ${m!.total_rango} documentos | Promedio: ${m!.promedio_diario}/día | Páginas: ${m!.total_paginas}\n`
    texto += `Escaneados hoy: ${m!.escaneados_hoy} | Esta semana: ${m!.esta_semana}\n`
    texto += `Total histórico: ${m!.total_global}\n`
    if (storage) {
      texto += `Almacenamiento: ${storage.total_gb} GB | Promedio: ${storage.promedio_mb} MB/archivo | Máximo: ${storage.max_mb} MB\n`
    }
    texto += '\n'

    texto += `Detalle por día:\n${'-'.repeat(70)}\n`
    texto += `${'Fecha'.padEnd(14)}${'Docs'.padStart(6)}${'MB'.padStart(10)}${'Prom MB'.padStart(10)}${'>10MB'.padStart(7)}${'Clientes'.padStart(10)}\n`
    for (const d of porDia) {
      if (d.documentos === 0) continue
      texto += `${d.fecha.padEnd(14)}${String(d.documentos).padStart(6)}${String(d.mb_subidos ?? 0).padStart(10)}${String(d.promedio_mb ?? 0).padStart(10)}${String(d.archivos_grandes ?? 0).padStart(7)}${String(d.clientes_distintos).padStart(10)}\n`
    }

    texto += `\nPor tipo de documento:\n${'-'.repeat(40)}\n`
    for (const t of porTipo) {
      texto += `${(TIPO_LABELS[t.tipo] ?? t.tipo).padEnd(28)}${String(t.cantidad).padStart(6)}\n`
    }

    if (porTamano) {
      texto += `\nDistribución por tamaño:\n${'-'.repeat(40)}\n`
      for (const t of TAMANO_LABELS) {
        const val = porTamano[t.key] ?? 0
        if (val > 0) texto += `${t.label.padEnd(28)}${String(val).padStart(6)}\n`
      }
    }

    if (porUsuario.length > 0) {
      texto += `\nPor usuario:\n${'-'.repeat(40)}\n`
      for (const u of porUsuario) {
        texto += `${labelUsuario(u.usuario).padEnd(28)}${String(u.cantidad).padStart(6)}\n`
      }
    }

    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-escaneo-${data.desde}-${data.hasta}.txt`
    a.click()
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
          <h1 className="text-2xl font-bold text-slate-900">Productividad de escaneo</h1>
        </div>
        <button
          onClick={descargarReporte}
          disabled={!data}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-lg hover:bg-slate-900 disabled:opacity-40 transition"
        >
          Descargar reporte
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-white rounded-lg border p-1">
          {RANGOS.map(r => (
            <button
              key={r.value}
              onClick={() => setRangoDias(r.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                rangoDias === r.value ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={tipoFiltro}
          onChange={e => setTipoFiltro(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white outline-none"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_LABELS).filter(([k]) => k !== 'sin_tipo').map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={usuarioFiltro}
          onChange={e => setUsuarioFiltro(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm bg-white outline-none"
        >
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => (
            <option key={u} value={u}>{labelUsuario(u)}</option>
          ))}
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
              <h2 className="text-sm font-bold text-blue-900 mb-2">
                Productividad de {labelUsuario(usuarioFiltro)}
              </h2>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-blue-800">
                <span><strong>Total:</strong> {m.total_global.toLocaleString('es-GT')} docs</span>
                <span><strong>Promedio:</strong> {m.promedio_diario}/día</span>
                <span>
                  <strong>Mejor día:</strong>{' '}
                  {new Date(mejorDia.fecha + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
                  {' '}({mejorDia.documentos.toLocaleString('es-GT')})
                </span>
                <span><strong>Esta semana:</strong> {m.esta_semana} docs</span>
                <span><strong>Hoy:</strong> {m.escaneados_hoy} docs</span>
                {storage && <span><strong>Almacenamiento:</strong> {storage.total_gb} GB ({storage.promedio_mb} MB/archivo)</span>}
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <Card label="Total escaneados" value={m!.total_global.toLocaleString('es-GT')} icon="📚" />
            <Card label="Escaneados hoy" value={String(m!.escaneados_hoy)} icon="📄" highlight={m!.escaneados_hoy >= promedio} />
            <Card label={`Promedio diario (${rangoDias}d)`} value={String(m!.promedio_diario)} icon="📊" />
            <Card label="Esta semana" value={String(m!.esta_semana)} icon="📅" />
            {storage && (
              <Card
                label="Almacenamiento total"
                value={`${storage.total_gb} GB`}
                icon="💾"
                sub={`${storage.promedio_mb} MB/archivo`}
              />
            )}
          </div>

          {/* Per-user breakdown (only when "Todos" is selected) */}
          {!usuarioFiltro && porUsuario.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Documentos por usuario</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {porUsuario.map((u: UsuarioData, i: number) => (
                  <button
                    key={u.usuario}
                    onClick={() => setUsuarioFiltro(u.usuario)}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-slate-50 transition text-left"
                  >
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
              Documentos por día
              {usuarioFiltro && <span className="text-slate-400 font-normal"> — {labelUsuario(usuarioFiltro)}</span>}
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="fecha"
                  tickFormatter={fechaLabel}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval={Math.max(0, Math.floor(porDia.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip
                  labelFormatter={(v: any) => new Date(String(v) + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  formatter={(v: any, name: any) => [v, name === 'documentos' ? 'Documentos' : name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <ReferenceLine y={promedio} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: `Prom: ${promedio}`, position: 'right', fontSize: 11, fill: '#64748b' }} />
                <Bar dataKey="documentos" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {porDia.map((d: DiaData, i: number) => (
                    <Cell key={i} fill={d.documentos >= promedio ? '#3B82F6' : '#EF4444'} opacity={d.documentos === 0 ? 0.15 : 0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart: MB per day */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">
              MB subidos por día
              {usuarioFiltro && <span className="text-slate-400 font-normal"> — {labelUsuario(usuarioFiltro)}</span>}
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porDia} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <XAxis
                  dataKey="fecha"
                  tickFormatter={fechaLabel}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  interval={Math.max(0, Math.floor(porDia.length / 10) - 1)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  labelFormatter={(v: any) => new Date(String(v) + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                  formatter={(v: any) => [`${v} MB`, 'Volumen']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="mb_subidos" fill="#8B5CF6" radius={[3, 3, 0, 0]} maxBarSize={24} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Detail table */}
            <div className="col-span-2 bg-white border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b">
                <h2 className="text-sm font-semibold text-slate-700">Últimos 14 días</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                      <th className="px-3 py-2.5 text-left w-8"></th>
                      <th className="px-3 py-2.5 text-left">Fecha</th>
                      <th className="px-3 py-2.5 text-right">Docs</th>
                      <th className="px-3 py-2.5 text-right">MB</th>
                      <th className="px-3 py-2.5 text-right">Prom MB</th>
                      <th className="px-3 py-2.5 text-right">&gt;10MB</th>
                      <th className="px-3 py-2.5 text-right">Clientes</th>
                      <th className="px-3 py-2.5 text-right">IA</th>
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
                          <td className="px-3 py-2 text-right text-violet-600 font-medium">{d.mb_subidos ?? 0}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{d.promedio_mb ?? 0}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{d.archivos_grandes ?? 0}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{d.clientes_distintos}</td>
                          <td className="px-3 py-2 text-right text-slate-500">{d.clasificados_ia}</td>
                        </tr>
                      )
                    })}
                    <tr className="bg-slate-50 font-semibold">
                      <td className="px-3 py-2.5"></td>
                      <td className="px-3 py-2.5 text-slate-700">Total</td>
                      <td className="px-3 py-2.5 text-right text-slate-900">{totales14.documentos}</td>
                      <td className="px-3 py-2.5 text-right text-violet-700">{Math.round(totales14.mb * 10) / 10}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{totales14.documentos > 0 ? Math.round(totales14.mb / totales14.documentos * 10) / 10 : 0}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{totales14.grandes}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{totales14.clientes}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{totales14.clasificados}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pie chart: by type */}
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Por tipo de documento</h2>
              {porTipo.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={porTipo.map((t: TipoData) => ({ name: TIPO_LABELS[t.tipo] ?? t.tipo, value: t.cantidad }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {porTipo.map((_: TipoData, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
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
              ) : (
                <p className="text-sm text-slate-400 italic py-8 text-center">Sin datos</p>
              )}
            </div>
          </div>

          {/* File size distribution */}
          {tamanoData.length > 0 && (
            <div className="bg-white border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-700 mb-3">Distribución por tamaño de archivo</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="col-span-1">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={tamanoData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {tamanoData.map((_: any, i: number) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Archivos']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="col-span-2 flex items-center">
                  <div className="w-full space-y-2">
                    {tamanoData.map((t: any, i: number) => {
                      const total = tamanoData.reduce((s: number, x: any) => s + x.value, 0)
                      const pct = total > 0 ? Math.round((t.value / total) * 100) : 0
                      return (
                        <div key={t.name} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs text-slate-600 w-24">{t.name}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5">
                            <div
                              className="h-2.5 rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-700 w-16 text-right">{t.value} ({pct}%)</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
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
