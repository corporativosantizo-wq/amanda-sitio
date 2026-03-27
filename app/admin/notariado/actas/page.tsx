// ============================================================================
// app/admin/notariado/actas/page.tsx
// Documentos notariales — actas notariales y escrituras públicas
// Lee de legal.documentos WHERE tipo IN ('acta_notarial', 'escritura_publica')
// ============================================================================

'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge, EmptyState, TableSkeleton } from '@/components/admin/ui';
import DocumentViewer from '@/components/admin/document-viewer';

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'acta_notarial', label: 'Actas Notariales' },
  { key: 'escritura_publica', label: 'Escrituras Publicas' },
];

const TIPO_LABELS: Record<string, string> = {
  acta_notarial: 'Acta Notarial',
  escritura_publica: 'Escritura Publica',
};

interface DocNotarial {
  id: string;
  codigo_documento: string | null;
  titulo: string;
  tipo: string;
  estado: string;
  nombre_archivo: string;
  archivo_url: string | null;
  fecha_documento: string | null;
  numero_documento: string | null;
  descripcion: string | null;
  partes: any[] | null;
  cliente: { id: string; codigo: string; nombre: string } | null;
  created_at: string;
}

export default function ActasNotarialesPage() {
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (tab) params.set('tipo', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '30');

  const { data, loading } = useFetch<{
    data: DocNotarial[]; total: number; totalPages: number;
  }>(`/api/admin/notariado/actas?${params}`);

  const docs = data?.data ?? [];
  const [previewDoc, setPreviewDoc] = useState<{ id: string; nombre: string } | null>(null);

  const formatFecha = (fecha: string | null) => {
    if (!fecha) return '—';
    return new Date(fecha).toLocaleDateString('es-GT', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatPartes = (partes: any[] | null) => {
    if (!partes || partes.length === 0) return '—';
    return partes
      .map((p: any) => p.nombre ?? p.requirente ?? p.otorgante ?? '')
      .filter(Boolean)
      .join(', ')
      || '—';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Actas y Documentos Notariales"
        description={`${data?.total ?? 0} documentos`}
      />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>
      </div>

      <input type="text" placeholder="Buscar por titulo, numero, descripcion..."
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={10} /> : docs.length === 0 ? (
        <EmptyState icon="📄" title="Sin documentos" description="No hay actas ni escrituras registradas" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['No.', 'Titulo', 'Tipo', 'Fecha', 'Requirente / Partes', 'Cliente', 'Doc'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm font-mono text-[#1E40AF] font-bold">
                      {doc.numero_documento || doc.codigo_documento || '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-900 font-medium max-w-xs truncate">
                      {doc.titulo || doc.nombre_archivo}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={doc.tipo === 'acta_notarial' ? 'info' : 'success'}>
                        {TIPO_LABELS[doc.tipo] ?? doc.tipo}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {formatFecha(doc.fecha_documento)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate">
                      {formatPartes(doc.partes)}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {doc.cliente?.nombre ?? '—'}
                    </td>
                    <td className="py-3 px-4 pr-5">
                      {doc.archivo_url ? (
                        <button
                          onClick={() => setPreviewDoc({ id: doc.id, nombre: doc.nombre_archivo ?? doc.titulo ?? 'documento' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
                          title="Ver documento"
                        >
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
                          PDF
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Sin archivo</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">Pagina {page} de {data.totalPages} ({data.total} docs)</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Anterior</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente</button>
              </div>
            </div>
          )}
        </div>
      )}

      {previewDoc && (
        <DocumentViewer
          docId={previewDoc.id}
          fileName={previewDoc.nombre}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
