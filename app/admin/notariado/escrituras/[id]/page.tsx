// ============================================================================
// app/admin/notariado/escrituras/[id]/page.tsx
// Vista de detalle de escritura con carpetas de documentos + drag & drop
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { generarAvisoGeneral, type TipoAviso } from '@/lib/generators/aviso-general';
import { saveAs } from 'file-saver';

// ── Types ──────────────────────────────────────────────────────────────

interface Escritura {
  id: string;
  numero: number;
  numero_texto: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;
  tipo_instrumento: string;
  tipo_instrumento_texto: string;
  descripcion: string | null;
  estado: string;
  comparecientes: Array<{ nombre: string; dpi?: string; calidad?: string; representacion?: string }>;
  hojas_protocolo: number | null;
  notas: string | null;
  protocolo: { id: string; anio: number };
  cliente: { id: string; nombre: string } | null;
  testimonios: any[];
}

interface Documento {
  id: string;
  escritura_id: string;
  categoria: string;
  subcategoria: string | null;
  nombre_archivo: string;
  storage_path: string;
  tamano_bytes: number | null;
  notas: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const CARPETAS = [
  { key: 'borrador_docx', label: 'Borrador DOCX', icon: '📝', accept: '.docx,.doc', desc: 'Archivos .docx y .doc' },
  { key: 'testimonio', label: 'Testimonios', icon: '📜', accept: '.pdf', desc: 'Archivos PDF' },
  { key: 'aviso_trimestral', label: 'Avisos Trimestrales', icon: '📅', accept: '.pdf', desc: 'Archivos PDF' },
  { key: 'aviso_general', label: 'Avisos Generales', icon: '📋', accept: '.pdf,.docx', desc: 'Archivos PDF o DOCX' },
];

const SUBCATEGORIAS_AVISO = [
  { value: 'cancelacion', label: 'Cancelación' },
  { value: 'aclaracion', label: 'Aclaración' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'modificacion', label: 'Modificación' },
  { value: 'rescision', label: 'Rescisión' },
];

const ESTADO_BADGES: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-700',
  autorizada: 'bg-green-100 text-green-700',
  escaneada: 'bg-blue-100 text-blue-700',
  con_testimonio: 'bg-indigo-100 text-indigo-700',
  cancelada: 'bg-red-100 text-red-700',
};

// ── Page ───────────────────────────────────────────────────────────────

export default function EscrituraDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [escritura, setEscritura] = useState<Escritura | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tabActiva, setTabActiva] = useState('borrador_docx');
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAvisoModal, setShowAvisoModal] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Archivos de la Escritura (PDF firmado + DOCX editable)
  const [archivoPdf, setArchivoPdf] = useState<Documento | null>(null);
  const [archivoDocx, setArchivoDocx] = useState<Documento | null>(null);
  const [archivosLoading, setArchivosLoading] = useState(true);
  const [uploadingArchivo, setUploadingArchivo] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const archivoInputRef = useRef<HTMLInputElement>(null);
  const pendingArchivo = useRef<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Fetch escritura
  useEffect(() => {
    fetch(`/api/admin/notariado/escrituras/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Escritura no encontrada');
        return res.json();
      })
      .then(setEscritura)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch archivos principales (escritura_pdf, escritura_docx)
  const fetchArchivos = useCallback(async () => {
    setArchivosLoading(true);
    try {
      const [pdfRes, docxRes] = await Promise.all([
        fetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=escritura_pdf`),
        fetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=escritura_docx`),
      ]);
      if (pdfRes.ok) {
        const pdfDocs = await pdfRes.json();
        setArchivoPdf(pdfDocs.length > 0 ? pdfDocs[0] : null);
      }
      if (docxRes.ok) {
        const docxDocs = await docxRes.json();
        setArchivoDocx(docxDocs.length > 0 ? docxDocs[0] : null);
      }
    } catch { /* ignore */ }
    setArchivosLoading(false);
  }, [id]);

  useEffect(() => { fetchArchivos(); }, [fetchArchivos]);

  // Upload archivo principal
  const handleUploadArchivo = async (file: File, categoria: string) => {
    setUploadingArchivo(categoria);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('escritura_id', id);
      formData.append('categoria', categoria);

      const res = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Error al subir');
      } else {
        fetchArchivos();
      }
    } catch {
      alert('Error al subir archivo');
    }
    setUploadingArchivo(null);
  };

  const triggerArchivoUpload = (categoria: string) => {
    pendingArchivo.current = categoria;
    if (archivoInputRef.current) {
      archivoInputRef.current.accept = categoria === 'escritura_pdf' ? '.pdf' : '.docx,.doc';
      archivoInputRef.current.click();
    }
  };

  const handleArchivoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingArchivo.current) {
      handleUploadArchivo(file, pendingArchivo.current);
      pendingArchivo.current = null;
    }
    e.target.value = '';
  };

  const handleDeleteArchivo = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    try {
      const res = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      });
      if (res.ok) fetchArchivos();
      else alert('Error al eliminar');
    } catch {
      alert('Error al eliminar');
    }
  };

  // Fetch documents for active tab
  const fetchDocumentos = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=${tabActiva}`);
      if (res.ok) {
        const data = await res.json();
        setDocumentos(data);
      }
    } catch { /* ignore */ }
    setDocsLoading(false);
  }, [id, tabActiva]);

  useEffect(() => { fetchDocumentos(); }, [fetchDocumentos]);

  // Upload
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      formData.append('escritura_id', id);
      formData.append('categoria', tabActiva);

      const res = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Error al subir');
        return;
      }
      fetchDocumentos();
    } catch {
      alert('Error al subir archivo');
    }
    setUploading(false);
  };

  // Drag & drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false when leaving the drop zone (not entering children)
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleUpload(files[0]);
    }
  };

  // Download
  const handleDownload = async (doc: Documento) => {
    try {
      const res = await fetch(`/api/admin/notariado/escrituras/documentos/download?id=${doc.id}`);
      if (!res.ok) { alert('Error al descargar'); return; }
      const { url } = await res.json();
      window.open(url, '_blank');
    } catch {
      alert('Error al descargar');
    }
  };

  // Delete
  const handleDelete = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    try {
      const res = await fetch('/api/admin/notariado/escrituras/documentos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: doc.id }),
      });
      if (res.ok) fetchDocumentos();
      else alert('Error al eliminar');
    } catch {
      alert('Error al eliminar');
    }
  };

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala' });

  const carpetaActiva = CARPETAS.find((c) => c.key === tabActiva)!;

  // ── Render ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-1/4" />
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
          <div className="h-32 bg-slate-100 rounded-xl" />
        </div>
        <div className="h-64 bg-slate-100 rounded-xl mt-4" />
      </div>
    </div>
  );

  if (error || !escritura) return (
    <div className="p-8">
      <Link href="/admin/notariado/escrituras" className="text-blue-600 hover:text-blue-800 text-sm">← Volver</Link>
      <div className="mt-4 p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">{error || 'Escritura no encontrada'}</div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/notariado/escrituras" className="text-sm text-slate-500 hover:text-slate-700">← Escrituras</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Escritura {escritura.numero_texto}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{escritura.tipo_instrumento_texto}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTADO_BADGES[escritura.estado] ?? 'bg-slate-100'}`}>
          {escritura.estado}
        </span>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Datos Generales</p>
          <div className="space-y-1.5 text-sm">
            <p><span className="text-slate-500">Número:</span> <span className="font-medium font-mono">{escritura.numero}</span></p>
            <p><span className="text-slate-500">Fecha:</span> <span className="font-medium">{new Date(escritura.fecha_autorizacion + 'T12:00:00').toLocaleDateString('es-GT', { dateStyle: 'long', timeZone: 'America/Guatemala' })}</span></p>
            <p><span className="text-slate-500">Lugar:</span> <span className="font-medium">{escritura.lugar_autorizacion}</span></p>
            <p><span className="text-slate-500">Departamento:</span> <span className="font-medium">{escritura.departamento}</span></p>
            <p><span className="text-slate-500">Tipo:</span> <span className="font-medium">{escritura.tipo_instrumento_texto}</span></p>
            {escritura.hojas_protocolo && <p><span className="text-slate-500">Hojas:</span> <span className="font-medium">{escritura.hojas_protocolo}</span></p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Comparecientes</p>
          <div className="space-y-1.5">
            {escritura.comparecientes.map((c: any, i: number) => (
              <div key={i} className="text-sm">
                <p className="font-medium text-slate-900">{c.nombre}</p>
                {(c.calidad || c.dpi) && (
                  <p className="text-xs text-slate-500">
                    {c.calidad && <span>{c.calidad}</span>}
                    {c.dpi && <span className="ml-2">DPI: {c.dpi}</span>}
                  </p>
                )}
                {c.representacion && <p className="text-xs text-slate-400">Rep: {c.representacion}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Información Adicional</p>
          <div className="space-y-1.5 text-sm">
            {escritura.cliente && (
              <p><span className="text-slate-500">Cliente:</span> <span className="font-medium">{escritura.cliente.nombre}</span></p>
            )}
            {escritura.protocolo && (
              <p><span className="text-slate-500">Protocolo:</span> <span className="font-medium">{escritura.protocolo.anio}</span></p>
            )}
            <p><span className="text-slate-500">Estado:</span> <span className="font-medium capitalize">{escritura.estado}</span></p>
          </div>
          {(escritura.descripcion || escritura.notas) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-1">Notas</p>
              <p className="text-sm text-slate-600">{escritura.descripcion || escritura.notas}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Archivos de la Escritura ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Archivos de la Escritura</h2>
        <input ref={archivoInputRef} type="file" className="hidden" onChange={handleArchivoFileChange} />
        {archivosLoading ? (
          <div className="flex gap-4">
            <div className="flex-1 h-20 bg-slate-100 rounded-lg animate-pulse" />
            <div className="flex-1 h-20 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* PDF Card */}
            <ArchivoCard
              tipo="pdf"
              label="PDF Firmado"
              desc="Escritura escaneada con firmas"
              doc={archivoPdf}
              isUploading={uploadingArchivo === 'escritura_pdf'}
              onUpload={() => triggerArchivoUpload('escritura_pdf')}
              onDownload={() => archivoPdf && handleDownload(archivoPdf)}
              onReplace={() => triggerArchivoUpload('escritura_pdf')}
              onDelete={() => archivoPdf && handleDeleteArchivo(archivoPdf)}
            />
            {/* DOCX Card */}
            <ArchivoCard
              tipo="docx"
              label="DOCX Editable"
              desc="Escritura en formato editable"
              doc={archivoDocx}
              isUploading={uploadingArchivo === 'escritura_docx'}
              onUpload={() => triggerArchivoUpload('escritura_docx')}
              onDownload={() => archivoDocx && handleDownload(archivoDocx)}
              onReplace={() => triggerArchivoUpload('escritura_docx')}
              onDelete={() => archivoDocx && handleDeleteArchivo(archivoDocx)}
            />
          </div>
        )}
      </div>

      {/* ── Document Folders ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200 px-4 pt-4 pb-0">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Documentos</h2>
          <div className="flex gap-1 overflow-x-auto">
            {CARPETAS.map((c) => (
              <button
                key={c.key}
                onClick={() => setTabActiva(c.key)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
                  tabActiva === c.key
                    ? 'border-[#2d6bcf] text-[#2d6bcf] bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="mr-1.5">{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {/* Upload area + tab actions */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">{carpetaActiva.desc}</p>
            <div className="flex items-center gap-2">
              {/* "Generar Aviso" button only on the Avisos Generales tab */}
              {tabActiva === 'aviso_general' && (
                <button
                  onClick={() => setShowAvisoModal(true)}
                  className="px-4 py-2 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243456] transition-colors font-medium flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generar Aviso
                </button>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 text-sm bg-[#2d6bcf] text-white rounded-lg hover:bg-[#2558a8] disabled:bg-slate-300 transition-colors font-medium flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {uploading ? 'Subiendo...' : 'Subir archivo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={carpetaActiva.accept}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
              />
            </div>
          </div>

          {/* Drag & drop zone + file list */}
          <div
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              dragging
                ? 'border-[#2d6bcf] bg-blue-50/50'
                : 'border-slate-200 bg-transparent'
            }`}
          >
            {/* Drag overlay */}
            {dragging && (
              <div className="py-8 text-center">
                <svg className="w-10 h-10 mx-auto text-[#2d6bcf] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm font-medium text-[#2d6bcf]">Soltar archivo aquí</p>
                <p className="text-xs text-slate-400 mt-1">{carpetaActiva.desc}</p>
              </div>
            )}

            {/* File list */}
            {!dragging && (
              <>
                {docsLoading ? (
                  <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>
                ) : documentos.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-3xl mb-2">{carpetaActiva.icon}</p>
                    <p className="text-sm text-slate-500">No hay archivos en esta carpeta</p>
                    <p className="text-xs text-slate-400 mt-1">Arrastra un archivo o usa el botón &quot;Subir archivo&quot;</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {documentos.map((doc: Documento) => (
                      <div key={doc.id} className="flex items-center justify-between py-3 px-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg shrink-0">
                            {doc.nombre_archivo.endsWith('.docx') || doc.nombre_archivo.endsWith('.doc') ? '📘' : '📄'}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
                            <p className="text-xs text-slate-400">
                              {fmtSize(doc.tamano_bytes)} — {fmtDate(doc.created_at)}
                              {doc.subcategoria && (
                                <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{doc.subcategoria}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-2 text-slate-400 hover:text-[#2d6bcf] hover:bg-blue-50 rounded-lg transition-colors"
                            title="Descargar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Aviso General Modal */}
      {showAvisoModal && (
        <AvisoGeneralModal
          escritura={escritura}
          onClose={() => setShowAvisoModal(false)}
          onCreated={() => {
            if (tabActiva === 'aviso_general') fetchDocumentos();
          }}
        />
      )}
    </div>
  );
}

// ── Archivo Card (PDF/DOCX principal) ─────────────────────────────────

function ArchivoCard({
  tipo, label, desc, doc, isUploading,
  onUpload, onDownload, onReplace, onDelete,
}: {
  tipo: 'pdf' | 'docx';
  label: string;
  desc: string;
  doc: Documento | null;
  isUploading: boolean;
  onUpload: () => void;
  onDownload: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  const isPdf = tipo === 'pdf';
  const hasFile = !!doc;

  const fmtSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

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
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
          <p className="text-sm font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
          <p className="text-xs text-slate-400 mt-0.5">{fmtSize(doc.tamano_bytes)}</p>
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

// ── Aviso General Modal ────────────────────────────────────────────────

function AvisoGeneralModal({ escritura, onClose, onCreated }: { escritura: Escritura; onClose: () => void; onCreated: () => void }) {
  const [tipoAviso, setTipoAviso] = useState<TipoAviso>('cancelacion');
  const [motivo, setMotivo] = useState('');
  const [fechaAviso, setFechaAviso] = useState(new Date().toISOString().split('T')[0]);
  const [generando, setGenerando] = useState(false);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
      // Fetch membrete config
      let membrete;
      try {
        const memRes = await fetch('/api/admin/notariado/configuracion/membrete-base64');
        if (memRes.ok) {
          const memJson = await memRes.json();
          membrete = memJson.membrete ?? undefined;
        }
      } catch { /* sin membrete */ }

      const blob = await generarAvisoGeneral({
        tipoAviso,
        motivo,
        fechaAviso,
        escritura: {
          numero: escritura.numero,
          fecha_autorizacion: escritura.fecha_autorizacion,
          lugar_autorizacion: escritura.lugar_autorizacion,
          departamento: escritura.departamento,
        },
        membrete,
      });

      const tipoLabel = tipoAviso.charAt(0).toUpperCase() + tipoAviso.slice(1);
      const filename = `Aviso-${tipoLabel}-Esc${escritura.numero}.docx`;
      saveAs(blob, filename);

      // Save to DB for history
      try {
        const formData = new FormData();
        formData.append('archivo', new File([blob], filename, {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }));
        formData.append('escritura_id', escritura.id);
        formData.append('subcategoria', tipoAviso);
        formData.append('notas', motivo || `Aviso de ${tipoLabel}`);

        await fetch('/api/admin/notariado/avisos-generales', {
          method: 'POST',
          body: formData,
        });
        onCreated();
      } catch { /* ignore save error, file was already downloaded */ }

      onClose();
    } catch (err) {
      alert('Error al generar aviso');
      console.error(err);
    }
    setGenerando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Generar Aviso General</h3>
          <p className="text-xs text-slate-400">Esc. {escritura.numero}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de aviso</label>
            <select
              value={tipoAviso}
              onChange={(e) => setTipoAviso(e.target.value as TipoAviso)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
            >
              {SUBCATEGORIAS_AVISO.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo / razón</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder='Ej: "por haber incurrido en errores en su redacción"'
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del aviso</label>
            <input
              type="date"
              value={fechaAviso}
              onChange={(e) => setFechaAviso(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGenerar}
            disabled={generando}
            className="flex-1 px-4 py-2.5 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            {generando ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Generando...
              </>
            ) : (
              'Generar y Descargar DOCX'
            )}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
