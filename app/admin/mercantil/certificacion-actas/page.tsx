'use client';

import { useState, useRef, useCallback } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

// ── Types ──────────────────────────────────────────────────────────────────

interface Asistente {
  nombre: string;
  cargo: string;
  acciones?: string;
}

interface PuntoActa {
  numero: number;
  titulo: string;
  contenido_literal: string;
}

interface DatosExtraidos {
  entidad: string;
  tipo_entidad: string | null;
  tipo_asamblea: string | null;
  numero_acta: number | null;
  fecha_acta: string;
  hora_acta: string | null;
  lugar_acta: string | null;
  presidente_asamblea: string | null;
  secretario_asamblea: string | null;
  asistentes: Asistente[];
  puntos: PuntoActa[];
  quorum: string | null;
  convocatoria: string | null;
  notas: string | null;
}

interface BulkItem {
  file: File;
  status: 'pending' | 'extracting' | 'done' | 'error';
  datos: DatosExtraidos | null;
  error?: string;
  // Editable fields per item (for generation)
  requirenteNombre: string;
  requirenteDpi: string;
  requirenteCalidad: string;
  fechaCertificacion: string;
  lugarCertificacion: string;
  horaCertificacion: string;
  puntosSeleccionados: Set<number>;
}

// ── Styles ─────────────────────────────────────────────────────────────────

const INPUT_CLASS = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
const LABEL_CLASS = 'block text-xs font-medium text-slate-500 mb-1';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50';

// ── Component ──────────────────────────────────────────────────────────────

export default function CertificacionActasPage() {
  // Step management
  const [step, setStep] = useState<'upload' | 'form' | 'generating' | 'bulk' | 'bulk-edit'>('upload');

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Extracted data
  const [datos, setDatos] = useState<DatosExtraidos | null>(null);

  // Form state (editable fields)
  const [entidad, setEntidad] = useState('');
  const [tipoEntidad, setTipoEntidad] = useState('');
  const [numeroActa, setNumeroActa] = useState('');
  const [fechaActa, setFechaActa] = useState('');
  const [horaActa, setHoraActa] = useState('');
  const [lugarActa, setLugarActa] = useState('');
  const [presidenteAsamblea, setPresidenteAsamblea] = useState('');
  const [secretarioAsamblea, setSecretarioAsamblea] = useState('');
  const [convocatoria, setConvocatoria] = useState('');
  const [tipoAsamblea, setTipoAsamblea] = useState('');

  // Requirente
  const [requirenteNombre, setRequirenteNombre] = useState('');
  const [requirenteDpi, setRequirenteDpi] = useState('');
  const [requirenteCalidad, setRequirenteCalidad] = useState('');

  // Certificación
  const [fechaCertificacion, setFechaCertificacion] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [lugarCertificacion, setLugarCertificacion] = useState('la ciudad de Guatemala');
  const [horaCertificacion, setHoraCertificacion] = useState('las diez horas');

  // Puntos
  const [puntos, setPuntos] = useState<PuntoActa[]>([]);
  const [puntosSeleccionados, setPuntosSeleccionados] = useState<Set<number>>(new Set());

  // Bulk upload state
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkEditIndex, setBulkEditIndex] = useState<number | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Upload & Extract ───────────────────────────────────────────────────

  const handleFileSelect = async (file: File) => {
    setPdfFile(file);
    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('archivo', file);

      const res = await adminFetch('/api/admin/mercantil/extraer-acta', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al extraer datos');

      const d: DatosExtraidos = json.datos;
      setDatos(d);

      // Populate form fields
      setEntidad(d.entidad ?? '');
      setTipoEntidad(d.tipo_entidad ?? '');
      setNumeroActa(d.numero_acta?.toString() ?? '');
      setFechaActa(d.fecha_acta ?? '');
      setHoraActa(d.hora_acta ?? '');
      setLugarActa(d.lugar_acta ?? '');
      setPresidenteAsamblea(d.presidente_asamblea ?? '');
      setSecretarioAsamblea(d.secretario_asamblea ?? '');
      setConvocatoria(d.convocatoria ?? '');
      setTipoAsamblea(d.tipo_asamblea ?? '');
      setPuntos(d.puntos ?? []);

      // Auto-select all points
      const allNums = new Set((d.puntos ?? []).map((p: PuntoActa) => p.numero));
      setPuntosSeleccionados(allNums);

      // Auto-fill requirente from presidente if empty
      if (!requirenteNombre && d.presidente_asamblea) {
        setRequirenteNombre(d.presidente_asamblea);
        setRequirenteCalidad('Representante Legal');
      }

      setStep('form');
    } catch (err: any) {
      setUploadError(err.message ?? 'Error al procesar el archivo');
    } finally {
      setUploading(false);
    }
  };

  // ── Bulk Upload & Extract ────────────────────────────────────────────

  const extractDatos = useCallback(async (file: File): Promise<DatosExtraidos> => {
    const formData = new FormData();
    formData.append('archivo', file);
    const res = await adminFetch('/api/admin/mercantil/extraer-acta', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? 'Error al extraer datos');
    return json.datos;
  }, []);

  const handleBulkSelect = async (files: FileList) => {
    const today = new Date().toISOString().split('T')[0];
    const items: BulkItem[] = Array.from(files).map((file: File) => ({
      file,
      status: 'pending' as const,
      datos: null,
      requirenteNombre: '',
      requirenteDpi: '',
      requirenteCalidad: '',
      fechaCertificacion: today,
      lugarCertificacion: 'la ciudad de Guatemala',
      horaCertificacion: 'las diez horas',
      puntosSeleccionados: new Set<number>(),
    }));
    setBulkItems(items);
    setStep('bulk');

    // Process each file sequentially to avoid overwhelming the API
    for (let i = 0; i < items.length; i++) {
      setBulkItems((prev: BulkItem[]) =>
        prev.map((item: BulkItem, idx: number) =>
          idx === i ? { ...item, status: 'extracting' } : item
        )
      );
      try {
        const datos = await extractDatos(items[i].file);
        const allNums = new Set((datos.puntos ?? []).map((p: PuntoActa) => p.numero));
        setBulkItems((prev: BulkItem[]) =>
          prev.map((item: BulkItem, idx: number) =>
            idx === i
              ? {
                  ...item,
                  status: 'done',
                  datos,
                  puntosSeleccionados: allNums,
                  requirenteNombre: datos.presidente_asamblea ?? '',
                  requirenteCalidad: datos.presidente_asamblea ? 'Representante Legal' : '',
                }
              : item
          )
        );
      } catch (err: any) {
        setBulkItems((prev: BulkItem[]) =>
          prev.map((item: BulkItem, idx: number) =>
            idx === i ? { ...item, status: 'error', error: err.message } : item
          )
        );
      }
    }
  };

  const handleGenerarTodos = async () => {
    const readyItems = bulkItems.filter(
      (item: BulkItem) =>
        item.status === 'done' &&
        item.datos &&
        item.requirenteNombre &&
        item.requirenteCalidad &&
        item.puntosSeleccionados.size > 0
    );
    if (readyItems.length === 0) return;

    setGeneratingAll(true);
    for (const item of readyItems) {
      const d = item.datos!;
      const puntosACertificar = (d.puntos ?? [])
        .filter((p: PuntoActa) => item.puntosSeleccionados.has(p.numero))
        .map((p: PuntoActa) => ({
          numero: p.numero,
          titulo: p.titulo,
          contenido_literal: p.contenido_literal,
        }));

      const payload = {
        entidad: d.entidad,
        tipo_entidad: d.tipo_entidad || undefined,
        tipo_asamblea: d.tipo_asamblea || undefined,
        numero_acta: d.numero_acta,
        fecha_acta: d.fecha_acta,
        hora_acta: d.hora_acta || undefined,
        lugar_acta: d.lugar_acta || undefined,
        presidente_asamblea: d.presidente_asamblea || undefined,
        secretario_asamblea: d.secretario_asamblea || undefined,
        convocatoria: d.convocatoria || undefined,
        puntos_certificar: puntosACertificar,
        requirente: {
          nombre: item.requirenteNombre,
          dpi: item.requirenteDpi || undefined,
          calidad: item.requirenteCalidad,
        },
        fecha_certificacion: item.fechaCertificacion,
        lugar_certificacion: item.lugarCertificacion,
        hora_certificacion: item.horaCertificacion,
      };

      try {
        const res = await adminFetch('/api/admin/mercantil/generar-certificacion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const json = await res.json();
          throw new Error(json.error ?? 'Error al generar');
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Certificacion-Acta-${d.numero_acta || 'SN'}-${d.entidad.substring(0, 30)}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // Individual errors are silently skipped in bulk generation
      }
    }
    setGeneratingAll(false);
  };

  const handleBulkEditItem = (index: number) => {
    const item = bulkItems[index];
    if (!item.datos) return;
    const d = item.datos;
    setBulkEditIndex(index);

    // Populate form fields from bulk item
    setEntidad(d.entidad ?? '');
    setTipoEntidad(d.tipo_entidad ?? '');
    setNumeroActa(d.numero_acta?.toString() ?? '');
    setFechaActa(d.fecha_acta ?? '');
    setHoraActa(d.hora_acta ?? '');
    setLugarActa(d.lugar_acta ?? '');
    setPresidenteAsamblea(d.presidente_asamblea ?? '');
    setSecretarioAsamblea(d.secretario_asamblea ?? '');
    setConvocatoria(d.convocatoria ?? '');
    setTipoAsamblea(d.tipo_asamblea ?? '');
    setPuntos(d.puntos ?? []);
    setPuntosSeleccionados(new Set(item.puntosSeleccionados));
    setRequirenteNombre(item.requirenteNombre);
    setRequirenteDpi(item.requirenteDpi);
    setRequirenteCalidad(item.requirenteCalidad);
    setFechaCertificacion(item.fechaCertificacion);
    setLugarCertificacion(item.lugarCertificacion);
    setHoraCertificacion(item.horaCertificacion);
    setPdfFile(item.file);
    setDatos(d);
    setStep('bulk-edit');
  };

  const handleSaveBulkEdit = () => {
    if (bulkEditIndex === null) return;
    // Save edited fields back to bulk item
    setBulkItems((prev: BulkItem[]) =>
      prev.map((item: BulkItem, idx: number) => {
        if (idx !== bulkEditIndex) return item;
        return {
          ...item,
          datos: {
            ...item.datos!,
            entidad,
            tipo_entidad: tipoEntidad || null,
            tipo_asamblea: tipoAsamblea || null,
            numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
            fecha_acta: fechaActa,
            hora_acta: horaActa || null,
            lugar_acta: lugarActa || null,
            presidente_asamblea: presidenteAsamblea || null,
            secretario_asamblea: secretarioAsamblea || null,
            convocatoria: convocatoria || null,
            puntos,
          },
          requirenteNombre,
          requirenteDpi,
          requirenteCalidad,
          fechaCertificacion,
          lugarCertificacion,
          horaCertificacion,
          puntosSeleccionados: new Set(puntosSeleccionados),
        };
      })
    );
    setBulkEditIndex(null);
    setStep('bulk');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) {
      handleFileSelect(file);
    }
  };

  // ── Toggle punto ───────────────────────────────────────────────────────

  const togglePunto = (numero: number) => {
    setPuntosSeleccionados((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(numero)) next.delete(numero);
      else next.add(numero);
      return next;
    });
  };

  // ── Generate DOCX ─────────────────────────────────────────────────────

  const handleGenerar = async () => {
    if (puntosSeleccionados.size === 0) {
      setGenError('Selecciona al menos un punto a certificar.');
      return;
    }

    setGenerating(true);
    setGenError(null);

    try {
      const puntosACertificar = puntos
        .filter((p: PuntoActa) => puntosSeleccionados.has(p.numero))
        .map((p: PuntoActa) => ({
          numero: p.numero,
          titulo: p.titulo,
          contenido_literal: p.contenido_literal,
        }));

      const payload = {
        entidad,
        tipo_entidad: tipoEntidad || undefined,
        tipo_asamblea: tipoAsamblea || undefined,
        numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
        fecha_acta: fechaActa,
        hora_acta: horaActa || undefined,
        lugar_acta: lugarActa || undefined,
        presidente_asamblea: presidenteAsamblea || undefined,
        secretario_asamblea: secretarioAsamblea || undefined,
        convocatoria: convocatoria || undefined,
        puntos_certificar: puntosACertificar,
        requirente: {
          nombre: requirenteNombre,
          dpi: requirenteDpi || undefined,
          calidad: requirenteCalidad,
        },
        fecha_certificacion: fechaCertificacion,
        lugar_certificacion: lugarCertificacion,
        hora_certificacion: horaCertificacion,
      };

      const res = await adminFetch('/api/admin/mercantil/generar-certificacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? 'Error al generar');
      }

      // Download the DOCX
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificacion-Acta-${numeroActa || 'SN'}-${entidad.substring(0, 30)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGenError(err.message ?? 'Error al generar la certificación');
    } finally {
      setGenerating(false);
    }
  };

  // ── Reset ──────────────────────────────────────────────────────────────

  const handleReset = () => {
    setStep('upload');
    setPdfFile(null);
    setDatos(null);
    setUploadError(null);
    setGenError(null);
    setEntidad('');
    setTipoEntidad('');
    setNumeroActa('');
    setFechaActa('');
    setHoraActa('');
    setLugarActa('');
    setPresidenteAsamblea('');
    setSecretarioAsamblea('');
    setConvocatoria('');
    setTipoAsamblea('');
    setRequirenteNombre('');
    setRequirenteDpi('');
    setRequirenteCalidad('');
    setPuntos([]);
    setPuntosSeleccionados(new Set());
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F172A]">
            Certificación de Actas
          </h1>
          <p className="text-slate-500 mt-1">
            Sube el acta en PDF o DOCX, revisa los datos extraídos y genera la certificación notarial
          </p>
        </div>
        {step === 'form' && (
          <button onClick={handleReset} className={BTN_SECONDARY}>
            Nueva acta
          </button>
        )}
        {step === 'bulk' && (
          <button onClick={() => { setBulkItems([]); setStep('upload'); }} className={BTN_SECONDARY}>
            Nueva subida
          </button>
        )}
        {step === 'bulk-edit' && (
          <button onClick={handleSaveBulkEdit} className={BTN_SECONDARY}>
            Volver a lista
          </button>
        )}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
              uploading
                ? 'border-slate-200 bg-slate-50'
                : 'border-slate-300 hover:border-[#0891B2] hover:bg-slate-50'
            }`}
          >
            {uploading ? (
              <>
                <div className="w-10 h-10 border-4 border-[#0891B2] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-sm font-medium text-slate-700">
                  Extrayendo datos del acta con IA...
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Esto puede tomar unos segundos
                </p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm font-medium text-slate-700">
                  Arrastra el PDF o Word del acta aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Se extraerán automáticamente: entidad, número de acta, fecha, asistentes y puntos
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {uploadError && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {uploadError}
            </div>
          )}

          {/* Bulk upload button */}
          <div className="mt-4 flex items-center justify-center">
            <button
              onClick={() => bulkInputRef.current?.click()}
              className={BTN_SECONDARY + ' flex items-center gap-2'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Subida masiva
            </button>
            <input
              ref={bulkInputRef}
              type="file"
              accept=".pdf,.docx"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) handleBulkSelect(files);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* ── Bulk: Processing List ── */}
      {step === 'bulk' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Archivos procesados ({bulkItems.filter((i: BulkItem) => i.status === 'done').length}/{bulkItems.length})
            </h2>
            <button
              onClick={handleGenerarTodos}
              disabled={generatingAll || bulkItems.filter((i: BulkItem) => i.status === 'done').length === 0}
              className={BTN_PRIMARY + ' flex items-center gap-2'}
            >
              {generatingAll ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando...
                </>
              ) : (
                `Generar todos (${bulkItems.filter((i: BulkItem) => i.status === 'done').length})`
              )}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left">
                  <th className="py-2 px-3 text-xs font-medium text-slate-400">Archivo</th>
                  <th className="py-2 px-3 text-xs font-medium text-slate-400">Entidad</th>
                  <th className="py-2 px-3 text-xs font-medium text-slate-400">Acta</th>
                  <th className="py-2 px-3 text-xs font-medium text-slate-400">Fecha</th>
                  <th className="py-2 px-3 text-xs font-medium text-slate-400">Estado</th>
                  <th className="py-2 px-3 text-xs font-medium text-slate-400"></th>
                </tr>
              </thead>
              <tbody>
                {bulkItems.map((item: BulkItem, idx: number) => (
                  <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 px-3 text-slate-700 font-medium truncate max-w-[200px]">
                      {item.file.name}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.datos?.entidad ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.datos?.numero_acta ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.datos?.fecha_acta ?? '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.status === 'pending' && (
                        <span className="text-xs text-slate-400">Pendiente</span>
                      )}
                      {item.status === 'extracting' && (
                        <span className="flex items-center gap-1.5 text-xs text-[#0891B2]">
                          <span className="w-3 h-3 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin" />
                          Extrayendo...
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span className="text-xs text-green-600 font-medium">Listo</span>
                      )}
                      {item.status === 'error' && (
                        <span className="text-xs text-red-500" title={item.error}>Error</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {item.status === 'done' && (
                        <button
                          onClick={() => handleBulkEditItem(idx)}
                          className="text-xs text-[#0891B2] hover:underline font-medium"
                        >
                          Ver / Editar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step 2: Form (also used for bulk-edit) ── */}
      {(step === 'form' || step === 'bulk-edit') && datos && (
        <div className="space-y-6">
          {/* PDF badge */}
          {pdfFile && (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-sm text-slate-600">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 18h12a2 2 0 002-2V6l-4-4H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {pdfFile.name}
              <span className="text-slate-400">({(pdfFile.size / (1024 * 1024)).toFixed(1)} MB)</span>
            </div>
          )}

          {/* ── Datos de la Entidad ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">1</span>
              Datos de la Entidad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Nombre de la entidad</label>
                <input className={INPUT_CLASS} value={entidad} onChange={(e) => setEntidad(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo de entidad</label>
                <select className={INPUT_CLASS} value={tipoEntidad} onChange={(e) => setTipoEntidad(e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="Sociedad Anónima">Sociedad Anónima</option>
                  <option value="Sociedad de Responsabilidad Limitada">Sociedad de Responsabilidad Limitada</option>
                  <option value="Asociación">Asociación</option>
                  <option value="Fundación">Fundación</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo de asamblea</label>
                <select className={INPUT_CLASS} value={tipoAsamblea} onChange={(e) => setTipoAsamblea(e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="Asamblea General Ordinaria">Asamblea General Ordinaria</option>
                  <option value="Asamblea General Extraordinaria">Asamblea General Extraordinaria</option>
                  <option value="Asamblea Ordinaria">Asamblea Ordinaria</option>
                  <option value="Asamblea Extraordinaria">Asamblea Extraordinaria</option>
                  <option value="Junta Directiva">Junta Directiva</option>
                  <option value="Sesión de Junta Directiva">Sesión de Junta Directiva</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo de convocatoria</label>
                <select className={INPUT_CLASS} value={convocatoria} onChange={(e) => setConvocatoria(e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="totalitaria">Totalitaria</option>
                  <option value="primera">Primera convocatoria</option>
                  <option value="segunda">Segunda convocatoria</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Datos del Acta ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">2</span>
              Datos del Acta
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL_CLASS}>Número de acta</label>
                <input className={INPUT_CLASS} type="number" value={numeroActa} onChange={(e) => setNumeroActa(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Fecha del acta</label>
                <input className={INPUT_CLASS} type="date" value={fechaActa} onChange={(e) => setFechaActa(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Hora (texto)</label>
                <input className={INPUT_CLASS} value={horaActa} onChange={(e) => setHoraActa(e.target.value)} placeholder="las diez horas" />
              </div>
              <div className="md:col-span-3">
                <label className={LABEL_CLASS}>Lugar de la asamblea</label>
                <input className={INPUT_CLASS} value={lugarActa} onChange={(e) => setLugarActa(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Presidente de la asamblea</label>
                <input className={INPUT_CLASS} value={presidenteAsamblea} onChange={(e) => setPresidenteAsamblea(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Secretario de la asamblea</label>
                <input className={INPUT_CLASS} value={secretarioAsamblea} onChange={(e) => setSecretarioAsamblea(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Puntos del Acta ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">3</span>
              Puntos a Certificar
              <span className="ml-auto text-xs font-normal text-slate-400">
                {puntosSeleccionados.size} de {puntos.length} seleccionados
              </span>
            </h2>

            {puntos.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No se detectaron puntos en el acta
              </p>
            ) : (
              <div className="space-y-3">
                {puntos.map((punto: PuntoActa, idx: number) => {
                  const selected = puntosSeleccionados.has(punto.numero);
                  return (
                    <div
                      key={`${punto.numero}-${idx}`}
                      className={`border rounded-lg p-4 transition-all cursor-pointer ${
                        selected
                          ? 'border-[#0891B2] bg-[#0891B2]/5 ring-1 ring-[#0891B2]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => togglePunto(punto.numero)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? 'bg-[#0891B2] border-[#0891B2]' : 'border-slate-300'
                        }`}>
                          {selected && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-[#0891B2]">PUNTO {punto.numero}</span>
                            <span className="text-sm font-medium text-[#0F172A]">{punto.titulo}</span>
                          </div>
                          <textarea
                            className={`w-full text-xs text-slate-600 bg-transparent border border-slate-200 rounded-lg p-2 resize-y min-h-[60px] focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 ${
                              !selected ? 'opacity-50' : ''
                            }`}
                            value={punto.contenido_literal}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const newPuntos = [...puntos];
                              newPuntos[idx] = { ...punto, contenido_literal: e.target.value };
                              setPuntos(newPuntos);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Requirente ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">4</span>
              Datos del Requirente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Nombre completo</label>
                <input className={INPUT_CLASS} value={requirenteNombre} onChange={(e) => setRequirenteNombre(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>DPI (CUI)</label>
                <input className={INPUT_CLASS} value={requirenteDpi} onChange={(e) => setRequirenteDpi(e.target.value)} placeholder="1583 35198 0101" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Calidad en que actúa</label>
                <select className={INPUT_CLASS} value={requirenteCalidad} onChange={(e) => setRequirenteCalidad(e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="Representante Legal">Representante Legal</option>
                  <option value="Presidente">Presidente</option>
                  <option value="Secretario">Secretario</option>
                  <option value="Administrador Único">Administrador Único</option>
                  <option value="Gerente General">Gerente General</option>
                  <option value="Mandatario">Mandatario</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Datos de la Certificación ── */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">5</span>
              Datos de la Certificación
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL_CLASS}>Fecha de certificación</label>
                <input className={INPUT_CLASS} type="date" value={fechaCertificacion} onChange={(e) => setFechaCertificacion(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Lugar</label>
                <input className={INPUT_CLASS} value={lugarCertificacion} onChange={(e) => setLugarCertificacion(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Hora (texto)</label>
                <input className={INPUT_CLASS} value={horaCertificacion} onChange={(e) => setHoraCertificacion(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Error ── */}
          {genError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {genError}
            </div>
          )}

          {/* ── Actions ── */}
          <div className="flex items-center justify-between pt-2">
            {step === 'bulk-edit' ? (
              <button onClick={handleSaveBulkEdit} className={BTN_SECONDARY}>
                Volver a lista
              </button>
            ) : (
              <button onClick={handleReset} className={BTN_SECONDARY}>
                Cancelar
              </button>
            )}
            {step === 'bulk-edit' ? (
              <button onClick={handleSaveBulkEdit} className={BTN_PRIMARY}>
                Guardar cambios
              </button>
            ) : (
              <button
                onClick={handleGenerar}
                disabled={generating || !entidad || !requirenteNombre || !requirenteCalidad || puntosSeleccionados.size === 0}
                className={BTN_PRIMARY}
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </span>
                ) : (
                  `Generar certificación (${puntosSeleccionados.size} punto${puntosSeleccionados.size !== 1 ? 's' : ''})`
                )}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
