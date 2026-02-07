// ============================================================================
// app/admin/clientes/page.tsx
// Directorio de clientes
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'persona', label: 'Individuales' },
  { key: 'empresa', label: 'Empresas' },
];

interface ClienteRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  nit: string;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  created_at: string;
}

export default function ClientesListPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (tab) params.set('tipo', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');
  params.set('activo', 'true');

  const { data, loading } = useFetch<{
    data: ClienteRow[]; total: number; totalPages: number;
  }>(`/api/admin/clientes?${params}`);

  const clientes = data?.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Clientes"
        description={`${data?.total ?? 0} clientes activos`}
        action={{
          label: '+ Nuevo cliente',
          onClick: () => router.push('/admin/clientes/nuevo'),
        }}
      />

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por nombre, NIT o email..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : clientes.length === 0 ? (
        <EmptyState icon="👤" title="Sin clientes" description="Agrega tu primer cliente"
          action={{ label: '+ Nuevo cliente', onClick: () => router.push('/admin/clientes/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Código', 'Nombre', 'Tipo', 'NIT', 'Email', 'Teléfono'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clientes.map(c => (
                  <tr key={c.id} onClick={() => router.push(`/admin/clientes/${c.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm font-mono text-slate-500">{c.codigo}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{c.nombre}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.tipo === 'empresa' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                      }`}>{c.tipo === 'empresa' ? '🏢 Empresa' : '👤 Individual'}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 font-mono">{c.nit}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{c.email ?? '—'}</td>
                    <td className="py-3 px-4 pr-5 text-sm text-slate-500">{c.telefono ?? '—'}</td>
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
