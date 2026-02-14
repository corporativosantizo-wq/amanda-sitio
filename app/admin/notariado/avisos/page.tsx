// ============================================================================
// app/admin/notariado/avisos/page.tsx
// Generador de Avisos Trimestrales
// ============================================================================

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generarAvisoTrimestral } from '@/lib/generators/aviso-trimestral';
import { saveAs } from 'file-saver';

const TRIMESTRES = [
  { value: 1, label: 'Primer Trimestre (Ene-Mar)' },
  { value: 2, label: 'Segundo Trimestre (Abr-Jun)' },
  { value: 3, label: 'Tercer Trimestre (Jul-Sep)' },
  { value: 4, label: 'Cuarto Trimestre (Oct-Dic)' },
] as const;

const anioActual = new Date().getFullYear();
const ANIOS = Array.from({ length: 5 }, (_, i) => anioActual - i);

export default function AvisosPage() {
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(1);
  const [anio, setAnio] = useState(anioActual);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<{ total: number; canceladas: number } | null>(null);
  const [error, setError] = useState('');

  const handleGenerar = async () => {
    setGenerando(true);
    setError('');
    setResultado(null);

    try {
      // Fetch escrituras for the quarter
      const mesInicio = (trimestre - 1) * 3 + 1;
      const mesFin = trimestre * 3;
      const fechaInicio = `${anio}-${String(mesInicio).padStart(2, '0')}-01`;
      const ultimoDia = new Date(anio, mesFin, 0).getDate();
      const fechaFin = `${anio}-${String(mesFin).padStart(2, '0')}-${ultimoDia}`;

      // Use the existing API to get escrituras for the year
      const res = await fetch(`/api/admin/notariado/escrituras?anio=${anio}&limit=500`);
      if (!res.ok) throw new Error('Error al consultar escrituras');

      const { data: todas } = await res.json();

      // Filter by quarter dates
      const escrituras = (todas ?? []).filter((e: any) => {
        const fecha = e.fecha_autorizacion;
        return fecha >= fechaInicio && fecha <= fechaFin;
      });

      const canceladas = escrituras.filter((e: any) => e.estado === 'cancelada').length;

      // Generate DOCX
      const blob = await generarAvisoTrimestral({
        trimestre,
        anio,
        escrituras: escrituras.map((e: any) => ({
          numero: e.numero,
          numero_texto: e.numero_texto,
          tipo_instrumento_texto: e.tipo_instrumento_texto,
          lugar_autorizacion: 'Guatemala', // Default since list doesn't include this
          departamento: 'Guatemala',
          fecha_autorizacion: e.fecha_autorizacion,
          estado: e.estado,
        })),
      });

      const trimestreLabel = `Q${trimestre}`;
      saveAs(blob, `Aviso-Trimestral-${trimestreLabel}-${anio}.docx`);

      setResultado({ total: escrituras.length, canceladas });
    } catch (err: any) {
      setError(err.message || 'Error al generar aviso');
      console.error(err);
    }
    setGenerando(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/notariado" className="text-sm text-slate-500 hover:text-slate-700">← Notariado</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Avisos Trimestrales</h1>
        <p className="text-sm text-slate-500 mt-1">Genera avisos para el Archivo General de Protocolos</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Generar Aviso Trimestral</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Trimestre</label>
            <select
              value={trimestre}
              onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
            >
              {TRIMESTRES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
            >
              {ANIOS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {resultado && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Aviso generado con {resultado.total} escritura{resultado.total !== 1 ? 's' : ''}
              {resultado.canceladas > 0 && ` (${resultado.canceladas} cancelada${resultado.canceladas !== 1 ? 's' : ''})`}
            </div>
          )}

          <button
            onClick={handleGenerar}
            disabled={generando}
            className="w-full px-4 py-3 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
          >
            {generando ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                Generando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Generar y Descargar DOCX
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
