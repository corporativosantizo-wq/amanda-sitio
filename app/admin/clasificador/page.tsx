// ============================================================================
// app/admin/clasificador/page.tsx
// Panel de clasificación y asignación masiva de documentos
// ============================================================================
'use client';

import { useState, useEffect, useRef } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { KPICard } from '@/components/admin/ui';

// ── Types ──────────────────────────────────────────────────────────────────

interface DocItem {
  id: string;
  nombre_archivo: string;
  nombre_original: string | null;
  codigo_documento: string | null;
  tipo: string | null;
  titulo: string | null;
  fecha_documento: string | null;
  confianza_ia: number;
  estado: string;
  cliente_nombre_detectado: string | null;
  cliente_id: string | null;
  partes: any[];
  archivo_tamano: number;
  created_at: string;
  cliente: { id: string; codigo: string; nombre: string } | null;
}

interface Stats {
  sin_cliente: number;
  pendientes: number;
  clasificados: number;
  total: number;
}

interface ApiResponse {
  data: DocItem[];
  total: number;
  totalPages: number;
  stats: Stats;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TIPOS: Record<string, string> = {
  contrato_comercial: '📑 Contrato Comercial',
  escritura_publica: '📜 Escritura Pública',
  testimonio: '📃 Testimonio',
  acta_notarial: '🖊️ Acta Notarial',
  poder: '🔏 Poder',
  contrato_laboral: '👷 Contrato Laboral',
  demanda_memorial: '📝 Demanda / Memorial',
  resolucion_judicial: '⚖️ Resolución Judicial',
  otro: '📄 Otro',
};

const TIPOS_SELECT: Record<string, string> = {
  contrato_comercial: 'Contrato Comercial',
  escritura_publica: 'Escritura Pública',
  testimonio: 'Testimonio',
  acta_notarial: 'Acta Notarial',
  poder: 'Poder',
  contrato_laboral: 'Contrato Laboral',
  demanda_memorial: 'Demanda / Memorial',
  resolucion_judicial: 'Resolución Judicial',
  otro: 'Otro',
};

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-amber-50', text: 'text-amber-700' },
  clasificado: { bg: 'bg-blue-50', text: 'text-blue-700' },
  aprobado: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rechazado: { bg: 'bg-red-50', text: 'text-red-700' },
};

const TABS = [
  { key: 'sin_cliente', label: 'Sin cliente' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'clasificados', label: 'Clasificados IA' },
  { key: 'todos', label: 'Todos' },
];

function getFileIcon(name: string): string {
  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (ext === '.pdf') return '📄';
  if (ext === '.docx' || ext === '.doc') return '📝';
  if (ext === '.xlsx' || ext === '.xls') return '📊';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return '🖼️';
  return '📄';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ClasificadorPage() {
  const [tab, setTab] = useState('sin_cliente');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<any[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Floating action bar state
  const [asignarClienteId, setAsignarClienteId] = useState('');
  const [asignarClienteQuery, setAsignarClienteQuery] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [cambiarTipo, setCambiarTipo] = useState('');

  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const clienteDropdownRef = useRef<HTMLDivElement>(null);
  const { mutate, loading: mutating } = useMutate();

  // ── Debounce search ────────────────────────────────────────────────────

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [search]);

  // ── Close dropdown on outside click ────────────────────────────────────

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (clienteDropdownRef.current && !clienteDropdownRef.current.contains(e.target as Node)) {
        setShowClienteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch data ─────────────────────────────────────────────────────────

  const params = new URLSearchParams();
  params.set('tab', tab);
  if (debouncedSearch) params.set('q', debouncedSearch);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data: apiData, loading, refetch } = useFetch<ApiResponse>(
    `/api/admin/clasificador?${params}`
  );

  const docs = apiData?.data ?? [];
  const stats = apiData?.stats ?? { sin_cliente: 0, pendientes: 0, clasificados: 0, total: 0 };

  // Load clientes for dropdown
  useEffect(() => {
    fetch('/api/admin/clientes?limit=200&activo=true')
      .then((r: any) => r.json())
      .then((d: any) => setClientes(d.data ?? []))
      .catch(() => {});
  }, []);

  // ── Selection helpers ──────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelectedDocs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocs.size === docs.length && docs.length > 0) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(docs.map((d: DocItem) => d.id)));
    }
  };

  const cancelSelection = () => {
    setSelectedDocs(new Set());
    setAsignarClienteId('');
    setAsignarClienteQuery('');
    setCambiarTipo('');
  };

  // ── Actions ────────────────────────────────────────────────────────────

  const handleAsignar = async () => {
    if (!asignarClienteId || selectedDocs.size === 0) return;
    await mutate('/api/admin/clasificador/actions', {
      body: {
        action: 'asignar',
        documento_ids: Array.from(selectedDocs),
        cliente_id: asignarClienteId,
      },
      onSuccess: () => {
        cancelSelection();
        refetch();
      },
    });
  };

  const handleCambiarTipo = async () => {
    if (!cambiarTipo || selectedDocs.size === 0) return;
    await mutate('/api/admin/clasificador/actions', {
      body: {
        action: 'cambiar_tipo',
        documento_ids: Array.from(selectedDocs),
        tipo: cambiarTipo,
      },
      onSuccess: () => {
        cancelSelection();
        refetch();
      },
    });
  };

  // ── Preview ────────────────────────────────────────────────────────────

  const openPreview = async (doc: DocItem) => {
    setPreviewDoc(doc);
    setPreviewUrl(null);
    try {
      const res = await fetch(`/api/admin/documentos/${doc.id}`);
      const data = await res.json();
      if (data.signed_url) setPreviewUrl(data.signed_url);
    } catch { /* ignore */ }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  // ── Client search dropdown ─────────────────────────────────────────────

  const clientesFiltrados = asignarClienteQuery.length >= 1
    ? clientes.filter((c: any) =>
        c.nombre.toLowerCase().includes(asignarClienteQuery.toLowerCase()) ||
        (c.codigo ?? '').toLowerCase().includes(asignarClienteQuery.toLowerCase())
      ).slice(0, 8)
    : [];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Clasificador de Documentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Clasifica, asigna y organiza documentos pendientes
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Sin cliente"
          value={String(stats.sin_cliente)}
          icon={<span>👤</span>}
          accent={tab === 'sin_cliente'}
        />
        <KPICard
          label="Pendientes"
          value={String(stats.pendientes)}
          icon={<span>⏳</span>}
          accent={tab === 'pendientes'}
        />
        <KPICard
          label="Clasificados IA"
          value={String(stats.clasificados)}
          icon={<span>🤖</span>}
          accent={tab === 'clasificados'}
        />
        <KPICard
          label="Total documentos"
          value={String(stats.total)}
          icon={<span>📁</span>}
          accent={tab === 'todos'}
        />
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); setSelectedDocs(new Set()); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto">
          <svg width="16" height="16" fill="none" stroke="#94a3b8" viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e: any) => setSearch(e.target.value)}
            className="w-full sm:w-72 pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
          />
          {search && (
            <button
              onClick={() => { setSearch(''); setDebouncedSearch(''); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Document table */}
      {loading ? (
        <div className="bg-white rounded-xl p-10 text-center">
          <div className="w-8 h-8 border-3 border-slate-200 border-t-[#0891B2] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Cargando documentos...</p>
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <svg width="48" height="48" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" className="mx-auto mb-3">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-slate-500">No se encontraron documentos en esta vista.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  <th className="w-10 py-3 pl-5 pr-1">
                    <input
                      type="checkbox"
                      checked={docs.length > 0 && selectedDocs.size === docs.length}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]"
                    />
                  </th>
                  {['Nombre / Título', 'Tipo', 'Estado', 'Tamaño', 'Fecha', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {docs.map((doc: DocItem) => {
                  const est = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                  const showAiSuggestion = doc.cliente_nombre_detectado && !doc.cliente_id;
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-slate-50/50 transition-colors ${selectedDocs.has(doc.id) ? 'bg-blue-50/30' : ''}`}
                    >
                      <td className="py-3 pl-5 pr-1">
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]"
                        />
                      </td>
                      <td className="py-3 px-4 max-w-[280px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0">{getFileIcon(doc.nombre_original ?? doc.nombre_archivo)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {doc.titulo ?? doc.nombre_archivo}
                            </p>
                            {doc.titulo && doc.nombre_original && (
                              <p className="text-xs text-slate-400 truncate">{doc.nombre_original}</p>
                            )}
                            {showAiSuggestion && (
                              <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                🤖 IA: &ldquo;{doc.cliente_nombre_detectado}&rdquo;
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {doc.tipo ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap bg-slate-100 text-slate-600">
                            {TIPOS[doc.tipo] ?? doc.tipo}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.bg} ${est.text}`}>
                          {doc.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">
                        {formatBytes(doc.archivo_tamano)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500 whitespace-nowrap">
                        {doc.created_at
                          ? new Date(doc.created_at).toLocaleDateString('es-GT')
                          : '—'}
                      </td>
                      <td className="py-3 px-4 pr-5 text-right">
                        <button
                          onClick={() => openPreview(doc)}
                          className="px-3 py-1.5 text-xs font-medium text-[#0891B2] bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors whitespace-nowrap"
                        >
                          Vista previa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {apiData && apiData.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">
                Página {page} de {apiData.totalPages} ({apiData.total} documentos)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30"
                >
                  &larr; Anterior
                </button>
                <button
                  onClick={() => setPage((p: number) => p + 1)}
                  disabled={page >= apiData.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30"
                >
                  Siguiente &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating action bar */}
      {selectedDocs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1E3A5F] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium shrink-0">
            {selectedDocs.size} documento{selectedDocs.size !== 1 ? 's' : ''} seleccionado{selectedDocs.size !== 1 ? 's' : ''}
          </span>

          {/* Client selector */}
          <div className="flex items-center gap-2" ref={clienteDropdownRef}>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={asignarClienteId
                  ? clientes.find((c: any) => c.id === asignarClienteId)?.nombre ?? ''
                  : asignarClienteQuery}
                onChange={(e: any) => {
                  if (asignarClienteId) {
                    setAsignarClienteId('');
                  }
                  setAsignarClienteQuery(e.target.value);
                  setShowClienteDropdown(true);
                }}
                onFocus={() => { if (asignarClienteQuery.length >= 1) setShowClienteDropdown(true); }}
                className="w-44 px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/50"
              />
              {asignarClienteId && (
                <button
                  onClick={() => { setAsignarClienteId(''); setAsignarClienteQuery(''); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              {showClienteDropdown && clientesFiltrados.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-60 max-h-48 overflow-y-auto">
                  {clientesFiltrados.map((c: any) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setAsignarClienteId(c.id);
                        setAsignarClienteQuery('');
                        setShowClienteDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-900"
                    >
                      <span className="font-medium">{c.codigo}</span>
                      <span className="text-slate-500 ml-1.5">{c.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleAsignar}
              disabled={!asignarClienteId || mutating}
              className="px-3 py-1.5 text-sm font-medium bg-[#0891B2] rounded-lg hover:bg-[#0891B2]/80 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {mutating ? '...' : 'Asignar'}
            </button>
          </div>

          <div className="w-px h-6 bg-white/20" />

          {/* Type selector */}
          <div className="flex items-center gap-2">
            <select
              value={cambiarTipo}
              onChange={(e: any) => setCambiarTipo(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#0891B2]/50 [&>option]:text-slate-900"
            >
              <option value="">Tipo...</option>
              {Object.entries(TIPOS_SELECT).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <button
              onClick={handleCambiarTipo}
              disabled={!cambiarTipo || mutating}
              className="px-3 py-1.5 text-sm font-medium bg-[#0891B2] rounded-lg hover:bg-[#0891B2]/80 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {mutating ? '...' : 'Aplicar'}
            </button>
          </div>

          <div className="w-px h-6 bg-white/20" />

          {/* Cancel */}
          <button
            onClick={cancelSelection}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closePreview}>
          <div
            className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 truncate">Vista previa</h3>
              <button onClick={closePreview} className="text-slate-400 hover:text-slate-600">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</p>
                  <p className="text-sm text-slate-900 mt-0.5">
                    {getFileIcon(previewDoc.nombre_original ?? previewDoc.nombre_archivo)}{' '}
                    {previewDoc.titulo ?? previewDoc.nombre_archivo}
                  </p>
                </div>
                {previewDoc.nombre_original && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Archivo original</p>
                    <p className="text-sm text-slate-600 mt-0.5">{previewDoc.nombre_original}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</p>
                    <p className="text-sm text-slate-700 mt-0.5">{TIPOS[previewDoc.tipo ?? ''] ?? previewDoc.tipo ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(ESTADO_COLORS[previewDoc.estado] ?? ESTADO_COLORS.pendiente).bg} ${(ESTADO_COLORS[previewDoc.estado] ?? ESTADO_COLORS.pendiente).text}`}>
                      {previewDoc.estado}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tamaño</p>
                    <p className="text-sm text-slate-700 mt-0.5">{formatBytes(previewDoc.archivo_tamano)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</p>
                    <p className="text-sm text-slate-700 mt-0.5">
                      {previewDoc.fecha_documento
                        ? new Date(previewDoc.fecha_documento).toLocaleDateString('es-GT')
                        : previewDoc.created_at
                          ? new Date(previewDoc.created_at).toLocaleDateString('es-GT')
                          : '—'}
                    </p>
                  </div>
                </div>
                {previewDoc.cliente && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cliente</p>
                    <p className="text-sm text-slate-700 mt-0.5">{previewDoc.cliente.codigo} — {previewDoc.cliente.nombre}</p>
                  </div>
                )}
                {previewDoc.cliente_nombre_detectado && !previewDoc.cliente_id && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sugerencia IA</p>
                    <p className="text-sm text-purple-700 mt-0.5">🤖 &ldquo;{previewDoc.cliente_nombre_detectado}&rdquo;</p>
                  </div>
                )}
                {previewDoc.confianza_ia > 0 && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Confianza IA</p>
                    <p className="text-sm text-slate-700 mt-0.5">{Math.round(previewDoc.confianza_ia * 100)}%</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                {previewUrl ? (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Abrir / Descargar
                  </a>
                ) : (
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-400 text-sm rounded-lg">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#0891B2] rounded-full animate-spin" />
                    Obteniendo URL...
                  </div>
                )}
                <button
                  onClick={closePreview}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
