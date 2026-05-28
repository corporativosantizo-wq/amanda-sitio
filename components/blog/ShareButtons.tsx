'use client'

// ============================================================================
// components/blog/ShareButtons.tsx
// Botones de compartir en redes (WhatsApp, Facebook, LinkedIn, X) + copiar link.
// - ShareButtons: fila o columna reutilizable (blog y admin).
// - BlogShareDock: sidebar sticky (desktop) + barra flotante (mobile) + Toaster.
// ============================================================================

import { toast, Toaster } from 'sonner'

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.582 0 11.94-5.359 11.943-11.893a11.821 11.821 0 00-3.416-8.45" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  )
}

interface ShareTarget {
  key: string
  label: string
  color: string
  href: string
  icon: React.ReactNode
}

function buildTargets(url: string, title: string): ShareTarget[] {
  const u = encodeURIComponent(url)
  const t = encodeURIComponent(title)
  return [
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, icon: <WhatsAppIcon /> },
    { key: 'facebook', label: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}`, icon: <FacebookIcon /> },
    { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`, icon: <LinkedInIcon /> },
    { key: 'twitter', label: 'X', color: '#0F172A', href: `https://twitter.com/intent/tweet?text=${t}&url=${u}`, icon: <XIcon /> },
  ]
}

function CircleLink({ target }: { target: ShareTarget }) {
  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      title={`Compartir en ${target.label}`}
      aria-label={`Compartir en ${target.label}`}
      className="flex items-center justify-center w-11 h-11 rounded-full text-white shadow-sm hover:scale-110 hover:shadow-md transition-all"
      style={{ backgroundColor: target.color }}
    >
      {target.icon}
    </a>
  )
}

function CopyButton({ url }: { url: string }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('¡Link copiado!')
    } catch {
      toast.error('No se pudo copiar el link')
    }
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copiar link"
      aria-label="Copiar link"
      className="flex items-center justify-center w-11 h-11 rounded-full bg-slate-light text-navy hover:bg-cyan hover:text-navy-dark hover:scale-110 transition-all shadow-sm"
    >
      <LinkIcon />
    </button>
  )
}

export function ShareButtons({
  url,
  title,
  variant = 'row',
  showLabel = true,
}: {
  url: string
  title: string
  variant?: 'row' | 'column'
  showLabel?: boolean
}) {
  const targets = buildTargets(url, title)
  const isColumn = variant === 'column'

  return (
    <div className={`flex gap-3 ${isColumn ? 'flex-col items-center' : 'flex-row flex-wrap items-center'}`}>
      {showLabel && !isColumn && (
        <span className="text-sm font-semibold text-slate mr-1">Compartir:</span>
      )}
      {targets.map((t) => (
        <CircleLink key={t.key} target={t} />
      ))}
      <CopyButton url={url} />
    </div>
  )
}

export function BlogShareDock({ url, title }: { url: string; title: string }) {
  return (
    <>
      {/* Sidebar sticky — desktop */}
      <div className="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-3 bg-white/90 backdrop-blur rounded-2xl border border-slate-light shadow-md px-3 py-4">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate mb-1">Compartir</span>
        <ShareButtons url={url} title={title} variant="column" showLabel={false} />
      </div>

      {/* Barra flotante — mobile */}
      <div className="flex lg:hidden fixed bottom-0 left-0 right-0 z-30 items-center justify-center gap-3 bg-white/95 backdrop-blur border-t border-slate-light shadow-[0_-2px_12px_rgba(0,0,0,0.06)] px-4 py-3">
        <ShareButtons url={url} title={title} variant="row" showLabel={false} />
      </div>

      <Toaster richColors position="bottom-center" />
    </>
  )
}
