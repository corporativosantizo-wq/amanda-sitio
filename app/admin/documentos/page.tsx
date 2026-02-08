// ============================================================================
// app/admin/documentos/page.tsx
// Panel de gestión documental con vista por carpetas de clientes
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch } from '@/lib/hooks/use-fetch';

const TIPOS: Record<string, string> = {
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

function getFileIcon(name: string): string {
  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (ext === '.pdf') return '\u{1F4C4}';
  if (ext === '.docx' || ext === '.doc') return '\u{1F4DD}';
  if (ext === '.xlsx' || ext === '.xls') return '\u{1F4CA}';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return '\u{1F5BC}';
  return '\u{1F4C4}';
}

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-slate-100', text: 'text-slate-600' },
  clasificado: { bg: 'bg-purple-50', text: 'text-purple-700' },
  aprobado: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rechazado: { bg: 'bg-red-50', text: 'text-red-700' },
};

const TABS = [
  { key: 'carpetas', label: 'Carpetas' },
  { key: 'sin_cliente', label: 'Sin clasificar' },
  { key: 'clasificado', label: 'Pendientes de revisión' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: '', label: 'Todos' },
];

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

interface Carpeta {
  cliente_id: string;
  codigo: string;
  nombre: string;
  total_docs: number;
}

export default function DocumentosPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('estado') ?? 'carpetas';
  const initialCarpeta = searchParams.get('cliente_id') ?? null;

  const [tab, setTab] = useState(initialTab);
  const [carpetaAbierta, setCarpetaAbierta] = useState<Carpeta | null>(null);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<any[]>([]);
  const [editingCliente, setEditingCliente] = useState<string | null>(null);

  // Transcription state
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeProgress, setTranscribeProgress] = useState<{
    current: number; total: number; docName: string; status: string; downloadUrl?: string;
  } | null>(null);

  // Fetch folders
  const { data: carpetasData } = useFetch<{ carpetas: Carpeta[] }>(
    tab === 'carpetas' && !carpetaAbierta ? '/api/admin/documentos?carpetas=true' : null
  );
  const carpetas = carpetasData?.carpetas ?? [];

  // Fetch documents (for non-folder tabs or when inside a folder)
  const docParams = new URLSearchParams();
  if (tab === 'carpetas' && carpetaAbierta) {
    docParams.set('cliente_id', carpetaAbierta.cliente_id);
  } else if (tab === 'sin_cliente') {
    docParams.set('sin_cliente', 'true');
  } else if (tab !== 'carpetas') {
    if (tab) docParams.set('estado', tab);
  }
  if (tipoFilter) docParams.set('tipo', tipoFilter);
  if (search) docParams.set('q', search);
  docParams.set('page', String(page));
  docParams.set('limit', '20');

  const shouldFetchDocs = tab !== 'carpetas' || carpetaAbierta;
  const { data, loading, refetch } = useFetch<{
    data: DocItem[];
    total: number;
    totalPages: number;
  }>(shouldFetchDocs ? `/api/admin/documentos?${docParams}` : null);

  const docs = data?.data ?? [];

  // Load clientes for dropdown
  useEffect(() => {
    fetch('/api/admin/clientes?limit=200&activo=true')
      .then((r: any) => r.json())
      .then((d: any) => setClientes(d.data ?? []))
      .catch(() => {});
  }, []);

  // Open folder from URL param
  useEffect(() => {
    if (initialCarpeta && clientes.length > 0) {
      const c = clientes.find((cl: any) => cl.id === initialCarpeta);
      if (c) {
        setCarpetaAbierta({ cliente_id: c.id, codigo: c.codigo, nombre: c.nombre, total_docs: 0 });
        setTab('carpetas');
      }
    }
  }, [initialCarpeta, clientes]);

  const aprobar = async (id: string, edits?: any) => {
    setProcessing((prev: Set<string>) => new Set([...prev, id]));
    try {
      await fetch('/api/admin/documentos/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones: [{ id, accion: 'aprobar', edits }] }),
      });
      refetch();
    } catch { /* ignore */ }
    setProcessing((prev: Set<string>) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const rechazar = async (id: string) => {
    setProcessing((prev: Set<string>) => new Set([...prev, id]));
    try {
      await fetch('/api/admin/documentos/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones: [{ id, accion: 'rechazar' }] }),
      });
      refetch();
    } catch { /* ignore */ }
    setProcessing((prev: Set<string>) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const aprobarTodosAlta = async () => {
    const alta = docs.filter(
      (d: DocItem) => d.estado === 'clasificado' && d.confianza_ia >= 0.8 && d.cliente_id
    );
    if (alta.length === 0) return;
    const acciones = alta.map((d: DocItem) => ({ id: d.id, accion: 'aprobar' as const }));
    setProcessing(new Set(alta.map((d: DocItem) => d.id)));
    try {
      await fetch('/api/admin/documentos/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acciones }),
      });
      refetch();
    } catch { /* ignore */ }
    setProcessing(new Set());
  };

  const verPDF = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/documentos/${id}`);
      const data = await res.json();
      if (data.signed_url) window.open(data.signed_url, '_blank');
    } catch { /* ignore */ }
  };

  const cambiarCliente = async (docId: string, clienteId: string) => {
    await fetch(`/api/admin/documentos/${docId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId }),
    });
    setEditingCliente(null);
    refetch();
  };

  const confianzaColor = (c: number) => {
    if (c >= 0.8) return 'text-emerald-600 bg-emerald-50';
    if (c >= 0.5) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const altaConfianza = docs.filter(
    (d: DocItem) => d.estado === 'clasificado' && d.confianza_ia >= 0.8 && d.cliente_id
  );

  const isPDF = (doc: DocItem) => {
    const name = (doc.nombre_original ?? doc.nombre_archivo).toLowerCase();
    return name.endsWith('.pdf');
  };

  const toggleSelect = (id: string) => {
    setSelectedDocs((prev: Set<string>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pdfDocs = docs.filter(isPDF);
    if (pdfDocs.length > 0 && selectedDocs.size === pdfDocs.length) {
      setSelectedDocs(new Set());
    } else {
      setSelectedDocs(new Set(pdfDocs.map((d: DocItem) => d.id)));
    }
  };

  const transcribirUno = async (docId: string) => {
    const d = docs.find((x: DocItem) => x.id === docId);
    setTranscribing(true);
    setTranscribeProgress({
      current: 1, total: 1,
      docName: d?.titulo ?? d?.nombre_archivo ?? '',
      status: 'Transcribiendo...',
    });
    try {
      const res = await fetch('/api/admin/documentos/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: docId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTranscribeProgress((p: any) => p ? { ...p, status: `Error: ${data.error}` } : null);
      } else {
        setTranscribeProgress((p: any) => p ? {
          ...p, status: 'completado',
          docName: `${data.transcripcion.paginas} páginas transcritas`,
          downloadUrl: data.transcripcion.download_url,
        } : null);
        refetch();
      }
    } catch (err: any) {
      setTranscribeProgress((p: any) => p ? { ...p, status: `Error: ${err.message}` } : null);
    }
  };

  const transcribirSeleccionados = async () => {
    const ids = Array.from(selectedDocs);
    if (ids.length === 0) return;
    setTranscribing(true);

    for (let i = 0; i < ids.length; i++) {
      const d = docs.find((x: DocItem) => x.id === ids[i]);
      setTranscribeProgress({
        current: i + 1, total: ids.length,
        docName: d?.titulo ?? d?.nombre_archivo ?? '',
        status: 'Transcribiendo...',
      });
      try {
        const res = await fetch('/api/admin/documentos/transcribir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documento_id: ids[i] }),
        });
        const data = await res.json();
        if (!res.ok) {
          setTranscribeProgress((p: any) => p ? { ...p, status: `Error: ${data.error}. Continuando...` } : null);
          await new Promise((r: any) => setTimeout(r, 2000));
        }
      } catch {
        await new Promise((r: any) => setTimeout(r, 2000));
      }
    }

    setTranscribeProgress({
      current: ids.length, total: ids.length,
      status: 'completado',
      docName: `${ids.length} documento(s) transcritos`,
    });
    setSelectedDocs(new Set());
    refetch();
  };

  const cerrarProgreso = () => {
    setTranscribing(false);
    setTranscribeProgress(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documentos</h1>
          {tab === 'carpetas' && carpetaAbierta ? (
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
              <button onClick={() => setCarpetaAbierta(null)} className="hover:text-[#0891B2] transition-colors">
                Documentos
              </button>
              <span>&gt;</span>
              <span className="font-medium text-slate-700">{carpetaAbierta.codigo} — {carpetaAbierta.nombre}</span>
            </div>
          ) : (
            <p className="text-sm text-slate-500 mt-0.5">
              {tab === 'carpetas' ? `${carpetas.length} carpetas de clientes` :
               `${data?.total ?? 0} documentos${tab === 'clasificado' ? ' pendientes de revisión' : ''}`}
            </p>
          )}
        </div>
        <Link
          href="/admin/documentos/upload"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all shrink-0"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Subir documentos
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map((t: any) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setPage(1); setCarpetaAbierta(null); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Folder view */}
      {tab === 'carpetas' && !carpetaAbierta && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {carpetas.length === 0 ? (
            <div className="p-10 text-center">
              <svg width="48" height="48" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" className="mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <p className="text-sm text-slate-500">No hay documentos asignados a clientes.</p>
              <Link href="/admin/documentos/upload" className="text-sm text-[#0891B2] hover:underline mt-2 inline-block">
                Subir documentos
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {carpetas.map((c: Carpeta) => (
                <button
                  key={c.cliente_id}
                  onClick={() => setCarpetaAbierta(c)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                >
                  <svg width="24" height="24" fill="#f59e0b" stroke="#f59e0b" viewBox="0 0 24 24" className="shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{c.codigo}</p>
                    <p className="text-xs text-slate-500 truncate">{c.nombre}</p>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    {c.total_docs} doc{c.total_docs !== 1 ? 's' : ''}
                  </span>
                  <svg width="16" height="16" fill="none" stroke="#9ca3af" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Document list (inside folder or other tabs) */}
      {shouldFetchDocs && (
        <>
          {/* Filters */}
          {(tab !== 'carpetas' || carpetaAbierta) && (
            <div className="flex gap-3 flex-wrap">
              <input
                type="text"
                placeholder="Buscar por título o archivo..."
                value={search}
                onChange={(e: any) => { setSearch(e.target.value); setPage(1); }}
                className="w-full max-w-xs px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
              <select
                value={tipoFilter}
                onChange={(e: any) => { setTipoFilter(e.target.value); setPage(1); }}
                className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">Todos los tipos</option>
                {Object.entries(TIPOS).map(([k, v]: [string, string]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          )}

          {/* Batch approve button */}
          {tab === 'clasificado' && altaConfianza.length > 0 && (
            <button
              onClick={aprobarTodosAlta}
              className="px-4 py-2 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-all"
            >
              Aprobar todos con alta confianza ({altaConfianza.length})
            </button>
          )}

          {/* Content */}
          {loading ? (
            <div className="bg-white rounded-xl p-10 text-center">
              <p className="text-sm text-slate-400">Cargando documentos...</p>
            </div>
          ) : docs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <svg width="48" height="48" fill="none" stroke="#d1d5db" viewBox="0 0 24 24" className="mx-auto mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-slate-500">
                {carpetaAbierta ? 'Este cliente no tiene documentos.' :
                 tab === 'sin_cliente' ? 'Todos los documentos tienen cliente asignado.' :
                 tab === 'clasificado' ? 'No hay documentos pendientes de revisión.' : 'No se encontraron documentos.'}
              </p>
            </div>
          ) : tab === 'sin_cliente' ? (
            /* Card view for unassigned docs */
            <div className="grid gap-4">
              {docs.map((doc: DocItem) => {
                const est = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                return (
                  <div key={doc.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-4">
                      {isPDF(doc) && (
                        <input
                          type="checkbox"
                          checked={selectedDocs.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          className="mt-1 rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2] shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.bg} ${est.text}`}>
                            {doc.estado}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                            Sin cliente asignado
                          </span>
                          {doc.tipo && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                              {TIPOS[doc.tipo] ?? doc.tipo}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 truncate">
                          <span className="mr-1.5">{getFileIcon(doc.nombre_original ?? doc.nombre_archivo)}</span>
                          {doc.titulo ?? doc.nombre_archivo}
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                          <span>Archivo: {doc.nombre_original ?? doc.nombre_archivo}</span>
                          <span>{(doc.archivo_tamano / 1024 / 1024).toFixed(1)} MB</span>
                          {doc.cliente_nombre_detectado && (
                            <span className="text-amber-600">IA detectó: &ldquo;{doc.cliente_nombre_detectado}&rdquo;</span>
                          )}
                        </div>
                        {doc.partes && doc.partes.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500">
                            Partes: {doc.partes.map((p: any) => `${p.nombre} (${p.rol})`).join(', ')}
                          </div>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">Asignar cliente:</span>
                          <select
                            defaultValue=""
                            onChange={(e: any) => {
                              if (e.target.value) cambiarCliente(doc.id, e.target.value);
                            }}
                            className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 max-w-[250px] focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
                          >
                            <option value="">Seleccionar cliente...</option>
                            {clientes.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => verPDF(doc.id)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          Ver archivo
                        </button>
                        {isPDF(doc) && (
                          <button
                            onClick={() => transcribirUno(doc.id)}
                            className="px-3 py-1.5 text-xs font-medium text-[#0891B2] bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                          >
                            Transcribir
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tab === 'clasificado' ? (
            /* Card view for review */
            <div className="grid gap-4">
              {docs.map((doc: DocItem) => (
                <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    {isPDF(doc) && (
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        className="mt-1 rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2] shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[doc.estado]?.bg ?? ''} ${ESTADO_COLORS[doc.estado]?.text ?? ''}`}>
                          {TIPOS[doc.tipo ?? ''] ?? doc.tipo ?? 'Sin tipo'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confianzaColor(doc.confianza_ia)}`}>
                          {Math.round(doc.confianza_ia * 100)}% confianza
                        </span>
                      </div>
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        <span className="mr-1.5">{getFileIcon(doc.nombre_original ?? doc.nombre_archivo)}</span>
                        {doc.titulo ?? doc.nombre_archivo}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                        {doc.fecha_documento && (
                          <span>Fecha: {new Date(doc.fecha_documento).toLocaleDateString('es-GT')}</span>
                        )}
                        <span>Archivo: {doc.nombre_original ?? doc.nombre_archivo}</span>
                        <span>{(doc.archivo_tamano / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      {doc.partes && doc.partes.length > 0 && (
                        <div className="mt-2 text-xs text-slate-500">
                          Partes: {doc.partes.map((p: any) => `${p.nombre} (${p.rol})`).join(', ')}
                        </div>
                      )}
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-slate-500">Cliente:</span>
                        {editingCliente === doc.id ? (
                          <select
                            autoFocus
                            defaultValue={doc.cliente_id ?? ''}
                            onChange={(e: any) => {
                              if (e.target.value) cambiarCliente(doc.id, e.target.value);
                              else setEditingCliente(null);
                            }}
                            onBlur={() => setEditingCliente(null)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 max-w-[200px]"
                          >
                            <option value="">Sin asignar</option>
                            {clientes.map((c: any) => (
                              <option key={c.id} value={c.id}>{c.nombre}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCliente(doc.id)}
                            className="text-xs text-[#0891B2] hover:underline"
                          >
                            {doc.cliente?.nombre ?? doc.cliente_nombre_detectado ?? 'Sin asignar'}{' '}
                            <span className="text-slate-400">(cambiar)</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => verPDF(doc.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        Ver archivo
                      </button>
                      {isPDF(doc) && (
                        <button
                          onClick={() => transcribirUno(doc.id)}
                          className="px-3 py-1.5 text-xs font-medium text-[#0891B2] bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
                        >
                          Transcribir
                        </button>
                      )}
                      <button
                        onClick={() => aprobar(doc.id)}
                        disabled={processing.has(doc.id)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                      >
                        {processing.has(doc.id) ? '...' : 'Aprobar'}
                      </button>
                      <button
                        onClick={() => rechazar(doc.id)}
                        disabled={processing.has(doc.id)}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Table view for folders/aprobados/todos */
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <th className="w-10 py-3 pl-5 pr-1">
                        <input
                          type="checkbox"
                          checked={docs.filter(isPDF).length > 0 && selectedDocs.size === docs.filter(isPDF).length}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]"
                        />
                      </th>
                      {(carpetaAbierta ? ['Código', 'Archivo', 'Tipo', 'Título', 'Estado'] : ['Archivo', 'Tipo', 'Título', 'Cliente', 'Fecha', 'Estado']).map((h: string) => (
                        <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">
                          {h}
                        </th>
                      ))}
                      <th className="w-24 py-3 px-4 pr-5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {docs.map((doc: DocItem) => {
                      const est = ESTADO_COLORS[doc.estado] ?? ESTADO_COLORS.pendiente;
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                          onClick={() => verPDF(doc.id)}
                        >
                          <td className="py-3 pl-5 pr-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            {isPDF(doc) && (
                              <input
                                type="checkbox"
                                checked={selectedDocs.has(doc.id)}
                                onChange={() => toggleSelect(doc.id)}
                                className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]"
                              />
                            )}
                          </td>
                          {carpetaAbierta ? (
                            <>
                              <td className="py-3 px-4 text-sm font-mono text-slate-700">
                                {doc.codigo_documento ?? '—'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-500 max-w-[200px] truncate">
                                <span className="mr-1">{getFileIcon(doc.nombre_original ?? doc.nombre_archivo)}</span>
                                {doc.nombre_original ?? doc.nombre_archivo}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-500">
                                {TIPOS[doc.tipo ?? ''] ?? doc.tipo ?? '—'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-700 max-w-[250px] truncate">
                                {doc.titulo ?? '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.bg} ${est.text}`}>
                                  {doc.estado}
                                </span>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-4 text-sm text-slate-900 max-w-[200px] truncate">
                                <span className="mr-1">{getFileIcon(doc.nombre_original ?? doc.nombre_archivo)}</span>
                                {doc.codigo_documento ?? doc.nombre_archivo}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-500">
                                {TIPOS[doc.tipo ?? ''] ?? doc.tipo ?? '—'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-700 max-w-[250px] truncate">
                                {doc.titulo ?? '—'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {doc.cliente?.nombre ?? '—'}
                              </td>
                              <td className="py-3 px-4 text-sm text-slate-500">
                                {doc.fecha_documento
                                  ? new Date(doc.fecha_documento).toLocaleDateString('es-GT')
                                  : '—'}
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.bg} ${est.text}`}>
                                  {doc.estado}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="py-3 px-4 pr-5 text-right" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            {isPDF(doc) && (
                              <button
                                onClick={() => transcribirUno(doc.id)}
                                className="text-xs font-medium text-[#0891B2] hover:text-[#1E40AF] transition-colors"
                              >
                                Transcribir
                              </button>
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
                    <button
                      onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30"
                    >
                      &larr; Anterior
                    </button>
                    <button
                      onClick={() => setPage((p: number) => p + 1)}
                      disabled={page >= data.totalPages}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30"
                    >
                      Siguiente &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Floating selection bar */}
      {selectedDocs.size > 0 && !transcribing && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1E3A5F] text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4">
          <span className="text-sm font-medium">{selectedDocs.size} PDF(s) seleccionados</span>
          <button
            onClick={transcribirSeleccionados}
            className="px-4 py-1.5 text-sm font-medium bg-[#0891B2] rounded-lg hover:bg-[#0891B2]/80 transition-colors"
          >
            Transcribir seleccionados
          </button>
          <button
            onClick={() => setSelectedDocs(new Set())}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Transcription progress modal */}
      {transcribing && transcribeProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {transcribeProgress.status === 'completado' ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <svg width="48" height="48" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Transcripción completada</h3>
                <p className="text-sm text-slate-500 text-center mb-6">{transcribeProgress.docName}</p>
                <div className="flex gap-3 justify-center">
                  {transcribeProgress.downloadUrl && (
                    <a
                      href={transcribeProgress.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] rounded-lg hover:bg-[#0891B2]/80"
                    >
                      Descargar DOCX
                    </a>
                  )}
                  <button
                    onClick={cerrarProgreso}
                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : transcribeProgress.status.startsWith('Error') ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <svg width="48" height="48" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Error en transcripción</h3>
                <p className="text-sm text-red-600 text-center mb-6 break-words">{transcribeProgress.status}</p>
                <button
                  onClick={cerrarProgreso}
                  className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                >
                  Cerrar
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-[#0891B2] rounded-full animate-spin" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 text-center mb-1">
                  Transcribiendo {transcribeProgress.current} de {transcribeProgress.total}
                </h3>
                <p className="text-sm text-slate-500 text-center mb-4 truncate">{transcribeProgress.docName}</p>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-[#1E40AF] to-[#0891B2] h-2 rounded-full transition-all"
                    style={{ width: `${(transcribeProgress.current / transcribeProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 text-center mt-2">Esto puede tomar varios minutos por documento...</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
