'use client'

import Link from 'next/link'
import { useFetch } from '@/lib/hooks/use-fetch'
import { Scale, Shield, Building2, AlertTriangle } from 'lucide-react'
import {
  ORIGEN_LABEL, ORIGEN_COLOR, TIPO_PROCESO_LABEL,
  type OrigenExpediente,
} from '@/lib/types/expedientes'

const secciones = [
  {
    titulo: 'Expedientes',
    descripcion: 'Casos judiciales, fiscales y administrativos',
    href: '/admin/expedientes',
    icon: '⚖️',
    color: 'bg-sky-50 border-sky-200',
  },
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
    titulo: 'Cumplimiento Mercantil',
    descripcion: 'Patentes, inscripciones y asambleas',
    href: '/admin/mercantil',
    icon: '🏢',
    color: 'bg-teal-50 border-teal-200',
  },
  {
    titulo: 'Cumplimiento Laboral',
    descripcion: 'Contratos, registros IGT y reglamentos',
    href: '/admin/laboral',
    icon: '👷',
    color: 'bg-violet-50 border-violet-200',
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

interface ExpedientesStats {
  stats: {
    por_estado: Record<string, number>;
    por_origen: Record<string, number>;
    total_activos: number;
    total_suspendidos: number;
    recientes: {
      id: string;
      numero_expediente: string | null;
      numero_mp: string | null;
      numero_administrativo: string | null;
      origen: OrigenExpediente;
      tipo_proceso: string;
      fecha_ultima_actuacion: string | null;
      cliente: { id: string; nombre: string };
    }[];
  };
  plazos_proximos: {
    id: string;
    descripcion: string;
    fecha_vencimiento: string;
    dias_restantes: number;
    expediente: {
      id: string;
      numero_expediente: string | null;
      numero_mp: string | null;
      numero_administrativo: string | null;
      origen: OrigenExpediente;
      cliente: { id: string; nombre: string };
    };
  }[];
  plazos_vencidos: {
    id: string;
    descripcion: string;
    fecha_vencimiento: string;
    expediente: {
      id: string;
      numero_expediente: string | null;
      origen: OrigenExpediente;
      cliente: { id: string; nombre: string };
    };
  }[];
}

const OrigenIcon = ({ origen }: { origen: OrigenExpediente }) => {
  const cls = 'w-3.5 h-3.5';
  switch (origen) {
    case 'judicial': return <Scale className={cls} />;
    case 'fiscal': return <Shield className={cls} />;
    case 'administrativo': return <Building2 className={cls} />;
  }
};

function getNumero(e: { numero_expediente: string | null; numero_mp?: string | null; numero_administrativo?: string | null }): string {
  return e.numero_expediente ?? e.numero_mp ?? e.numero_administrativo ?? '—';
}

interface CumplimientoStats {
  stats: { total: number; por_vencer: number; vencidos: number };
  por_vencer: { id: string; categoria: string; fecha_vencimiento?: string; fecha_fin?: string; dias_restantes: number; cliente: { id: string; nombre: string } }[];
  vencidos: { id: string; categoria: string; fecha_vencimiento?: string; fecha_fin?: string; cliente: { id: string; nombre: string } }[];
}

export default function AdminDashboard() {
  const { data } = useFetch<ExpedientesStats>('/api/admin/expedientes/stats?dias=7');
  const { data: mercData } = useFetch<CumplimientoStats>('/api/admin/mercantil/stats?dias=30');
  const { data: labData } = useFetch<CumplimientoStats>('/api/admin/laboral/stats?dias=30');

  const stats = data?.stats;
  const plazosProximos = data?.plazos_proximos ?? [];
  const plazosVencidos = data?.plazos_vencidos ?? [];
  const totalPlazosUrgentes = plazosProximos.length + plazosVencidos.length;

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Panel de Administración</h1>
        <p className="text-gray-500 mt-1">IURISLEX — Sistema de Gestión Legal</p>
      </div>

      {/* Expedientes summary widget */}
      {stats && (stats.total_activos > 0 || totalPlazosUrgentes > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 lg:col-span-1">
            <div className="rounded-xl p-4 bg-gradient-to-br from-[#1E40AF] to-[#0891B2] text-white shadow-lg shadow-blue-900/20">
              <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">Activos</p>
              <p className="text-2xl font-bold mt-1">{stats.total_activos}</p>
              <p className="text-xs text-blue-100 mt-1">expedientes</p>
            </div>
            <div className={`rounded-xl p-4 border ${
              plazosVencidos.length > 0 ? 'bg-red-50 border-red-200' :
              plazosProximos.length > 0 ? 'bg-amber-50 border-amber-200' :
              'bg-white border-slate-200'
            } shadow-sm`}>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Plazos urgentes</p>
              <p className={`text-2xl font-bold mt-1 ${
                plazosVencidos.length > 0 ? 'text-red-700' :
                plazosProximos.length > 0 ? 'text-amber-700' :
                'text-slate-900'
              }`}>{totalPlazosUrgentes}</p>
              {plazosVencidos.length > 0 && (
                <p className="text-xs text-red-600 mt-1">{plazosVencidos.length} vencido{plazosVencidos.length > 1 ? 's' : ''}</p>
              )}
            </div>
            {/* By origen */}
            {Object.entries(stats.por_origen).map(([origen, count]) => (
              <div key={origen} className={`rounded-xl p-4 border border-slate-200 bg-white shadow-sm`}>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded ${ORIGEN_COLOR[origen as OrigenExpediente]}`}>
                    <OrigenIcon origen={origen as OrigenExpediente} />
                  </span>
                  <p className="text-xs font-medium text-slate-500">{ORIGEN_LABEL[origen as OrigenExpediente]}</p>
                </div>
                <p className="text-xl font-bold text-slate-900 mt-1">{count}</p>
              </div>
            ))}
          </div>

          {/* Plazos urgentes list */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Plazos próximos (7 días)</h3>
              <Link href="/admin/expedientes" className="text-xs text-[#0891B2] hover:text-[#1E40AF] font-medium">
                Ver todos →
              </Link>
            </div>
            {totalPlazosUrgentes === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Sin plazos urgentes esta semana
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {/* Vencidos first */}
                {plazosVencidos.map(p => (
                  <Link key={p.id} href={`/admin/expedientes/${p.expediente.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-red-50/50 transition-colors">
                    <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{p.descripcion}</p>
                      <p className="text-xs text-slate-500">{getNumero(p.expediente)} · {p.expediente.cliente.nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                      Vencido
                    </span>
                  </Link>
                ))}
                {/* Próximos */}
                {plazosProximos.map(p => (
                  <Link key={p.id} href={`/admin/expedientes/${p.expediente.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <span className={`inline-flex items-center justify-center w-2 h-2 rounded-full shrink-0 ${
                      p.dias_restantes <= 2 ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{p.descripcion}</p>
                      <p className="text-xs text-slate-500">{getNumero(p.expediente)} · {p.expediente.cliente.nombre}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      p.dias_restantes <= 2 ? 'text-red-600 bg-red-100' : 'text-amber-600 bg-amber-100'
                    }`}>
                      {p.dias_restantes}d
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cumplimiento widgets */}
      {((mercData?.stats?.por_vencer ?? 0) > 0 || (mercData?.stats?.vencidos ?? 0) > 0 ||
        (labData?.stats?.por_vencer ?? 0) > 0 || (labData?.stats?.vencidos ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mercantil */}
          {((mercData?.stats?.por_vencer ?? 0) > 0 || (mercData?.stats?.vencidos ?? 0) > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Mercantil — Alertas</h3>
                <Link href="/admin/mercantil" className="text-xs text-[#0891B2] hover:text-[#1E40AF] font-medium">Ver todos →</Link>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {(mercData?.vencidos ?? []).slice(0, 5).map(t => (
                  <Link key={t.id} href={`/admin/mercantil/${t.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-red-50/50 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{t.categoria} · {t.cliente?.nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">Vencido</span>
                  </Link>
                ))}
                {(mercData?.por_vencer ?? []).slice(0, 5).map(t => (
                  <Link key={t.id} href={`/admin/mercantil/${t.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{t.categoria} · {t.cliente?.nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">{t.dias_restantes}d</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {/* Laboral */}
          {((labData?.stats?.por_vencer ?? 0) > 0 || (labData?.stats?.vencidos ?? 0) > 0) && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 text-sm">Laboral — Alertas</h3>
                <Link href="/admin/laboral" className="text-xs text-[#0891B2] hover:text-[#1E40AF] font-medium">Ver todos →</Link>
              </div>
              <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {(labData?.vencidos ?? []).slice(0, 5).map(t => (
                  <Link key={t.id} href={`/admin/laboral/${t.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-red-50/50 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{t.categoria} · {t.cliente?.nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-0.5 rounded-full shrink-0">Vencido</span>
                  </Link>
                ))}
                {(labData?.por_vencer ?? []).slice(0, 5).map(t => (
                  <Link key={t.id} href={`/admin/laboral/${t.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 transition-colors">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 truncate">{t.categoria} · {t.cliente?.nombre}</p>
                    </div>
                    <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">{t.dias_restantes}d</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section cards */}
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
