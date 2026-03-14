'use client';

import { useState, useRef, useEffect } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

// ── Types ──────────────────────────────────────────────────────────────────

interface Clausula {
  numero: string;
  titulo: string;
  contenido: string;
  seleccionada: boolean;
}

interface DatosEscritura {
  entidad: string;
  tipo_entidad: string | null;
  clausulas: { numero: string; titulo: string; contenido: string }[];
}

// ── Styles ─────────────────────────────────────────────────────────────────

const INPUT_CLASS = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
const LABEL_CLASS = 'block text-xs font-medium text-slate-500 mb-1';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50';

// Cláusulas recomendadas para nombramiento
const CLAUSULAS_RECOMENDADAS = ['objeto', 'administraci', 'representaci', 'nombramiento', 'primer'];

function esClausulaRecomendada(titulo: string): boolean {
  const t = titulo.toLowerCase();
  return CLAUSULAS_RECOMENDADAS.some((k: string) => t.includes(k));
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NombramientosPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ── Step 1: Escritura constitutiva ──
  const escrituraRef = useRef<HTMLInputElement>(null);
  const [extractingEscritura, setExtractingEscritura] = useState(false);
  const [escrituraError, setEscrituraError] = useState<string | null>(null);
  const [entidad, setEntidad] = useState('');
  const [tipoEntidad, setTipoEntidad] = useState('');
  const [clausulas, setClausulas] = useState<Clausula[]>([]);

  // ── Step 2: Certificación del acta ──
  const certRef = useRef<HTMLInputElement>(null);
  const [extractingCert, setExtractingCert] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const [numeroActa, setNumeroActa] = useState('');
  const [fechaActa, setFechaActa] = useState('');
  const [tipoAsamblea, setTipoAsamblea] = useState('');
  const [puntoResolutivo, setPuntoResolutivo] = useState('');

  // ── Step 3: Datos del requirente ──
  const [reqNombre, setReqNombre] = useState('');
  const [reqEdad, setReqEdad] = useState('');
  const [reqEstadoCivil, setReqEstadoCivil] = useState('');
  const [reqNacionalidad, setReqNacionalidad] = useState('guatemalteco');
  const [reqProfesion, setReqProfesion] = useState('');
  const [reqDpi, setReqDpi] = useState('');
  const [reqDireccion, setReqDireccion] = useState('');
  const [reqCalidad, setReqCalidad] = useState('');

  // Nombramiento
  const [cargoNombrado, setCargoNombrado] = useState('Representante Legal');
  const [nombreNombrado, setNombreNombrado] = useState('');

  // Cancelación
  const [conCancelacion, setConCancelacion] = useState(false);
  const [cancelNombre, setCancelNombre] = useState('');
  const [cancelCargo, setCancelCargo] = useState('');
  const [cancelRegistro, setCancelRegistro] = useState('');

  // ── Step 4: Certificación metadata ──
  const [fechaCert, setFechaCert] = useState(new Date().toISOString().split('T')[0]);
  const [lugarCert, setLugarCert] = useState('la ciudad de Guatemala');
  const [horaCert, setHoraCert] = useState('las diez horas');

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Check for precargados from Generador 2 ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('precargados_nombramiento');
      if (!raw) return;
      const datos = JSON.parse(raw);
      sessionStorage.removeItem('precargados_nombramiento');

      if (datos.entidad) setEntidad(datos.entidad);
      if (datos.tipo_entidad) setTipoEntidad(datos.tipo_entidad);
      if (datos.numero_acta) setNumeroActa(datos.numero_acta.toString());
      if (datos.fecha_acta) setFechaActa(datos.fecha_acta);
      if (datos.tipo_asamblea) setTipoAsamblea(datos.tipo_asamblea);
      if (datos.punto_resolutivo) setPuntoResolutivo(datos.punto_resolutivo);
      if (datos.requirente_nombre) setReqNombre(datos.requirente_nombre);
      if (datos.requirente_calidad) setReqCalidad(datos.requirente_calidad);
      if (datos.requirente_dpi) setReqDpi(datos.requirente_dpi);
    } catch { /* ignore */ }
  }, []);

  // ── Step 1: Extract escritura ──────────────────────────────────────────

  const handleEscrituraUpload = async (file: File) => {
    setExtractingEscritura(true);
    setEscrituraError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await adminFetch('/api/admin/mercantil/extraer-escritura', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al extraer datos');

      const d: DatosEscritura = json.datos;
      if (d.entidad) setEntidad(d.entidad);
      if (d.tipo_entidad) setTipoEntidad(d.tipo_entidad);

      if (d.clausulas && d.clausulas.length > 0) {
        setClausulas(d.clausulas.map((c: any) => ({
          numero: c.numero ?? '',
          titulo: c.titulo ?? '',
          contenido: c.contenido ?? '',
          seleccionada: esClausulaRecomendada(c.titulo ?? ''),
        })));
      }
    } catch (err: any) {
      setEscrituraError(err.message ?? 'Error al procesar la escritura');
    } finally {
      setExtractingEscritura(false);
    }
  };

  const toggleClausula = (idx: number) => {
    setClausulas(clausulas.map((c: Clausula, i: number) =>
      i === idx ? { ...c, seleccionada: !c.seleccionada } : c
    ));
  };

  // ── Step 2: Extract certificación ──────────────────────────────────────

  const handleCertUpload = async (file: File) => {
    setExtractingCert(true);
    setCertError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await adminFetch('/api/admin/mercantil/extraer-acta', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al extraer datos');

      const d = json.datos;
      if (d.numero_acta) setNumeroActa(d.numero_acta.toString());
      if (d.fecha_acta) setFechaActa(d.fecha_acta);
      if (d.tipo_asamblea) setTipoAsamblea(d.tipo_asamblea);
      if (d.presidente_asamblea && !reqNombre) setReqNombre(d.presidente_asamblea);
      // Combine all puntos into punto resolutivo
      if (d.puntos && d.puntos.length > 0) {
        const textoCompleto = d.puntos
          .map((p: any) => p.contenido_literal)
          .join(' ');
        setPuntoResolutivo(textoCompleto);
      }
    } catch (err: any) {
      setCertError(err.message ?? 'Error al procesar la certificación');
    } finally {
      setExtractingCert(false);
    }
  };

  // ── Generate DOCX ──────────────────────────────────────────────────────

  const handleGenerar = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const clausulasTranscritas = clausulas
        .filter((c: Clausula) => c.seleccionada)
        .map((c: Clausula) => ({
          numero: c.numero,
          titulo: c.titulo,
          contenido: c.contenido,
        }));

      const payload = {
        entidad,
        tipo_entidad: tipoEntidad || undefined,
        clausulas_transcritas: clausulasTranscritas,
        numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
        fecha_acta: fechaActa,
        tipo_asamblea: tipoAsamblea || undefined,
        punto_resolutivo: puntoResolutivo,
        requirente: {
          nombre: reqNombre,
          edad: reqEdad || undefined,
          estado_civil: reqEstadoCivil || undefined,
          nacionalidad: reqNacionalidad || undefined,
          profesion: reqProfesion || undefined,
          dpi: reqDpi || undefined,
          direccion: reqDireccion || undefined,
          calidad: reqCalidad,
        },
        cargo_nombrado: cargoNombrado,
        nombre_nombrado: nombreNombrado,
        cancelacion: conCancelacion ? {
          nombre_anterior: cancelNombre,
          cargo_anterior: cancelCargo,
          registro_rm: cancelRegistro || undefined,
        } : undefined,
        fecha_certificacion: fechaCert,
        lugar_certificacion: lugarCert,
        hora_certificacion: horaCert,
      };

      const res = await adminFetch('/api/admin/mercantil/generar-nombramiento', {
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
      a.download = `Nombramiento-${cargoNombrado.substring(0, 20)}-${entidad.substring(0, 25)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setGenError(err.message ?? 'Error al generar el nombramiento');
    } finally {
      setGenerating(false);
    }
  };

  // ── Step indicator ──────────────────────────────────────────────────────

  const steps = [
    { n: 1, label: 'Escritura' },
    { n: 2, label: 'Acta' },
    { n: 3, label: 'Requirente' },
    { n: 4, label: 'Generar' },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F172A]">
            Nombramientos
          </h1>
          <p className="text-slate-500 mt-1">
            Genera el acta notarial de nombramiento de representante legal
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8">
        {steps.map((s: { n: number; label: string }, idx: number) => (
          <div key={s.n} className="flex items-center gap-1">
            <button
              onClick={() => setStep(s.n as 1 | 2 | 3 | 4)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === s.n
                  ? 'bg-[#0891B2] text-white'
                  : step > s.n
                    ? 'bg-[#0891B2]/10 text-[#0891B2]'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border border-current/20">
                {step > s.n ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.n}
              </span>
              {s.label}
            </button>
            {idx < steps.length - 1 && (
              <div className={`w-6 h-px ${step > s.n ? 'bg-[#0891B2]' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ═══════════ Step 1: Escritura Constitutiva ═══════════ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
              Escritura Constitutiva
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Sube el PDF o DOCX de la escritura constitutiva para extraer las cláusulas
            </p>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => escrituraRef.current?.click()}
                disabled={extractingEscritura}
                className={BTN_SECONDARY + ' flex items-center gap-2'}
              >
                {extractingEscritura ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin" />
                    Extrayendo cláusulas...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Subir escritura constitutiva
                  </>
                )}
              </button>
              <input
                ref={escrituraRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleEscrituraUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              {escrituraError && <span className="text-xs text-red-500">{escrituraError}</span>}
            </div>

            {/* Entidad name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
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
            </div>

            {/* Cláusulas */}
            {clausulas.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">
                  Cláusulas extraídas — selecciona las que se deben transcribir
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {clausulas.map((c: Clausula, idx: number) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        c.seleccionada
                          ? 'border-[#0891B2] bg-[#0891B2]/5 ring-1 ring-[#0891B2]/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => toggleClausula(idx)}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          c.seleccionada ? 'bg-[#0891B2] border-[#0891B2]' : 'border-slate-300'
                        }`}>
                          {c.seleccionada && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0891B2]">{c.numero}</span>
                            <span className="text-sm font-medium text-[#0F172A]">{c.titulo}</span>
                            {esClausulaRecomendada(c.titulo) && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">
                                Recomendada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                            {c.contenido.substring(0, 200)}...
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep(2)} className={BTN_PRIMARY} disabled={!entidad}>
              Siguiente: Certificación del acta
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Step 2: Certificación del Acta ═══════════ */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-3">
              Certificación del Acta de Nombramiento
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Sube la certificación del acta o ingresa los datos manualmente
            </p>

            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => certRef.current?.click()}
                disabled={extractingCert}
                className={BTN_SECONDARY + ' flex items-center gap-2'}
              >
                {extractingCert ? (
                  <>
                    <span className="w-4 h-4 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin" />
                    Extrayendo...
                  </>
                ) : (
                  'Subir certificación de acta'
                )}
              </button>
              <input
                ref={certRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCertUpload(file);
                  e.target.value = '';
                }}
                className="hidden"
              />
              {certError && <span className="text-xs text-red-500">{certError}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className={LABEL_CLASS}>Número de acta</label>
                <input className={INPUT_CLASS} type="number" value={numeroActa} onChange={(e) => setNumeroActa(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Fecha del acta</label>
                <input className={INPUT_CLASS} type="date" value={fechaActa} onChange={(e) => setFechaActa(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Tipo de asamblea</label>
                <select className={INPUT_CLASS} value={tipoAsamblea} onChange={(e) => setTipoAsamblea(e.target.value)}>
                  <option value="">Sin especificar</option>
                  <option value="Asamblea General Ordinaria">Asamblea General Ordinaria</option>
                  <option value="Asamblea General Extraordinaria">Asamblea General Extraordinaria</option>
                  <option value="Asamblea Ordinaria">Asamblea Ordinaria</option>
                  <option value="Asamblea Extraordinaria">Asamblea Extraordinaria</option>
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS}>Punto resolutivo (texto literal)</label>
              <textarea
                className={INPUT_CLASS + ' min-h-[120px] resize-y'}
                value={puntoResolutivo}
                onChange={(e) => setPuntoResolutivo(e.target.value)}
                placeholder="Texto literal de lo resuelto en la asamblea respecto al nombramiento..."
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className={BTN_SECONDARY}>Anterior</button>
            <button onClick={() => setStep(3)} className={BTN_PRIMARY} disabled={!puntoResolutivo}>
              Siguiente: Datos del requirente
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Step 3: Datos del Requirente ═══════════ */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4">
              Datos del Requirente
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={LABEL_CLASS}>Nombre completo</label>
                <input className={INPUT_CLASS} value={reqNombre} onChange={(e) => setReqNombre(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Edad</label>
                <input className={INPUT_CLASS} value={reqEdad} onChange={(e) => setReqEdad(e.target.value)} placeholder="45 años" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Estado civil</label>
                <select className={INPUT_CLASS} value={reqEstadoCivil} onChange={(e) => setReqEstadoCivil(e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="soltero">Soltero/a</option>
                  <option value="casado">Casado/a</option>
                  <option value="unido de hecho">Unido/a de hecho</option>
                  <option value="divorciado">Divorciado/a</option>
                  <option value="viudo">Viudo/a</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Nacionalidad</label>
                <input className={INPUT_CLASS} value={reqNacionalidad} onChange={(e) => setReqNacionalidad(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Profesión u oficio</label>
                <input className={INPUT_CLASS} value={reqProfesion} onChange={(e) => setReqProfesion(e.target.value)} placeholder="Comerciante" />
              </div>
              <div>
                <label className={LABEL_CLASS}>DPI (CUI)</label>
                <input className={INPUT_CLASS} value={reqDpi} onChange={(e) => setReqDpi(e.target.value)} placeholder="1583 35198 0101" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Dirección</label>
                <input className={INPUT_CLASS} value={reqDireccion} onChange={(e) => setReqDireccion(e.target.value)} placeholder="ciudad de Guatemala" />
              </div>
              <div>
                <label className={LABEL_CLASS}>Calidad en que actúa</label>
                <select className={INPUT_CLASS} value={reqCalidad} onChange={(e) => setReqCalidad(e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="Administrador Único">Administrador Único</option>
                  <option value="Presidente del Consejo de Administración">Presidente del Consejo</option>
                  <option value="Representante Legal">Representante Legal</option>
                  <option value="Gerente General">Gerente General</option>
                  <option value="Mandatario">Mandatario</option>
                </select>
              </div>
            </div>
          </div>

          {/* Nombramiento */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4">
              Datos del Nombramiento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Cargo a nombrar</label>
                <select className={INPUT_CLASS} value={cargoNombrado} onChange={(e) => setCargoNombrado(e.target.value)}>
                  <option value="Representante Legal">Representante Legal</option>
                  <option value="Administrador Único">Administrador Único</option>
                  <option value="Presidente del Consejo de Administración">Presidente del Consejo</option>
                  <option value="Gerente General">Gerente General</option>
                </select>
              </div>
              <div>
                <label className={LABEL_CLASS}>Nombre del nombrado</label>
                <input className={INPUT_CLASS} value={nombreNombrado} onChange={(e) => setNombreNombrado(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Cancelación */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={conCancelacion}
                  onChange={(e) => setConCancelacion(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-[#0891B2]/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0891B2]"></div>
              </label>
              <span className="text-sm font-semibold text-[#0F172A]">
                Incluir cancelación de nombramiento anterior
              </span>
            </div>
            {conCancelacion && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={LABEL_CLASS}>Nombre del anterior</label>
                  <input className={INPUT_CLASS} value={cancelNombre} onChange={(e) => setCancelNombre(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Cargo que ostentaba</label>
                  <input className={INPUT_CLASS} value={cancelCargo} onChange={(e) => setCancelCargo(e.target.value)} placeholder="Representante Legal" />
                </div>
                <div>
                  <label className={LABEL_CLASS}>Registro en RM (núm, folio, libro)</label>
                  <input className={INPUT_CLASS} value={cancelRegistro} onChange={(e) => setCancelRegistro(e.target.value)} placeholder="número 123456, folio 789, libro 45 de Auxiliares de Comercio" />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className={BTN_SECONDARY}>Anterior</button>
            <button
              onClick={() => setStep(4)}
              className={BTN_PRIMARY}
              disabled={!reqNombre || !reqCalidad || !nombreNombrado}
            >
              Siguiente: Revisar y generar
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Step 4: Revisar y Generar ═══════════ */}
      {step === 4 && (
        <div className="space-y-6">
          {/* Resumen */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4">
              Resumen del Nombramiento
            </h2>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="text-slate-400">Entidad</div>
              <div className="font-medium text-slate-700">{entidad} {tipoEntidad && `(${tipoEntidad})`}</div>

              <div className="text-slate-400">Cláusulas transcritas</div>
              <div className="font-medium text-slate-700">
                {clausulas.filter((c: Clausula) => c.seleccionada).length} de {clausulas.length}
              </div>

              <div className="text-slate-400">Acta</div>
              <div className="font-medium text-slate-700">
                {numeroActa ? `Acta ${numeroActa}` : 'Sin número'} — {fechaActa || 'Sin fecha'}
              </div>

              <div className="text-slate-400">Requirente</div>
              <div className="font-medium text-slate-700">{reqNombre} ({reqCalidad})</div>

              <div className="text-slate-400">Nombrado</div>
              <div className="font-medium text-slate-700">{nombreNombrado} como {cargoNombrado}</div>

              {conCancelacion && (
                <>
                  <div className="text-slate-400">Cancelar</div>
                  <div className="font-medium text-slate-700">{cancelNombre} ({cancelCargo})</div>
                </>
              )}
            </div>
          </div>

          {/* Datos de la certificación */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-sm font-semibold text-[#0F172A] mb-4">
              Datos del Acta Notarial
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={LABEL_CLASS}>Fecha</label>
                <input className={INPUT_CLASS} type="date" value={fechaCert} onChange={(e) => setFechaCert(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Lugar</label>
                <input className={INPUT_CLASS} value={lugarCert} onChange={(e) => setLugarCert(e.target.value)} />
              </div>
              <div>
                <label className={LABEL_CLASS}>Hora (texto)</label>
                <input className={INPUT_CLASS} value={horaCert} onChange={(e) => setHoraCert(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Error */}
          {genError && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {genError}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button onClick={() => setStep(3)} className={BTN_SECONDARY}>Anterior</button>
            <button
              onClick={handleGenerar}
              disabled={generating || !entidad || !reqNombre || !nombreNombrado || !puntoResolutivo}
              className={BTN_PRIMARY}
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generando...
                </span>
              ) : (
                'Generar nombramiento DOCX'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
