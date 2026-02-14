'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { Badge, EmptyState, TableSkeleton } from '@/components/admin/ui';
import { tusUpload, TUS_THRESHOLD } from '@/lib/storage/tus-upload';

// ── Toast system ─────────────────────────────────────────────────────────────

interface Toast {
  id: string;
  type: 'success' | 'warning' | 'error';
  message: string;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface Carpeta {
  id: string;
  nombre: string;
  icono: string | null;
  padre_id: string | null;
  orden: number | null;
}

interface Tomo {
  id: string;
  titulo: string;
  nombre_archivo: string;
  archivo_url: string;
  carpeta_id: string | null;
  procesado: boolean;
  num_paginas: number | null;
  total_fragmentos: number | null;
  created_at: string;
  carpeta: { id: string; nombre: string } | null;
}

interface ListResponse {
  data: Tomo[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Upload helper ───────────────────────────────────────────────────────────

function xhrUpload(
  url: string,
  file: File,
  contentType: string,
  onProgress: (loaded: number, total: number) => void
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error('Error de conexión'));
    xhr.send(file);
  });
}

function formatBytesShort(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatSpeedShort(bytesPerSec: number): string {
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function limpiarNombreArchivo(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function JurisprudenciaPage() {
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Processing state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processingAll, setProcessingAll] = useState(false);

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (type: Toast['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  };

  // Data
  const listUrl = `/api/admin/jurisprudencia?page=${page}&limit=20`;
  const { data: listData, loading, refetch } = useFetch<ListResponse>(listUrl);
  const { data: carpetasData } = useFetch<{ carpetas: Carpeta[] }>(
    '/api/admin/jurisprudencia?carpetas=true'
  );
  const { mutate, loading: mutating } = useMutate();

  const carpetas = carpetasData?.carpetas ?? [];
  const tomos = listData?.data ?? [];
  const totalPages = listData?.totalPages ?? 1;

  const pendingTomos = tomos.filter((t: Tomo) => !t.procesado);

  // ── Process handler ─────────────────────────────────────────────────────

  const handleProcesar = async (tomoId: string) => {
    setProcessingIds((prev) => new Set(prev).add(tomoId));
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 360000); // 6 min

      const res = await fetch('/api/admin/jurisprudencia/procesar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tomo_id: tomoId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        addToast('error', data.error ?? 'Error al procesar tomo');
        return;
      }

      if (data.warning) {
        addToast('warning', data.warning);
      } else {
        const msg = `Procesado: ${data.pages ?? '?'} págs, ${data.fragmentos ?? '?'} fragmentos, ${data.embeddings ?? '?'} embeddings`;
        addToast('success', msg);
      }

      await refetch();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addToast('error', 'Tiempo de espera agotado (6 min)');
      } else {
        addToast('error', err.message ?? 'Error al procesar tomo');
      }
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(tomoId);
        return next;
      });
    }
  };

  const handleProcesarTodos = async () => {
    setProcessingAll(true);
    for (const tomo of pendingTomos) {
      await handleProcesar(tomo.id);
    }
    setProcessingAll(false);
  };

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDelete = async (id: string) => {
    await mutate(`/api/admin/jurisprudencia/${id}`, {
      method: 'DELETE',
      onSuccess: () => {
        setConfirmDelete(null);
        refetch();
      },
    });
  };

  // ── View/Download handler ─────────────────────────────────────────────────

  const handleView = async (id: string) => {
    const res = await fetch(`/api/admin/jurisprudencia/${id}`);
    const data = await res.json();
    if (data.signed_url) {
      window.open(data.signed_url, '_blank');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Jurisprudencia — Tomos</h1>
          <p className="text-sm text-slate-500 mt-1">Gestión de tomos de jurisprudencia para consulta con IA</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingTomos.length > 0 && (
            <button
              onClick={handleProcesarTodos}
              disabled={processingAll || processingIds.size > 0}
              className="px-4 py-2.5 text-sm rounded-lg border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingAll ? 'Procesando...' : `Procesar Todos (${pendingTomos.length})`}
            </button>
          )}
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 text-sm rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white font-medium hover:shadow-lg hover:shadow-blue-900/20 transition-all flex items-center gap-2"
          >
            <span className="text-lg leading-none">+</span>
            Subir Tomo
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={5} />
          </div>
        ) : tomos.length === 0 ? (
          <EmptyState
            icon="📚"
            title="No hay tomos"
            description="Sube tu primer tomo de jurisprudencia para comenzar."
            action={{ label: 'Subir Tomo', onClick: () => setShowModal(true) }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Título</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Materia</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-500">Páginas</th>
                  <th className="text-center px-5 py-3 font-medium text-slate-500">Estado</th>
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Fecha</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-500">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tomos.map((tomo) => (
                  <tr key={tomo.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900 truncate max-w-xs">{tomo.titulo}</div>
                      <div className="text-xs text-slate-400 truncate max-w-xs">{tomo.nombre_archivo}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {tomo.carpeta?.nombre ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-center text-slate-600">
                      {tomo.num_paginas ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {tomo.procesado ? (
                        <Badge variant="success">
                          Procesado{tomo.total_fragmentos ? ` (${tomo.total_fragmentos})` : ''}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Pendiente</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                      {formatFecha(tomo.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!tomo.procesado && (
                          <button
                            onClick={() => handleProcesar(tomo.id)}
                            disabled={processingIds.has(tomo.id) || processingAll}
                            className="text-xs px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                          >
                            {processingIds.has(tomo.id) ? (
                              <>
                                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Procesando...
                              </>
                            ) : (
                              'Procesar'
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleView(tomo.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => setConfirmDelete(tomo.id)}
                          className="text-xs px-2.5 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <span className="text-sm text-slate-500">
              Página {page} de {totalPages} ({listData?.total ?? 0} tomos)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirm Dialog ──────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Eliminar tomo</h3>
            <p className="text-sm text-slate-600 mb-5">
              Se eliminará el tomo y su archivo del almacenamiento. Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={mutating}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {mutating ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Container ──────────────────────────────────────────────── */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`animate-slideUp px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-start gap-3 ${
                toast.type === 'success'
                  ? 'bg-emerald-600 text-white'
                  : toast.type === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-red-600 text-white'
              }`}
            >
              <span className="flex-1">{toast.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      {showModal && (
        <UploadModal
          carpetas={carpetas}
          onClose={() => setShowModal(false)}
          onDone={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

// ── Upload Modal Component ──────────────────────────────────────────────────

interface UploadModalProps {
  carpetas: Carpeta[];
  onClose: () => void;
  onDone: () => void;
}

function UploadModal({ carpetas, onClose, onDone }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [byteProgress, setByteProgress] = useState({ loaded: 0, total: 0, startedAt: 0 });
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Client-side hierarchy: flat carpetas → categorías (padre_id null) + subcarpetas
  const categorias = carpetas.filter((c) => c.padre_id === null);
  const subcategorias = categoriaId
    ? carpetas.filter((c) => c.padre_id === categoriaId)
    : [];

  console.log('[Jurisprudencia] Carpetas cargadas:', carpetas.length, carpetas);
  console.log('[Jurisprudencia] Categorías (padre_id=null):', categorias.length, categorias.map(c => `${c.id} ${c.nombre}`));
  console.log('[Jurisprudencia] Categoría seleccionada:', categoriaId);
  console.log('[Jurisprudencia] Subcarpetas filtradas (padre_id===categoriaId):', subcategorias.length, subcategorias.map(c => `${c.id} ${c.nombre} padre=${c.padre_id}`));

  const categoriaSeleccionada = categorias.find((c) => c.id === categoriaId);

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategoriaId('');
  }, [categoriaId]);

  // The carpeta_id to use is subcategory if selected, otherwise category
  const carpetaFinal = subcategoriaId || categoriaId || null;
  // Build two-level storage path: categoria/subcategoria (e.g. "jurisprudencia/derecho-civil")
  const slugify = (name: string) =>
    name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const carpetaPath = (() => {
    if (!categoriaSeleccionada) return '';
    const base = slugify(categoriaSeleccionada.nombre);
    if (subcategoriaId) {
      const sub = subcategorias.find((c) => c.id === subcategoriaId);
      return sub ? `${base}/${slugify(sub.nombre)}` : base;
    }
    return base;
  })();

  // ── Drag & Drop ─────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (droppedFiles.length > 0) setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []).filter((f) =>
      f.name.toLowerCase().endsWith('.pdf')
    );
    if (selected.length > 0) setFiles((prev) => [...prev, ...selected]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Upload Flow ─────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setProgress({ current: 0, total: files.length });

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress({ current: i + 1, total: files.length });

        // 1. Get signed upload URL
        const urlRes = await fetch('/api/admin/jurisprudencia/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            filesize: file.size,
            carpeta_path: carpetaPath,
          }),
        });
        const urlData = await urlRes.json();
        if (!urlRes.ok) throw new Error(urlData.error ?? 'Error al obtener URL de subida');

        // 2. Upload file with progress (TUS for >50MB, XHR for smaller)
        const uploadStart = Date.now();
        setByteProgress({ loaded: 0, total: file.size, startedAt: uploadStart });

        if (file.size > TUS_THRESHOLD) {
          await tusUpload({
            file,
            bucketName: 'jurisprudencia',
            objectName: urlData.storage_path,
            onProgress: (loaded, total) => setByteProgress({ loaded, total, startedAt: uploadStart }),
          });
        } else {
          const uploadRes = await xhrUpload(
            urlData.signed_url,
            file,
            'application/pdf',
            (loaded, total) => setByteProgress({ loaded, total, startedAt: uploadStart })
          );
          if (!uploadRes.ok) throw new Error('Error al subir archivo al almacenamiento');
        }

        // 3. Register tomo in DB
        const titulo = limpiarNombreArchivo(file.name);
        const registerRes = await fetch('/api/admin/jurisprudencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            titulo,
            nombre_archivo: file.name,
            archivo_url: urlData.storage_path,
            carpeta_id: carpetaFinal,
          }),
        });
        const registerData = await registerRes.json();
        if (!registerRes.ok) throw new Error(registerData.error ?? 'Error al registrar tomo');
      }

      onDone();
    } catch (err: any) {
      setError(err.message ?? 'Error durante la subida');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Subir Tomos</h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-blue-400 bg-blue-50 scale-[1.02]'
                : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            <svg
              className={`w-10 h-10 mx-auto mb-3 ${dragging ? 'text-blue-400' : 'text-slate-300'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm font-medium text-slate-700">
              Arrastra archivos PDF aquí
            </p>
            <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar — máximo 1GB por archivo</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">
                {files.length} archivo{files.length !== 1 ? 's' : ''} seleccionado{files.length !== 1 ? 's' : ''}
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1.5">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {(file.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      disabled={uploading}
                      className="ml-2 p-1 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Folder Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                disabled={uploading}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icono ? `${c.icono} ` : ''}{c.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subcategoría</label>
              <select
                value={subcategoriaId}
                onChange={(e) => setSubcategoriaId(e.target.value)}
                disabled={uploading || subcategorias.length === 0}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              >
                <option value="">— Ninguna —</option>
                {subcategorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress */}
          {uploading && (() => {
            const pct = byteProgress.total > 0 ? Math.round((byteProgress.loaded / byteProgress.total) * 100) : 0;
            const elapsed = byteProgress.startedAt > 0 ? (Date.now() - byteProgress.startedAt) / 1000 : 0;
            const speed = elapsed > 0.5 ? byteProgress.loaded / elapsed : 0;
            return (
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">
                    Archivo {progress.current} de {progress.total}
                  </span>
                  <span className="font-medium text-slate-900">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {byteProgress.total > 0 && (
                  <p className="text-xs text-slate-400">
                    {formatBytesShort(byteProgress.loaded)} / {formatBytesShort(byteProgress.total)}
                    {speed > 0 && ` — ${formatSpeedShort(speed)}`}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white font-medium hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading
              ? `Subiendo ${progress.current}/${progress.total}...`
              : `Subir ${files.length > 0 ? files.length : ''} archivo${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
