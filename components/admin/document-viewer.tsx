// ============================================================================
// components/admin/document-viewer.tsx
// Modal viewer for documents: PDF (iframe), DOCX (mammoth), images, fallback
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface DocumentViewerProps {
  docId: string;
  fileName: string;
  onClose: () => void;
}

type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; signedUrl: string; type: 'pdf' | 'image' | 'docx' | 'other' };

function getFileExt(name: string): string {
  return (name?.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
}

function getViewType(ext: string): 'pdf' | 'image' | 'docx' | 'other' {
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (['docx', 'doc'].includes(ext)) return 'docx';
  return 'other';
}

const EXT_COLORS: Record<string, string> = {
  pdf: 'bg-red-100 text-red-700',
  docx: 'bg-blue-100 text-blue-700',
  doc: 'bg-blue-100 text-blue-700',
  xlsx: 'bg-green-100 text-green-700',
  xls: 'bg-green-100 text-green-700',
  jpg: 'bg-amber-100 text-amber-700',
  jpeg: 'bg-amber-100 text-amber-700',
  png: 'bg-amber-100 text-amber-700',
};

export default function DocumentViewer({ docId, fileName, onClose }: DocumentViewerProps) {
  const [state, setState] = useState<ViewState>({ status: 'loading' });
  const [docxHtml, setDocxHtml] = useState<string | null>(null);

  const ext = getFileExt(fileName);
  const viewType = getViewType(ext);

  // Fetch signed URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await adminFetch(`/api/admin/documentos/${docId}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.error || !data.signed_url) {
          setState({ status: 'error', message: data.error || 'No se pudo obtener URL del documento' });
          return;
        }
        setState({ status: 'ready', signedUrl: data.signed_url, type: viewType });

        // For DOCX, fetch and convert
        if (viewType === 'docx') {
          try {
            const blob = await fetch(data.signed_url).then(r => r.blob());
            const arrayBuf = await blob.arrayBuffer();
            const mammoth = await import('mammoth');
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuf });
            if (!cancelled) setDocxHtml(result.value);
          } catch {
            if (!cancelled) setDocxHtml('<p style="color:#94a3b8;text-align:center;padding:2rem">No se pudo renderizar el documento DOCX.</p>');
          }
        }
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'Error de red al obtener documento' });
      }
    })();
    return () => { cancelled = true; };
  }, [docId, viewType]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const openExternal = useCallback(() => {
    if (state.status === 'ready') window.open(state.signedUrl, '_blank', 'noopener');
  }, [state]);

  const downloadFile = useCallback(() => {
    if (state.status === 'ready') {
      const a = document.createElement('a');
      a.href = state.signedUrl;
      a.download = fileName || 'documento';
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
  }, [state, fileName]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{ width: '95vw', height: '95vh', maxWidth: '1400px' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 shrink-0">
          <FileText size={18} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-900 truncate flex-1">{fileName}</p>
          {ext && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${EXT_COLORS[ext] ?? 'bg-slate-100 text-slate-600'}`}>
              {ext}
            </span>
          )}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={openExternal} disabled={state.status !== 'ready'}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
              title="Abrir en nueva pestaña">
              <ExternalLink size={16} />
            </button>
            <button onClick={downloadFile} disabled={state.status !== 'ready'}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30"
              title="Descargar">
              <Download size={16} />
            </button>
            <button onClick={onClose}
              className="p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
              title="Cerrar (Esc)">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden bg-slate-50 rounded-b-2xl">
          {state.status === 'loading' && (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-500">Cargando documento...</p>
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <p className="text-4xl mb-3">📄</p>
                <p className="text-sm font-medium text-slate-700 mb-1">No se pudo cargar el documento</p>
                <p className="text-xs text-slate-500">{state.message}</p>
              </div>
            </div>
          )}

          {state.status === 'ready' && state.type === 'pdf' && (
            <iframe
              src={state.signedUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          )}

          {state.status === 'ready' && state.type === 'image' && (
            <div className="h-full overflow-auto flex items-center justify-center p-6">
              <img
                src={state.signedUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          )}

          {state.status === 'ready' && state.type === 'docx' && (
            <div className="h-full overflow-auto">
              {docxHtml === null ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Convirtiendo DOCX...</p>
                  </div>
                </div>
              ) : (
                <div
                  className="prose prose-sm max-w-4xl mx-auto p-8 bg-white min-h-full shadow-sm"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
              )}
            </div>
          )}

          {state.status === 'ready' && state.type === 'other' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <p className="text-5xl mb-4">📎</p>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Vista previa no disponible para archivos .{ext || '?'}
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={openExternal}
                    className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors">
                    Abrir en nueva pestaña
                  </button>
                  <button onClick={downloadFile}
                    className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
                    Descargar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
