// ============================================================================
// app/admin/audiencias/page.tsx
// Listado de audiencias del registro (legal.audiencias). Mismo patrón visual
// que /admin/expedientes. Consume el GET del registro nuevo (NO el de Outlook).
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { TableSkeleton, EmptyState } from '@/components/admin/ui';
import {
  type Audiencia,
  type EstadoAudiencia,
  type ModalidadAudiencia,
  MODALIDAD_AUDIENCIA_LABEL, MODALIDAD_AUDIENCIA_COLOR,
  ESTADO_AUDIENCIA_LABEL, ESTADO_AUDIENCIA_COLOR,
  formatAudienciaFecha,
} from '@/lib/types/audiencias';

const ESTADO_TABS: { key: '' | EstadoAudiencia; label: string }[] = [
  { key: '', label: 'Todas' },
  { key: 'programada', label: 'Programadas' },
  { key: 'confirmada', label: 'Confirmadas' },
  { key: 'reprogramada', label: 'Reprogramadas' },
  { key: 'realizada', label: 'Realizadas' },
  { key: 'suspendida', label: 'Suspendidas' },
  { key: 'cancelada', label: 'Canceladas' },
];

const MODALIDAD_OPCIONES: { key: '' | ModalidadAudiencia; label: string }[] = [
  { key: '', label: 'Todas las modalidades' },
  { key: 'presencial', label: 'Presencial' },
  { key: 'virtual', label: 'Virtual' },
  { key: 'hibrida', label: 'Híbrida' },
];

function lugarDisplay(a: Audiencia): string {
  return [a.juzgado, a.sala].filter(Boolean).join(' · ') || '—';
}

export default function AudienciasListPage() {
  const router = useRouter();
  const [estado, setEstado] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (modalidad) params.set('modalidad', modalidad);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading } = useFetch<{
    data: Audiencia[]; total: number; totalPages: number;
  }>(`/api/admin/audiencias/registro?${params}`);

  const audiencias = data?.data ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audiencias</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} audiencias</p>
        </div>
        <button
          onClick={() => router.push('/admin/audiencias/nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all shrink-0"
        >
          <Plus size={16} />
          Nueva Audiencia
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {ESTADO_TABS.map(t => (
            <button key={t.key} onClick={() => { setEstado(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                estado === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>
        <select
          value={modalidad}
          onChange={e => { setModalidad(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
        >
          {MODALIDAD_OPCIONES.map(m => (
            <option key={m.key} value={m.key}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por título, tipo o juzgado..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-md px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : audiencias.length === 0 ? (
        <EmptyState icon="⚖️" title="Sin audiencias" description="Registra tu primera audiencia"
          action={{ label: '+ Nueva Audiencia', onClick: () => router.push('/admin/audiencias/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Fecha y hora', 'Cliente', 'Expediente', 'Modalidad', 'Lugar', 'Estado'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {audiencias.map(a => (
                  <tr key={a.id} onClick={() => router.push(`/admin/audiencias/${a.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5">
                      <div className="text-sm font-medium text-slate-900">{formatAudienciaFecha(a.fecha_hora_inicio)}</div>
                      {a.titulo && <div className="text-xs text-slate-400 mt-0.5 max-w-[200px] truncate">{a.titulo}</div>}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700 max-w-[180px] truncate">{a.cliente?.nombre ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 font-mono">{a.expediente?.numero_expediente ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODALIDAD_AUDIENCIA_COLOR[a.modalidad]}`}>
                        {MODALIDAD_AUDIENCIA_LABEL[a.modalidad]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500 max-w-[180px] truncate">{lugarDisplay(a)}</td>
                    <td className="py-3 px-4 pr-5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_AUDIENCIA_COLOR[a.estado]}`}>
                        {ESTADO_AUDIENCIA_LABEL[a.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">Página {page} de {data.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
