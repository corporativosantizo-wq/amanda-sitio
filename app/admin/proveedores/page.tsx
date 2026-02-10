// ============================================================================
// app/admin/proveedores/page.tsx
// Directorio de proveedores
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import { EmptyState, TableSkeleton } from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'freelance', label: 'Freelance' },
  { key: 'empresa', label: 'Empresa' },
  { key: 'consultor', label: 'Consultor' },
  { key: 'perito', label: 'Perito' },
  { key: 'traductor', label: 'Traductor' },
  { key: 'notificador', label: 'Notificador' },
  { key: 'otro', label: 'Otro' },
];

const TIPO_BADGE: Record<string, string> = {
  freelance: 'bg-purple-50 text-purple-700',
  empresa: 'bg-blue-50 text-blue-700',
  consultor: 'bg-teal-50 text-teal-700',
  perito: 'bg-amber-50 text-amber-700',
  traductor: 'bg-indigo-50 text-indigo-700',
  notificador: 'bg-rose-50 text-rose-700',
  otro: 'bg-slate-100 text-slate-600',
};

interface ProveedorRow {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  especialidad: string | null;
  nit: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
}

export default function ProveedoresListPage() {
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
    data: ProveedorRow[]; total: number; totalPages: number;
  }>(`/api/admin/proveedores?${params}`);

  const proveedores = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Proveedores</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} proveedores activos</p>
        </div>
        <button
          onClick={() => router.push('/admin/proveedores/nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all"
        >
          + Nuevo proveedor
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por nombre, NIT, email o especialidad..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : proveedores.length === 0 ? (
        <EmptyState icon="🤝" title="Sin proveedores" description="Agrega tu primer proveedor"
          action={{ label: '+ Nuevo proveedor', onClick: () => router.push('/admin/proveedores/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Código', 'Nombre', 'Tipo', 'Especialidad', 'Email', 'Teléfono'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedores.map(p => (
                  <tr key={p.id} onClick={() => router.push(`/admin/proveedores/${p.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm font-mono text-slate-500">{p.codigo}</td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{p.nombre}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        TIPO_BADGE[p.tipo] ?? TIPO_BADGE.otro
                      }`}>{p.tipo}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{p.especialidad ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">{p.email ?? '—'}</td>
                    <td className="py-3 px-4 pr-5 text-sm text-slate-500">{p.telefono ?? '—'}</td>
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
