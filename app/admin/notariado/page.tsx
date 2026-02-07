'use client'

import Link from 'next/link'

const modulos = [
  { titulo: 'Escrituras', href: '/admin/notariado/escrituras', icon: '📜', desc: 'Protocolo notarial y escrituras públicas' },
]

export default function NotariadoPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Notariado</h1>
      <p className="text-gray-500 mb-8">Protocolo notarial</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modulos.map((m) => (
          <Link key={m.href} href={m.href} className="block p-6 bg-white rounded-xl border-2 border-gray-100 hover:border-blue-200 hover:shadow-md transition-all">
            <div className="text-3xl mb-3">{m.icon}</div>
            <h2 className="text-lg font-semibold text-gray-900">{m.titulo}</h2>
            <p className="text-sm text-gray-500 mt-1">{m.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
