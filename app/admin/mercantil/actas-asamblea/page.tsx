'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';
import EntidadSelector, { type EntidadOption } from '@/components/admin/entidad-selector';

// ── Types ──────────────────────────────────────────────────────────────────

interface Accionista {
  nombre: string;
  representacion: string;
  acciones: string;
}

interface PuntoAgenda {
  titulo: string;
  resolucion: string;
}

interface EscrituraExtraida {
  entidad: string;
  tipo_entidad: string | null;
  accionistas: { nombre: string; representacion?: string; acciones?: string }[];
}

// ── Styles ─────────────────────────────────────────────────────────────────

const INPUT_CLASS = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
const LABEL_CLASS = 'block text-xs font-medium text-slate-500 mb-1';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'px-4 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50';

const ORDINALES = ['PRIMERO', 'SEGUNDO', 'TERCERO', 'CUARTO', 'QUINTO', 'SEXTO', 'SÉPTIMO', 'OCTAVO', 'NOVENO', 'DÉCIMO'];

// ── Component ──────────────────────────────────────────────────────────────

export default function ActasAsambleaPage() {
  const router = useRouter();

  // Entidad vinculada
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<EntidadOption | null>(null);

  // Entidad
  const [entidad, setEntidad] = useState('');
  const [tipoAsamblea, setTipoAsamblea] = useState('Asamblea General Ordinaria');
  const [numeroActa, setNumeroActa] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [hora, setHora] = useState('las diez horas');
  const [lugar, setLugar] = useState('la ciudad de Guatemala, departamento de Guatemala');

  // Accionistas
  const [accionistas, setAccionistas] = useState<Accionista[]>([
    { nombre: '', representacion: 'por sí', acciones: '' },
  ]);

  // Asamblea
  const [presidente, setPresidente] = useState('');
  const [secretario, setSecretario] = useState('');

  // Puntos de agenda
  const [puntos, setPuntos] = useState<PuntoAgenda[]>([
    { titulo: '', resolucion: '' },
  ]);

  // Upload escritura
  const escrituraInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // ── Handle entity selection ────────────────────────────────────────────
  const handleEntidadChange = (ent: EntidadOption | null) => {
    setEntidadSeleccionada(ent);
    if (ent) {
      setEntidad(ent.nombre);
      if (ent.representante_legal_nombre && !presidente) {
        setPresidente(ent.representante_legal_nombre);
      }
    }
  };

  // ── Create document record in entidad ─────────────────────────────────
  const registrarDocumento = async () => {
    if (!entidadSeleccionada) return;
    try {
      await adminFetch(`/api/admin/mercantil/entidades/${entidadSeleccionada.id}/documentos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'acta_asamblea',
          titulo: `Acta ${numeroActa || 'S/N'} — ${tipoAsamblea}`,
          fecha_documento: fecha,
          numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
          tipo_asamblea: tipoAsamblea,
          estado: 'generado',
        }),
      });
    } catch { /* silent — non-critical */ }
  };

  // ── Extract from escritura ──────────────────────────────────────────────

  const handleEscrituraUpload = async (file: File) => {
    setExtracting(true);
    setExtractError(null);
    try {
      const formData = new FormData();
      formData.append('archivo', file);
      const res = await adminFetch('/api/admin/mercantil/extraer-escritura', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al extraer datos');

      const d: EscrituraExtraida = json.datos;
      if (d.entidad) setEntidad(d.entidad);
      if (d.accionistas && d.accionistas.length > 0) {
        setAccionistas(d.accionistas.map((a: any) => ({
          nombre: a.nombre ?? '',
          representacion: a.representacion ?? 'por sí',
          acciones: a.acciones ?? '',
        })));
        // Auto-fill presidente with first accionista
        if (!presidente && d.accionistas[0]?.nombre) {
          setPresidente(d.accionistas[0].nombre);
        }
      }
    } catch (err: any) {
      setExtractError(err.message ?? 'Error al procesar la escritura');
    } finally {
      setExtracting(false);
    }
  };

  // ── Accionistas management ──────────────────────────────────────────────

  const addAccionista = () => {
    setAccionistas([...accionistas, { nombre: '', representacion: 'por sí', acciones: '' }]);
  };

  const removeAccionista = (idx: number) => {
    if (accionistas.length <= 1) return;
    setAccionistas(accionistas.filter((_: Accionista, i: number) => i !== idx));
  };

  const updateAccionista = (idx: number, field: keyof Accionista, value: string) => {
    setAccionistas(accionistas.map((a: Accionista, i: number) =>
      i === idx ? { ...a, [field]: value } : a
    ));
  };

  // ── Puntos management ──────────────────────────────────────────────────

  const addPunto = () => {
    setPuntos([...puntos, { titulo: '', resolucion: '' }]);
  };

  const removePunto = (idx: number) => {
    if (puntos.length <= 1) return;
    setPuntos(puntos.filter((_: PuntoAgenda, i: number) => i !== idx));
  };

  const updatePunto = (idx: number, field: keyof PuntoAgenda, value: string) => {
    setPuntos(puntos.map((p: PuntoAgenda, i: number) =>
      i === idx ? { ...p, [field]: value } : p
    ));
  };

  // ── Generate DOCX ──────────────────────────────────────────────────────

  const handleGenerar = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const payload = {
        entidad,
        tipo_asamblea: tipoAsamblea,
        numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
        fecha,
        hora,
        lugar,
        accionistas: accionistas.filter((a: Accionista) => a.nombre.trim()),
        presidente,
        secretario,
        puntos: puntos.filter((p: PuntoAgenda) => p.titulo.trim()),
      };

      const res = await adminFetch('/api/admin/mercantil/generar-acta-libro', {
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
      a.download = `Acta-${numeroActa || 'SN'}-${entidad.substring(0, 30)}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Auto-register in entity docs
      await registrarDocumento();
    } catch (err: any) {
      setGenError(err.message ?? 'Error al generar el acta');
    } finally {
      setGenerating(false);
    }
  };

  // ── Navigate to Generador 2 with precargados ────────────────────────────

  const handleCertificar = () => {
    const datosActa = {
      entidad,
      tipo_asamblea: tipoAsamblea,
      numero_acta: numeroActa ? parseInt(numeroActa, 10) : null,
      fecha_acta: fecha,
      hora_acta: hora,
      lugar_acta: lugar,
      presidente_asamblea: presidente,
      secretario_asamblea: secretario,
      puntos: puntos.filter((p: PuntoAgenda) => p.titulo.trim()).map((p: PuntoAgenda, i: number) => ({
        numero: i + 1,
        titulo: p.titulo,
        contenido_literal: p.resolucion,
      })),
    };
    sessionStorage.setItem('precargados_certificacion', JSON.stringify(datosActa));
    router.push('/admin/mercantil/certificacion-actas?precargados=1');
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#0F172A]">
            Actas de Asamblea
          </h1>
          <p className="text-slate-500 mt-1">
            Genera el acta de libro para la asamblea de la sociedad
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* ── Entidad selector ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <EntidadSelector value={entidadSeleccionada} onChange={handleEntidadChange} />
          {entidadSeleccionada && (
            <p className="text-xs text-slate-400 mt-2">
              Al generar, se registrará automáticamente en el expediente de esta entidad.
            </p>
          )}
        </div>

        {/* ── Escritura constitutiva (opcional) ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-[#0891B2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar desde escritura constitutiva
            <span className="text-xs font-normal text-slate-400">(opcional)</span>
          </h2>
          <p className="text-xs text-slate-400 mb-3">
            Sube el PDF o DOCX de la escritura para extraer automáticamente la entidad y los accionistas
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => escrituraInputRef.current?.click()}
              disabled={extracting}
              className={BTN_SECONDARY + ' flex items-center gap-2'}
            >
              {extracting ? (
                <>
                  <span className="w-4 h-4 border-2 border-[#0891B2] border-t-transparent rounded-full animate-spin" />
                  Extrayendo...
                </>
              ) : (
                'Subir escritura'
              )}
            </button>
            <input
              ref={escrituraInputRef}
              type="file"
              accept=".pdf,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleEscrituraUpload(file);
                e.target.value = '';
              }}
              className="hidden"
            />
            {extractError && (
              <span className="text-xs text-red-500">{extractError}</span>
            )}
          </div>
        </div>

        {/* ── Datos de la Entidad ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">1</span>
            Datos de la Asamblea
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Nombre de la entidad</label>
              <input className={INPUT_CLASS} value={entidad} onChange={(e) => setEntidad(e.target.value)} placeholder="Ejemplo, Sociedad Anónima" />
            </div>
            <div>
              <label className={LABEL_CLASS}>Tipo de asamblea</label>
              <select className={INPUT_CLASS} value={tipoAsamblea} onChange={(e) => setTipoAsamblea(e.target.value)}>
                <option value="Asamblea General Ordinaria">Asamblea General Ordinaria</option>
                <option value="Asamblea General Extraordinaria">Asamblea General Extraordinaria</option>
                <option value="Asamblea General Ordinaria Totalitaria">Asamblea General Ordinaria Totalitaria</option>
                <option value="Asamblea General Extraordinaria Totalitaria">Asamblea General Extraordinaria Totalitaria</option>
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>Número de acta</label>
              <input className={INPUT_CLASS} type="number" value={numeroActa} onChange={(e) => setNumeroActa(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Fecha</label>
              <input className={INPUT_CLASS} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Hora (texto)</label>
              <input className={INPUT_CLASS} value={hora} onChange={(e) => setHora(e.target.value)} placeholder="las diez horas" />
            </div>
            <div className="md:col-span-2">
              <label className={LABEL_CLASS}>Lugar</label>
              <input className={INPUT_CLASS} value={lugar} onChange={(e) => setLugar(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Presidente de la asamblea</label>
              <input className={INPUT_CLASS} value={presidente} onChange={(e) => setPresidente(e.target.value)} />
            </div>
            <div>
              <label className={LABEL_CLASS}>Secretario ad-hoc</label>
              <input className={INPUT_CLASS} value={secretario} onChange={(e) => setSecretario(e.target.value)} />
            </div>
          </div>
        </div>

        {/* ── Accionistas Presentes ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">2</span>
            Accionistas Presentes
            <button onClick={addAccionista} className="ml-auto text-xs text-[#0891B2] hover:underline font-medium">
              + Agregar accionista
            </button>
          </h2>
          <div className="space-y-3">
            {accionistas.map((acc: Accionista, idx: number) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-start">
                <div className="col-span-5">
                  {idx === 0 && <label className={LABEL_CLASS}>Nombre</label>}
                  <input
                    className={INPUT_CLASS}
                    value={acc.nombre}
                    onChange={(e) => updateAccionista(idx, 'nombre', e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="col-span-3">
                  {idx === 0 && <label className={LABEL_CLASS}>Representación</label>}
                  <input
                    className={INPUT_CLASS}
                    value={acc.representacion}
                    onChange={(e) => updateAccionista(idx, 'representacion', e.target.value)}
                    placeholder="por sí"
                  />
                </div>
                <div className="col-span-3">
                  {idx === 0 && <label className={LABEL_CLASS}>Acciones</label>}
                  <input
                    className={INPUT_CLASS}
                    value={acc.acciones}
                    onChange={(e) => updateAccionista(idx, 'acciones', e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  {idx === 0 && <label className={LABEL_CLASS}>&nbsp;</label>}
                  <button
                    onClick={() => removeAccionista(idx)}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Puntos de Agenda / Resoluciones ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-[#0891B2]/10 text-[#0891B2] rounded-full text-xs flex items-center justify-center font-bold">3</span>
            Puntos de Agenda y Resoluciones
            <button onClick={addPunto} className="ml-auto text-xs text-[#0891B2] hover:underline font-medium">
              + Agregar punto
            </button>
          </h2>
          <div className="space-y-4">
            {puntos.map((punto: PuntoAgenda, idx: number) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[#0891B2]">
                    {ORDINALES[idx] ?? `PUNTO ${idx + 1}`}
                  </span>
                  {puntos.length > 1 && (
                    <button
                      onClick={() => removePunto(idx)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <label className={LABEL_CLASS}>Título del punto</label>
                    <input
                      className={INPUT_CLASS}
                      value={punto.titulo}
                      onChange={(e) => updatePunto(idx, 'titulo', e.target.value)}
                      placeholder="Ej: Verificación de quórum, Nombramiento de Representante Legal..."
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLASS}>Texto de la resolución</label>
                    <textarea
                      className={INPUT_CLASS + ' min-h-[100px] resize-y'}
                      value={punto.resolucion}
                      onChange={(e) => updatePunto(idx, 'resolucion', e.target.value)}
                      placeholder="Texto completo de lo resuelto en este punto..."
                    />
                  </div>
                </div>
              </div>
            ))}
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleCertificar}
              disabled={!entidad || puntos.filter((p: PuntoAgenda) => p.titulo.trim()).length === 0}
              className={BTN_SECONDARY + ' flex items-center gap-1.5'}
            >
              Certificar esta acta
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
          <button
            onClick={handleGenerar}
            disabled={generating || !entidad || !presidente || !secretario || puntos.filter((p: PuntoAgenda) => p.titulo.trim()).length === 0}
            className={BTN_PRIMARY}
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generando...
              </span>
            ) : (
              'Generar acta DOCX'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
