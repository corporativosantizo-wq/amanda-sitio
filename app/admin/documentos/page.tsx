// ============================================================================
// app/admin/documentos/page.tsx
// Panel de gestión documental: revisión, aprobación, exploración
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

const ESTADO_COLORS: Record<string, { bg: string; text: string }> = {
  pendiente: { bg: 'bg-slate-100', text: 'text-slate-600' },
  clasificado: { bg: 'bg-purple-50', text: 'text-purple-700' },
  aprobado: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rechazado: { bg: 'bg-red-50', text: 'text-red-700' },
};

const TABS = [
  { key: 'clasificado', label: 'Pendientes de revisión' },
  { key: 'aprobado', label: 'Aprobados' },
  { key: '', label: 'Todos' },
];

interface DocItem {
  id: string;
  nombre_archivo: string;
  tipo: string | null;
  titulo: string | null;
  fecha_documento: string | null;
  confianza_ia: number;
  estado: string;
  nombre_cliente_extraido: string | null;
  cliente_id: string | null;
  partes: any[];
  tamano_bytes: number;
  created_at: string;
  cliente: { id: string; codigo: string; nombre: string } | null;
}

export default function DocumentosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('estado') ?? 'clasificado';

  const [tab, setTab] = useState(initialTab);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [page, setPage] = useState(1);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [clientes, setClientes] = useState<any[]>([]);
  const [editingCliente, setEditingCliente] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  if (tipoFilter) params.set('tipo', tipoFilter);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: DocItem[];
    total: number;
    totalPages: number;
  }>(`/api/admin/documentos?${params}`);

  const docs = data?.data ?? [];

  // Cargar clientes para dropdown
  useEffect(() => {
    fetch('/api/admin/clientes?limit=200&activo=true')
      .then((r: any) => r.json())
      .then((d: any) => setClientes(d.data ?? []))
      .catch(() => {});
  }, []);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documentos</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.total ?? 0} documentos
            {tab === 'clasificado' ? ' pendientes de revisión' : ''}
          </p>
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
            onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
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
            {tab === 'clasificado' ? 'No hay documentos pendientes de revisión.' : 'No se encontraron documentos.'}
          </p>
          {tab === 'clasificado' && (
            <Link href="/admin/documentos/upload" className="text-sm text-[#0891B2] hover:underline mt-2 inline-block">
              Subir documentos
            </Link>
          )}
        </div>
      ) : tab === 'clasificado' ? (
        /* Card view for review */
        <div className="grid gap-4">
          {docs.map((doc: DocItem) => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Type badge + confidence */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[doc.estado]?.bg ?? ''} ${ESTADO_COLORS[doc.estado]?.text ?? ''}`}>
                      {TIPOS[doc.tipo ?? ''] ?? doc.tipo ?? 'Sin tipo'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${confianzaColor(doc.confianza_ia)}`}>
                      {Math.round(doc.confianza_ia * 100)}% confianza
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-slate-900 truncate">
                    {doc.titulo ?? doc.nombre_archivo}
                  </h3>

                  {/* Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                    {doc.fecha_documento && (
                      <span>Fecha: {new Date(doc.fecha_documento).toLocaleDateString('es-GT')}</span>
                    )}
                    <span>Archivo: {doc.nombre_archivo}</span>
                    <span>{(doc.tamano_bytes / 1024 / 1024).toFixed(1)} MB</span>
                  </div>

                  {/* Partes */}
                  {doc.partes && doc.partes.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Partes: {doc.partes.map((p: any) => `${p.nombre} (${p.rol})`).join(', ')}
                    </div>
                  )}

                  {/* Cliente */}
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
                        {doc.cliente?.nombre ?? doc.nombre_cliente_extraido ?? 'Sin asignar'}{' '}
                        <span className="text-slate-400">(cambiar)</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => verPDF(doc.id)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Ver PDF
                  </button>
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
        /* Table view for aprobados/todos */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Archivo', 'Tipo', 'Título', 'Cliente', 'Fecha', 'Estado'].map((h: string) => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
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
                      <td className="py-3 px-4 pl-5 text-sm text-slate-900 max-w-[200px] truncate">
                        {doc.nombre_archivo}
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
                      <td className="py-3 px-4 pr-5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${est.bg} ${est.text}`}>
                          {doc.estado}
                        </span>
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
    </div>
  );
}
