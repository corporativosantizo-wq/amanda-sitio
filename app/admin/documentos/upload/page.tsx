// ============================================================================
// app/admin/documentos/upload/page.tsx
// Subida masiva de PDFs con clasificación IA
// Sube directo a Supabase Storage (bypasses Vercel 4.5MB body limit)
// ============================================================================
'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

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

export default function UploadDocumentos() {
  const [step, setStep] = useState<'select' | 'processing' | 'done'>('select');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = useCallback((fileList: FileList | File[]) => {
    const newFiles: FileEntry[] = [];
    const rejected: string[] = [];

    for (const f of Array.from(fileList)) {
      if (f.type !== 'application/pdf') {
        rejected.push(`${f.name}: no es un PDF.`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        rejected.push(`${f.name}: el archivo es demasiado grande (${formatSize(f.size)}). Máximo 20MB.`);
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
      setFiles((prev: FileEntry[]) => [...prev, ...newFiles].slice(0, 20));
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

  const startUpload = async () => {
    if (files.length === 0) return;
    setStep('processing');
    setUploading(true);
    setGlobalError(null);

    // Paso 1: Subir cada PDF directo a Supabase Storage via signed URL
    const uploaded: { id: string; storage_path: string; filename: string; filesize: number; docId?: string }[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setCurrentIdx(i);
      updateFile(f.id, { status: 'subiendo' });

      try {
        // 1a. Get signed upload URL from API
        const urlRes = await fetch('/api/admin/documentos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: f.file.name, filesize: f.file.size }),
        });

        const urlData = await urlRes.json();
        if (!urlRes.ok) {
          updateFile(f.id, { status: 'error', error: urlData.error ?? `Error HTTP ${urlRes.status}` });
          continue;
        }

        // 1b. Upload directly to Supabase Storage (no Vercel body limit)
        const uploadRes = await fetch(urlData.signed_url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: f.file,
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text().catch(() => '');
          updateFile(f.id, { status: 'error', error: `Error al subir a Storage: HTTP ${uploadRes.status} — ${errText.slice(0, 200)}` });
          continue;
        }

        uploaded.push({
          id: f.id,
          storage_path: urlData.storage_path,
          filename: f.file.name,
          filesize: f.file.size,
        });
        updateFile(f.id, { storagePath: urlData.storage_path });
      } catch (err: any) {
        updateFile(f.id, { status: 'error', error: `Error de conexión: ${err.message ?? 'desconocido'}` });
      }
    }

    if (uploaded.length === 0) {
      setGlobalError('Ningún archivo se subió correctamente.');
      setUploading(false);
      setStep('done');
      return;
    }

    // Paso 2: Registrar documentos en BD (metadata only — tiny JSON payload)
    let registeredDocs: any[] = [];
    try {
      const regRes = await fetch('/api/admin/documentos/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: uploaded.map((u: any) => ({
            storage_path: u.storage_path,
            filename: u.filename,
            filesize: u.filesize,
          })),
        }),
      });

      const regData = await regRes.json();
      if (!regRes.ok) {
        setGlobalError(`Error al registrar: ${regData.error ?? 'desconocido'}`);
        for (const u of uploaded) updateFile(u.id, { status: 'error', error: 'Error al registrar en BD' });
        setUploading(false);
        setStep('done');
        return;
      }

      registeredDocs = regData.documentos ?? [];

      // Match registered docs back to files
      for (const doc of registeredDocs) {
        const match = uploaded.find((u: any) => u.filename === doc.nombre_archivo);
        if (match) {
          match.docId = doc.id;
          updateFile(match.id, { resultado: doc, status: 'analizando' });
        }
      }

      for (const err of regData.errores ?? []) {
        const fileName = err.split(':')[0]?.trim();
        const match = files.find((f: FileEntry) => f.nombre === fileName);
        if (match) updateFile(match.id, { status: 'error', error: err });
      }
    } catch (connErr: any) {
      setGlobalError(`Error de conexión: ${connErr.message ?? 'desconocido'}`);
      for (const u of uploaded) updateFile(u.id, { status: 'error', error: 'Error de conexión' });
      setUploading(false);
      setStep('done');
      return;
    }

    // Paso 3: Clasificar uno por uno
    for (let i = 0; i < uploaded.length; i++) {
      const u = uploaded[i];
      if (!u.docId) continue;

      setCurrentIdx(i);
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
          continue;
        }

        if (res.ok) {
          updateFile(u.id, { status: 'clasificado', resultado: result.documento });
        } else {
          updateFile(u.id, { status: 'error', error: result.error ?? `Error HTTP ${res.status}` });
        }
      } catch (classErr: any) {
        updateFile(u.id, { status: 'error', error: `Error de conexión al clasificar: ${classErr.message ?? 'desconocido'}` });
      }

      // Delay 1s entre documentos
      if (i < uploaded.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/documentos" className="text-sm text-slate-500 hover:text-slate-700">
          &larr; Documentos
        </Link>
        <h1 className="text-xl font-bold text-slate-900 mt-2">Subir documentos</h1>
        <p className="text-sm text-slate-500 mt-1">
          Arrastre archivos PDF para clasificarlos automáticamente con IA
        </p>
      </div>

      {/* Step 1: Selección de archivos */}
      {step === 'select' && (
        <>
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
              accept=".pdf"
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
              {dragOver ? 'Suelte los archivos aquí' : 'Arrastre sus PDFs aquí'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              o haga clic para seleccionar (máx. 20 archivos, 20MB c/u)
            </p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-6 bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
              {files.map((f: FileEntry) => (
                <div key={f.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <svg width="20" height="20" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
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
                  className="px-5 py-2 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg transition-all"
                >
                  Subir y clasificar
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
