export const dynamic = 'force-dynamic';
// ============================================================================
// app/admin/notariado/escrituras/page.tsx
// Protocolo notarial - lista de escrituras
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge, EmptyState, TableSkeleton } from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'autorizada', label: 'Autorizadas' },
  { key: 'cancelada', label: 'Canceladas' },
];

interface Escritura {
  id: string;
  numero: number;
  tipo_acto: string;
  descripcion: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  estado: string;
  tiene_testimonio: boolean;
  tiene_pdf: boolean;
  otorgantes: string[];
}

export default function EscriturasListPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  params.set('anio', String(anio));
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading } = useFetch<{
    data: Escritura[]; total: number; totalPages: number;
  }>(`/api/admin/notariado/escrituras?${params}`);

  const escrituras = data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Protocolo Notarial"
        description={`${data?.total ?? 0} escrituras en ${anio}`}
        action={{
          label: '+ Nueva escritura',
          onClick: () => router.push('/admin/notariado/escrituras/nueva'),
        }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>
        <select value={anio} onChange={e => { setAnio(+e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <input type="text" placeholder="Buscar por número, acto o otorgante..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : escrituras.length === 0 ? (
        <EmptyState icon="📜" title="Sin escrituras" description={`No hay escrituras en ${anio}`} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['No.', 'Tipo de acto', 'Descripción', 'Otorgantes', 'Fecha', 'Estado', 'Test.', 'PDF'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escrituras.map(e => (
                  <tr key={e.id} onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5">
                      <span className="text-lg font-bold text-[#1E40AF]">{e.numero}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900 font-medium">{e.tipo_acto}</td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">{e.descripcion}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {e.otorgantes?.slice(0, 2).join(', ')}{e.otorgantes?.length > 2 ? ` +${e.otorgantes.length - 2}` : ''}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {new Date(e.fecha_autorizacion).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="py-3 px-4"><Badge variant={e.estado as any}>{e.estado}</Badge></td>
                    <td className="py-3 px-4 text-sm">
                      {e.tiene_testimonio ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 px-4 pr-5 text-sm">
                      {e.tiene_pdf ? <span className="text-emerald-600">✓</span> : <span className="text-slate-300">—</span>}
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
