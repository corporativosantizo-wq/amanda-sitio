// ============================================================================
// app/admin/notariado/configuracion/page.tsx
// Configuración de plantilla base (membrete) para documentos DOCX
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface MembreteConfig {
  membrete_path: string | null;
  membrete_width: number;
  membrete_height: number;
  previewUrl: string | null;
}

export default function ConfiguracionNotariadoPage() {
  const [config, setConfig] = useState<MembreteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(100);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/notariado/configuracion');
      if (!res.ok) throw new Error('Error al cargar configuración');
      const data = await res.json();
      setConfig(data);
      setWidth(data.membrete_width ?? 600);
      setHeight(data.membrete_height ?? 100);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('width', String(width));
      formData.append('height', String(height));

      const res = await fetch('/api/admin/notariado/configuracion', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al subir imagen');

      setSuccess('Membrete actualizado correctamente');
      if (fileRef.current) fileRef.current.value = '';
      await fetchConfig();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Eliminar el membrete actual? Los documentos se generarán sin encabezado.')) return;

    setDeleting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/admin/notariado/configuracion', { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');

      setSuccess('Membrete eliminado');
      await fetchConfig();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="h-4 bg-slate-200 rounded w-96" />
          <div className="h-64 bg-slate-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/notariado" className="text-sm text-slate-500 hover:text-slate-700">
          ← Notariado
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Configuración de Plantilla</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configura el membrete (encabezado) para los documentos DOCX generados
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {success}
        </div>
      )}

      {/* Current membrete preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Membrete Actual</h2>

        {config?.previewUrl ? (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <p className="text-xs text-slate-400 mb-2">Vista previa del encabezado:</p>
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.previewUrl}
                  alt="Membrete actual"
                  className="max-h-32 object-contain border border-slate-200 rounded"
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>Dimensiones en DOCX: {width} × {height} px</span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-600 hover:text-red-700 font-medium"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar membrete'}
                </button>
              </div>
            </div>

            {/* Info box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p className="font-medium mb-1">Documentos que usan este membrete:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Avisos Trimestrales</li>
                <li>Avisos Generales (cancelación, aclaración, etc.)</li>
                <li>Índice del Protocolo</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-slate-500">No hay membrete configurado</p>
            <p className="text-xs text-slate-400 mt-1">Los documentos se generarán sin encabezado</p>
          </div>
        )}
      </div>

      {/* Upload / Replace */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {config?.membrete_path ? 'Reemplazar Membrete' : 'Subir Membrete'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Imagen del encabezado
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#1a2744] file:text-white hover:file:bg-[#243456] file:cursor-pointer"
            />
            <p className="text-xs text-slate-400 mt-1">PNG o JPG, máximo 2MB. Se recomienda un ancho de 600px o más.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Ancho en DOCX (px)
              </label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                min={100}
                max={1200}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Alto en DOCX (px)
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                min={30}
                max={400}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
              />
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-2.5 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] disabled:bg-slate-300 transition-colors flex items-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Subiendo...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {config?.membrete_path ? 'Reemplazar Imagen' : 'Subir Imagen'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
