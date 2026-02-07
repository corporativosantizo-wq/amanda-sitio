export const dynamic = 'force-dynamic';
// ============================================================================
// app/admin/contabilidad/gastos/page.tsx
// Lista de gastos con filtros por categoría y mes
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface Gasto {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  categoria: { nombre: string } | null;
  proveedor: string | null;
  tiene_comprobante: boolean;
  deducible: boolean;
}

export default function GastosListPage() {
  const router = useRouter();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('mes', String(mes));
  params.set('anio', String(anio));
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '30');

  const { data, loading } = useFetch<{
    data: Gasto[]; total: number; totalPages: number; total_monto: number;
  }>(`/api/admin/contabilidad/gastos?${params}`);

  const gastos = data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Gastos"
        description={data ? `${data.total} gastos · Total: ${Q(data.total_monto)}` : 'Cargando...'}
        action={{
          label: '+ Nuevo gasto',
          onClick: () => router.push('/admin/contabilidad/gastos/nuevo'),
        }}
      />

      {/* Month/Year selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 overflow-x-auto bg-white rounded-lg border border-slate-200 p-1">
          {MESES.map((m, i) => (
            <button key={m} onClick={() => { setMes(i + 1); setPage(1); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                mes === i + 1 ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
        <select value={anio} onChange={e => setAnio(+e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por descripción o proveedor..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : gastos.length === 0 ? (
        <EmptyState icon="💸" title="Sin gastos" description={`No hay gastos registrados en ${MESES[mes - 1]} ${anio}`} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Fecha', 'Descripción', 'Categoría', 'Proveedor', 'Monto', '📎', '🧾'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gastos.map(g => (
                  <tr key={g.id} onClick={() => router.push(`/admin/contabilidad/gastos/${g.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm text-slate-600">
                      {new Date(g.fecha).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900">{g.descripcion}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{g.categoria?.nombre ?? '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">{g.proveedor ?? '—'}</td>
                    <td className="py-3 px-4 text-sm font-bold text-red-600">-{Q(g.monto)}</td>
                    <td className="py-3 px-4 text-sm">{g.tiene_comprobante ? '✓' : ''}</td>
                    <td className="py-3 px-4 pr-5 text-sm">{g.deducible ? <span className="text-emerald-600">Sí</span> : <span className="text-slate-400">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary bar */}
          <div className="px-5 py-3 bg-gradient-to-r from-red-50 to-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-600">{gastos.length} gastos en {MESES[mes - 1]}</span>
            <span className="text-lg font-bold text-red-600">-{Q(data?.total_monto ?? 0)}</span>
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
