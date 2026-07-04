'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { adminFetch } from '@/lib/utils/admin-fetch'
import CorreosSalientes from '@/components/admin/CorreosSalientes'
import { CUENTAS_CORREO, swapFirma } from '@/lib/config/cuentas-correo'

// ── Types ──────────────────────────────────────────────────────────────────

interface Stats {
  totalThreads: number
  pendingDrafts: number
  emailsToday: number
  filteredToday: number
  threadsByClasificacion: Record<string, number>
}

interface FilteredThread {
  id: string
  subject: string
  account: string
  clasificacion: string
  updated_at: string
  messages: Array<{
    id: string
    from_email: string
    from_name: string | null
    subject: string
    clasificacion: string | null
    confidence_score: number | null
    received_at: string
  }>
}

interface Draft {
  id: string
  to_email: string
  subject: string
  body_text: string
  tone: string | null
  status: string
  scheduled_at: string | null
  send_account: string | null
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
  publicidad: 'bg-amber-100 text-amber-700',
  notificacion_sistema: 'bg-slate-100 text-slate-600',
  personal: 'bg-purple-100 text-purple-700',
  urgente: 'bg-orange-100 text-orange-700',
  pendiente: 'bg-yellow-100 text-yellow-700',
}

// Cuenta de buzón → badge (color + etiqueta corta)
const ACCOUNT_BADGE: Record<string, { label: string; className: string; emoji: string }> = {
  'contador@papeleo.legal':  { label: 'Contador',  className: 'bg-amber-100 text-amber-700',  emoji: '💰' },
  'asistente@papeleo.legal': { label: 'Asistente', className: 'bg-blue-100 text-blue-700',    emoji: '📧' },
  'amanda@papeleo.legal':    { label: 'Amanda',    className: 'bg-purple-100 text-purple-700', emoji: '⭐' },
}

function AccountBadge({ account }: { account: string }) {
  const cfg = ACCOUNT_BADGE[account] ?? {
    label: account.split('@')[0],
    className: 'bg-slate-100 text-slate-600',
    emoji: '📬',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.className}`}>
      <span aria-hidden>{cfg.emoji}</span>{cfg.label}
    </span>
  )
}

// Cuentas seleccionables en el filtro (debe coincidir con ACCOUNTS del backend)
const ACCOUNT_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'contador@papeleo.legal', label: '💰 Contador' },
  { value: 'asistente@papeleo.legal', label: '📧 Asistente' },
]

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

function MollyMailContent() {
  const searchParams = useSearchParams()
  const highlightDraftId = searchParams.get('draft')
  const draftRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [stats, setStats] = useState<Stats | null>(null)
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [scheduled, setScheduled] = useState<Draft[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [triggerLoading, setTriggerLoading] = useState(false)
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({})
  // Cuenta emisora elegida por borrador (default: la cuenta del hilo)
  const [sendAccounts, setSendAccounts] = useState<Record<string, string>>({})
  // Instrucción de "Ajustar con IA" por borrador
  const [aiInstructions, setAiInstructions] = useState<Record<string, string>>({})
  const [adjustingId, setAdjustingId] = useState<string | null>(null)
  // Borradores donde el swap de firma no encontró la firma exacta
  const [firmaHints, setFirmaHints] = useState<Record<string, boolean>>({})
  const [schedulingDraft, setSchedulingDraft] = useState<string | null>(null)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [filtered, setFiltered] = useState<FilteredThread[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [accountFilter, setAccountFilter] = useState('')

  const fetchData = useCallback(async () => {
    try {
      const threadsUrl = `/api/admin/molly?limit=10${accountFilter ? `&account=${encodeURIComponent(accountFilter)}` : ''}`
      const [statsRes, draftsRes, threadsRes, filteredRes] = await Promise.all([
        adminFetch('/api/admin/molly/stats'),
        adminFetch('/api/admin/molly/drafts'),
        adminFetch(threadsUrl),
        adminFetch('/api/admin/molly/filtered'),
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
      if (filteredRes.ok) {
        const f = await filteredRes.json()
        setFiltered(f.data ?? [])
      }
    } catch (err) {
      console.error('Error cargando datos:', err)
    } finally {
      setLoading(false)
    }
  }, [accountFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-scroll to draft from ?draft= query param
  useEffect(() => {
    if (highlightDraftId && !loading && draftRefs.current[highlightDraftId]) {
      draftRefs.current[highlightDraftId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightDraftId, loading, drafts])

  const selectedAccount = (draft: Draft) => sendAccounts[draft.id] ?? draft.thread.account

  // Al cambiar la cuenta emisora, reemplaza la firma horneada en el texto por
  // la de la cuenta nueva (swap determinístico, sin IA). Si no encuentra una
  // firma conocida, deja el texto intacto y muestra el aviso ámbar.
  const handleAccountChange = (draft: Draft, nueva: string) => {
    const anterior = selectedAccount(draft)
    if (nueva === anterior) return
    setSendAccounts((prev) => ({ ...prev, [draft.id]: nueva }))

    const texto = editedBodies[draft.id] ?? draft.body_text
    const swapped = swapFirma(texto, anterior, nueva)
    if (swapped !== null) {
      setEditedBodies((prev) => ({ ...prev, [draft.id]: swapped }))
      setFirmaHints((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
    } else {
      setFirmaHints((prev) => ({ ...prev, [draft.id]: true }))
    }
  }

  const handleAdjustDraft = async (draft: Draft) => {
    const instruccion = (aiInstructions[draft.id] ?? '').trim()
    if (!instruccion) return
    setAdjustingId(draft.id)
    setErrorMsg(null)
    try {
      const payload: Record<string, string> = {
        instruccion,
        // Firma/tono de la cuenta seleccionada en este momento
        account: selectedAccount(draft),
      }
      // Si Amanda ya editó el textarea, la IA parte del texto editado
      const edited = editedBodies[draft.id]
      if (edited !== undefined && edited !== draft.body_text) payload.currentBody = edited

      const res = await adminFetch(`/api/admin/molly/drafts/${draft.id}/ajustar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Error al ajustar el borrador con IA')

      const nuevo = json.data
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draft.id ? { ...d, body_text: nuevo.body_text, tone: nuevo.tone } : d,
        ),
      )
      // El textarea pasa a mostrar el borrador regenerado (sigue editable)
      setEditedBodies((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      setAiInstructions((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      setFirmaHints((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ajustar el borrador con IA')
    } finally {
      setAdjustingId(null)
    }
  }

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
      if (action === 'approve' && sendAccounts[draftId]) payload.send_account = sendAccounts[draftId]

      const res = await adminFetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Error ${res.status} al procesar la acción`)
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
      if (sendAccounts[draftId]) payload.send_account = sendAccounts[draftId]

      const res = await adminFetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `Error ${res.status} al programar`)
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
      await adminFetch('/api/admin/molly/drafts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId, action: 'cancel_schedule' }),
      })

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
      await adminFetch('/api/admin/molly', { method: 'POST' })
      await fetchData()
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setTriggerLoading(false)
    }
  }

  const handleRestore = async (threadId: string) => {
    setRestoringId(threadId)
    try {
      await adminFetch('/api/admin/molly/filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId }),
      })
      fetchData()
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión')
    } finally {
      setRestoringId(null)
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
        <div className="flex gap-3">
          <a
            href="/admin/email/comunicaciones"
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            📝 Nuevo correo
          </a>
          <button
            onClick={handleTrigger}
            disabled={triggerLoading}
            className="px-4 py-2 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan/90 transition-colors disabled:opacity-50"
          >
            {triggerLoading ? 'Revisando...' : 'Revisar emails ahora'}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
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
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="text-sm text-slate mb-1">Filtrados hoy</div>
            <div className="text-2xl font-bold text-red-500">{stats.filteredToday}</div>
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

      {/* Correos salientes nuevos (sin hilo previo) */}
      <CorreosSalientes />

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
              <div
                key={draft.id}
                ref={(el) => { draftRefs.current[draft.id] = el }}
                className={`bg-white rounded-xl shadow-sm p-5${highlightDraftId === draft.id ? ' ring-2 ring-cyan ring-offset-2' : ''}`}
              >
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
                    <p className="text-sm text-slate mb-1 flex items-center gap-1.5">
                      <span>De: {draft.message?.from_name || draft.to_email}</span>
                      <span aria-hidden>&rarr;</span>
                      <AccountBadge account={draft.thread.account} />
                    </p>
                    {draft.message?.resumen && (
                      <p className="text-sm text-slate italic mb-2">{draft.message.resumen}</p>
                    )}
                    <div className="bg-slate-50 rounded-lg p-3 mt-2">
                      <p className="text-xs text-slate mb-1 font-medium">Borrador (editable):</p>
                      <textarea
                        className="w-full text-sm text-navy bg-white border border-gray-200 rounded-lg p-2 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-cyan/50 focus:border-cyan disabled:opacity-50"
                        value={editedBodies[draft.id] ?? draft.body_text}
                        disabled={adjustingId === draft.id}
                        onChange={(e) =>
                          setEditedBodies((prev) => ({
                            ...prev,
                            [draft.id]: e.target.value,
                          }))
                        }
                      />
                      {/* Ajustar con IA: regenera el borrador siguiendo la instrucción */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={aiInstructions[draft.id] ?? ''}
                          onChange={(e) =>
                            setAiInstructions((prev) => ({ ...prev, [draft.id]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdjustDraft(draft)
                          }}
                          placeholder='Instrucción para la IA, ej. "más formal", "pedí los documentos primero"'
                          disabled={adjustingId === draft.id}
                          className="flex-1 text-sm text-navy bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan/50 focus:border-cyan disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleAdjustDraft(draft)}
                          disabled={
                            !(aiInstructions[draft.id] ?? '').trim() ||
                            adjustingId === draft.id ||
                            actionLoading === draft.id
                          }
                          className="px-4 py-2 bg-cyan text-navy-dark text-sm font-semibold rounded-lg hover:bg-cyan/90 transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          {adjustingId === draft.id ? 'Ajustando…' : '✨ Ajustar con IA'}
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate mt-2">{formatDate(draft.created_at)}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0 w-44">
                    {/* Cuenta emisora (default: la cuenta donde llegó el correo) */}
                    <div>
                      <label className="block text-xs text-slate font-medium mb-1">Enviar desde:</label>
                      <select
                        value={selectedAccount(draft)}
                        onChange={(e) => handleAccountChange(draft, e.target.value)}
                        disabled={actionLoading === draft.id || adjustingId === draft.id}
                        className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white text-navy focus:outline-none focus:ring-2 focus:ring-cyan/50 disabled:opacity-50"
                      >
                        {CUENTAS_CORREO.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      {firmaHints[draft.id] && (
                        <p className="text-xs text-amber-600 mt-1">
                          No encontré la firma en el texto — usá &quot;Ajustar con IA&quot; para regenerarla con la cuenta nueva.
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        handleDraftAction(
                          draft.id,
                          'approve',
                          // Aprueba lo que se ve en el textarea (incluye swap de firma)
                          editedBodies[draft.id] !== undefined &&
                            editedBodies[draft.id] !== draft.body_text
                            ? editedBodies[draft.id]
                            : undefined,
                        )
                      }
                      disabled={actionLoading === draft.id || adjustingId === draft.id}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {editedBodies[draft.id] !== undefined &&
                      editedBodies[draft.id] !== draft.body_text
                        ? 'Aprobar (editado)'
                        : 'Aprobar'}
                    </button>
                    <button
                      onClick={() => {
                        setSchedulingDraft(schedulingDraft === draft.id ? null : draft.id)
                        setScheduleDate('')
                        setScheduleTime('')
                      }}
                      disabled={actionLoading === draft.id || adjustingId === draft.id}
                      className="px-4 py-2 bg-amber-50 text-amber-700 text-sm font-semibold rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      Programar
                    </button>
                    <button
                      onClick={() => handleDraftAction(draft.id, 'reject')}
                      disabled={actionLoading === draft.id || adjustingId === draft.id}
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
                    <p className="text-sm text-slate mb-1 flex items-center gap-1.5">
                      <span>Para: {draft.to_email}</span>
                      <span aria-hidden>&bull;</span>
                      <span>Desde:</span>
                      <AccountBadge account={draft.send_account ?? draft.thread.account} />
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

      {/* Filtered emails */}
      {filtered.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-navy mb-4">
            Filtrados <span className="text-sm font-normal text-slate">({filtered.length})</span>
          </h2>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">Asunto</th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">De</th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">Tipo</th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">Confianza</th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3">Fecha</th>
                  <th className="text-left text-xs font-medium text-slate uppercase tracking-wider px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((t) => {
                  const msg = t.messages?.[0]
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-sm font-medium text-navy">
                          {t.subject.length > 40 ? t.subject.substring(0, 40) + '...' : t.subject}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate">
                        {msg?.from_name || msg?.from_email || '—'}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${CLASIFICACION_COLORS[t.clasificacion] || CLASIFICACION_COLORS.pendiente}`}>
                          {t.clasificacion}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate">
                        {msg?.confidence_score != null ? `${Math.round(msg.confidence_score * 100)}%` : '—'}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate">
                        {formatDate(t.updated_at)}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleRestore(t.id)}
                          disabled={restoringId === t.id}
                          className="px-3 py-1 text-xs font-medium bg-white text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 disabled:opacity-50 transition-colors"
                        >
                          {restoringId === t.id ? 'Restaurando...' : 'No es spam'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent threads */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-navy">Hilos recientes</h2>
          <div className="flex gap-1.5">
            {ACCOUNT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setAccountFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                  accountFilter === f.value
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
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
                      <AccountBadge account={thread.account} />
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

export default function MollyMailPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="animate-pulse space-y-6"><div className="h-8 bg-gray-200 rounded w-48" /><div className="grid grid-cols-3 gap-4">{[1, 2, 3].map((i) => (<div key={i} className="h-24 bg-gray-200 rounded-xl" />))}</div><div className="h-64 bg-gray-200 rounded-xl" /></div></div>}>
      <MollyMailContent />
    </Suspense>
  )
}
