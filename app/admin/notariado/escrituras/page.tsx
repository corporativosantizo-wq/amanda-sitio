// ============================================================================
// app/admin/notariado/escrituras/page.tsx
// Protocolo notarial - lista de escrituras con botones PDF/DOCX
// ============================================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge, EmptyState, TableSkeleton } from '@/components/admin/ui';
import { safeWindowOpen } from '@/lib/utils/validate-url';

const TABS = [
  { key: '', label: 'Todas' },
  { key: 'autorizada', label: 'Autorizadas' },
  { key: 'cancelada', label: 'Canceladas' },
];

interface Escritura {
  id: string;
  numero: number;
  numero_texto: string;
  tipo_instrumento_texto: string;
  descripcion: string | null;
  fecha_autorizacion: string;
  estado: string;
  cliente_nombre: string | null;
  testimonios_pendientes: number;
  pdf_escritura_url: string | null;
  tiene_escritura_pdf: boolean;
  tiene_escritura_docx: boolean;
}

export default function EscriturasListPage() {
  const router = useRouter();
  const [tab, setTab] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUpload = useRef<{ escrituraId: string; categoria: string } | null>(null);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  params.set('anio', String(anio));
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading, refetch } = useFetch<{
    data: Escritura[]; total: number; totalPages: number;
  }>(`/api/admin/notariado/escrituras?${params}`);

  const escrituras = data?.data ?? [];

  // Upload handler
  const handleUploadFile = useCallback(async (file: File, escrituraId: string, categoria: string) => {
    const key = `${escrituraId}_${categoria}`;
    setUploading((p) => ({ ...p, [key]: 'uploading' }));
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('escritura_id', escrituraId);
      formData.append('categoria', categoria);

      const res = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Error al subir');
      } else {
        refetch();
      }
    } catch {
      alert('Error al subir archivo');
    }
    setUploading((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  }, [refetch]);

  // Open file picker for upload
  const triggerUpload = (escrituraId: string, categoria: string) => {
    pendingUpload.current = { escrituraId, categoria };
    if (fileInputRef.current) {
      fileInputRef.current.accept = categoria === 'escritura_pdf' ? '.pdf' : '.docx,.doc';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingUpload.current) {
      handleUploadFile(file, pendingUpload.current.escrituraId, pendingUpload.current.categoria);
      pendingUpload.current = null;
    }
    e.target.value = '';
  };

  // Download
  const handleDownload = async (escrituraId: string, categoria: string) => {
    try {
      const res = await fetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${escrituraId}&categoria=${categoria}`);
      if (!res.ok) return;
      const docs = await res.json();
      if (docs.length === 0) return;
      const dlRes = await fetch(`/api/admin/notariado/escrituras/documentos/download?id=${docs[0].id}`);
      if (!dlRes.ok) return;
      const { url } = await dlRes.json();
      safeWindowOpen(url);
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  // Delete
  const handleDeleteDoc = async (escrituraId: string, categoria: string) => {
    if (!confirm(`¿Eliminar el archivo ${categoria === 'escritura_pdf' ? 'PDF' : 'DOCX'} de esta escritura?`)) return;
    try {
      const res = await fetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${escrituraId}&categoria=${categoria}`);
      if (!res.ok) return;
      const docs = await res.json();
      if (docs.length === 0) return;

      const delRes = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docs[0].id }),
      });
      if (delRes.ok) refetch();
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

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

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}>{t.label}</button>
          ))}
        </div>
        <select value={anio} onChange={(e) => { setAnio(+e.target.value); setPage(1); }}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <input type="text" placeholder="Buscar por número, acto o otorgante..."
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                  {['No.', 'Tipo de acto', 'Descripción', 'Fecha', 'Estado', 'Archivos'].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escrituras.map((e) => {
                  const pdfKey = `${e.id}_escritura_pdf`;
                  const docxKey = `${e.id}_escritura_docx`;
                  const isPdfUploading = !!uploading[pdfKey];
                  const isDocxUploading = !!uploading[docxKey];

                  return (
                    <tr key={e.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="py-3 px-4 pl-5 cursor-pointer" onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}>
                        <span className="text-lg font-bold text-[#1E40AF]">{e.numero}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900 font-medium cursor-pointer" onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}>
                        {e.tipo_instrumento_texto}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 max-w-xs truncate cursor-pointer" onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}>
                        {e.descripcion || '—'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500 cursor-pointer" onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}>
                        {new Date(e.fecha_autorizacion).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 cursor-pointer" onClick={() => router.push(`/admin/notariado/escrituras/${e.id}`)}>
                        <Badge variant={e.estado as any}>{e.estado}</Badge>
                      </td>
                      <td className="py-3 px-4 pr-5">
                        <div className="flex items-center gap-1.5 relative">
                          {/* PDF button */}
                          <FileActionButton
                            type="pdf"
                            hasFile={e.tiene_escritura_pdf}
                            isUploading={isPdfUploading}
                            menuOpen={menuOpen === pdfKey}
                            onToggleMenu={() => setMenuOpen(menuOpen === pdfKey ? null : pdfKey)}
                            onUpload={() => triggerUpload(e.id, 'escritura_pdf')}
                            onDownload={() => handleDownload(e.id, 'escritura_pdf')}
                            onReplace={() => triggerUpload(e.id, 'escritura_pdf')}
                            onDelete={() => handleDeleteDoc(e.id, 'escritura_pdf')}
                          />
                          {/* DOCX button */}
                          <FileActionButton
                            type="docx"
                            hasFile={e.tiene_escritura_docx}
                            isUploading={isDocxUploading}
                            menuOpen={menuOpen === docxKey}
                            onToggleMenu={() => setMenuOpen(menuOpen === docxKey ? null : docxKey)}
                            onUpload={() => triggerUpload(e.id, 'escritura_docx')}
                            onDownload={() => handleDownload(e.id, 'escritura_docx')}
                            onReplace={() => triggerUpload(e.id, 'escritura_docx')}
                            onDelete={() => handleDeleteDoc(e.id, 'escritura_docx')}
                          />
                        </div>
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
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
                <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Close menus on click outside */}
      {menuOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}

// ── File Action Button ─────────────────────────────────────────────────

function FileActionButton({
  type, hasFile, isUploading, menuOpen,
  onToggleMenu, onUpload, onDownload, onReplace, onDelete,
}: {
  type: 'pdf' | 'docx';
  hasFile: boolean;
  isUploading: boolean;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const isPdf = type === 'pdf';
  const label = isPdf ? 'PDF' : 'DOCX';
  const solidBg = isPdf ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700';
  const outlineBg = isPdf
    ? 'bg-white text-red-600 border border-red-300 hover:bg-red-50'
    : 'bg-white text-blue-600 border border-blue-300 hover:bg-blue-50';

  if (isUploading) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md ${isPdf ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        {label}
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={(ev) => {
          ev.stopPropagation();
          if (hasFile) onToggleMenu();
          else onUpload();
        }}
        title={hasFile ? `${label} disponible` : `Subir ${label}`}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${hasFile ? solidBg : outlineBg}`}
      >
        {isPdf ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v3H8v-3zm3 0h2v3h-2v-3zm3 0h2v3h-2v-3z"/></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h1.5l1 2.5L11.5 14H13l-1.75 3.5L13 21h-1.5l-1-2.5L9.5 21H8l1.75-3.5L8 14z"/></svg>
        )}
        {label}
      </button>

      {/* Dropdown menu when file exists */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-40">
          <button
            onClick={(ev) => { ev.stopPropagation(); onDownload(); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4" /></svg>
            Descargar
          </button>
          <button
            onClick={(ev) => { ev.stopPropagation(); onReplace(); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Reemplazar
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={(ev) => { ev.stopPropagation(); onDelete(); }}
            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
