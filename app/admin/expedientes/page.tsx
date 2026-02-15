// ============================================================================
// app/admin/expedientes/page.tsx
// Lista de expedientes con filtros, búsqueda, badges y exportación Excel
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { Download, Scale, Shield, Building2, Plus, AlertTriangle } from 'lucide-react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { TableSkeleton, EmptyState } from '@/components/admin/ui';
import {
  type ExpedienteConCliente, type OrigenExpediente,
  ORIGEN_LABEL, ORIGEN_COLOR, TIPO_PROCESO_LABEL,
  FASE_LABEL, ESTADO_EXPEDIENTE_LABEL, ESTADO_EXPEDIENTE_COLOR,
  DEPARTAMENTOS_GUATEMALA,
} from '@/lib/types/expedientes';

const ORIGEN_TABS = [
  { key: '', label: 'Todos' },
  { key: 'judicial', label: 'Judiciales' },
  { key: 'fiscal', label: 'Fiscales' },
  { key: 'administrativo', label: 'Administrativos' },
];

const ESTADO_TABS = [
  { key: '', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'suspendido', label: 'Suspendidos' },
  { key: 'archivado', label: 'Archivados' },
  { key: 'finalizado', label: 'Finalizados' },
];

const OrigenIcon = ({ origen }: { origen: OrigenExpediente }) => {
  const cls = 'w-4 h-4';
  switch (origen) {
    case 'judicial': return <Scale className={cls} />;
    case 'fiscal': return <Shield className={cls} />;
    case 'administrativo': return <Building2 className={cls} />;
  }
};

function getNumeroDisplay(e: ExpedienteConCliente): string {
  const nums: string[] = [];
  if (e.numero_expediente) nums.push(e.numero_expediente);
  if (e.numero_mp) nums.push(`MP: ${e.numero_mp}`);
  if (e.numero_administrativo) nums.push(`Admin: ${e.numero_administrativo}`);
  return nums.join(' / ');
}

function getSedeDisplay(e: ExpedienteConCliente): string {
  if (e.juzgado) return e.juzgado;
  if (e.fiscalia) return e.fiscalia;
  if (e.entidad_administrativa) return e.entidad_administrativa;
  return '—';
}

export default function ExpedientesListPage() {
  const router = useRouter();
  const [origen, setOrigen] = useState('');
  const [estado, setEstado] = useState('activo');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [departamento, setDepartamento] = useState('');
  const [downloading, setDownloading] = useState(false);

  const params = new URLSearchParams();
  if (origen) params.set('origen', origen);
  if (estado) params.set('estado', estado);
  if (search) params.set('q', search);
  if (departamento) params.set('departamento', departamento);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading } = useFetch<{
    data: ExpedienteConCliente[]; total: number; totalPages: number;
  }>(`/api/admin/expedientes?${params}`);

  const expedientes = data?.data ?? [];

  async function handleDownload() {
    setDownloading(true);
    try {
      const exportParams = new URLSearchParams();
      if (origen) exportParams.set('origen', origen);
      if (estado) exportParams.set('estado', estado);
      if (search) exportParams.set('q', search);
      if (departamento) exportParams.set('departamento', departamento);
      exportParams.set('page', '1');
      exportParams.set('limit', '10000');

      const res = await fetch(`/api/admin/expedientes?${exportParams}`);
      const json = await res.json();
      const rows: ExpedienteConCliente[] = json.data ?? [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Expedientes');

      ws.columns = [
        { header: 'No. Expediente', key: 'numero', width: 24 },
        { header: 'No. MP', key: 'numero_mp', width: 20 },
        { header: 'No. Administrativo', key: 'numero_admin', width: 20 },
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Origen', key: 'origen', width: 14 },
        { header: 'Tipo Proceso', key: 'tipo', width: 24 },
        { header: 'Fase', key: 'fase', width: 24 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Sede', key: 'sede', width: 28 },
        { header: 'Departamento', key: 'depto', width: 16 },
        { header: 'Actor', key: 'actor', width: 24 },
        { header: 'Demandado', key: 'demandado', width: 24 },
        { header: 'Fecha Inicio', key: 'fecha', width: 14 },
        { header: 'Última Actuación', key: 'ultima', width: 14 },
      ];

      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { vertical: 'middle' };
      });

      rows.forEach(e => {
        ws.addRow({
          numero: e.numero_expediente ?? '',
          numero_mp: e.numero_mp ?? '',
          numero_admin: e.numero_administrativo ?? '',
          cliente: e.cliente?.nombre ?? '',
          origen: ORIGEN_LABEL[e.origen],
          tipo: TIPO_PROCESO_LABEL[e.tipo_proceso],
          fase: FASE_LABEL[e.fase_actual],
          estado: ESTADO_EXPEDIENTE_LABEL[e.estado] ?? e.estado,
          sede: getSedeDisplay(e),
          depto: e.departamento ?? '',
          actor: e.actor ?? '',
          demandado: e.demandado ?? '',
          fecha: e.fecha_inicio,
          ultima: e.fecha_ultima_actuacion ?? '',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const fecha = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Expedientes_${fecha}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar:', err);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expedientes</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} expedientes</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading || expedientes.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download size={16} />
            {downloading ? 'Descargando...' : 'Descargar'}
          </button>
          <button
            onClick={() => router.push('/admin/expedientes/nuevo')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all"
          >
            <Plus size={16} />
            Nuevo Expediente
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Origen tabs */}
        <div className="flex gap-1">
          {ORIGEN_TABS.map(t => (
            <button key={t.key} onClick={() => { setOrigen(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                origen === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>

        {/* Estado filter */}
        <select
          value={estado}
          onChange={e => { setEstado(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
        >
          {ESTADO_TABS.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        {/* Departamento filter */}
        <select
          value={departamento}
          onChange={e => { setDepartamento(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
        >
          <option value="">Todos los departamentos</option>
          {DEPARTAMENTOS_GUATEMALA.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por número, cliente, partes procesales..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-md px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : expedientes.length === 0 ? (
        <EmptyState icon="⚖️" title="Sin expedientes" description="Crea tu primer expediente"
          action={{ label: '+ Nuevo Expediente', onClick: () => router.push('/admin/expedientes/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['', 'Número(s)', 'Cliente', 'Tipo', 'Sede', 'Fase', 'Estado', 'Plazos'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expedientes.map(e => (
                  <tr key={e.id} onClick={() => router.push(`/admin/expedientes/${e.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    {/* Origen icon */}
                    <td className="py-3 px-4 pl-5">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${ORIGEN_COLOR[e.origen]}`}>
                        <OrigenIcon origen={e.origen} />
                      </span>
                    </td>
                    {/* Números */}
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-slate-900 font-mono">{getNumeroDisplay(e)}</div>
                      {e.fecha_ultima_actuacion && (
                        <div className="text-xs text-slate-400 mt-0.5">Últ. actuación: {e.fecha_ultima_actuacion}</div>
                      )}
                    </td>
                    {/* Cliente */}
                    <td className="py-3 px-4 text-sm text-slate-700 max-w-[180px] truncate">{e.cliente?.nombre ?? '—'}</td>
                    {/* Tipo proceso */}
                    <td className="py-3 px-4 text-sm text-slate-600">{TIPO_PROCESO_LABEL[e.tipo_proceso]}</td>
                    {/* Sede */}
                    <td className="py-3 px-4 text-sm text-slate-500 max-w-[160px] truncate">{getSedeDisplay(e)}</td>
                    {/* Fase */}
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                        {FASE_LABEL[e.fase_actual]}
                      </span>
                    </td>
                    {/* Estado */}
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_EXPEDIENTE_COLOR[e.estado]}`}>
                        {ESTADO_EXPEDIENTE_LABEL[e.estado]}
                      </span>
                    </td>
                    {/* Plazos urgentes */}
                    <td className="py-3 px-4 pr-5">
                      {e.plazo_proximo && e.plazo_proximo.dias_restantes <= 5 && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          e.plazo_proximo.dias_restantes <= 2
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          <AlertTriangle size={12} />
                          {e.plazo_proximo.dias_restantes}d
                        </span>
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
