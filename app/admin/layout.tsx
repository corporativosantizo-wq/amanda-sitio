'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Analytics } from "@vercel/analytics/react"
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

// ── Inner layout (has access to context) ────────────────────────────────────

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, loading, hasModule, isAdmin } = useAdminUser()

  const navigation: {
    name: string
    href: string
    modulo?: Modulo
    icon: React.ReactNode
    children?: { name: string; href: string }[]
  }[] = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Clientes',
      href: '/admin/clientes',
      modulo: 'clientes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      name: 'Expedientes',
      href: '/admin/expedientes',
      modulo: 'expedientes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
        </svg>
      ),
    },
    {
      name: 'Mercantil',
      href: '/admin/mercantil',
      modulo: 'mercantil' as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Laboral',
      href: '/admin/laboral',
      modulo: 'laboral' as const,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'Proveedores',
      href: '/admin/proveedores',
      modulo: 'proveedores',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      name: 'Calendario',
      href: '/admin/calendario',
      modulo: 'calendario',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      name: 'Tareas',
      href: '/admin/tareas',
      modulo: 'tareas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      name: 'Asistente IA',
      href: '/admin/ai',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a2.25 2.25 0 01-1.591.659H9.061a2 2 0 01-1.591-.659L5 14.5m14 0V17a2 2 0 01-2 2H7a2 2 0 01-2-2v-2.5" />
        </svg>
      ),
    },
    // ── Documentos & Legal ──
    {
      name: 'Documentos',
      href: '/admin/documentos',
      modulo: 'documentos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        </svg>
      ),
    },
    {
      name: 'Clasificador',
      href: '/admin/clasificador',
      modulo: 'clasificador',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
      ),
    },
    {
      name: 'Plantillas',
      href: '/admin/plantillas',
      modulo: 'plantillas',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
      ),
    },
    {
      name: 'Notariado',
      href: '/admin/notariado',
      modulo: 'notariado',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      children: [
        { name: 'Avisos', href: '/admin/notariado/avisos' },
        { name: 'Índice', href: '/admin/notariado/indice' },
        { name: 'Plantilla', href: '/admin/notariado/configuracion' },
      ],
    },
    {
      name: 'Jurisprudencia',
      href: '/admin/jurisprudencia',
      modulo: 'jurisprudencia',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      children: [
        { name: 'Buscar', href: '/admin/jurisprudencia/buscar' },
      ],
    },
    {
      name: 'Contabilidad',
      href: '/admin/contabilidad',
      modulo: 'contabilidad',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      children: [
        { name: 'Cotizaciones', href: '/admin/contabilidad/cotizaciones' },
        { name: 'Facturas', href: '/admin/contabilidad/facturas' },
        { name: 'Pagos', href: '/admin/contabilidad/pagos' },
        { name: 'Gastos', href: '/admin/contabilidad/gastos' },
        { name: 'Reportes', href: '/admin/contabilidad/reportes' },
      ],
    },
    // ── Sitio web ──
    {
      name: 'Posts',
      href: '/admin/posts',
      modulo: 'posts',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
        </svg>
      ),
    },
    {
      name: 'Productos',
      href: '/admin/productos',
      modulo: 'productos',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      name: 'Mensajes',
      href: '/admin/mensajes',
      modulo: 'mensajes',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    // ── Configuracion ──
    {
      name: 'Configuracion',
      href: '/admin/configuracion/usuarios',
      modulo: 'configuracion',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  // Filter navigation based on user permissions (while loading, show all to avoid flash)
  const filteredNav = loading
    ? navigation
    : navigation.filter((item) => {
        if (!item.modulo) return true // Dashboard, AI — always visible
        return hasModule(item.modulo)
      })

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  const displayName = user?.nombre ?? 'Panel Admin'
  const rolLabel = user ? (ROL_LABELS[user.rol] ?? user.rol) : 'Panel Admin'

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-navy-light">
        <div className="w-10 h-10 bg-cyan rounded-lg flex items-center justify-center">
          <span className="text-navy-dark font-bold text-lg">AS</span>
        </div>
        <div>
          <div className="text-white font-semibold">{displayName}</div>
          <div className="text-cyan text-xs">{rolLabel}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 py-6 space-y-1 overflow-y-auto pb-20" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {filteredNav.map((item) => (
          <div key={item.name}>
            <Link
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                isActive(item.href)
                  ? 'bg-cyan text-navy-dark font-semibold'
                  : 'text-slate-light hover:bg-navy-light hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </Link>
            {/* Sub-menu (Contabilidad, Notariado, etc.) */}
            {item.children && isActive(item.href) && (
              <div className="ml-8 mt-1 space-y-1">
                {item.children
                  .filter((child) => {
                    // Admins see everything
                    if (isAdmin) return true;
                    if (!user) return true;
                    // If user has the full parent module, show all children
                    if (item.modulo && user.modulos_permitidos.includes(item.modulo)) return true;
                    // For contabilidad, check specific sub-module access
                    if (item.modulo === 'contabilidad') {
                      const subSegment = child.href.split('/').pop() ?? '';
                      return CONTABILIDAD_SUBMODULES[subSegment]
                        ? user.modulos_permitidos.includes(subSegment as Modulo)
                        : false;
                    }
                    return true;
                  })
                  .map((child) => (
                  <Link
                    key={child.name}
                    href={child.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
                      pathname === child.href || pathname.startsWith(child.href + '/')
                        ? 'text-cyan font-medium'
                        : 'text-slate-light/70 hover:text-white'
                    }`}
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-navy-light">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-slate-light hover:text-cyan transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>Volver al sitio</span>
        </Link>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile hamburger button */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-navy-dark md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg text-slate-light hover:bg-navy-light hover:text-white transition-colors"
          aria-label="Abrir menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-cyan rounded-md flex items-center justify-center">
            <span className="text-navy-dark font-bold text-xs">AS</span>
          </div>
          <span className="text-white font-semibold text-sm">Admin</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: fixed, mobile: overlay drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-navy-dark transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile close button */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-light hover:bg-navy-light hover:text-white transition-colors md:hidden"
          aria-label="Cerrar menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sidebarContent}
      </aside>

      {/* Main content — desktop: offset by sidebar, mobile: full width with top bar padding */}
      <main className="md:ml-64 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
