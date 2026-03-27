// ============================================================================
// components/admin/document-viewer.tsx
// Modal viewer for documents: PDF (iframe via proxy), DOCX (mammoth), images, fallback
// Uses /api/admin/documentos/[id]/preview proxy to avoid CSP/CORS blocks.
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ExternalLink, Download, FileText } from 'lucide-react';

interface DocumentViewerProps {
  docId: string;
  fileName: string;
  onClose: () => void;
}

type ViewType = 'pdf' | 'image' | 'docx' | 'other';

function getFileExt(name: string): string {
  return (name?.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
}

function getViewType(ext: string): ViewType {
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
  const [docxHtml, setDocxHtml] = useState<string | null>(null);
  const [docxError, setDocxError] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  const ext = getFileExt(fileName);
  const viewType = getViewType(ext);
  const proxyUrl = `/api/admin/documentos/${docId}/preview`;

  // For DOCX: fetch via proxy and convert with mammoth
  useEffect(() => {
    if (viewType !== 'docx') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const mammoth = await import('mammoth');
        const result = await mammoth.convertToHtml({ arrayBuffer: buf });
        if (!cancelled) setDocxHtml(result.value);
      } catch {
        if (!cancelled) setDocxError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [proxyUrl, viewType]);

  // For images: create a blob URL from the proxy to avoid CSP issues
  useEffect(() => {
    if (viewType !== 'image') return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!cancelled) setImgUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setImgUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyUrl, viewType]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const downloadFile = useCallback(() => {
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = fileName || 'documento';
    a.click();
  }, [proxyUrl, fileName]);

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
            <button onClick={() => window.open(proxyUrl, '_blank', 'noopener')}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              title="Abrir en nueva pestaña">
              <ExternalLink size={16} />
            </button>
            <button onClick={downloadFile}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
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

          {/* PDF: iframe pointing to our proxy */}
          {viewType === 'pdf' && (
            <iframe
              src={proxyUrl}
              className="w-full h-full border-0"
              title={fileName}
            />
          )}

          {/* Image: blob URL from proxy */}
          {viewType === 'image' && (
            <div className="h-full overflow-auto flex items-center justify-center p-6">
              {imgUrl ? (
                <img src={imgUrl} alt={fileName}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-500">Cargando imagen...</p>
                </div>
              )}
            </div>
          )}

          {/* DOCX: mammoth.js rendered HTML */}
          {viewType === 'docx' && (
            <div className="h-full overflow-auto">
              {docxError ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <p className="text-4xl mb-3">📄</p>
                    <p className="text-sm font-medium text-slate-700 mb-1">No se pudo renderizar el DOCX</p>
                    <div className="flex gap-2 justify-center mt-4">
                      <button onClick={() => window.open(proxyUrl, '_blank', 'noopener')}
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
              ) : docxHtml === null ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-slate-500">Convirtiendo DOCX...</p>
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm max-w-4xl mx-auto p-8 bg-white min-h-full shadow-sm"
                  dangerouslySetInnerHTML={{ __html: docxHtml }} />
              )}
            </div>
          )}

          {/* Other: fallback with open/download buttons */}
          {viewType === 'other' && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-sm">
                <p className="text-5xl mb-4">📎</p>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Vista previa no disponible para archivos .{ext || '?'}
                </p>
                <div className="flex gap-2 justify-center mt-4">
                  <button onClick={() => window.open(proxyUrl, '_blank', 'noopener')}
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
