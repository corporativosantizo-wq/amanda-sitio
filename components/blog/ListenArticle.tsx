'use client'

// ============================================================================
// components/blog/ListenArticle.tsx
// Botón "Escuchar artículo" + reproductor inline para el blog público.
// - Al pulsar, pide el MP3 a /api/blog/[slug]/audio (se genera la 1a vez y se
//   cachea en Storage). Muestra indicador de carga mientras se genera.
// - Reproductor HTML5 con controles + botón de descarga del MP3.
// ============================================================================

import { useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'loading' | 'ready' | 'error'

function HeadphonesIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
      <path d="M21 16a2 2 0 0 1-2 2h-1a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3zM3 16a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H3z" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function ListenArticle({ slug }: { slug: string }) {
  const [status, setStatus] = useState<Status>('idle')
  const audioRef = useRef<HTMLAudioElement>(null)

  // Mismo origen: el <audio> consume el MP3 desde nuestro endpoint (que hace
  // streaming desde Storage). Así evitamos CORS/CSP de la URL de Supabase y
  // habilitamos el seek vía peticiones Range.
  const audioSrc = `/api/blog/${slug}/audio`

  const generate = async () => {
    setStatus('loading')
    try {
      // Pre-genera y cachea el MP3 (muestra el indicador de carga la 1a vez).
      const res = await fetch(`${audioSrc}?prewarm=1`)
      if (!res.ok) throw new Error('No se pudo generar el audio')
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    if (status === 'ready' && audioRef.current) {
      audioRef.current.play().catch(() => {
        /* el navegador puede bloquear el autoplay; el usuario puede darle play */
      })
    }
  }, [status])

  if (status === 'idle') {
    return (
      <button
        type="button"
        onClick={generate}
        className="inline-flex items-center gap-2 px-5 py-3 bg-cyan text-navy-dark font-semibold rounded-xl shadow-sm hover:bg-navy hover:text-white transition-all"
      >
        <HeadphonesIcon />
        Escuchar artículo
      </button>
    )
  }

  if (status === 'loading') {
    return (
      <div className="inline-flex items-center gap-3 px-5 py-3 bg-slate-lighter text-navy font-semibold rounded-xl">
        <Spinner />
        <span>Generando audio…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-600">No se pudo generar el audio.</span>
        <button
          type="button"
          onClick={generate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-navy hover:text-white transition-all"
        >
          Reintentar
        </button>
      </div>
    )
  }

  // ready
  return (
    <div className="w-full max-w-xl rounded-2xl border border-slate-light bg-white shadow-sm p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-navy mb-3">
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan/20 text-cyan-dark">
          <HeadphonesIcon />
        </span>
        Escuchar artículo
      </div>
      <audio ref={audioRef} controls preload="auto" src={audioSrc} className="w-full">
        Tu navegador no soporta la reproducción de audio.
      </audio>
      <div className="mt-3 flex justify-end">
        <a
          href={`/api/blog/${slug}/audio?download=1`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-dark hover:text-navy transition-colors"
        >
          <DownloadIcon />
          Descargar MP3
        </a>
      </div>
    </div>
  )
}
