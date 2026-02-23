// ============================================================================
// components/admin/archivo-card.tsx
// Componente reutilizable para mostrar/subir/descargar archivos PDF y DOCX
// ============================================================================

'use client';

export interface ArchivoCardProps {
  tipo: 'pdf' | 'docx';
  label: string;
  desc: string;
  nombreArchivo: string | null;
  isUploading: boolean;
  onUpload: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onDelete: () => void;
}

export function ArchivoCard({
  tipo, label, desc, nombreArchivo, isUploading,
  onUpload, onDownload, onReplace, onDelete,
}: ArchivoCardProps) {
  const isPdf = tipo === 'pdf';
  const hasFile = !!nombreArchivo;

  if (isUploading) {
    return (
      <div className={`border-2 border-dashed rounded-lg p-4 flex items-center justify-center gap-2 ${isPdf ? 'border-red-300 bg-red-50/50' : 'border-blue-300 bg-blue-50/50'}`}>
        <svg className={`animate-spin h-5 w-5 ${isPdf ? 'text-red-500' : 'text-blue-500'}`} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        <span className={`text-sm font-medium ${isPdf ? 'text-red-600' : 'text-blue-600'}`}>Subiendo...</span>
      </div>
    );
  }

  if (!hasFile) {
    return (
      <button
        onClick={onUpload}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors w-full ${
          isPdf ? 'border-red-200 hover:border-red-400 hover:bg-red-50/50' : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/50'
        }`}
      >
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2 ${isPdf ? 'bg-red-100' : 'bg-blue-100'}`}>
          {isPdf ? (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v3H8v-3zm3 0h2v3h-2v-3zm3 0h2v3h-2v-3z"/></svg>
          ) : (
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h1.5l1 2.5L11.5 14H13l-1.75 3.5L13 21h-1.5l-1-2.5L9.5 21H8l1.75-3.5L8 14z"/></svg>
          )}
        </div>
        <p className={`text-sm font-medium ${isPdf ? 'text-red-700' : 'text-blue-700'}`}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
        <p className={`text-xs mt-2 ${isPdf ? 'text-red-400' : 'text-blue-400'}`}>Click para subir</p>
      </button>
    );
  }

  return (
    <div className={`border rounded-lg p-4 ${isPdf ? 'border-red-200 bg-red-50/30' : 'border-blue-200 bg-blue-50/30'}`}>
      <div className="flex items-start gap-3">
        <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${isPdf ? 'bg-red-100' : 'bg-blue-100'}`}>
          {isPdf ? (
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h2v3H8v-3zm3 0h2v3h-2v-3zm3 0h2v3h-2v-3z"/></svg>
          ) : (
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6zm2-6h1.5l1 2.5L11.5 14H13l-1.75 3.5L13 21h-1.5l-1-2.5L9.5 21H8l1.75-3.5L8 14z"/></svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{nombreArchivo}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button onClick={onDownload}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            isPdf ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          Descargar
        </button>
        <button onClick={onReplace}
          className="px-3 py-1.5 text-xs font-medium rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors">
          Reemplazar
        </button>
        <button onClick={onDelete}
          className="px-2 py-1.5 text-xs rounded-md text-red-500 hover:bg-red-50 transition-colors" title="Eliminar">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
    </div>
  );
}
