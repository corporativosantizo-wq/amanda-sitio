// ============================================================================
// app/admin/notariado/avisos/page.tsx
// Avisos — tabs: Trimestrales | Generales
// ============================================================================

'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { generarAvisoTrimestral } from '@/lib/generators/aviso-trimestral';
import { generarAvisoGeneral, type TipoAviso } from '@/lib/generators/aviso-general';
import { saveAs } from 'file-saver';
import { safeWindowOpen } from '@/lib/utils/validate-url';

// ── Shared constants ────────────────────────────────────────────────────

const TRIMESTRES = [
  { value: 1, label: 'Primer Trimestre (Ene-Mar)' },
  { value: 2, label: 'Segundo Trimestre (Abr-Jun)' },
  { value: 3, label: 'Tercer Trimestre (Jul-Sep)' },
  { value: 4, label: 'Cuarto Trimestre (Oct-Dic)' },
] as const;

const TIPOS_AVISO: { value: TipoAviso; label: string }[] = [
  { value: 'cancelacion', label: 'Cancelación' },
  { value: 'aclaracion', label: 'Aclaración' },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'modificacion', label: 'Modificación' },
  { value: 'rescision', label: 'Rescisión' },
];

const anioActual = new Date().getFullYear();
const ANIOS = Array.from({ length: 5 }, (_, i) => anioActual - i);

interface EscrituraOption {
  id: string;
  numero: number;
  numero_texto: string;
  tipo_instrumento_texto: string;
  fecha_autorizacion: string;
  lugar_autorizacion: string;
  departamento: string;
  estado: string;
}

interface AvisoDoc {
  id: string;
  escritura_id: string;
  subcategoria: string | null;
  nombre_archivo: string;
  tamano_bytes: number | null;
  notas: string | null;
  created_at: string;
  escrituras: {
    numero: number;
    numero_texto: string;
    tipo_instrumento_texto: string;
    fecha_autorizacion: string;
    lugar_autorizacion: string;
    departamento: string;
  } | null;
}

// ── Helper to fetch membrete ────────────────────────────────────────────

async function fetchMembrete() {
  try {
    const res = await fetch('/api/admin/notariado/configuracion/membrete-base64');
    if (res.ok) {
      const json = await res.json();
      return json.membrete ?? undefined;
    }
  } catch { /* sin membrete */ }
  return undefined;
}

// ── Page ────────────────────────────────────────────────────────────────

export default function AvisosPage() {
  const [tab, setTab] = useState<'trimestrales' | 'generales'>('trimestrales');

  return (
    <div className="p-6 space-y-6">
      <div>
        <Link href="/admin/notariado" className="text-sm text-slate-500 hover:text-slate-700">← Notariado</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">Avisos</h1>
        <p className="text-sm text-slate-500 mt-1">Avisos trimestrales y generales para el Archivo General de Protocolos</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('trimestrales')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'trimestrales'
                ? 'border-[#2d6bcf] text-[#2d6bcf]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Avisos Trimestrales
          </button>
          <button
            onClick={() => setTab('generales')}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'generales'
                ? 'border-[#2d6bcf] text-[#2d6bcf]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Avisos Generales
          </button>
        </div>
      </div>

      {tab === 'trimestrales' ? <TabTrimestrales /> : <TabGenerales />}
    </div>
  );
}

// ── Tab: Avisos Trimestrales ────────────────────────────────────────────

function TabTrimestrales() {
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
      const mesInicio = (trimestre - 1) * 3 + 1;
      const mesFin = trimestre * 3;
      const fechaInicio = `${anio}-${String(mesInicio).padStart(2, '0')}-01`;
      const ultimoDia = new Date(anio, mesFin, 0).getDate();
      const fechaFin = `${anio}-${String(mesFin).padStart(2, '0')}-${ultimoDia}`;

      const res = await fetch(`/api/admin/notariado/escrituras?anio=${anio}&limit=500`);
      if (!res.ok) throw new Error('Error al consultar escrituras');

      const { data: todas } = await res.json();

      const escrituras = (todas ?? []).filter((e: any) => {
        const fecha = e.fecha_autorizacion;
        return fecha >= fechaInicio && fecha <= fechaFin;
      });

      const canceladas = escrituras.filter((e: any) => e.estado === 'cancelada').length;

      const membrete = await fetchMembrete();

      const blob = await generarAvisoTrimestral({
        trimestre,
        anio,
        escrituras: escrituras.map((e: any) => ({
          numero: e.numero,
          numero_texto: e.numero_texto,
          tipo_instrumento_texto: e.tipo_instrumento_texto,
          lugar_autorizacion: 'Guatemala',
          departamento: 'Guatemala',
          fecha_autorizacion: e.fecha_autorizacion,
          estado: e.estado,
        })),
        membrete,
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
  );
}

// ── Tab: Avisos Generales ───────────────────────────────────────────────

function TabGenerales() {
  const [avisos, setAvisos] = useState<AvisoDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchAvisos = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/notariado/avisos-generales');
      if (res.ok) {
        const data = await res.json();
        setAvisos(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchAvisos(); }, []);

  const tipoLabel = (sub: string | null) => {
    const found = TIPOS_AVISO.find((t) => t.value === sub);
    return found?.label ?? sub ?? '-';
  };

  const tipoBadge = (sub: string | null) => {
    const colors: Record<string, string> = {
      cancelacion: 'bg-red-100 text-red-700',
      aclaracion: 'bg-blue-100 text-blue-700',
      ampliacion: 'bg-green-100 text-green-700',
      modificacion: 'bg-amber-100 text-amber-700',
      rescision: 'bg-purple-100 text-purple-700',
    };
    return colors[sub ?? ''] ?? 'bg-slate-100 text-slate-700';
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' });

  const handleDownload = async (docId: string) => {
    try {
      const res = await fetch(`/api/admin/notariado/escrituras/documentos/download?id=${docId}`);
      if (!res.ok) { alert('Error al descargar'); return; }
      const { url } = await res.json();
      safeWindowOpen(url);
    } catch {
      alert('Error al descargar');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + New button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {avisos.length} aviso{avisos.length !== 1 ? 's' : ''} generado{avisos.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-[#1a2744] text-white text-sm font-medium rounded-lg hover:bg-[#243456] transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Aviso General
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando...</div>
        ) : avisos.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm text-slate-500">No hay avisos generales aún</p>
            <p className="text-xs text-slate-400 mt-1">Genera uno con el botón &quot;Nuevo Aviso General&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Escritura</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Tipo</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Archivo</th>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Fecha</th>
                  <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 w-20">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {avisos.map((aviso: AvisoDoc) => (
                  <tr key={aviso.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      {aviso.escrituras ? (
                        <Link
                          href={`/admin/notariado/escrituras/${aviso.escritura_id}`}
                          className="text-sm font-medium text-[#2d6bcf] hover:underline"
                        >
                          Esc. {aviso.escrituras.numero} — {aviso.escrituras.tipo_instrumento_texto}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-500">Escritura eliminada</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tipoBadge(aviso.subcategoria)}`}>
                        {tipoLabel(aviso.subcategoria)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{aviso.nombre_archivo}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-500">{fmtDate(aviso.created_at)}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDownload(aviso.id)}
                        className="p-2 text-slate-400 hover:text-[#2d6bcf] hover:bg-blue-50 rounded-lg transition-colors"
                        title="Descargar"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <NuevoAvisoGeneralModal
          onClose={() => setShowModal(false)}
          onCreated={fetchAvisos}
        />
      )}
    </div>
  );
}

// ── Modal: Nuevo Aviso General ──────────────────────────────────────────

function NuevoAvisoGeneralModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [escrituras, setEscrituras] = useState<EscrituraOption[]>([]);
  const [loadingEsc, setLoadingEsc] = useState(true);
  const [escrituraId, setEscrituraId] = useState('');
  const [tipoAviso, setTipoAviso] = useState<TipoAviso>('cancelacion');
  const [motivo, setMotivo] = useState('');
  const [fechaAviso, setFechaAviso] = useState(new Date().toISOString().split('T')[0]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all escrituras
  useEffect(() => {
    const fetchEscrituras = async () => {
      try {
        const res = await fetch(`/api/admin/notariado/escrituras?limit=500`);
        if (res.ok) {
          const { data } = await res.json();
          setEscrituras(data ?? []);
        }
      } catch { /* ignore */ }
      setLoadingEsc(false);
    };
    fetchEscrituras();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredEscrituras = useMemo(() => {
    if (!busqueda.trim()) return escrituras;
    const q = busqueda.toLowerCase();
    return escrituras.filter((e: EscrituraOption) =>
      String(e.numero).includes(q) ||
      e.tipo_instrumento_texto.toLowerCase().includes(q) ||
      e.numero_texto.toLowerCase().includes(q)
    );
  }, [escrituras, busqueda]);

  const selectedEscritura = escrituras.find((e: EscrituraOption) => e.id === escrituraId);

  const handleGenerar = async () => {
    if (!escrituraId || !selectedEscritura) {
      setError('Selecciona una escritura');
      return;
    }

    setGenerando(true);
    setError('');

    try {
      const membrete = await fetchMembrete();

      const blob = await generarAvisoGeneral({
        tipoAviso,
        motivo,
        fechaAviso,
        escritura: {
          numero: selectedEscritura.numero,
          fecha_autorizacion: selectedEscritura.fecha_autorizacion,
          lugar_autorizacion: selectedEscritura.lugar_autorizacion,
          departamento: selectedEscritura.departamento,
        },
        membrete,
      });

      // Save to file-saver for download
      const tipoLabel = tipoAviso.charAt(0).toUpperCase() + tipoAviso.slice(1);
      const filename = `Aviso-${tipoLabel}-Esc${selectedEscritura.numero}.docx`;
      saveAs(blob, filename);

      // Also save to DB for history
      const formData = new FormData();
      formData.append('archivo', new File([blob], filename, {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }));
      formData.append('escritura_id', escrituraId);
      formData.append('subcategoria', tipoAviso);
      formData.append('notas', motivo || `Aviso de ${tipoLabel}`);

      await fetch('/api/admin/notariado/avisos-generales', {
        method: 'POST',
        body: formData,
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al generar aviso');
      console.error(err);
    }
    setGenerando(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Nuevo Aviso General</h3>

        <div className="space-y-4">
          {/* Searchable escritura dropdown */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Escritura</label>
            {loadingEsc ? (
              <div className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-400">
                Cargando escrituras...
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] flex items-center justify-between"
                >
                  {selectedEscritura ? (
                    <span>
                      <span className="font-medium">Esc. {selectedEscritura.numero}</span>
                      <span className="text-slate-500 ml-2">— {selectedEscritura.tipo_instrumento_texto}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400">Seleccionar escritura...</span>
                  )}
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg">
                    <div className="p-2 border-b border-slate-100">
                      <input
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar por número o tipo..."
                        autoFocus
                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      {filteredEscrituras.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-slate-400">Sin resultados</div>
                      ) : (
                        filteredEscrituras.map((esc: EscrituraOption) => (
                          <button
                            key={esc.id}
                            type="button"
                            onClick={() => {
                              setEscrituraId(esc.id);
                              setDropdownOpen(false);
                              setBusqueda('');
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${
                              esc.id === escrituraId ? 'bg-blue-50' : ''
                            }`}
                          >
                            <span className="font-medium">Esc. {esc.numero}</span>
                            <span className="text-slate-500 ml-2">— {esc.tipo_instrumento_texto}</span>
                            {esc.estado === 'cancelada' && (
                              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-xs">Cancelada</span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de aviso</label>
            <select
              value={tipoAviso}
              onChange={(e) => setTipoAviso(e.target.value as TipoAviso)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf]"
            >
              {TIPOS_AVISO.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Motivo */}
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

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha del aviso</label>
            <input
              type="date"
              value={fechaAviso}
              onChange={(e) => setFechaAviso(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleGenerar}
            disabled={generando || !escrituraId}
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
