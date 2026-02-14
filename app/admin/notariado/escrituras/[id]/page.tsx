// ============================================================================
// app/admin/notariado/escrituras/[id]/page.tsx
// Vista de detalle de escritura con carpetas de documentos
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
  { key: 'borrador_docx', label: 'Borradores', icon: '📝', accept: '.docx,.doc', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'testimonio', label: 'Testimonios', icon: '📜', accept: '.pdf', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'aviso_trimestral', label: 'Avisos Trimestrales', icon: '📅', accept: '.pdf', color: 'bg-green-50 text-green-700 border-green-200' },
  { key: 'aviso_general', label: 'Avisos Generales', icon: '📋', accept: '.pdf', color: 'bg-purple-50 text-purple-700 border-purple-200' },
];

const SUBCATEGORIAS_AVISO = [
  { value: 'aclaracion', label: 'Aclaración' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'modificacion', label: 'Modificación' },
  { value: 'cancelacion', label: 'Cancelación' },
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

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="h-64 bg-slate-100 rounded-xl" />
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
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${ESTADO_BADGES[escritura.estado] ?? 'bg-slate-100'}`}>
            {escritura.estado}
          </span>
          <button
            onClick={() => setShowAvisoModal(true)}
            className="px-3 py-1.5 text-sm bg-[#1a2744] text-white rounded-lg hover:bg-[#243456] transition-colors"
          >
            Generar Aviso
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Datos Generales</p>
          <div className="space-y-1.5 text-sm">
            <p><span className="text-slate-500">Fecha:</span> <span className="font-medium">{new Date(escritura.fecha_autorizacion + 'T12:00:00').toLocaleDateString('es-GT', { dateStyle: 'long', timeZone: 'America/Guatemala' })}</span></p>
            <p><span className="text-slate-500">Lugar:</span> <span className="font-medium">{escritura.lugar_autorizacion}</span></p>
            <p><span className="text-slate-500">Departamento:</span> <span className="font-medium">{escritura.departamento}</span></p>
            {escritura.hojas_protocolo && <p><span className="text-slate-500">Hojas:</span> <span className="font-medium">{escritura.hojas_protocolo}</span></p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Comparecientes</p>
          <div className="space-y-1">
            {escritura.comparecientes.map((c: any, i: number) => (
              <p key={i} className="text-sm">
                <span className="font-medium">{c.nombre}</span>
                {c.calidad && <span className="text-slate-500 text-xs ml-1">({c.calidad})</span>}
              </p>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Notas</p>
          <p className="text-sm text-slate-600">{escritura.descripcion || escritura.notas || 'Sin notas'}</p>
          {escritura.cliente && (
            <p className="text-sm mt-2"><span className="text-slate-500">Cliente:</span> <span className="font-medium">{escritura.cliente.nombre}</span></p>
          )}
        </div>
      </div>

      {/* Document Folders */}
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
          {/* Upload area */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500">
              {carpetaActiva.key === 'borrador_docx' ? 'Archivos .docx y .doc' : 'Archivos PDF'}
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 text-sm bg-[#2d6bcf] text-white rounded-lg hover:bg-[#2558a8] disabled:bg-slate-300 transition-colors font-medium"
            >
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

          {/* File list */}
          {docsLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Cargando...</div>
          ) : documentos.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-3xl mb-2">{carpetaActiva.icon}</p>
              <p className="text-sm text-slate-500">No hay archivos en esta carpeta</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {documentos.map((doc: Documento) => (
                <div key={doc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-lg">
                      {doc.nombre_archivo.endsWith('.docx') || doc.nombre_archivo.endsWith('.doc') ? '📘' : '📄'}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{doc.nombre_archivo}</p>
                      <p className="text-xs text-slate-400">
                        {fmtSize(doc.tamano_bytes)} — {fmtDate(doc.created_at)}
                        {doc.subcategoria && <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{doc.subcategoria}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
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
        </div>
      </div>

      {/* Aviso General Modal */}
      {showAvisoModal && (
        <AvisoGeneralModal
          escritura={escritura}
          onClose={() => setShowAvisoModal(false)}
        />
      )}
    </div>
  );
}

// ── Aviso General Modal ────────────────────────────────────────────────

function AvisoGeneralModal({ escritura, onClose }: { escritura: Escritura; onClose: () => void }) {
  const [tipoAviso, setTipoAviso] = useState<TipoAviso>('cancelacion');
  const [motivo, setMotivo] = useState('');
  const [fechaAviso, setFechaAviso] = useState(new Date().toISOString().split('T')[0]);
  const [generando, setGenerando] = useState(false);

  const handleGenerar = async () => {
    setGenerando(true);
    try {
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
      });

      const tipoLabel = tipoAviso.charAt(0).toUpperCase() + tipoAviso.slice(1);
      saveAs(blob, `Aviso-${tipoLabel}-Esc${escritura.numero}.docx`);
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
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Generar Aviso General</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de aviso</label>
            <select
              value={tipoAviso}
              onChange={(e) => setTipoAviso(e.target.value as TipoAviso)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del aviso</label>
            <input
              type="date"
              value={fechaAviso}
              onChange={(e) => setFechaAviso(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGenerar}
            disabled={generando}
            className="flex-1 px-4 py-2.5 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] disabled:bg-slate-300 transition-colors"
          >
            {generando ? 'Generando...' : 'Generar y Descargar DOCX'}
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
