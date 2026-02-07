// ============================================================================
// app/admin/contabilidad/pagos/page.tsx
// Lista de pagos con filtros y acción rápida de confirmar
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'registrado', label: 'Por confirmar' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'anulado', label: 'Anulados' },
];

const METODO_ICON: Record<string, string> = {
  transferencia: '🏦', deposito: '💵', efectivo: '💰',
  cheque: '📄', tarjeta: '💳', otro: '📋',
};

interface Pago {
  id: string;
  monto: number;
  metodo_pago: string;
  referencia_pago: string | null;
  estado: string;
  es_anticipo: boolean;
  fecha_pago: string;
  factura: { numero: string } | null;
  cliente: { nombre: string } | null;
}

export default function PagosListPage() {
  const router = useRouter();
  const { mutate } = useMutate();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: Pago[]; total: number; totalPages: number;
  }>(`/api/admin/contabilidad/pagos?${params}`);

  const pagos = data?.data ?? [];

  const confirmarPago = async (pagoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Confirmar este pago? Se generará factura FEL automáticamente.')) return;
    await mutate(`/api/admin/contabilidad/pagos/${pagoId}/acciones`, {
      body: { accion: 'confirmar' },
      onSuccess: () => refetch(),
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pagos"
        description={`${data?.total ?? 0} pagos`}
        action={{
          label: '+ Registrar pago',
          onClick: () => router.push('/admin/contabilidad/pagos/nuevo'),
        }}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por factura, cliente o referencia..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={8} cols={7} /> : pagos.length === 0 ? (
        <EmptyState icon="💰" title="Sin pagos" description={tab === 'registrado' ? 'No hay pagos por confirmar' : 'Aún no se han registrado pagos'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Fecha', 'Factura', 'Cliente', 'Monto', 'Método', 'Referencia', 'Estado', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map(p => (
                  <tr key={p.id} onClick={() => router.push(`/admin/contabilidad/pagos/${p.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm text-slate-600">
                      {new Date(p.fecha_pago).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-slate-900">{p.factura?.numero ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-700">{p.cliente?.nombre ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-[#1E40AF]">{Q(p.monto)}</span>
                      {p.es_anticipo && <span className="ml-1 text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">60%</span>}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span>{METODO_ICON[p.metodo_pago] ?? '📋'}</span>
                      <span className="ml-1 text-slate-600 capitalize">{p.metodo_pago}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500 font-mono">{p.referencia_pago ?? '—'}</td>
                    <td className="py-3 px-4"><Badge variant={p.estado as any}>{p.estado}</Badge></td>
                    <td className="py-3 px-4 pr-5">
                      {p.estado === 'registrado' && (
                        <button onClick={(e) => confirmarPago(p.id, e)}
                          className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors">
                          ✓ Confirmar
                        </button>
                      )}
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
