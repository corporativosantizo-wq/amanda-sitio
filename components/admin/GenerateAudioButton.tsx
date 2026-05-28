'use client'

// ============================================================================
// components/admin/GenerateAudioButton.tsx
// Pre-genera (y cachea) el audio TTS de un post desde el admin, para que el
// primer visitante no espere. Llama a /api/blog/[slug]/audio?prewarm=1.
// ============================================================================

import { useState } from 'react'

type State = 'idle' | 'working' | 'done' | 'error'

export default function GenerateAudioButton({ slug }: { slug: string }) {
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')

  const generate = async () => {
    setState('working')
    setMessage('')
    try {
      const res = await fetch(`/api/blog/${slug}/audio?prewarm=1`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'No se pudo generar el audio')
      setState('done')
      setMessage(data.generated ? 'Audio generado y guardado en cache.' : 'El audio ya estaba en cache.')
    } catch (err: any) {
      setState('error')
      setMessage(err.message || 'Error al generar el audio')
    }
  }

  return (
    <div>
      <h2 className="font-display text-lg font-bold text-navy mb-1">🔊 Audio del artículo</h2>
      <p className="text-sm text-slate mb-4">
        Pre-genera la narración (OpenAI TTS) para que el visitante no espere la primera vez.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={state === 'working'}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-azure text-white font-semibold rounded-lg hover:bg-navy transition-colors disabled:opacity-50"
        >
          {state === 'working' ? 'Generando…' : '🔊 Generar audio'}
        </button>
        {message && (
          <span className={`text-sm ${state === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message}
          </span>
        )}
      </div>
    </div>
  )
}
