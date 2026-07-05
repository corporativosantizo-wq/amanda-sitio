// ============================================================================
// components/admin/HiloDetalleModal.tsx
// Detalle de un hilo de Molly Mail: mensajes completos (HTML sanitizado en
// server + iframe sandbox como segunda capa), historial de borradores del
// hilo, y botón "Generar respuesta con IA" on-demand. El borrador generado
// cae en "Borradores pendientes" del dashboard — ahí vive todo el flujo de
// edición/ajuste/cuenta/aprobación existente. Este modal NUNCA envía nada.
// ============================================================================
'use client'

import { useEffect, useState, useCallback } from 'react'
import { adminFetch } from '@/lib/utils/admin-fetch'
import { SESSION_EXPIRED_MSG } from '@/lib/utils/auth-redirect'
import {
  AccountBadge,
  CLASIFICACION_COLORS,
  URGENCIA_LABELS,
  URGENCIA_COLORS,
  DRAFT_STATUS_BADGE,
} from '@/components/admin/molly-badges'

interface ThreadMessage {
  id: string
  from_email: string
  from_name: string | null
  to_emails: string[]
  cc_emails: string[] | null
  subject: string
  direction: string
  body_text: string | null
  body_html: string | null // ya sanitizado por el server
  attachments: Array<{ name?: string; nombre?: string }> | null
  received_at: string
}

interface ThreadDraft {
  id: string
  status: string
  subject: string
  to_email: string
  scheduled_at: string | null
  created_at: string
}

interface ThreadDetailData {
  thread: {
    id: string
    subject: string
    account: string
    clasificacion: string
    urgencia: number
    status: string
  }
  messages: ThreadMessage[]
  drafts: ThreadDraft[]
}

// Mini-documento para el iframe: tipografía legible + aislamiento total del
// CSS del correo respecto al dashboard. sandbox="" (allowlist vacía) impide
// scripts, same-origin, forms y popups — segunda capa sobre la sanitización.
function wrapEmailHtml(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:12px;font:14px/1.5 system-ui,-apple-system,sans-serif;word-break:break-word;color:#1e293b}img{max-width:100%}</style></head><body>${html}</body></html>`
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function HiloDetalleModal({
  threadId,
  onClose,
  onGoToDraft,
}: {
  threadId: string
  onClose: () => void
  onGoToDraft: (draftId: string) => void
}) {
  const [detail, setDetail] = useState<ThreadDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminFetch(`/api/admin/molly/threads/${threadId}`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || `Error ${res.status} al cargar el hilo`)
        if (!cancelled) setDetail(json.data)
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message === 'SESSION_EXPIRED' ? SESSION_EXPIRED_MSG : (err.message || 'Error al cargar el hilo'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [threadId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !generating) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, generating])

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await adminFetch(`/api/admin/molly/threads/${threadId}/generar-respuesta`, {
        method: 'POST',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status} al generar la respuesta`)
      // Con existente:true el destino es el mismo: la tarjeta del borrador
      onGoToDraft(json.data.id)
    } catch (err: any) {
      setError(err.message === 'SESSION_EXPIRED' ? SESSION_EXPIRED_MSG : (err.message || 'Error al generar la respuesta'))
      setGenerating(false)
    }
  }, [threadId, onGoToDraft])

  const draftPendiente = detail?.drafts.find((d) => d.status === 'pendiente')
  const draftProgramado = detail?.drafts.find((d) => d.status === 'programado')
  const hayInbound = detail?.messages.some((m) => m.direction === 'inbound') ?? false

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!generating) onClose() }}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-8 text-sm text-slate">Cargando hilo…</div>
        ) : !detail ? (
          <div className="p-8">
            <p className="text-sm text-red-600 mb-4">{error ?? 'No se pudo cargar el hilo'}</p>
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200">
              Cerrar
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-xl">
              <div className="min-w-0">
                <h3 className="font-semibold text-navy truncate">{detail.thread.subject}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <AccountBadge account={detail.thread.account} />
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${CLASIFICACION_COLORS[detail.thread.clasificacion] || CLASIFICACION_COLORS.pendiente}`}>
                    {detail.thread.clasificacion}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${URGENCIA_COLORS[detail.thread.urgencia] || URGENCIA_COLORS[0]}`}>
                    {URGENCIA_LABELS[detail.thread.urgencia] || 'Info'}
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={generating}
                className="text-slate hover:text-navy text-xl leading-none flex-shrink-0 disabled:opacity-50"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Mensajes */}
            <div className="px-6 py-4 space-y-4">
              {detail.messages.length === 0 && (
                <p className="text-sm text-slate">Este hilo no tiene mensajes registrados.</p>
              )}
              {detail.messages.map((msg) => (
                <div key={msg.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium text-navy">
                        {msg.direction === 'inbound' ? (
                          <span className="text-blue-600" aria-hidden>↓ </span>
                        ) : (
                          <span className="text-green-600" aria-hidden>↑ </span>
                        )}
                        {msg.from_name || msg.from_email}
                      </span>
                      <span className="text-xs text-slate">{formatDate(msg.received_at)}</span>
                    </div>
                    <p className="text-xs text-slate mt-0.5">
                      Para: {(msg.to_emails ?? []).join(', ') || '—'}
                      {msg.cc_emails?.length ? ` · CC: ${msg.cc_emails.join(', ')}` : ''}
                    </p>
                    {!!msg.attachments?.length && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {msg.attachments.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                            📎 {a.name || a.nombre || 'adjunto'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.body_html ? (
                    <iframe
                      title={`Mensaje de ${msg.from_email}`}
                      srcDoc={wrapEmailHtml(msg.body_html)}
                      sandbox=""
                      className="w-full bg-white"
                      style={{ height: 360, border: 0 }}
                    />
                  ) : msg.body_text ? (
                    <div className="px-4 py-3 text-sm text-navy whitespace-pre-wrap">{msg.body_text}</div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate italic">(sin contenido)</div>
                  )}
                </div>
              ))}

              {/* Borradores del hilo */}
              {detail.drafts.length > 0 && (
                <div>
                  <p className="text-xs text-slate font-medium mb-2">Borradores de este hilo:</p>
                  <div className="space-y-1.5">
                    {detail.drafts.map((d) => {
                      const badge = DRAFT_STATUS_BADGE[d.status] ?? { label: d.status, className: 'bg-slate-100 text-slate-600' }
                      return (
                        <div key={d.id} className="flex items-center gap-2 text-sm">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-slate text-xs">{formatDate(d.created_at)}</span>
                          <span className="text-navy truncate">{d.subject}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer de acción */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-xl">
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-xs text-slate">
                  {draftProgramado && !draftPendiente && 'Ya hay una respuesta programada para este hilo.'}
                  {!hayInbound && !draftPendiente && !draftProgramado && 'Este hilo no tiene mensajes entrantes que responder.'}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    disabled={generating}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cerrar
                  </button>
                  {draftPendiente ? (
                    <button
                      onClick={() => onGoToDraft(draftPendiente.id)}
                      className="px-4 py-2 bg-cyan text-navy-dark text-sm font-semibold rounded-lg hover:bg-cyan/90 transition-colors"
                    >
                      Ver borrador pendiente
                    </button>
                  ) : draftProgramado ? null : (
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !hayInbound}
                      className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {generating ? 'Generando…' : '🪄 Generar respuesta con IA'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
