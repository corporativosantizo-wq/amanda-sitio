// ============================================================================
// app/admin/laboral/page.tsx
// Lista de trámites laborales con filtros, semáforo y exportación Excel
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ExcelJS from 'exceljs';
import { Download, Plus, AlertTriangle, CheckCircle } from 'lucide-react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { TableSkeleton, EmptyState } from '@/components/admin/ui';
import {
  type TramiteLaboralConCliente,
  type CategoriaLaboral,
  CATEGORIA_LABORAL_SHORT,
  CATEGORIA_LABORAL_LABEL,
  ESTADO_LABORAL_LABEL,
  ESTADO_LABORAL_COLOR,
  MONEDA_LABORAL_LABEL,
  getSemaforoLaboral,
  SEMAFORO_LABORAL_DOT,
} from '@/lib/types/laboral';

const ESTADO_TABS = [
  { key: '', label: 'Todos' },
  { key: 'pendiente', label: 'Pendiente' },
  { key: 'en_elaboracion', label: 'En Elaboración' },
  { key: 'firmado', label: 'Firmado' },
  { key: 'registrado', label: 'Registrado' },
  { key: 'vigente', label: 'Vigente' },
  { key: 'vencido', label: 'Vencido' },
];

const CATEGORIA_OPTIONS: { key: string; label: string }[] = [
  { key: '', label: 'Todas las categorías' },
  ...Object.entries(CATEGORIA_LABORAL_SHORT).map(([k, v]) => ({ key: k, label: v })),
];

export default function LaboralListPage() {
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
    data: TramiteLaboralConCliente[]; total: number; totalPages: number;
  }>(`/api/admin/laboral?${params}`);

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

      const res = await fetch(`/api/admin/laboral?${exportParams}`);
      const json = await res.json();
      const rows: TramiteLaboralConCliente[] = json.data ?? [];

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Trámites Laborales');

      ws.columns = [
        { header: 'Cliente', key: 'cliente', width: 28 },
        { header: 'Categoría', key: 'categoria', width: 24 },
        { header: 'Estado', key: 'estado', width: 14 },
        { header: 'Empleado', key: 'empleado', width: 24 },
        { header: 'Puesto', key: 'puesto', width: 20 },
        { header: 'Fecha Inicio', key: 'fecha_inicio', width: 14 },
        { header: 'Fecha Fin', key: 'fecha_fin', width: 14 },
        { header: 'Salario', key: 'salario', width: 14 },
        { header: 'Moneda', key: 'moneda', width: 8 },
        { header: 'Registro IGT', key: 'registro_igt', width: 18 },
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
          categoria: CATEGORIA_LABORAL_LABEL[t.categoria],
          estado: ESTADO_LABORAL_LABEL[t.estado],
          empleado: t.nombre_empleado ?? '',
          puesto: t.puesto ?? '',
          fecha_inicio: t.fecha_inicio ?? '',
          fecha_fin: t.fecha_fin ?? '',
          salario: t.salario ?? '',
          moneda: t.moneda,
          registro_igt: t.numero_registro_igt ?? '',
          descripcion: t.descripcion ?? '',
        });
      });

      const buf = await wb.xlsx.writeBuffer();
      const fecha = new Date().toISOString().slice(0, 10);
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tramites_Laborales_${fecha}.xlsx`;
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
          <h1 className="text-xl font-bold text-slate-900">Cumplimiento Laboral</h1>
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
            onClick={() => router.push('/admin/laboral/nuevo')}
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
      <input type="text" placeholder="Buscar por empleado, puesto, registro IGT..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-md px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : tramites.length === 0 ? (
        <EmptyState icon="📄" title="Sin trámites laborales" description="Registra tu primer trámite"
          action={{ label: '+ Nuevo Trámite', onClick: () => router.push('/admin/laboral/nuevo') }} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['', 'Cliente', 'Categoría', 'Empleado', 'Vigencia', 'Estado', ''].map((h, i) => (
                    <th key={i} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tramites.map(t => {
                  const semaforo = getSemaforoLaboral(t.fecha_fin, t.estado, t.alerta_dias_antes);
                  return (
                    <tr key={t.id} onClick={() => router.push(`/admin/laboral/${t.id}`)}
                      className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <td className="py-3 px-4 pl-5">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${SEMAFORO_LABORAL_DOT[semaforo]}`} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-slate-900">{t.cliente?.nombre ?? '—'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-700">{CATEGORIA_LABORAL_SHORT[t.categoria]}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm text-slate-900">{t.nombre_empleado ?? '—'}</div>
                        {t.puesto && <div className="text-xs text-slate-400">{t.puesto}</div>}
                      </td>
                      <td className="py-3 px-4">
                        {t.fecha_inicio || t.fecha_fin ? (
                          <div className="text-xs text-slate-600">
                            {t.fecha_inicio && <span>{t.fecha_inicio}</span>}
                            {t.fecha_inicio && t.fecha_fin && <span> — </span>}
                            {t.fecha_fin && <span>{t.fecha_fin}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_LABORAL_COLOR[t.estado]}`}>
                          {ESTADO_LABORAL_LABEL[t.estado]}
                        </span>
                      </td>
                      <td className="py-3 px-4 pr-5">
                        {semaforo === 'rojo' && <AlertTriangle size={16} className="text-red-500" />}
                        {semaforo === 'amarillo' && <AlertTriangle size={16} className="text-amber-500" />}
                        {semaforo === 'verde' && <CheckCircle size={16} className="text-green-500" />}
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
