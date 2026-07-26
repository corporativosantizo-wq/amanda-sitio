'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useFetch, useMutate } from '@/lib/hooks/use-fetch'
import { Scale, Shield, Building2, AlertTriangle } from 'lucide-react'
import {
  ORIGEN_LABEL, ORIGEN_COLOR, TIPO_PROCESO_LABEL,
  type OrigenExpediente,
} from '@/lib/types/expedientes'
import { type EstadoAudiencia } from '@/lib/types/audiencias'

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

interface Audiencia {
  id: string;                      // registro: uuid | outlook: event id
  origen: 'registro' | 'outlook';
  titulo: string;
  fecha: string;
  fecha_fin: string | null;
  todo_dia: boolean;
  tipo: string | null;
  tribunal: string;
  cliente: string;
  estado: EstadoAudiencia | null;  // null en las "sin registro"
  sin_registro: boolean;
}

interface AudienciasData {
  audiencias: Audiencia[];
  total: number;
  mes: string;
}

// Las realizadas y las ya pasadas van en gris, sin badge de urgencia; solo lo
// pendiente y futuro compite por rojo/amarillo/verde.
type UrgenciaAudiencia = 'realizada' | 'pasada' | 'red' | 'yellow' | 'green';

function getUrgencia(fecha: string, estado: EstadoAudiencia | null): UrgenciaAudiencia {
  if (estado === 'realizada') return 'realizada';
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  const diff = Math.floor((d.getTime() - hoy.getTime()) / 86400000);
  if (diff < 0) return 'pasada';    // ya ocurrió y nadie la marcó
  if (diff <= 1) return 'red';      // hoy o mañana
  if (diff <= 7) return 'yellow';   // esta semana
  return 'green';                    // resto del mes
}

const URGENCIA_STYLES: Record<UrgenciaAudiencia, { dot: string; badge: string; label: string; atenuada: boolean }> = {
  realizada: { dot: 'bg-slate-300', badge: 'text-emerald-600 bg-emerald-50', label: '✓ Realizada', atenuada: true },
  pasada: { dot: 'bg-slate-300', badge: 'text-slate-500 bg-slate-100', label: 'Pasada', atenuada: true },
  red: { dot: 'bg-red-500', badge: 'text-red-600 bg-red-100', label: 'Urgente', atenuada: false },
  yellow: { dot: 'bg-amber-500', badge: 'text-amber-600 bg-amber-100', label: 'Esta semana', atenuada: false },
  green: { dot: 'bg-green-500', badge: 'text-green-600 bg-green-100', label: '', atenuada: false },
};

const TIPO_COLOR: Record<string, string> = {
  Civil: 'bg-blue-100 text-blue-700',
  Penal: 'bg-red-100 text-red-700',
  Laboral: 'bg-amber-100 text-amber-700',
  Familia: 'bg-pink-100 text-pink-700',
  Mercantil: 'bg-teal-100 text-teal-700',
  General: 'bg-gray-100 text-gray-600',
};

export default function AdminDashboard() {
  const { data } = useFetch<ExpedientesStats>('/api/admin/expedientes/stats?dias=7');
  const { data: mercData } = useFetch<CumplimientoStats>('/api/admin/mercantil/stats?dias=30');
  const { data: labData } = useFetch<CumplimientoStats>('/api/admin/laboral/stats?dias=30');
  const { data: audData, setData: setAudData } = useFetch<AudienciasData>('/api/admin/audiencias');
  const { mutate } = useMutate();
  const [marcandoId, setMarcandoId] = useState<string | null>(null);

  async function marcarRealizada(id: string) {
    setMarcandoId(id);
    const res = await mutate(`/api/admin/audiencias/registro/${id}`, {
      method: 'PUT',
      body: { estado: 'realizada' },
    });
    if (res) {
      setAudData(prev => prev ? {
        ...prev,
        audiencias: prev.audiencias.map(a => a.id === id ? { ...a, estado: 'realizada' as EstadoAudiencia } : a),
      } : prev);
    }
    setMarcandoId(null);
  }

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

      {/* Audiencias Judiciales */}
      {audData && audData.audiencias.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏛️</span>
              <h3 className="font-semibold text-slate-900 text-sm">
                Audiencias Judiciales — {audData.mes.charAt(0).toUpperCase() + audData.mes.slice(1)}
              </h3>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
                {audData.total}
              </span>
            </div>
            <Link href="/admin/calendario" className="text-xs text-[#0891B2] hover:text-[#1E40AF] font-medium">
              Ver calendario →
            </Link>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {audData.audiencias.map((aud) => {
              const urgencia = getUrgencia(aud.fecha, aud.estado);
              const styles = URGENCIA_STYLES[urgencia];
              const fechaObj = new Date(aud.fecha);
              const dia = fechaObj.toLocaleDateString('es-GT', { timeZone: 'America/Guatemala', weekday: 'short', day: 'numeric', month: 'short' });
              const hora = aud.todo_dia ? 'Todo el día' : fechaObj.toLocaleTimeString('es-GT', { timeZone: 'America/Guatemala', hour: '2-digit', minute: '2-digit' });
              const puedeMarcar = aud.origen === 'registro' && aud.estado !== 'realizada';

              return (
                <div key={aud.id} className={`flex items-center gap-3 px-5 py-3 ${urgencia === 'red' ? 'bg-red-50/40' : 'hover:bg-slate-50'} transition-colors`}>
                  <span className={`w-2 h-2 rounded-full ${aud.sin_registro ? 'bg-amber-400' : styles.dot} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm truncate font-medium ${styles.atenuada ? 'text-slate-400' : 'text-slate-900'}`}>{aud.titulo}</p>
                      {aud.sin_registro ? (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">
                          En calendario, sin registro
                        </span>
                      ) : aud.tipo && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${TIPO_COLOR[aud.tipo] ?? TIPO_COLOR.General}`}>
                          {aud.tipo}
                        </span>
                      )}
                    </div>
                    <p className={`text-xs mt-0.5 ${styles.atenuada ? 'text-slate-400' : 'text-slate-500'}`}>
                      {dia} · {hora}
                      {aud.tribunal && <> · {aud.tribunal}</>}
                      {aud.cliente && <> · {aud.cliente}</>}
                    </p>
                  </div>
                  {aud.sin_registro ? (
                    <Link
                      href="/admin/audiencias/nuevo"
                      className="text-xs font-medium text-amber-700 hover:text-amber-900 shrink-0"
                    >
                      Registrar →
                    </Link>
                  ) : (
                    <>
                      {styles.label && (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${styles.badge}`}>
                          {styles.label}
                        </span>
                      )}
                      {puedeMarcar && (
                        <button
                          onClick={() => marcarRealizada(aud.id)}
                          disabled={marcandoId === aud.id}
                          title="Marcar como realizada"
                          className="text-xs font-medium px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 shrink-0 transition-colors"
                        >
                          {marcandoId === aud.id ? '…' : '✓ Realizada'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
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
