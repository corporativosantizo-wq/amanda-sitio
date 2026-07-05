// ============================================================================
// components/admin/molly-badges.tsx
// Badges compartidos de Molly Mail (cuenta, clasificación, urgencia).
// Extraídos de app/admin/email/page.tsx para reusarlos en el modal de hilo.
// ============================================================================
'use client'

export const CLASIFICACION_COLORS: Record<string, string> = {
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
export const ACCOUNT_BADGE: Record<string, { label: string; className: string; emoji: string }> = {
  'contador@papeleo.legal':  { label: 'Contador',  className: 'bg-amber-100 text-amber-700',  emoji: '💰' },
  'asistente@papeleo.legal': { label: 'Asistente', className: 'bg-blue-100 text-blue-700',    emoji: '📧' },
  'amanda@papeleo.legal':    { label: 'Amanda',    className: 'bg-purple-100 text-purple-700', emoji: '⭐' },
}

export function AccountBadge({ account }: { account: string }) {
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

export const URGENCIA_LABELS = ['Info', 'Normal', 'Importante', 'Urgente']
export const URGENCIA_COLORS = [
  'bg-gray-100 text-gray-600',
  'bg-blue-100 text-blue-600',
  'bg-orange-100 text-orange-600',
  'bg-red-100 text-red-600',
]

// Status de borradores de respuesta (email_drafts)
export const DRAFT_STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pendiente:  { label: 'Pendiente',  className: 'bg-yellow-100 text-yellow-700' },
  programado: { label: 'Programado', className: 'bg-blue-100 text-blue-700' },
  enviado:    { label: 'Enviado',    className: 'bg-green-100 text-green-700' },
  rechazado:  { label: 'Rechazado',  className: 'bg-red-100 text-red-700' },
  pospuesto:  { label: 'Pospuesto',  className: 'bg-slate-100 text-slate-600' },
  aprobado:   { label: 'Aprobado',   className: 'bg-green-100 text-green-700' },
  editado:    { label: 'Editado',    className: 'bg-cyan-100 text-cyan-700' },
}
