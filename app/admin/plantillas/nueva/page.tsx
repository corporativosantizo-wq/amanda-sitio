// ============================================================================
// app/admin/plantillas/nueva/page.tsx
// Wizard: subir .docx → análisis IA → editar campos → guardar plantilla
// ============================================================================
'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CampoDetectado {
  id: string;
  label: string;
  tipo: string;
  requerido: boolean;
  placeholder?: string;
  descripcion?: string;
}

type Step = 'upload' | 'analyzing' | 'review' | 'saving' | 'done';

const TIPOS_DOCUMENTO = [
  'contrato', 'demanda', 'acta', 'escritura', 'memorial', 'recurso', 'poder', 'otro',
];

const TIPOS_CAMPO = [
  { key: 'texto', label: 'Texto' },
  { key: 'persona', label: 'Persona (nombre)' },
  { key: 'numero', label: 'Número / Monto' },
  { key: 'fecha', label: 'Fecha' },
  { key: 'dpi', label: 'DPI / CUI' },
  { key: 'parrafo', label: 'Párrafo largo' },
  { key: 'seleccion', label: 'Selección' },
];

export default function NuevaPlantillaPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos del análisis / formulario
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('contrato');
  const [descripcion, setDescripcion] = useState('');
  const [campos, setCampos] = useState<CampoDetectado[]>([]);
  const [estructura, setEstructura] = useState('');
  const [storagePath, setStoragePath] = useState<string | null>(null);

  // ── Upload & Analysis ─────────────────────────────────────────────────

  const analizarArchivo = useCallback(async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setError('Solo se aceptan archivos .docx');
      return;
    }

    setError(null);
    setStep('analyzing');

    try {
      const formData = new FormData();
      formData.append('archivo', file);

      const res = await fetch('/api/admin/plantillas/analizar', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error ?? 'Error al analizar documento');
      }

      const data = await res.json();
      const a = data.analysis;

      setNombre(a.nombre || '');
      setTipo(a.tipo || 'otro');
      setDescripcion(a.descripcion || '');
      setCampos(a.campos || []);
      setEstructura(a.estructura || '');
      setStoragePath(data.storage_path || null);
      setStep('review');
    } catch (err: any) {
      setError(err.message);
      setStep('upload');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) analizarArchivo(file);
  }, [analizarArchivo]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analizarArchivo(file);
  }, [analizarArchivo]);

  // ── Campos management ─────────────────────────────────────────────────

  const updateCampo = (index: number, key: string, value: any) => {
    setCampos((prev: CampoDetectado[]) => prev.map((c: CampoDetectado, i: number) =>
      i === index ? { ...c, [key]: value } : c
    ));
  };

  const removeCampo = (index: number) => {
    setCampos((prev: CampoDetectado[]) => prev.filter((_: CampoDetectado, i: number) => i !== index));
  };

  const addCampo = () => {
    const id = `campo_${Date.now()}`;
    setCampos((prev: CampoDetectado[]) => [...prev, {
      id,
      label: 'Nuevo campo',
      tipo: 'texto',
      requerido: false,
    }]);
  };

  // ── Save ──────────────────────────────────────────────────────────────

  const guardar = async () => {
    if (!nombre.trim()) {
      setError('Nombre de la plantilla es requerido');
      return;
    }
    if (!estructura.trim()) {
      setError('La estructura del documento es requerida');
      return;
    }

    setError(null);
    setStep('saving');

    try {
      const res = await fetch('/api/admin/plantillas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nombre.trim(),
          tipo,
          descripcion: descripcion.trim() || null,
          campos,
          estructura,
          archivo_original: storagePath,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        throw new Error(err.error ?? 'Error al guardar');
      }

      setStep('done');
    } catch (err: any) {
      setError(err.message);
      setStep('review');
    }
  };

  // ── Crear manualmente (sin subir archivo) ─────────────────────────────

  const crearManual = () => {
    setNombre('');
    setTipo('contrato');
    setDescripcion('');
    setCampos([]);
    setEstructura('');
    setStoragePath(null);
    setStep('review');
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <button onClick={() => router.push('/admin/plantillas')} className="hover:text-[#0891B2]">
            Plantillas
          </button>
          <span>/</span>
          <span className="text-slate-700">Nueva plantilla</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Nueva plantilla</h1>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Step: Upload ───────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <div
            onDragOver={(e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#0891B2] bg-teal-50'
                : 'border-slate-300 hover:border-[#0891B2] hover:bg-slate-50'
            }`}
          >
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">
              Arrastra un archivo .docx aquí
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              o haz click para seleccionar un archivo
            </p>
            <p className="text-xs text-slate-400">
              El sistema analizará el documento con IA y detectará los campos variables automáticamente
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={crearManual}
              className="text-sm text-[#0891B2] hover:underline"
            >
              O crear plantilla manualmente sin subir archivo
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Analyzing ────────────────────────────────────────────── */}
      {step === 'analyzing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-12 h-12 border-2 border-slate-300 border-t-[#1E40AF] rounded-full animate-spin mx-auto mb-6" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            Analizando documento con IA...
          </h3>
          <p className="text-sm text-slate-500">
            Extrayendo texto y detectando campos variables. Esto puede tomar unos segundos.
          </p>
        </div>
      )}

      {/* ── Step: Review / Edit ────────────────────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-6">
          {/* Información general */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Información general</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nombre de la plantilla *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNombre(e.target.value)}
                  placeholder="Ej: Contrato de arrendamiento"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo de documento
                </label>
                <select
                  value={tipo}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTipo(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
                >
                  {TIPOS_DOCUMENTO.map((t: string) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descripción
                </label>
                <textarea
                  value={descripcion}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescripcion(e.target.value)}
                  placeholder="Descripción breve de para qué sirve esta plantilla"
                  rows={2}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Campos detectados */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">
                Campos variables ({campos.length})
              </h2>
              <button
                onClick={addCampo}
                className="px-3 py-1.5 text-xs font-medium text-[#0891B2] bg-teal-50 rounded-md hover:bg-teal-100 transition-colors"
              >
                + Agregar campo
              </button>
            </div>

            {campos.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                No se detectaron campos. Agrega campos manualmente o revisa la estructura.
              </p>
            ) : (
              <div className="space-y-3">
                {campos.map((campo: CampoDetectado, index: number) => (
                  <div
                    key={campo.id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <code className="text-xs text-teal-700 bg-teal-50 px-2 py-1 rounded font-mono min-w-[120px]">
                      {`{{${campo.id}}}`}
                    </code>
                    <input
                      type="text"
                      value={campo.label}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampo(index, 'label', e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
                      placeholder="Etiqueta del campo"
                    />
                    <select
                      value={campo.tipo}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCampo(index, 'tipo', e.target.value)}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2] w-40"
                    >
                      {TIPOS_CAMPO.map((tc: { key: string; label: string }) => (
                        <option key={tc.key} value={tc.key}>{tc.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs text-slate-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={campo.requerido}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCampo(index, 'requerido', e.target.checked)}
                        className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]/20"
                      />
                      Req.
                    </label>
                    <button
                      onClick={() => removeCampo(index)}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      title="Eliminar campo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Estructura / Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">
              Estructura del documento
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Los marcadores <code className="bg-teal-50 text-teal-700 px-1 rounded">{`{{campo}}`}</code> serán
              reemplazados con los datos al generar el documento.
            </p>

            {/* Preview con marcadores resaltados */}
            <div className="relative">
              <div
                className="absolute inset-0 px-4 py-3 text-sm font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden leading-relaxed"
                aria-hidden="true"
                dangerouslySetInnerHTML={{
                  __html: estructura
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(
                      /\{\{(\w+)\}\}/g,
                      '<mark class="bg-teal-100 text-teal-700 rounded px-0.5 font-semibold">{{$1}}</mark>'
                    ),
                }}
              />
              <textarea
                value={estructura}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEstructura(e.target.value)}
                className="relative w-full min-h-[400px] px-4 py-3 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-transparent text-transparent caret-slate-900 resize-y leading-relaxed"
                placeholder="Pega aquí la estructura del documento con marcadores {{campo_id}}"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push('/admin/plantillas')}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              className="px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] hover:opacity-90 transition-opacity"
            >
              Guardar plantilla
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Saving ───────────────────────────────────────────────── */}
      {step === 'saving' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-12 h-12 border-2 border-slate-300 border-t-[#1E40AF] rounded-full animate-spin mx-auto mb-6" />
          <h3 className="text-lg font-semibold text-slate-700">Guardando plantilla...</h3>
        </div>
      )}

      {/* ── Step: Done ─────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-16 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Plantilla guardada</h3>
          <p className="text-sm text-slate-500 mb-6">
            La plantilla &ldquo;{nombre}&rdquo; está lista. Ya puedes usarla desde el Asistente IA.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => router.push('/admin/plantillas')}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Ir a plantillas
            </button>
            <button
              onClick={() => {
                setStep('upload');
                setError(null);
                setNombre('');
                setTipo('contrato');
                setDescripcion('');
                setCampos([]);
                setEstructura('');
                setStoragePath(null);
              }}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2]"
            >
              Crear otra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
