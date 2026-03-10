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
import { safeWindowOpen } from '@/lib/utils/validate-url';
import { TipoInstrumento, TIPO_INSTRUMENTO_LABEL } from '@/lib/types/enums';
import { adminFetch } from '@/lib/utils/admin-fetch';

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
  comparecientes: Array<{ nombre: string; dpi?: string; calidad?: string; representacion?: string; cliente_id?: string | null }>;
  hojas_protocolo: number | null;
  hojas_fotocopia: number | null;
  objeto_acto: string | null;
  valor_acto: number | null;
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

const DEPARTAMENTOS = [
  'Guatemala', 'Sacatepéquez', 'Chimaltenango', 'El Progreso',
  'Escuintla', 'Santa Rosa', 'Sololá', 'Totonicapán',
  'Quetzaltenango', 'Suchitepéquez', 'Retalhuleu', 'San Marcos',
  'Huehuetenango', 'Quiché', 'Baja Verapaz', 'Alta Verapaz',
  'Petén', 'Izabal', 'Zacapa', 'Chiquimula', 'Jalapa', 'Jutiapa',
];

const TIPO_OPTIONS = Object.entries(TIPO_INSTRUMENTO_LABEL).map(([value, label]) => ({
  value, label,
}));

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
  const [accionLoading, setAccionLoading] = useState(false);
  const [testimonioEditando, setTestimonioEditando] = useState<string | null>(null);
  const [testimonioTexto, setTestimonioTexto] = useState('');
  const [testimonioSaving, setTestimonioSaving] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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
    adminFetch(`/api/admin/notariado/escrituras/${id}`)
      .then(async (res) => {
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
        adminFetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=escritura_pdf`),
        adminFetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=escritura_docx`),
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

      const res = await adminFetch('/api/admin/notariado/escrituras/documentos', {
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
      const res = await adminFetch('/api/admin/notariado/escrituras/documentos', {
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
      const res = await adminFetch(`/api/admin/notariado/escrituras/documentos?escritura_id=${id}&categoria=${tabActiva}`);
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

      const res = await adminFetch('/api/admin/notariado/escrituras/documentos', {
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
      const res = await adminFetch(`/api/admin/notariado/escrituras/documentos/download?id=${doc.id}`);
      if (!res.ok) { alert('Error al descargar'); return; }
      const { url } = await res.json();
      safeWindowOpen(url);
    } catch {
      alert('Error al descargar');
    }
  };

  // Delete
  const handleDelete = async (doc: Documento) => {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    try {
      const res = await adminFetch('/api/admin/notariado/escrituras/documentos', {
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

  // Cambiar estado (autorizar / cancelar)
  const handleAccion = async (accion: 'autorizar' | 'cancelar', motivo?: string) => {
    const confirmMsg = accion === 'autorizar'
      ? '¿Marcar esta escritura como autorizada?'
      : '¿Cancelar esta escritura?';
    if (!confirm(confirmMsg)) return;

    setAccionLoading(true);
    try {
      const res = await adminFetch(`/api/admin/notariado/escrituras/${id}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, motivo }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          alert(err.error || 'Error al cambiar estado');
        } catch {
          alert('Error al cambiar estado');
        }
        return;
      }
      // Refetch to get updated testimonios (created by DB trigger + texto generated)
      await refetchEscritura();
    } catch {
      alert('Error al cambiar estado');
    }
    setAccionLoading(false);
  };

  // Refetch escritura (including testimonios)
  const refetchEscritura = async () => {
    try {
      const res = await adminFetch(`/api/admin/notariado/escrituras/${id}`);
      if (res.ok) setEscritura(await res.json());
    } catch { /* ignore */ }
  };

  // Guardar texto_razon editado
  const handleGuardarTexto = async (testimonioId: string) => {
    setTestimonioSaving(true);
    try {
      const res = await adminFetch(`/api/admin/notariado/testimonios/${testimonioId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto_razon: testimonioTexto }),
      });
      if (!res.ok) { alert('Error al guardar'); return; }
      await refetchEscritura();
      setTestimonioEditando(null);
    } catch { alert('Error al guardar'); }
    setTestimonioSaving(false);
  };

  // Regenerar texto desde plantilla
  const handleRegenerarTexto = async (testimonioId: string) => {
    if (!confirm('Esto sobrescribirá el texto actual con la plantilla. ¿Continuar?')) return;
    try {
      const res = await adminFetch(`/api/admin/notariado/testimonios/${testimonioId}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'regenerar_texto' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al regenerar');
        return;
      }
      await refetchEscritura();
    } catch { alert('Error al regenerar'); }
  };

  // Acción de testimonio (generar/firmar/entregar)
  const handleTestimonioAccion = async (testimonioId: string, accion: string) => {
    try {
      const res = await adminFetch(`/api/admin/notariado/testimonios/${testimonioId}/acciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error');
        return;
      }
      await refetchEscritura();
    } catch { alert('Error al cambiar estado'); }
  };

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEditModal(true)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Editar
          </button>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTADO_BADGES[escritura.estado] ?? 'bg-slate-100'}`}>
            {escritura.estado}
          </span>
          {escritura.estado === 'borrador' && (
            <button
              onClick={() => handleAccion('autorizar')}
              disabled={accionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {accionLoading ? 'Procesando...' : 'Marcar como autorizada'}
            </button>
          )}
          {escritura.estado !== 'cancelada' && (
            <button
              onClick={() => handleAccion('cancelar')}
              disabled={accionLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Cancelar escritura
            </button>
          )}
        </div>
      </div>

      {/* Suggestion banner: PDF exists but still borrador */}
      {escritura.estado === 'borrador' && archivoPdf && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <svg className="w-5 h-5 shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="flex-1">Esta escritura tiene PDF adjunto pero sigue en estado <strong>borrador</strong>.</p>
          <button
            onClick={() => handleAccion('autorizar')}
            disabled={accionLoading}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Marcar como autorizada
          </button>
        </div>
      )}

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
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-slate-900">{c.nombre}</p>
                  {c.cliente_id && (
                    <Link href={`/admin/clientes/${c.cliente_id}`} className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-medium rounded hover:bg-green-200 transition-colors">
                      Ver cliente
                    </Link>
                  )}
                </div>
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

      {/* ── Testimonios ──────────────────────────────────────────────── */}
      {escritura.testimonios && escritura.testimonios.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Testimonios</h2>
          <div className="space-y-4">
            {escritura.testimonios.map((t: any) => {
              const isEditing = testimonioEditando === t.id;
              const TIPO_LABEL: Record<string, string> = {
                primer_testimonio: 'Primer Testimonio',
                testimonio_especial: 'Testimonio Especial',
              };
              const ESTADO_TEST: Record<string, string> = {
                borrador: 'bg-slate-100 text-slate-700',
                generado: 'bg-blue-100 text-blue-700',
                firmado: 'bg-indigo-100 text-indigo-700',
                entregado: 'bg-green-100 text-green-700',
              };

              return (
                <div key={t.id} className="border border-slate-200 rounded-lg p-4">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">📜</span>
                      <span className="text-sm font-semibold text-slate-900">{TIPO_LABEL[t.tipo] ?? t.tipo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ESTADO_TEST[t.estado] ?? 'bg-slate-100'}`}>{t.estado}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {t.estado === 'borrador' && (
                        <button
                          onClick={() => handleRegenerarTexto(t.id)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                          title="Regenerar desde plantilla"
                        >
                          Regenerar
                        </button>
                      )}
                      {t.estado === 'borrador' && t.texto_razon && (
                        <button
                          onClick={() => handleTestimonioAccion(t.id, 'generar')}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                          Marcar generado
                        </button>
                      )}
                      {t.estado === 'generado' && (
                        <button
                          onClick={() => handleTestimonioAccion(t.id, 'firmar')}
                          className="px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                        >
                          Marcar firmado
                        </button>
                      )}
                      {t.estado === 'firmado' && (
                        <button
                          onClick={() => handleTestimonioAccion(t.id, 'entregar')}
                          className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
                        >
                          Marcar entregado
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Destinatario */}
                  <p className="text-xs text-slate-500 mb-2">
                    <span className="font-medium">Destinatario:</span> {t.destinatario}
                  </p>

                  {/* Texto de razón */}
                  {t.texto_razon ? (
                    <div>
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={testimonioTexto}
                            onChange={e => setTestimonioTexto(e.target.value)}
                            rows={10}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/20"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleGuardarTexto(t.id)}
                              disabled={testimonioSaving}
                              className="px-3 py-1.5 text-xs font-medium bg-[#2d6bcf] text-white rounded-md hover:bg-[#2558a8] disabled:opacity-50"
                            >
                              {testimonioSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                            <button
                              onClick={() => setTestimonioEditando(null)}
                              className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div
                            className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto cursor-pointer hover:border-slate-300 transition-colors"
                            onClick={() => { setTestimonioEditando(t.id); setTestimonioTexto(t.texto_razon); }}
                            title="Click para editar"
                          >
                            {t.texto_razon}
                          </div>
                          {t.texto_editado && (
                            <p className="text-[10px] text-amber-600 mt-1">Texto editado manualmente</p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-3 border border-dashed border-slate-200 text-center">
                      Sin texto de razón generado
                      <button
                        onClick={() => handleRegenerarTexto(t.id)}
                        className="ml-2 text-[#2d6bcf] hover:underline font-medium"
                      >
                        Generar ahora
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* Editar Escritura Modal */}
      {showEditModal && (
        <EditarEscrituraModal
          escritura={escritura}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            setShowEditModal(false);
            await refetchEscritura();
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
        const memRes = await adminFetch('/api/admin/notariado/configuracion/membrete-base64');
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

        await adminFetch('/api/admin/notariado/avisos-generales', {
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

// ── Editar Escritura Modal ─────────────────────────────────────────────

interface EditForm {
  tipo_instrumento: string;
  tipo_instrumento_texto: string;
  descripcion: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;
  estado: string;
  hojas_protocolo: string;
  hojas_fotocopia: string;
  objeto_acto: string;
  valor_acto: string;
  notas: string;
}

interface EditComp {
  nombre: string;
  dpi: string;
  calidad: string;
  representacion: string;
  cliente_id: string | null;
}

function EditarEscrituraModal({
  escritura,
  onClose,
  onSaved,
}: {
  escritura: Escritura;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<EditForm>({
    tipo_instrumento: escritura.tipo_instrumento,
    tipo_instrumento_texto: escritura.tipo_instrumento_texto,
    descripcion: escritura.descripcion ?? '',
    fecha_autorizacion: escritura.fecha_autorizacion,
    lugar_autorizacion: escritura.lugar_autorizacion,
    departamento: escritura.departamento,
    estado: escritura.estado,
    hojas_protocolo: escritura.hojas_protocolo?.toString() ?? '',
    hojas_fotocopia: escritura.hojas_fotocopia?.toString() ?? '',
    objeto_acto: escritura.objeto_acto ?? '',
    valor_acto: escritura.valor_acto?.toString() ?? '',
    notas: escritura.notas ?? '',
  });
  const [comparecientes, setComparecientes] = useState<EditComp[]>(
    escritura.comparecientes.map((c: any) => ({
      nombre: c.nombre ?? '',
      dpi: c.dpi ?? '',
      calidad: c.calidad ?? 'otorgante',
      representacion: c.representacion ?? '',
      cliente_id: c.cliente_id ?? null,
    }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key: keyof EditForm, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleTipoChange = (value: string) => {
    const label = TIPO_INSTRUMENTO_LABEL[value as TipoInstrumento] ?? '';
    setForm(prev => ({ ...prev, tipo_instrumento: value, tipo_instrumento_texto: label }));
  };

  const addCompareciente = () =>
    setComparecientes(prev => [...prev, { nombre: '', dpi: '', calidad: 'otorgante', representacion: '', cliente_id: null }]);

  const removeCompareciente = (idx: number) => {
    if (comparecientes.length <= 1) return;
    setComparecientes(prev => prev.filter((_: EditComp, i: number) => i !== idx));
  };

  const updateComp = (idx: number, key: keyof EditComp, value: string) =>
    setComparecientes(prev => prev.map((c: EditComp, i: number) => i === idx ? { ...c, [key]: value } : c));

  const handleSave = async () => {
    if (!form.tipo_instrumento) { setError('Selecciona tipo de instrumento'); return; }
    if (!form.tipo_instrumento_texto.trim()) { setError('Ingresa la descripción del instrumento'); return; }
    if (!form.fecha_autorizacion) { setError('Ingresa la fecha de autorización'); return; }

    const validComps = comparecientes.filter((c: EditComp) => c.nombre.trim());
    if (validComps.length === 0) { setError('Agrega al menos un compareciente'); return; }

    setSaving(true);
    setError('');
    try {
      const body: Record<string, any> = {
        tipo_instrumento: form.tipo_instrumento,
        tipo_instrumento_texto: form.tipo_instrumento_texto,
        descripcion: form.descripcion || null,
        fecha_autorizacion: form.fecha_autorizacion,
        lugar_autorizacion: form.lugar_autorizacion,
        departamento: form.departamento,
        estado: form.estado !== escritura.estado ? form.estado : undefined,
        comparecientes: validComps,
        objeto_acto: form.objeto_acto || null,
        valor_acto: form.valor_acto ? parseFloat(form.valor_acto) : null,
        hojas_protocolo: form.hojas_protocolo ? parseInt(form.hojas_protocolo) : null,
        hojas_fotocopia: form.hojas_fotocopia ? parseInt(form.hojas_fotocopia) : null,
        notas: form.notas || null,
      };

      await adminFetch(`/api/admin/notariado/escrituras/${escritura.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      onSaved();
    } catch {
      setError('Error al guardar');
    }
    setSaving(false);
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/20 focus:border-[#2d6bcf]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-slate-900">Editar escritura {escritura.numero_texto}</h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Tipo de instrumento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo de instrumento</label>
              <select value={form.tipo_instrumento} onChange={e => handleTipoChange(e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {TIPO_OPTIONS.map((t: { value: string; label: string }) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Descripción del instrumento</label>
              <input type="text" value={form.tipo_instrumento_texto} onChange={e => updateField('tipo_instrumento_texto', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Descripción interna */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descripción interna</label>
            <input type="text" value={form.descripcion} onChange={e => updateField('descripcion', e.target.value)}
              placeholder="Ej: Compraventa de inmueble zona 10" className={inputCls} />
          </div>

          {/* Fecha, Lugar, Departamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha autorización</label>
              <input type="date" value={form.fecha_autorizacion} onChange={e => updateField('fecha_autorizacion', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Lugar autorización</label>
              <input type="text" value={form.lugar_autorizacion} onChange={e => updateField('lugar_autorizacion', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Departamento</label>
              <select value={form.departamento} onChange={e => updateField('departamento', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS.map((d: string) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Estado */}
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select value={form.estado} onChange={e => updateField('estado', e.target.value)} className={inputCls}>
              <option value="borrador">Borrador</option>
              <option value="autorizada">Autorizada</option>
              <option value="escaneada">Escaneada</option>
              <option value="con_testimonio">Con Testimonio</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Hojas, Objeto, Valor */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hojas protocolo</label>
              <input type="number" min="0" value={form.hojas_protocolo} onChange={e => updateField('hojas_protocolo', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Hojas fotocopia</label>
              <input type="number" min="0" value={form.hojas_fotocopia} onChange={e => updateField('hojas_fotocopia', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Valor del acto (Q)</label>
              <input type="number" min="0" step="0.01" value={form.valor_acto} onChange={e => updateField('valor_acto', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Objeto del acto</label>
              <input type="text" value={form.objeto_acto} onChange={e => updateField('objeto_acto', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Comparecientes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500">Comparecientes</label>
              <button onClick={addCompareciente} className="text-xs font-medium text-[#2d6bcf] hover:underline">+ Agregar</button>
            </div>
            <div className="space-y-3">
              {comparecientes.map((c: EditComp, i: number) => (
                <div key={i} className="border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={c.nombre} onChange={e => updateComp(i, 'nombre', e.target.value)}
                      placeholder="Nombre completo" className={`${inputCls} flex-1`} />
                    {comparecientes.length > 1 && (
                      <button onClick={() => removeCompareciente(i)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <input type="text" value={c.dpi} onChange={e => updateComp(i, 'dpi', e.target.value)}
                      placeholder="DPI" className={inputCls} />
                    <select value={c.calidad} onChange={e => updateComp(i, 'calidad', e.target.value)} className={inputCls}>
                      <option value="otorgante">Otorgante</option>
                      <option value="comprador">Comprador</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="mandante">Mandante</option>
                      <option value="mandatario">Mandatario</option>
                      <option value="donante">Donante</option>
                      <option value="donatario">Donatario</option>
                      <option value="arrendante">Arrendante</option>
                      <option value="arrendatario">Arrendatario</option>
                      <option value="mutuante">Mutuante</option>
                      <option value="mutuario">Mutuario</option>
                      <option value="poderdante">Poderdante</option>
                      <option value="apoderado">Apoderado</option>
                      <option value="representante_legal">Rep. Legal</option>
                      <option value="testador">Testador</option>
                      <option value="otro">Otro</option>
                    </select>
                    <input type="text" value={c.representacion} onChange={e => updateComp(i, 'representacion', e.target.value)}
                      placeholder="Representación (opcional)" className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notas internas</label>
            <textarea value={form.notas} onChange={e => updateField('notas', e.target.value)}
              rows={3} className={inputCls} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-2 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#2d6bcf] text-white text-sm font-semibold rounded-lg hover:bg-[#2558a8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
