// ============================================================================
// app/admin/contabilidad/facturas/page.tsx
// Lista de facturas con filtros y acciones
// ============================================================================

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'parcial', label: 'Parciales' },
  { key: 'pagada', label: 'Pagadas' },
  { key: 'vencida', label: 'Vencidas' },
  { key: 'anulada', label: 'Anuladas' },
];

interface Factura {
  id: string;
  numero: string;
  estado: string;
  total: number;
  monto_pagado: number;
  monto_pendiente: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  fel_uuid: string | null;
  cliente: { nombre: string } | null;
}

export default function FacturasListPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: Factura[]; total: number; totalPages: number;
  }>(`/api/admin/contabilidad/facturas?${params}`);

  const facturas = data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facturas"
        description={`${data?.total ?? 0} facturas`}
        action={{
          label: '+ Nueva factura',
          onClick: () => router.push('/admin/contabilidad/facturas/nueva'),
        }}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              tab === t.key
                ? 'bg-[#1E40AF] text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por número o cliente..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
      />

      {/* Table */}
      {loading ? <TableSkeleton rows={8} /> : facturas.length === 0 ? (
        <EmptyState icon="🧾" title="Sin facturas" description={tab ? `No hay facturas ${tab}s` : 'Aún no has generado facturas'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Número', 'Cliente', 'Total', 'Pagado', 'Pendiente', 'Estado', 'Emisión', 'FEL'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {facturas.map(f => (
                  <tr
                    key={f.id}
                    onClick={() => router.push(`/admin/contabilidad/facturas/${f.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 pl-5">
                      <span className="font-mono text-sm font-medium text-slate-900">{f.numero}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">{f.cliente?.nombre ?? '—'}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{Q(f.total)}</td>
                    <td className="py-3 px-4 text-sm text-emerald-600">{Q(f.monto_pagado)}</td>
                    <td className="py-3 px-4 text-sm font-medium text-amber-700">{f.monto_pendiente > 0 ? Q(f.monto_pendiente) : '—'}</td>
                    <td className="py-3 px-4"><Badge variant={f.estado as any}>{f.estado}</Badge></td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {new Date(f.fecha_emision).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 pr-5">
                      {f.fel_uuid
                        ? <span className="text-xs text-emerald-600 font-medium">✓ Emitida</span>
                        : <span className="text-xs text-slate-400">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
