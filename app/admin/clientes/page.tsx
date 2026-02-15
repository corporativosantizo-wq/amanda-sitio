// ============================================================================
// app/admin/clientes/page.tsx
// Directorio de clientes
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ExcelJS from 'exceljs';
import { Download, Upload } from 'lucide-react';
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
  administrador_unico_nombre: string | null;
  gerente_general_nombre: string | null;
  grupo_empresarial: { id: string; nombre: string } | null;
  activo: boolean;
  created_at: string;
}

interface GrupoOption {
  id: string;
  nombre: string;
  num_empresas: number;
}

export default function ClientesListPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [grupoFilter, setGrupoFilter] = useState('');
  const [grupos, setGrupos] = useState<GrupoOption[]>([]);

  // Fetch grupos for filter dropdown
  useEffect(() => {
    fetch('/api/admin/clientes/grupos')
      .then(r => r.json())
      .then(d => setGrupos(d.grupos ?? []))
      .catch(() => {});
  }, []);

  const params = new URLSearchParams();
  if (tab) params.set('tipo', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');
  params.set('activo', 'true');

  const { data, loading } = useFetch<{
    data: ClienteRow[]; total: number; totalPages: number;
  }>(`/api/admin/clientes?${params}`);

  // Filter by grupo on client-side (since API doesn't support it directly)
  const allClientes = data?.data ?? [];
  const clientes = grupoFilter
    ? allClientes.filter(c => c.grupo_empresarial?.id === grupoFilter)
    : allClientes;

  async function handleDownload() {
    setDownloading(true);
    try {
      const exportParams = new URLSearchParams();
      if (tab) exportParams.set('tipo', tab);
      if (search) exportParams.set('q', search);
      exportParams.set('activo', 'true');
      exportParams.set('page', '1');
      exportParams.set('limit', '10000');

      const res = await fetch(`/api/admin/clientes?${exportParams}`);
      const json = await res.json();
      const rows: ClienteRow[] = json.data ?? [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Clientes');

      ws.columns = [
        { header: 'Código', key: 'codigo', width: 14 },
        { header: 'Nombre', key: 'nombre', width: 32 },
        { header: 'Tipo', key: 'tipo', width: 14 },
        { header: 'NIT', key: 'nit', width: 16 },
        { header: 'Email', key: 'email', width: 28 },
        { header: 'Teléfono', key: 'telefono', width: 16 },
        { header: 'Rep. Direccion', key: 'rep_direccion', width: 28 },
        { header: 'Rep. Gestion', key: 'rep_gestion', width: 28 },
        { header: 'Grupo Empresarial', key: 'grupo', width: 24 },
      ];

      // Style header row
      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { vertical: 'middle' };
      });

      rows.forEach(c => {
        ws.addRow({
          codigo: c.codigo,
          nombre: c.nombre,
          tipo: c.tipo === 'empresa' ? 'Empresa' : 'Individual',
          nit: c.nit,
          email: c.email ?? '',
          telefono: c.telefono ?? '',
          rep_direccion: c.administrador_unico_nombre ?? '',
          rep_gestion: c.gerente_general_nombre ?? '',
          grupo: c.grupo_empresarial?.nombre ?? '',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const fecha = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Clientes_${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar clientes:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} clientes activos</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading || clientes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download size={16} />
            {downloading ? 'Descargando…' : 'Descargar Clientes'}
          </button>
          <Link
            href="/admin/clientes/importar"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
          >
            <Upload size={16} />
            Importar Excel
          </Link>
          <button
            onClick={() => router.push('/admin/clientes/nuevo')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all"
          >
            + Nuevo cliente
          </button>
        </div>
      </div>

      {/* Tabs + Grupo Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>

        {grupos.length > 0 && (
          <select
            value={grupoFilter}
            onChange={e => { setGrupoFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
          >
            <option value="">Todos los grupos</option>
            {grupos.map(g => (
              <option key={g.id} value={g.id}>{g.nombre} ({g.num_empresas})</option>
            ))}
          </select>
        )}
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
                      }`}>{c.tipo === 'empresa' ? 'Empresa' : 'Individual'}</span>
                      {c.grupo_empresarial && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">Grupo</span>
                      )}
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
