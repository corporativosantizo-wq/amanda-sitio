'use client'

import Link from 'next/link'

const secciones = [
  {
    titulo: 'Cotizaciones',
    descripcion: 'Crear y gestionar cotizaciones',
    href: '/admin/contabilidad/cotizaciones',
    icon: '📋',
    color: 'bg-blue-50 border-blue-200',
  },
  {
    titulo: 'Facturas',
    descripcion: 'Facturación electrónica FEL',
    href: '/admin/contabilidad/facturas',
    icon: '🧾',
    color: 'bg-emerald-50 border-emerald-200',
  },
  {
    titulo: 'Pagos',
    descripcion: 'Registrar y confirmar pagos',
    href: '/admin/contabilidad/pagos',
    icon: '💰',
    color: 'bg-amber-50 border-amber-200',
  },
  {
    titulo: 'Gastos',
    descripcion: 'Control de gastos y comprobantes',
    href: '/admin/contabilidad/gastos',
    icon: '💸',
    color: 'bg-red-50 border-red-200',
  },
  {
    titulo: 'Clientes',
    descripcion: 'Directorio de clientes',
    href: '/admin/clientes',
    icon: '👥',
    color: 'bg-purple-50 border-purple-200',
  },
  {
    titulo: 'Escrituras',
    descripcion: 'Protocolo notarial',
    href: '/admin/notariado/escrituras',
    icon: '📜',
    color: 'bg-slate-50 border-slate-200',
  },
  {
    titulo: 'Reportes',
    descripcion: 'Reportes financieros mensuales',
    href: '/admin/contabilidad/reportes',
    icon: '📊',
    color: 'bg-cyan-50 border-cyan-200',
  },
  {
    titulo: 'Posts',
    descripcion: 'Blog y artículos',
    href: '/admin/posts',
    icon: '✍️',
    color: 'bg-orange-50 border-orange-200',
  },
  {
    titulo: 'Productos',
    descripcion: 'Tienda de servicios',
    href: '/admin/productos',
    icon: '🛍️',
    color: 'bg-pink-50 border-pink-200',
  },
  {
    titulo: 'Mensajes',
    descripcion: 'Mensajes de contacto',
    href: '/admin/mensajes',
    icon: '✉️',
    color: 'bg-indigo-50 border-indigo-200',
  },
]

export default function AdminDashboard() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-500 mt-1">IURISLEX — Sistema de Gestión Legal</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {secciones.map((sec) => (
          <Link
            key={sec.href}
            href={sec.href}
            className={`block p-6 rounded-xl border-2 ${sec.color} hover:shadow-md transition-all`}
          >
            <div className="text-3xl mb-3">{sec.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900">{sec.titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{sec.descripcion}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
