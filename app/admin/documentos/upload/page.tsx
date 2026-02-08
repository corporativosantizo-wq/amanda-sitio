// ============================================================================
// app/admin/documentos/upload/page.tsx
// Subida masiva de documentos con clasificación IA
// Sube directo a Supabase Storage (bypasses Vercel 4.5MB body limit)
// Requiere seleccionar cliente antes de subir
// ============================================================================
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 100;
const BATCH_SIZE = 5; // Concurrent uploads/classifications per batch
const ALLOWED_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.jpg', '.jpeg', '.png'];

function getFileIcon(name: string): string {
  const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
  if (ext === '.pdf') return '\u{1F4C4}';
  if (ext === '.docx' || ext === '.doc') return '\u{1F4DD}';
  if (ext === '.xlsx' || ext === '.xls') return '\u{1F4CA}';
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') return '\u{1F5BC}';
  return '\u{1F4C4}';
}

interface FileEntry {
  id: string;
  file: File;
  nombre: string;
  tamano: string;
  status: 'pendiente' | 'subiendo' | 'analizando' | 'clasificado' | 'error';
  resultado?: any;
  error?: string;
  storagePath?: string;
}

interface ClienteOption {
  id: string;
  codigo: string;
  nombre: string;
}

export default function UploadDocumentos() {
  const [step, setStep] = useState<'select' | 'processing' | 'done'>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Client selector state
  const [clienteQuery, setClienteQuery] = useState('');
  const [clienteResults, setClienteResults] = useState<ClienteOption[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteOption | null>(null);
  const [searchingClientes, setSearchingClientes] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [codePreview, setCodePreview] = useState<string | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search clients as user types
  useEffect(() => {
    if (!clienteQuery.trim() || clienteQuery.length < 2) {
      setClienteResults([]);
      setShowDropdown(false);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchingClientes(true);
      try {
        const res = await fetch(`/api/admin/clientes?q=${encodeURIComponent(clienteQuery)}&limit=8&activo=true`);
        const data = await res.json();
        const results = (data.data ?? []).map((c: any) => ({
          id: c.id,
          codigo: c.codigo ?? '',
          nombre: c.nombre ?? '',
        }));
        setClienteResults(results);
        setShowDropdown(results.length > 0);
      } catch {
        setClienteResults([]);
      } finally {
        setSearchingClientes(false);
      }
    }, 300);

    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [clienteQuery]);

  // Fetch code preview when client is selected
  useEffect(() => {
    if (!selectedCliente) {
      setCodePreview(null);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/admin/documentos/preview-code?cliente_id=${selectedCliente.id}`);
        const data = await res.json();
        if (res.ok) setCodePreview(data.codigo_documento);
      } catch {
        setCodePreview(null);
      }
    })();
  }, [selectedCliente]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectCliente = (c: ClienteOption) => {
    setSelectedCliente(c);
    setClienteQuery(`${c.codigo} — ${c.nombre}`);
    setShowDropdown(false);
  };

  const clearCliente = () => {
    setSelectedCliente(null);
    setClienteQuery('');
    setCodePreview(null);
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FileEntry[] = [];
    const rejected: string[] = [];

    for (const f of Array.from(fileList)) {
      const ext = f.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? '';
      if (!ALLOWED_TYPES[f.type] && !ALLOWED_EXTENSIONS.includes(ext)) {
        rejected.push(`${f.name}: formato no permitido. Aceptados: PDF, DOCX, XLSX, JPG, PNG.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name}: el archivo es demasiado grande (${formatSize(f.size)}). Máximo 50MB.`);
        continue;
      }
      newFiles.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file: f,
        nombre: f.name,
        tamano: formatSize(f.size),
        status: 'pendiente' as const,
      });
    }

    if (rejected.length > 0) {
      setGlobalError(rejected.join('\n'));
    }

    if (newFiles.length > 0) {
      setFiles((prev: FileEntry[]) => [...prev, ...newFiles].slice(0, MAX_FILES));
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const removeFile = (id: string) => {
    setFiles((prev: FileEntry[]) => prev.filter((f: FileEntry) => f.id !== id));
  };

  const updateFile = (id: string, updates: Partial<FileEntry>) => {
    setFiles((prev: FileEntry[]) =>
      prev.map((f: FileEntry) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  // Upload a single file to Storage and return metadata
  const uploadSingleFile = async (f: FileEntry): Promise<{
    id: string; storage_path: string; filename: string; filesize: number;
  } | null> => {
    updateFile(f.id, { status: 'subiendo' });

    try {
      const urlRes = await fetch('/api/admin/documentos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: f.file.name, filesize: f.file.size }),
      });

      const urlData = await urlRes.json();
      if (!urlRes.ok) {
        updateFile(f.id, { status: 'error', error: urlData.error ?? `Error HTTP ${urlRes.status}` });
        return null;
      }

      const uploadRes = await fetch(urlData.signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': f.file.type || 'application/octet-stream' },
        body: f.file,
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        updateFile(f.id, { status: 'error', error: `Error al subir a Storage: HTTP ${uploadRes.status} — ${errText.slice(0, 200)}` });
        return null;
      }

      updateFile(f.id, { storagePath: urlData.storage_path });
      return { id: f.id, storage_path: urlData.storage_path, filename: f.file.name, filesize: f.file.size };
    } catch (err: any) {
      updateFile(f.id, { status: 'error', error: `Error de conexión: ${err.message ?? 'desconocido'}` });
      return null;
    }
  };

  // Classify a single document
  const classifySingleDoc = async (u: { id: string; docId: string }) => {
    updateFile(u.id, { status: 'analizando' });
    try {
      const res = await fetch('/api/admin/documentos/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: u.docId }),
      });

      const rawClassify = await res.text();
      let result: any;
      try {
        result = JSON.parse(rawClassify);
      } catch {
        updateFile(u.id, {
          status: 'error',
          error: `Respuesta inválida del clasificador (HTTP ${res.status}): ${rawClassify.slice(0, 200)}`,
        });
        return;
      }

      if (res.ok) {
        updateFile(u.id, { status: 'clasificado', resultado: result.documento });
      } else {
        updateFile(u.id, { status: 'error', error: result.error ?? `Error HTTP ${res.status}` });
      }
    } catch (classErr: any) {
      updateFile(u.id, { status: 'error', error: `Error de conexión al clasificar: ${classErr.message ?? 'desconocido'}` });
    }
  };

  // Process items in batches of BATCH_SIZE concurrently
  async function processBatches<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(fn));
      results.push(...batchResults);
      setCurrentIdx(Math.min(i + BATCH_SIZE, items.length) - 1);
    }
    return results;
  }

  const startUpload = async () => {
    if (files.length === 0) return;
    setStep('processing');
    setUploading(true);
    setGlobalError(null);

    // Paso 1: Subir archivos a Storage en lotes de BATCH_SIZE concurrentes
    setCurrentIdx(0);
    const uploadResults = await processBatches(files, uploadSingleFile);
    const uploaded = uploadResults.filter((r: any): r is NonNullable<typeof r> => r !== null);

    if (uploaded.length === 0) {
      setGlobalError('Ningún archivo se subió correctamente.');
      setUploading(false);
      setStep('done');
      return;
    }

    // Paso 2: Registrar documentos en BD en lotes de 20 (metadata JSON — tiny payloads)
    const allRegistered: { id: string; docId: string }[] = [];

    for (let i = 0; i < uploaded.length; i += 20) {
      const batch = uploaded.slice(i, i + 20);
      try {
        const regRes = await fetch('/api/admin/documentos/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            files: batch.map((u: any) => ({
              storage_path: u.storage_path,
              filename: u.filename,
              filesize: u.filesize,
              cliente_id: selectedCliente?.id ?? null,
            })),
          }),
        });

        const regData = await regRes.json();
        if (!regRes.ok) {
          for (const u of batch) updateFile(u.id, { status: 'error', error: regData.error ?? 'Error al registrar en BD' });
          continue;
        }

        for (const doc of regData.documentos ?? []) {
          const match = batch.find((u: any) => u.filename === doc.nombre_archivo);
          if (match) {
            allRegistered.push({ id: match.id, docId: doc.id });
            updateFile(match.id, { resultado: doc, status: 'analizando' });
          }
        }

        for (const err of regData.errores ?? []) {
          const fileName = err.split(':')[0]?.trim();
          const match = files.find((f: FileEntry) => f.nombre === fileName);
          if (match) updateFile(match.id, { status: 'error', error: err });
        }
      } catch (connErr: any) {
        for (const u of batch) updateFile(u.id, { status: 'error', error: 'Error de conexión' });
      }
    }

    if (allRegistered.length === 0) {
      setGlobalError('Ningún archivo se registró correctamente.');
      setUploading(false);
      setStep('done');
      return;
    }

    // Paso 3: Clasificar en lotes de BATCH_SIZE concurrentes
    setCurrentIdx(0);
    await processBatches(allRegistered, classifySingleDoc);

    setUploading(false);
    setStep('done');
  };

  const clasificados = files.filter((f: FileEntry) => f.status === 'clasificado').length;
  const errores = files.filter((f: FileEntry) => f.status === 'error').length;

  const STATUS_ICON: Record<string, { icon: string; color: string; text: string }> = {
    pendiente: { icon: '○', color: '#9ca3af', text: 'Pendiente' },
    subiendo: { icon: '↑', color: '#2563eb', text: 'Subiendo...' },
    analizando: { icon: '◌', color: '#7c3aed', text: 'Analizando con IA...' },
    clasificado: { icon: '✓', color: '#16a34a', text: 'Clasificado' },
    error: { icon: '✗', color: '#dc2626', text: 'Error' },
  };

  const canUpload = files.length > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/documentos" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Documentos
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Subir documentos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Arrastre archivos (PDF, DOCX, XLSX, JPG, PNG) para clasificarlos automáticamente con IA.
        </p>
      </div>

      {/* Step 1: Selección de cliente y archivos */}
      {step === 'select' && (
        <>
          {/* Client selector */}
          <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Cliente asociado <span className="text-xs font-normal text-slate-400">(opcional — la IA detectará automáticamente)</span>
            </label>
            <div className="relative" ref={dropdownRef}>
              {selectedCliente ? (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E40AF] to-[#0891B2] text-white text-xs font-bold">
                      {selectedCliente.codigo.slice(0, 3)}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{selectedCliente.nombre}</p>
                      <p className="text-xs text-slate-500">{selectedCliente.codigo}</p>
                    </div>
                  </div>
                  <button
                    onClick={clearCliente}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                    title="Cambiar cliente"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={clienteQuery}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClienteQuery(e.target.value)}
                    onFocus={() => { if (clienteResults.length > 0) setShowDropdown(true); }}
                    placeholder="Buscar cliente por nombre, código o NIT..."
                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891B2] focus:border-transparent"
                  />
                  {searchingClientes && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-slate-300 border-t-[#0891B2] rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              )}

              {/* Dropdown results */}
              {showDropdown && !selectedCliente && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {clienteResults.map((c: ClienteOption) => (
                    <button
                      key={c.id}
                      onClick={() => selectCliente(c)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <p className="text-sm font-medium text-slate-900">{c.nombre}</p>
                      <p className="text-xs text-slate-500">{c.codigo}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Code preview */}
            {codePreview && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Siguiente código: <strong className="text-slate-700">{codePreview}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-teal-500 bg-teal-50'
                : 'border-slate-300 bg-white hover:border-teal-400'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png"
              multiple
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) addFiles(e.target.files);
              }}
              className="hidden"
            />
            <svg width="48" height="48" fill="none" stroke={dragOver ? '#0d9488' : '#9ca3af'} viewBox="0 0 24 24" className="mx-auto mb-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-base font-semibold text-slate-700">
              {dragOver ? 'Suelte los archivos aquí' : 'Arrastre sus archivos aquí'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              o haga clic para seleccionar — PDF, DOCX, XLSX, JPG, PNG (máx. 100, 50MB c/u)
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {files.map((f: FileEntry) => (
                <div key={f.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{getFileIcon(f.nombre)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{f.nombre}</p>
                      <p className="text-xs text-slate-400">{f.tamano}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); removeFile(f.id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors p-1"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <div className="px-5 py-3 flex items-center justify-between bg-slate-50">
                <span className="text-sm text-slate-500">{files.length} archivo{files.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={startUpload}
                  disabled={!canUpload}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    canUpload
                      ? 'bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white hover:shadow-lg'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {selectedCliente ? 'Subir y clasificar' : 'Subir y clasificar con IA'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Error global */}
      {globalError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-start gap-3">
            <svg width="20" height="20" fill="none" stroke="#dc2626" viewBox="0 0 24 24" className="shrink-0 mt-0.5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1 break-words whitespace-pre-wrap">{globalError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Procesamiento */}
      {(step === 'processing' || step === 'done') && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Progress header */}
          {step === 'processing' && (
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-slate-300 border-t-[#1E40AF] rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-700">
                  Procesando documento {currentIdx + 1} de {files.length}...
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Tiempo estimado: ~{Math.max(1, (files.length - currentIdx) * 3)} segundos restantes
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="px-5 py-4 bg-emerald-50 border-b border-emerald-200">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-emerald-800">
                  {clasificados} clasificado{clasificados !== 1 ? 's' : ''}
                  {errores > 0 ? `, ${errores} error${errores !== 1 ? 'es' : ''}` : ''}
                </span>
              </div>
            </div>
          )}

          {/* File status list */}
          <div className="divide-y divide-slate-100">
            {files.map((f: FileEntry) => {
              const s = STATUS_ICON[f.status];
              return (
                <div key={f.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span style={{ color: s.color }} className="text-lg font-bold w-5 text-center">
                      {(f.status === 'analizando' || f.status === 'subiendo') ? (
                        <span className="inline-block w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                      ) : (
                        s.icon
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{f.nombre}</p>
                      {f.status === 'clasificado' && f.resultado?.tipo ? (
                        <p className="text-xs" style={{ color: s.color }}>
                          {s.text}: {f.resultado.titulo ?? f.resultado.tipo}
                        </p>
                      ) : f.status === 'error' && f.error ? (
                        <p className="text-xs text-red-600 break-words whitespace-pre-wrap max-w-lg">
                          {f.error}
                        </p>
                      ) : (
                        <p className="text-xs" style={{ color: s.color }}>
                          {s.text}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 shrink-0">{f.tamano}</span>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          {step === 'done' && (
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => { setStep('select'); setFiles([]); setGlobalError(null); }}
                className="px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Subir más archivos
              </button>
              <Link
                href="/admin/documentos?estado=clasificado"
                className="px-5 py-2 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all inline-block"
              >
                Ir a revisiones
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
