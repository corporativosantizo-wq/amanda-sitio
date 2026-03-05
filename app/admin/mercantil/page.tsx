// ============================================================================
// app/admin/mercantil/page.tsx
// Lista de trámites mercantiles con filtros, semáforo y exportación Excel
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { Download, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { TableSkeleton, EmptyState } from '@/components/admin/ui';
import {
  type TramiteMercantilConCliente,
  type CategoriaMercantil,
  type EstadoTramiteMercantil,
  CATEGORIA_MERCANTIL_SHORT,
  CATEGORIA_MERCANTIL_LABEL,
  ESTADO_MERCANTIL_LABEL,
  ESTADO_MERCANTIL_COLOR,
  getSemaforoMercantil,
  SEMAFORO_DOT,
} from '@/lib/types/mercantil';

const ESTADO_TABS = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_proceso', label: 'En Proceso' },
  { key: 'en_registro', label: 'En Registro' },
  { key: 'inscrito', label: 'Inscrito' },
  { key: 'vigente', label: 'Vigente' },
  { key: 'vencido', label: 'Vencido' },
];

const CATEGORIA_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Todas las categorías' },
  ...Object.entries(CATEGORIA_MERCANTIL_SHORT).map(([k, v]) => ({ key: k, label: v })),
];

export default function MercantilListPage() {
  const router = useRouter();
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (categoria) params.set('categoria', categoria);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading } = useFetch<{
    data: TramiteMercantilConCliente[]; total: number; totalPages: number;
  }>(`/api/admin/mercantil?${params}`);

  const tramites = data?.data ?? [];

  async function handleDownload() {
    setDownloading(true);
    try {
      const exportParams = new URLSearchParams();
      if (estado) exportParams.set('estado', estado);
      if (categoria) exportParams.set('categoria', categoria);
      if (search) exportParams.set('q', search);
      exportParams.set('page', '1');
      exportParams.set('limit', '10000');

      const res = await fetch(`/api/admin/mercantil?${exportParams}`);
      const json = await res.json();
      const rows: TramiteMercantilConCliente[] = json.data ?? [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Trámites Mercantiles');

      ws.columns = [
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'NIT', key: 'nit', width: 14 },
        { header: 'Categoría', key: 'categoria', width: 28 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'No. Registro', key: 'registro', width: 18 },
        { header: 'Fecha Trámite', key: 'fecha_tramite', width: 14 },
        { header: 'Fecha Inscripción', key: 'fecha_inscripcion', width: 16 },
        { header: 'Fecha Vencimiento', key: 'fecha_vencimiento', width: 16 },
        { header: 'Expediente RM', key: 'expediente_rm', width: 18 },
        { header: 'Notario', key: 'notario', width: 22 },
        { header: 'Descripción', key: 'descripcion', width: 36 },
      ];

      ws.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { vertical: 'middle' };
      });

      rows.forEach(t => {
        ws.addRow({
          cliente: t.cliente?.nombre ?? '',
          nit: t.cliente?.nit ?? '',
          categoria: CATEGORIA_MERCANTIL_LABEL[t.categoria],
          estado: ESTADO_MERCANTIL_LABEL[t.estado],
          registro: t.numero_registro ?? '',
          fecha_tramite: t.fecha_tramite,
          fecha_inscripcion: t.fecha_inscripcion ?? '',
          fecha_vencimiento: t.fecha_vencimiento ?? '',
          expediente_rm: t.numero_expediente_rm ?? '',
          notario: t.notario_responsable ?? '',
          descripcion: t.descripcion ?? '',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const fecha = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tramites_Mercantiles_${fecha}.xlsx`;
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
          <h1 className="text-xl font-bold text-slate-900">Cumplimiento Mercantil</h1>
          <p className="text-sm text-slate-500 mt-0.5">{data?.total ?? 0} trámites</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading || tramites.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download size={16} />
            {downloading ? 'Descargando...' : 'Descargar'}
          </button>
          <button
            onClick={() => router.push('/admin/mercantil/nuevo')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all"
          >
            <Plus size={16} />
            Nuevo Trámite
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 flex-wrap">
          {ESTADO_TABS.map(t => (
            <button key={t.key} onClick={() => { setEstado(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                estado === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>
        <select
          value={categoria}
          onChange={e => { setCategoria(e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20"
        >
          {CATEGORIA_OPTIONS.map(t => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por registro, expediente, notario, descripción..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-md px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : tramites.length === 0 ? (
        <EmptyState icon="📋" title="Sin trámites mercantiles" description="Registra tu primer trámite"
          action={{ label: '+ Nuevo Trámite', onClick: () => router.push('/admin/mercantil/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['', 'Cliente', 'Categoría', 'No. Registro', 'Vencimiento', 'Estado', ''].map((h, i) => (
                    <th key={i} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tramites.map(t => {
                  const semaforo = getSemaforoMercantil(t.fecha_vencimiento, t.estado, t.alerta_dias_antes);
                  return (
                    <tr key={t.id} onClick={() => router.push(`/admin/mercantil/${t.id}`)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                      {/* Semáforo dot */}
                      <td className="py-3 px-4 pl-5">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${SEMAFORO_DOT[semaforo]}`} />
                      </td>
                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-slate-900">{t.cliente?.nombre ?? '—'}</div>
                        {t.cliente?.nit && <div className="text-xs text-slate-400">NIT: {t.cliente.nit}</div>}
                      </td>
                      {/* Categoría */}
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-700">{CATEGORIA_MERCANTIL_SHORT[t.categoria]}</div>
                        {t.subtipo && <div className="text-xs text-slate-400">{t.subtipo}</div>}
                      </td>
                      {/* No. Registro */}
                      <td className="py-3 px-4 text-sm text-slate-600 font-mono">{t.numero_registro ?? '—'}</td>
                      {/* Vencimiento */}
                      <td className="py-3 px-4">
                        {t.fecha_vencimiento ? (
                          <div className="text-sm text-slate-700">{t.fecha_vencimiento}</div>
                        ) : (
                          <span className="text-xs text-slate-400">Sin vencimiento</span>
                        )}
                      </td>
                      {/* Estado */}
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_MERCANTIL_COLOR[t.estado]}`}>
                          {ESTADO_MERCANTIL_LABEL[t.estado]}
                        </span>
                      </td>
                      {/* Alertas */}
                      <td className="py-3 px-4 pr-5">
                        {semaforo === 'rojo' && (
                          <AlertTriangle size={16} className="text-red-500" />
                        )}
                        {semaforo === 'amarillo' && (
                          <AlertTriangle size={16} className="text-amber-500" />
                        )}
                        {semaforo === 'verde' && (
                          <CheckCircle size={16} className="text-green-500" />
                        )}
                      </td>
                    </tr>
                  );
                })}
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
