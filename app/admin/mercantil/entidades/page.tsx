'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import { EmptyState, TableSkeleton } from '@/components/admin/ui';

const TIPO_LABELS: Record<string, string> = {
  sociedad_anonima: 'S.A.',
  sociedad_limitada: 'S.R.L.',
  empresa_individual: 'E.I.',
  otra: 'Otra',
};

const TIPO_BADGE: Record<string, string> = {
  sociedad_anonima: 'bg-blue-50 text-blue-700',
  sociedad_limitada: 'bg-purple-50 text-purple-700',
  empresa_individual: 'bg-amber-50 text-amber-700',
  otra: 'bg-slate-100 text-slate-600',
};

interface EntidadRow {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  tipo_entidad: string;
  nit: string | null;
  representante_legal_nombre: string | null;
  activa: boolean;
  updated_at: string;
  documentos_count: number;
}

export default function EntidadesListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showNew, setShowNew] = useState(false);

  // New entity form
  const [newNombre, setNewNombre] = useState('');
  const [newTipo, setNewTipo] = useState('sociedad_anonima');
  const [creating, setCreating] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');
  params.set('activa', 'true');

  const { data, loading, refetch } = useFetch<{
    data: EntidadRow[]; total: number; totalPages: number;
  }>(`/api/admin/mercantil/entidades?${params}`);

  const entidades = data?.data ?? [];

  const handleCreate = async () => {
    if (!newNombre.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/mercantil/entidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newNombre, tipo_entidad: newTipo }),
      });
      if (!res.ok) throw new Error('Error al crear');
      const entidad = await res.json();
      router.push(`/admin/mercantil/entidades/${entidad.id}`);
    } catch {
      setCreating(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Entidades Mercantiles</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} entidades activas</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all"
        >
          + Nueva entidad
        </button>
      </div>

      {/* Quick create */}
      {showNew && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre de la entidad</label>
            <input
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Transportes Rope, Sociedad Anónima"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="w-48">
            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
            <select
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              value={newTipo}
              onChange={(e) => setNewTipo(e.target.value)}
            >
              <option value="sociedad_anonima">Sociedad Anónima</option>
              <option value="sociedad_limitada">S.R.L.</option>
              <option value="empresa_individual">Empresa Individual</option>
              <option value="otra">Otra</option>
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !newNombre.trim()}
            className="px-4 py-2 text-sm font-medium bg-[#0891B2] text-white rounded-lg hover:bg-[#0891B2]/90 disabled:opacity-50"
          >
            {creating ? 'Creando...' : 'Crear'}
          </button>
          <button
            onClick={() => setShowNew(false)}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar por nombre, NIT o representante legal..."
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
      />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : entidades.length === 0 ? (
        <EmptyState
          icon="🏢"
          title="Sin entidades"
          description="Crea tu primera entidad mercantil"
          action={{ label: '+ Nueva entidad', onClick: () => setShowNew(true) }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Entidad', 'Tipo', 'NIT', 'Representante Legal', 'Docs', 'Última actividad'].map((h: string) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entidades.map((e: EntidadRow) => (
                  <tr
                    key={e.id}
                    onClick={() => router.push(`/admin/mercantil/entidades/${e.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 pl-5">
                      <div className="text-sm font-medium text-slate-900">{e.nombre_corto ?? e.nombre}</div>
                      {e.nombre_corto && (
                        <div className="text-xs text-slate-400 truncate max-w-[250px]">{e.nombre}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIPO_BADGE[e.tipo_entidad] ?? TIPO_BADGE.otra}`}>
                        {TIPO_LABELS[e.tipo_entidad] ?? e.tipo_entidad}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{e.nit ?? '—'}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{e.representante_legal_nombre ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {e.documentos_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 pr-5 text-xs text-slate-400">
                      {new Date(e.updated_at).toLocaleDateString('es-GT')}
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
                <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">
                  ← Anterior
                </button>
                <button onClick={() => setPage((p: number) => p + 1)} disabled={page >= data.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
