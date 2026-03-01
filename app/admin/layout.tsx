'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AdminUserProvider, useAdminUser } from '@/lib/rbac/admin-user-context'
import type { Modulo } from '@/lib/rbac/permissions'
import { CONTABILIDAD_SUBMODULES } from '@/lib/rbac/permissions'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminUserProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminUserProvider>
  )
}

// ── Role labels ─────────────────────────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  admin: 'Administradora',
  abogado: 'Abogado/a',
  asistente: 'Asistente',
  contador: 'Contador/a',
  pasante: 'Pasante',
}

// ── Section colors ──────────────────────────────────────────────────────────

const SECTION_COLORS = {
  principal: '#3B82F6',
  legal: '#EAB308',
  gestion: '#F97316',
  contenido: '#A855F7',
} as const

type SectionKey = keyof typeof SECTION_COLORS

// ── Nav item type ───────────────────────────────────────────────────────────

interface NavItem {
  name: string
  href: string
  modulo?: Modulo
  icon: string
  children?: { name: string; href: string }[]
}

// ── Section definitions ─────────────────────────────────────────────────────

interface Section {
  key: SectionKey
  label: string
  color: string
  items: NavItem[]
}

const SECTIONS: Section[] = [
  {
    key: 'principal',
    label: 'PRINCIPAL',
    color: SECTION_COLORS.principal,
    items: [
      { name: 'Dashboard', href: '/admin', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { name: 'Calendario', href: '/admin/calendario', modulo: 'calendario', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { name: 'Clientes', href: '/admin/clientes', modulo: 'clientes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { name: 'Expedientes', href: '/admin/expedientes', modulo: 'expedientes', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
    ],
  },
  {
    key: 'legal',
    label: 'LEGAL',
    color: SECTION_COLORS.legal,
    items: [
      { name: 'Mercantil', href: '/admin/mercantil', modulo: 'mercantil' as Modulo, icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { name: 'Laboral', href: '/admin/laboral', modulo: 'laboral' as Modulo, icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      {
        name: 'Notariado', href: '/admin/notariado', modulo: 'notariado',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        children: [
          { name: 'Avisos', href: '/admin/notariado/avisos' },
          { name: 'Indice', href: '/admin/notariado/indice' },
          { name: 'Plantilla', href: '/admin/notariado/configuracion' },
        ],
      },
      { name: 'Proveedores', href: '/admin/proveedores', modulo: 'proveedores', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    ],
  },
  {
    key: 'gestion',
    label: 'GESTION',
    color: SECTION_COLORS.gestion,
    items: [
      {
        name: 'Contabilidad', href: '/admin/contabilidad', modulo: 'contabilidad',
        icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        children: [
          { name: 'Cotizaciones', href: '/admin/contabilidad/cotizaciones' },
          { name: 'Facturas', href: '/admin/contabilidad/facturas' },
          { name: 'Pagos', href: '/admin/contabilidad/pagos' },
          { name: 'Gastos', href: '/admin/contabilidad/gastos' },
          { name: 'Reportes', href: '/admin/contabilidad/reportes' },
        ],
      },
      { name: 'Documentos', href: '/admin/documentos', modulo: 'documentos', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
      { name: 'Clasificador', href: '/admin/clasificador', modulo: 'clasificador', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
      { name: 'Plantillas', href: '/admin/plantillas', modulo: 'plantillas', icon: 'M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2' },
    ],
  },
  {
    key: 'contenido',
    label: 'CONTENIDO',
    color: SECTION_COLORS.contenido,
    items: [
      {
        name: 'Jurisprudencia', href: '/admin/jurisprudencia', modulo: 'jurisprudencia',
        icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        children: [
          { name: 'Buscar', href: '/admin/jurisprudencia/buscar' },
        ],
      },
      { name: 'Posts', href: '/admin/posts', modulo: 'posts', icon: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z' },
      { name: 'Productos', href: '/admin/productos', modulo: 'productos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { name: 'Mensajes', href: '/admin/mensajes', modulo: 'mensajes', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    ],
  },
]

// Quick action pads
const QUICK_ACTIONS: { name: string; href: string; modulo?: Modulo; color: string; icon: string }[] = [
  {
    name: 'Molly Mail',
    href: '/admin/email',
    modulo: 'email',
    color: '#3B82F6',
    icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75',
  },
  {
    name: 'Asistente IA',
    href: '/admin/ai',
    color: '#22D3EE',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2 2 0 01-1.591-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5',
  },
  {
    name: 'Tareas',
    href: '/admin/tareas',
    modulo: 'tareas',
    color: '#F97316',
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
]

// ── Clock component ─────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('es-GT', {
        hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala',
      }))
    }
    update()
    const id = setInterval(update, 30000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-xs" style={{ color: '#8494A7' }}>{time}</span>
}

// ── Arturia button (desktop grid) ───────────────────────────────────────────

function ArturiaButton({
  href,
  active,
  color,
  icon,
  label,
  hasChevron,
  expanded,
  onClick,
  onNavigate,
}: {
  href: string
  active: boolean
  color: string
  icon: string
  label: string
  hasChevron?: boolean
  expanded?: boolean
  onClick?: () => void
  onNavigate?: () => void
}) {
  const [pressed, setPressed] = useState(false)

  const baseStyle: React.CSSProperties = {
    background: active
      ? `linear-gradient(180deg, ${color}08 0%, ${color}12 100%)`
      : 'linear-gradient(180deg, #F8F9FB 0%, #EEF1F5 100%)',
    border: active
      ? `1.5px solid ${color}59`
      : '1.5px solid rgba(0,0,0,0.06)',
    boxShadow: pressed
      ? 'inset 0 2px 4px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)'
      : '0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.7)',
    borderRadius: 11,
    transform: pressed ? 'scale(0.97) translateY(1px)' : undefined,
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  return (
    <Link
      href={href}
      title={label}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
        onNavigate?.()
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className="arturia-btn relative flex items-center gap-1.5 px-2 py-2 select-none"
      style={baseStyle}
    >
      {/* LED indicator */}
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm"
          style={{
            width: 4,
            height: 16,
            background: color,
            boxShadow: `0 0 8px ${color}99`,
          }}
        />
      )}

      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke={active ? color : '#64748B'}
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <span
        className="truncate leading-tight"
        style={{
          color: active ? '#1E293B' : '#475569',
          fontWeight: active ? 700 : 500,
          fontSize: 10.5,
        }}
      >
        {label}
      </span>

      {hasChevron && (
        <svg
          className="w-2.5 h-2.5 ml-auto flex-shrink-0 transition-transform duration-150"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            stroke: active ? color : '#94A3B8',
          }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Link>
  )
}

// ── Mobile nav row (single column, full label) ──────────────────────────────

function MobileNavRow({
  href,
  active,
  color,
  icon,
  label,
  hasChevron,
  expanded,
  onClick,
  onNavigate,
}: {
  href: string
  active: boolean
  color: string
  icon: string
  label: string
  hasChevron?: boolean
  expanded?: boolean
  onClick?: () => void
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
        onNavigate?.()
      }}
      className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      style={{
        background: active ? `${color}0C` : 'transparent',
      }}
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm"
          style={{
            width: 3,
            height: 16,
            background: color,
            boxShadow: `0 0 6px ${color}80`,
          }}
        />
      )}
      <svg
        className="w-[18px] h-[18px] flex-shrink-0"
        fill="none"
        stroke={active ? color : '#64748B'}
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <span
        style={{
          fontSize: 13,
          fontWeight: active ? 600 : 400,
          color: active ? '#1A2332' : '#475569',
        }}
      >
        {label}
      </span>
      {hasChevron && (
        <svg
          className="w-3 h-3 ml-auto flex-shrink-0 transition-transform duration-150"
          style={{
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            stroke: active ? color : '#94A3B8',
          }}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      )}
    </Link>
  )
}

// ── Quick action pad (desktop) ──────────────────────────────────────────────

function QuickPad({
  href,
  active,
  color,
  icon,
  label,
  onNavigate,
}: {
  href: string
  active: boolean
  color: string
  icon: string
  label: string
  onNavigate?: () => void
}) {
  const [pressed, setPressed] = useState(false)

  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      className="flex-1 flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl select-none arturia-btn"
      style={{
        background: active
          ? `linear-gradient(180deg, ${color}18 0%, ${color}25 100%)`
          : `linear-gradient(180deg, #F8F9FB 0%, #EEF1F5 100%)`,
        border: active
          ? `1.5px solid ${color}50`
          : '1.5px solid rgba(0,0,0,0.06)',
        boxShadow: pressed
          ? `inset 0 2px 6px rgba(0,0,0,0.1)`
          : `0 2px 6px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)`,
        transform: pressed ? 'scale(0.96) translateY(1px)' : undefined,
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke={active ? color : '#64748B'}
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
      <span
        style={{
          fontSize: 9.5,
          fontWeight: active ? 700 : 600,
          color: active ? color : '#64748B',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
    </Link>
  )
}

// ── Quick action icon (mobile compact) ──────────────────────────────────────

function QuickIconMobile({
  href,
  active,
  color,
  icon,
  label,
  onNavigate,
}: {
  href: string
  active: boolean
  color: string
  icon: string
  label: string
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      title={label}
      onClick={() => onNavigate?.()}
      className="flex items-center justify-center rounded-lg"
      style={{
        width: 40,
        height: 40,
        background: active ? `${color}15` : 'linear-gradient(180deg, #F8F9FB 0%, #EEF1F5 100%)',
        border: active ? `1.5px solid ${color}40` : '1.5px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}
    >
      <svg
        className="w-[18px] h-[18px]"
        fill="none"
        stroke={active ? color : '#64748B'}
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={icon} />
      </svg>
    </Link>
  )
}

// ── Expanded children list ──────────────────────────────────────────────────

function ChildrenList({
  children,
  color,
  pathname,
  onNavigate,
  isMobile,
}: {
  children: { name: string; href: string }[]
  color: string
  pathname: string
  onNavigate: () => void
  isMobile: boolean
}) {
  return (
    <div style={{ paddingLeft: isMobile ? 16 : 24 }} className="mt-1.5 space-y-0.5">
      {children.map((child) => {
        const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
        return (
          <Link
            key={child.href}
            href={child.href}
            onClick={onNavigate}
            className="relative flex items-center cursor-pointer transition-all duration-150"
            style={{
              padding: '7px 12px 7px 24px',
              borderRadius: 8,
              background: childActive ? `${color}0F` : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!childActive) {
                e.currentTarget.style.background = `${color}0A`
              }
            }}
            onMouseLeave={(e) => {
              if (!childActive) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {/* Mini LED */}
            {childActive && (
              <span
                className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-sm"
                style={{
                  width: 3,
                  height: 12,
                  background: color,
                  boxShadow: `0 0 6px ${color}80`,
                }}
              />
            )}
            <span
              style={{
                fontSize: 13,
                fontWeight: childActive ? 600 : 400,
                color: childActive ? '#1A2332' : '#6B7C93',
              }}
            >
              {child.name}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

// ── Inner layout ────────────────────────────────────────────────────────────

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const { user, loading, hasModule, isAdmin } = useAdminUser()

  const isActive = useCallback((href: string) => {
    if (href === '/admin') return pathname === '/admin'
    return pathname.startsWith(href)
  }, [pathname])

  // Auto-expand group if a child is active
  useEffect(() => {
    for (const section of SECTIONS) {
      for (const item of section.items) {
        if (item.children && isActive(item.href)) {
          setExpandedGroup(item.href)
          return
        }
      }
    }
  }, [pathname, isActive])

  const canSee = useCallback((modulo?: Modulo) => {
    if (!modulo) return true
    if (loading) return true
    return hasModule(modulo)
  }, [loading, hasModule])

  const filterChildren = useCallback((item: NavItem) => {
    return (item.children ?? []).filter((child) => {
      if (isAdmin) return true
      if (!user) return true
      if (item.modulo && user.modulos_permitidos.includes(item.modulo)) return true
      if (item.modulo === 'contabilidad') {
        const subSegment = child.href.split('/').pop() ?? ''
        return CONTABILIDAD_SUBMODULES[subSegment]
          ? user.modulos_permitidos.includes(subSegment as Modulo)
          : false
      }
      return true
    })
  }, [isAdmin, user])

  const displayName = user?.nombre ?? 'Panel Admin'
  const rolLabel = user ? (ROL_LABELS[user.rol] ?? user.rol) : 'Panel Admin'
  const closeMobile = () => setSidebarOpen(false)

  const sidebarBg: React.CSSProperties = {
    background: 'linear-gradient(180deg, #F5F7FA 0%, #ECF0F5 40%, #E4E8EE 100%)',
    borderRight: '1px solid #D1D6DE',
    boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
  }

  const brushedTexture: React.CSSProperties = {
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.3) 1px, rgba(255,255,255,0.3) 2px)',
  }

  // ── Render sidebar content ──

  const sidebarContent = (
    <div className="flex flex-col h-full" style={brushedTexture}>
      {/* ── Profile header ── */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        {/* Desktop: 42px avatar */}
        <div
          className="hidden md:flex items-center justify-center flex-shrink-0"
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #3B82F6 0%, #22D3EE 100%)',
          }}
        >
          <span className="text-white font-bold text-sm">AS</span>
        </div>
        {/* Mobile: 32px avatar */}
        <div
          className="flex md:hidden items-center justify-center flex-shrink-0"
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #3B82F6 0%, #22D3EE 100%)',
          }}
        >
          <span className="text-white font-bold text-xs">AS</span>
        </div>
        <div className="min-w-0 flex-1">
          <div style={{ color: '#2563EB', fontWeight: 600, fontSize: 14 }} className="truncate">
            {displayName}
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                color: '#06B6D4',
                textTransform: 'uppercase',
                letterSpacing: 1.8,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {rolLabel}
            </span>
            {/* Clock: desktop only */}
            <span className="hidden md:inline"><Clock /></span>
          </div>
        </div>
      </div>

      {/* ── Quick action pads — desktop: full pads, mobile: compact icons ── */}
      <div className="hidden md:flex gap-2 px-4 py-3">
        {QUICK_ACTIONS.filter((qa) => canSee(qa.modulo)).map((qa) => (
          <QuickPad
            key={qa.href}
            href={qa.href}
            active={isActive(qa.href)}
            color={qa.color}
            icon={qa.icon}
            label={qa.name}
            onNavigate={closeMobile}
          />
        ))}
      </div>
      <div className="flex md:hidden gap-2 px-4 py-2 justify-center">
        {QUICK_ACTIONS.filter((qa) => canSee(qa.modulo)).map((qa) => (
          <QuickIconMobile
            key={qa.href}
            href={qa.href}
            active={isActive(qa.href)}
            color={qa.color}
            icon={qa.icon}
            label={qa.name}
            onNavigate={closeMobile}
          />
        ))}
      </div>

      {/* ── Engraved divider ── */}
      <div className="px-4">
        <div
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.07) 50%, transparent 100%)',
          }}
        />
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
          }}
        />
      </div>

      {/* ── Scrollable sections ── */}
      <nav className="flex-1 overflow-y-auto px-4 py-3 space-y-4" style={{ scrollbarWidth: 'thin' }}>
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter((item) => canSee(item.modulo))
          if (visibleItems.length === 0) return null

          return (
            <div key={section.key}>
              {/* Section label — desktop only */}
              <div className="hidden md:flex items-center gap-2 mb-2 px-1">
                <span
                  className="flex-shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: section.color,
                    boxShadow: `0 0 6px ${section.color}60`,
                  }}
                />
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 700,
                    letterSpacing: 2.5,
                    color: section.color,
                    textTransform: 'uppercase',
                  }}
                >
                  {section.label}
                </span>
              </div>

              {/* Desktop: 2-column grid */}
              <div className="hidden md:grid grid-cols-2 gap-1.5">
                {visibleItems.map((item) => {
                  const hasKids = item.children && item.children.length > 0
                  const isExpanded = expandedGroup === item.href
                  const itemActive = isActive(item.href)

                  return (
                    <ArturiaButton
                      key={item.href}
                      href={item.href}
                      active={itemActive}
                      color={section.color}
                      icon={item.icon}
                      label={item.name}
                      hasChevron={hasKids}
                      expanded={isExpanded}
                      onNavigate={hasKids ? undefined : closeMobile}
                      onClick={hasKids ? () => {
                        setExpandedGroup(isExpanded ? null : item.href)
                      } : undefined}
                    />
                  )
                })}
              </div>

              {/* Desktop: expanded children below grid */}
              <div className="hidden md:block">
                {visibleItems.map((item) => {
                  if (!item.children || expandedGroup !== item.href) return null
                  const kids = filterChildren(item)
                  if (kids.length === 0) return null
                  return (
                    <ChildrenList
                      key={item.href + '-children'}
                      color={section.color}
                      pathname={pathname}
                      onNavigate={closeMobile}
                      isMobile={false}
                    >
                      {kids}
                    </ChildrenList>
                  )
                })}
              </div>

              {/* Mobile: single-column list */}
              <div className="md:hidden space-y-0.5">
                {visibleItems.map((item) => {
                  const hasKids = item.children && item.children.length > 0
                  const isExpanded = expandedGroup === item.href
                  const itemActive = isActive(item.href)

                  return (
                    <div key={item.href}>
                      <MobileNavRow
                        href={item.href}
                        active={itemActive}
                        color={section.color}
                        icon={item.icon}
                        label={item.name}
                        hasChevron={hasKids}
                        expanded={isExpanded}
                        onNavigate={hasKids ? undefined : closeMobile}
                        onClick={hasKids ? () => {
                          setExpandedGroup(isExpanded ? null : item.href)
                        } : undefined}
                      />
                      {hasKids && isExpanded && (() => {
                        const kids = filterChildren(item)
                        if (kids.length === 0) return null
                        return (
                          <ChildrenList
                            color={section.color}
                            pathname={pathname}
                            onNavigate={closeMobile}
                            isMobile={true}
                          >
                            {kids}
                          </ChildrenList>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── Bottom bar ── */}
      <div
        className="flex-shrink-0 px-4 py-3 flex items-center gap-2"
        style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
      >
        {/* Config button */}
        {canSee('configuracion') && (
          <Link
            href="/admin/configuracion/usuarios"
            onClick={closeMobile}
            className="arturia-btn flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs"
            style={{
              background: isActive('/admin/configuracion')
                ? 'linear-gradient(180deg, #64748B08 0%, #64748B12 100%)'
                : 'linear-gradient(180deg, #F8F9FB 0%, #EEF1F5 100%)',
              border: isActive('/admin/configuracion')
                ? '1.5px solid #64748B59'
                : '1.5px solid rgba(0,0,0,0.06)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.7)',
              color: '#64748B',
              fontWeight: isActive('/admin/configuracion') ? 700 : 500,
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ fontSize: 11 }}>Config</span>
          </Link>
        )}

        {/* Molly active indicator — desktop only */}
        <div className="hidden md:flex items-center gap-1.5 ml-auto">
          <span
            className="animate-pulse"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#22D3EE',
              boxShadow: '0 0 6px #22D3EE80',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: 10, color: '#8494A7', fontWeight: 500 }}>Molly activa</span>
        </div>

        {/* Sitio link — push right on mobile */}
        <Link
          href="/"
          className="flex items-center gap-1 md:ml-2 ml-auto text-xs transition-colors hover:opacity-80"
          style={{ color: '#8494A7' }}
        >
          <span style={{ fontSize: 11 }}>Sitio</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile hamburger button */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 md:hidden"
        style={{ background: 'linear-gradient(180deg, #F5F7FA 0%, #ECF0F5 100%)', borderBottom: '1px solid #D1D6DE' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: '#64748B' }}
          aria-label="Abrir menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #3B82F6 0%, #22D3EE 100%)',
            }}
          >
            <span className="text-white font-bold text-xs">AS</span>
          </div>
          <span style={{ color: '#2563EB', fontWeight: 600, fontSize: 14 }}>Admin</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ ...sidebarBg, width: 264 }}
      >
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors md:hidden z-10"
          style={{ color: '#64748B' }}
          aria-label="Cerrar menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="md:ml-[264px] min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
