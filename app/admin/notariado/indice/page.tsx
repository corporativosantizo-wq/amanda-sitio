// ============================================================================
// app/admin/notariado/indice/page.tsx
// Índice del Protocolo — Vista en pantalla + descarga DOCX
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { generarIndiceProtocolo } from '@/lib/generators/indice-protocolo';
import { saveAs } from 'file-saver';

interface EscrituraIndice {
  id: string;
  numero: number;
  numero_texto: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;
  tipo_instrumento_texto: string;
  estado: string;
  comparecientes: Array<{ nombre: string; calidad?: string }>;
  hojas_protocolo: number | null;
}

const anioActual = new Date().getFullYear();
const ANIOS = Array.from({ length: 5 }, (_, i) => anioActual - i);

export default function IndicePage() {
  const [anio, setAnio] = useState(anioActual);
  const [escrituras, setEscrituras] = useState<EscrituraIndice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [incluirRazon, setIncluirRazon] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/notariado/indice?anio=${anio}`)
      .then((res) => res.json())
      .then((json) => setEscrituras(json.data ?? []))
      .catch(() => setEscrituras([]))
      .finally(() => setLoading(false));
  }, [anio]);

  const handleDescargar = async () => {
    setGenerando(true);
    try {
      const blob = await generarIndiceProtocolo({
        anio,
        escrituras,
        incluirRazon,
      });
      saveAs(blob, `Indice-Protocolo-${anio}.docx`);
    } catch (err) {
      alert('Error al generar índice');
      console.error(err);
    }
    setGenerando(false);
  };

  const fmtFecha = (f: string) => {
    const d = new Date(f + 'T12:00:00');
    return d.toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' });
  };

  const totalHojas = escrituras.reduce((sum: number, e: EscrituraIndice) => sum + (e.hojas_protocolo ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <Link href="/admin/notariado" className="text-sm text-slate-500 hover:text-slate-700">← Notariado</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Índice del Protocolo</h1>
          <p className="text-sm text-slate-500 mt-1">
            {escrituras.length} escritura{escrituras.length !== 1 ? 's' : ''} — {totalHojas} hojas de protocolo
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
          >
            {ANIOS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={incluirRazon}
              onChange={(e) => setIncluirRazon(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#2d6bcf] focus:ring-[#2d6bcf]"
            />
            Incluir razón de cierre
          </label>

          <button
            onClick={handleDescargar}
            disabled={generando || escrituras.length === 0}
            className="px-4 py-2 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] disabled:bg-slate-300 transition-colors flex items-center gap-2"
          >
            {generando ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Descargar Índice DOCX
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : escrituras.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">📜</p>
            <p className="text-sm text-slate-500">No hay escrituras para el año {anio}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 w-16">No.</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Lugar y Fecha</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Otorgantes</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Objeto</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 w-20">Estado</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 w-16">Folio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escrituras.map((esc: EscrituraIndice) => (
                  <tr key={esc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm font-mono font-medium text-slate-900">{esc.numero}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{esc.lugar_autorizacion}, {fmtFecha(esc.fecha_autorizacion)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        {(esc.comparecientes ?? []).map((c: any, i: number) => (
                          <p key={i} className="text-sm text-slate-700">
                            {c.nombre}
                            {c.calidad && <span className="text-xs text-slate-400 ml-1">({c.calidad})</span>}
                          </p>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {esc.estado === 'cancelada' ? (
                        <span className="text-sm font-medium text-red-600">Cancelada</span>
                      ) : (
                        <span className="text-sm text-slate-700">{esc.tipo_instrumento_texto}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {esc.estado === 'cancelada' ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelada</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{esc.estado}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm text-slate-700">{esc.hojas_protocolo ?? '-'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
