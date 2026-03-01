'use client'

import { useState, useEffect, useCallback } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  totalThreads: number
  pendingDrafts: number
  emailsToday: number
  threadsByClasificacion: Record<string, number>
}

interface Draft {
  id: string
  to_email: string
  subject: string
  body_text: string
  tone: string | null
  status: string
  scheduled_at: string | null
  created_at: string
  thread: { id: string; subject: string; account: string; clasificacion: string; urgencia: number }
  message: { from_email: string; from_name: string | null; resumen: string | null } | null
}

interface Thread {
  id: string
  subject: string
  account: string
  clasificacion: string
  urgencia: number
  status: string
  message_count: number
  last_message_at: string
}

// ── Badge helpers ──────────────────────────────────────────────────────────

const CLASIFICACION_COLORS: Record<string, string> = {
  legal: 'bg-blue-100 text-blue-700',
  administrativo: 'bg-gray-100 text-gray-700',
  financiero: 'bg-green-100 text-green-700',
  spam: 'bg-red-100 text-red-700',
  personal: 'bg-purple-100 text-purple-700',
  urgente: 'bg-orange-100 text-orange-700',
  pendiente: 'bg-yellow-100 text-yellow-700',
}

const URGENCIA_LABELS = ['Info', 'Normal', 'Importante', 'Urgente']
const URGENCIA_COLORS = [
  'bg-gray-100 text-gray-600',
  'bg-blue-100 text-blue-600',
  'bg-orange-100 text-orange-600',
  'bg-red-100 text-red-600',
]

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Schedule helpers ──────────────────────────────────────────────────────

function getQuickScheduleOptions(): Array<{ label: string; date: string; time: string }> {
  const now = new Date()
  const gt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guatemala' }))
  const day = gt.getDay()

  const tomorrow = new Date(gt)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  const options: Array<{ label: string; date: string; time: string }> = [
    { label: 'Mañana 8am', date: tomorrowStr, time: '08:00' },
    { label: 'Mañana 2pm', date: tomorrowStr, time: '14:00' },
  ]

  if (day === 5 || day === 6 || day === 0) {
    const daysToMonday = day === 0 ? 1 : 8 - day
    const monday = new Date(gt)
    monday.setDate(monday.getDate() + daysToMonday)
    options.push({ label: 'Lunes 8am', date: monday.toISOString().split('T')[0], time: '08:00' })
  }

  return options
}

function formatScheduledDate(isoStr: string): string {
  const d = new Date(isoStr)
  return d.toLocaleDateString('es-GT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ── Page component ─────────────────────────────────────────────────────────

export default function MollyMailPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [scheduled, setScheduled] = useState<Draft[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({})
  const [schedulingDraft, setSchedulingDraft] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, draftsRes, threadsRes] = await Promise.all([
        fetch('/api/admin/molly/stats'),
        fetch('/api/admin/molly/drafts'),
        fetch('/api/admin/molly?limit=10'),
      ])

      if (statsRes.ok) setStats(await statsRes.json())
      if (draftsRes.ok) {
        const d = await draftsRes.json()
        setDrafts(d.data ?? [])
        setScheduled(d.scheduled ?? [])
      }
      if (threadsRes.ok) {
        const t = await threadsRes.json()
        setThreads(t.data ?? [])
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDraftAction = async (
    draftId: string,
    action: 'approve' | 'reject',
    editedBody?: string,
  ) => {
    setActionLoading(draftId)
    setErrorMsg(null)
    try {
      const payload: Record<string, string> = { draftId, action }
      if (editedBody !== undefined) payload.editedBody = editedBody

      const res = await fetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Error del servidor (${res.status})`)
      }

      setDrafts((prev) => prev.filter((d) => d.id !== draftId))
      setEditedBodies((prev) => {
        const next = { ...prev }
        delete next[draftId]
        return next
      })
      fetchData()
    } catch (err: any) {
      const msg = err.message || 'Error al procesar la acción'
      setErrorMsg(msg)
      console.error('Error:', msg)
    } finally {
      setActionLoading(null)
    }
  }

  const handleSchedule = async (draftId: string) => {
    if (!scheduleDate || !scheduleTime) {
      setErrorMsg('Selecciona fecha y hora para programar')
      return
    }
    setActionLoading(draftId)
    setErrorMsg(null)
    try {
      const scheduledAt = `${scheduleDate}T${scheduleTime}:00-06:00`
      const payload: Record<string, string> = { draftId, action: 'schedule', scheduled_at: scheduledAt }
      const edited = editedBodies[draftId]
      if (edited !== undefined && edited !== drafts.find((d) => d.id === draftId)?.body_text) {
        payload.editedBody = edited
      }

      const res = await fetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || `Error ${res.status}`)
        return
      }

      setSchedulingDraft(null)
      setScheduleDate('')
      setScheduleTime('')
      setEditedBodies((prev) => {
        const next = { ...prev }
        delete next[draftId]
        return next
      })
      fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelSchedule = async (draftId: string) => {
    setActionLoading(draftId)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, action: 'cancel_schedule' }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setErrorMsg(data.error || `Error ${res.status}`)
        return
      }

      fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión')
    } finally {
      setActionLoading(null)
    }
  }

  const handleTrigger = async () => {
    setTriggerLoading(true)
    try {
      await fetch('/api/admin/molly', { method: 'POST' })
      await fetchData()
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setTriggerLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Molly Mail</h1>
          <p className="text-slate mt-1">Asistente de email con IA</p>
        </div>
        <button
          onClick={handleTrigger}
          disabled={triggerLoading}
          className="px-4 py-2 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan/90 transition-colors disabled:opacity-50"
        >
          {triggerLoading ? 'Revisando...' : 'Revisar emails ahora'}
        </button>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-slate mb-1">Total hilos</div>
            <div className="text-2xl font-bold text-navy">{stats.totalThreads}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-slate mb-1">Borradores pendientes</div>
            <div className="text-2xl font-bold text-orange-600">{stats.pendingDrafts}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-slate mb-1">Emails hoy</div>
            <div className="text-2xl font-bold text-navy">{stats.emailsToday}</div>
          </div>
        </div>
      )}

      {/* Error banner */}
      {errorMsg && (
        <div className="mb-4 flex items-center justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <span>{errorMsg}</span>
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-4 text-red-400 hover:text-red-600 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Pending drafts */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-navy mb-4">
          Borradores pendientes ({drafts.length})
        </h2>
        {drafts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate">
            No hay borradores pendientes de aprobación
          </div>
        ) : (
          <div className="space-y-4">
            {drafts.map((draft) => (
              <div key={draft.id} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          CLASIFICACION_COLORS[draft.thread.clasificacion] || CLASIFICACION_COLORS.pendiente
                        }`}
                      >
                        {draft.thread.clasificacion}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          URGENCIA_COLORS[draft.thread.urgencia]
                        }`}
                      >
                        {URGENCIA_LABELS[draft.thread.urgencia]}
                      </span>
                    </div>
                    <h3 className="font-semibold text-navy mb-1">{draft.subject}</h3>
                    <p className="text-sm text-slate mb-1">
                      De: {draft.message?.from_name || draft.to_email} &rarr; {draft.thread.account}
                    </p>
                    {draft.message?.resumen && (
                      <p className="text-sm text-slate italic mb-2">{draft.message.resumen}</p>
                    )}
                    <div className="bg-slate-50 rounded-lg p-3 mt-2">
                      <p className="text-xs text-slate mb-1 font-medium">Borrador (editable):</p>
                      <textarea
                        className="w-full text-sm text-navy bg-white border border-gray-200 rounded-lg p-2 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-cyan/50 focus:border-cyan"
                        value={editedBodies[draft.id] ?? draft.body_text}
                        onChange={(e) =>
                          setEditedBodies((prev) => ({
                            ...prev,
                            [draft.id]: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <p className="text-xs text-slate mt-2">{formatDate(draft.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleDraftAction(draft.id, 'approve')}
                      disabled={actionLoading === draft.id}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    {editedBodies[draft.id] !== undefined &&
                      editedBodies[draft.id] !== draft.body_text && (
                      <button
                        onClick={() =>
                          handleDraftAction(draft.id, 'approve', editedBodies[draft.id])
                        }
                        disabled={actionLoading === draft.id}
                        className="px-4 py-2 bg-cyan text-navy-dark text-sm font-semibold rounded-lg hover:bg-cyan/90 transition-colors disabled:opacity-50"
                      >
                        Enviar editado
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSchedulingDraft(schedulingDraft === draft.id ? null : draft.id)
                        setScheduleDate('')
                        setScheduleTime('')
                      }}
                      disabled={actionLoading === draft.id}
                      className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-semibold rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      Programar
                    </button>
                    <button
                      onClick={() => handleDraftAction(draft.id, 'reject')}
                      disabled={actionLoading === draft.id}
                      className="px-4 py-2 bg-red-100 text-red-700 text-sm font-semibold rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
                {/* Schedule panel */}
                {schedulingDraft === draft.id && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-semibold text-amber-800 mb-3">Programar envío</p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {getQuickScheduleOptions().map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => { setScheduleDate(opt.date); setScheduleTime(opt.time) }}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            scheduleDate === opt.date && scheduleTime === opt.time
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                      <input
                        type="datetime-local"
                        value={scheduleDate && scheduleTime ? `${scheduleDate}T${scheduleTime}` : ''}
                        onChange={(e) => {
                          const val = e.target.value
                          if (val) {
                            setScheduleDate(val.split('T')[0])
                            setScheduleTime(val.split('T')[1]?.substring(0, 5) || '')
                          }
                        }}
                        className="px-3 py-1.5 text-xs border border-amber-300 rounded-lg bg-white text-amber-800 focus:ring-2 focus:ring-amber-400 outline-none"
                      />
                    </div>
                    {scheduleDate && scheduleTime && (
                      <p className="text-xs text-amber-600 mb-3">
                        Se enviará: {formatScheduledDate(`${scheduleDate}T${scheduleTime}:00-06:00`)}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSchedule(draft.id)}
                        disabled={actionLoading === draft.id || !scheduleDate || !scheduleTime}
                        className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => { setSchedulingDraft(null); setScheduleDate(''); setScheduleTime('') }}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scheduled drafts */}
      {scheduled.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-navy mb-4">
            Programados ({scheduled.length})
          </h2>
          <div className="space-y-4">
            {scheduled.map((draft) => (
              <div key={draft.id} className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-400">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
                        {draft.scheduled_at ? formatScheduledDate(draft.scheduled_at) : 'Programado'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          CLASIFICACION_COLORS[draft.thread.clasificacion] || CLASIFICACION_COLORS.pendiente
                        }`}
                      >
                        {draft.thread.clasificacion}
                      </span>
                    </div>
                    <h3 className="font-semibold text-navy mb-1">{draft.subject}</h3>
                    <p className="text-sm text-slate mb-1">
                      Para: {draft.to_email} &bull; {draft.thread.account}
                    </p>
                    <div className="bg-slate-50 rounded-lg p-3 mt-2">
                      <p className="text-sm text-navy whitespace-pre-wrap">
                        {draft.body_text.length > 200
                          ? draft.body_text.substring(0, 200) + '...'
                          : draft.body_text}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCancelSchedule(draft.id)}
                    disabled={actionLoading === draft.id}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex-shrink-0"
                  >
                    Cancelar programación
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent threads */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Hilos recientes</h2>
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {threads.length === 0 ? (
            <div className="p-8 text-center text-slate">
              No hay hilos de email todavía
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Asunto
                  </th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Cuenta
                  </th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Tipo
                  </th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Urgencia
                  </th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Msgs
                  </th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">
                    Último mensaje
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {threads.map((thread) => (
                  <tr key={thread.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-medium text-navy">
                        {thread.subject.length > 50
                          ? thread.subject.substring(0, 50) + '...'
                          : thread.subject}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-slate">
                        {thread.account.split('@')[0]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          CLASIFICACION_COLORS[thread.clasificacion] || CLASIFICACION_COLORS.pendiente
                        }`}
                      >
                        {thread.clasificacion}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          URGENCIA_COLORS[thread.urgencia]
                        }`}
                      >
                        {URGENCIA_LABELS[thread.urgencia]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate">{thread.message_count}</td>
                    <td className="px-5 py-3 text-sm text-slate">
                      {formatDate(thread.last_message_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
