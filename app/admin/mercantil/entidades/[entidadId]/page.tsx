'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';

// ── Styles ─────────────────────────────────────────────────────────────────

const INPUT = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';
const LABEL = 'block text-xs font-medium text-slate-500 mb-1';
const BTN_PRIMARY = 'px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white hover:shadow-lg transition-all disabled:opacity-50';
const BTN_SECONDARY = 'px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors';

const TIPO_LABELS: Record<string, string> = {
  sociedad_anonima: 'Sociedad Anónima',
  sociedad_limitada: 'S.R.L.',
  empresa_individual: 'Empresa Individual',
  otra: 'Otra',
};

const ESTADO_BADGE: Record<string, string> = {
  borrador: 'bg-slate-100 text-slate-600',
  generado: 'bg-blue-50 text-blue-700',
  firmado: 'bg-green-50 text-green-700',
  inscrito: 'bg-cyan-50 text-cyan-700',
};

const TIPO_DOC_BADGE: Record<string, { bg: string; label: string }> = {
  escritura_constitutiva: { bg: 'bg-purple-50 text-purple-700', label: 'Escritura' },
  acta_asamblea: { bg: 'bg-blue-50 text-blue-700', label: 'Acta' },
  certificacion_acta: { bg: 'bg-amber-50 text-amber-700', label: 'Certificación' },
  nombramiento: { bg: 'bg-teal-50 text-teal-700', label: 'Nombramiento' },
  patente_comercio: { bg: 'bg-orange-50 text-orange-700', label: 'Patente' },
  modificacion_escritura: { bg: 'bg-indigo-50 text-indigo-700', label: 'Modificación' },
  otro: { bg: 'bg-slate-100 text-slate-600', label: 'Otro' },
};

// ── Types ──────────────────────────────────────────────────────────────────

interface Entidad {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  tipo_entidad: string;
  nit: string | null;
  registro_mercantil_numero: number | null;
  registro_mercantil_folio: number | null;
  registro_mercantil_libro: number | null;
  patente_comercio: string | null;
  escritura_numero: number | null;
  escritura_fecha: string | null;
  escritura_notario: string | null;
  escritura_archivo_url: string | null;
  representante_legal_nombre: string | null;
  representante_legal_cargo: string | null;
  representante_legal_registro: number | null;
  representante_legal_folio: number | null;
  representante_legal_libro: number | null;
  cliente_id: string | null;
  expediente_id: string | null;
  activa: boolean;
  notas: string | null;
}

interface Documento {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string | null;
  fecha_documento: string | null;
  numero_acta: number | null;
  tipo_asamblea: string | null;
  archivo_generado_url: string | null;
  archivo_generado_nombre: string | null;
  archivo_escaneado_url: string | null;
  archivo_escaneado_nombre: string | null;
  estado: string;
  created_at: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function EntidadDetallePage() {
  const router = useRouter();
  const params = useParams();
  const entidadId = params.entidadId as string;

  const { data: entidad, loading, refetch: refetchEntidad } = useFetch<Entidad>(
    `/api/admin/mercantil/entidades/${entidadId}`
  );
  const { data: documentos, refetch: refetchDocs } = useFetch<Documento[]>(
    `/api/admin/mercantil/entidades/${entidadId}/documentos`
  );
  const { mutate } = useMutate();

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Entidad>>({});

  const startEdit = useCallback(() => {
    if (!entidad) return;
    setForm({ ...entidad });
    setEditing(true);
  }, [entidad]);

  const saveEdit = async () => {
    await mutate(`/api/admin/mercantil/entidades/${entidadId}`, {
      method: 'PATCH',
      body: form,
      onSuccess: () => { setEditing(false); refetchEntidad(); },
    });
  };

  // Navigate to generators with entity precargada
  const goGenerar = (tipo: 'acta' | 'certificacion' | 'nombramiento') => {
    if (!entidad) return;
    const datos = {
      entidad_id: entidad.id,
      entidad: entidad.nombre,
      tipo_entidad: TIPO_LABELS[entidad.tipo_entidad] ?? entidad.tipo_entidad,
      representante_legal_nombre: entidad.representante_legal_nombre,
      representante_legal_cargo: entidad.representante_legal_cargo,
    };
    const routes = {
      acta: '/admin/mercantil/actas-asamblea',
      certificacion: '/admin/mercantil/certificacion-actas',
      nombramiento: '/admin/mercantil/nombramientos',
    };
    sessionStorage.setItem('precargados_entidad', JSON.stringify(datos));
    router.push(routes[tipo]);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
          <div className="h-48 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!entidad) {
    return (
      <div className="p-8 max-w-5xl mx-auto text-center py-20">
        <p className="text-slate-500">Entidad no encontrada</p>
      </div>
    );
  }

  const docs = documentos ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.push('/admin/mercantil/entidades')}
            className="text-xs text-slate-400 hover:text-slate-600 mb-2 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Entidades
          </button>
          <h1 className="text-2xl font-bold text-[#0F172A]">{entidad.nombre_corto ?? entidad.nombre}</h1>
          {entidad.nombre_corto && (
            <p className="text-sm text-slate-400 mt-0.5">{entidad.nombre}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!editing ? (
            <button onClick={startEdit} className={BTN_SECONDARY}>Editar</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className={BTN_SECONDARY}>Cancelar</button>
              <button onClick={saveEdit} className={BTN_PRIMARY}>Guardar</button>
            </>
          )}
        </div>
      </div>

      {/* ── Ficha de la entidad ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Col 1: Datos básicos */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Datos de la entidad</h3>
            <Field label="Tipo" value={TIPO_LABELS[entidad.tipo_entidad] ?? entidad.tipo_entidad}
              editing={editing} type="select"
              options={[
                { value: 'sociedad_anonima', label: 'Sociedad Anónima' },
                { value: 'sociedad_limitada', label: 'S.R.L.' },
                { value: 'empresa_individual', label: 'Empresa Individual' },
                { value: 'otra', label: 'Otra' },
              ]}
              editValue={form.tipo_entidad ?? ''}
              onChange={(v: string) => setForm({ ...form, tipo_entidad: v })}
            />
            <Field label="NIT" value={entidad.nit}
              editing={editing} editValue={form.nit ?? ''}
              onChange={(v: string) => setForm({ ...form, nit: v })}
            />
            <Field label="Patente de Comercio" value={entidad.patente_comercio}
              editing={editing} editValue={form.patente_comercio ?? ''}
              onChange={(v: string) => setForm({ ...form, patente_comercio: v })}
            />
          </div>

          {/* Col 2: Registro Mercantil + Escritura */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registro Mercantil</h3>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Número" value={entidad.registro_mercantil_numero?.toString()}
                editing={editing} editValue={form.registro_mercantil_numero?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, registro_mercantil_numero: v ? parseInt(v) : null })} type="number"
              />
              <Field label="Folio" value={entidad.registro_mercantil_folio?.toString()}
                editing={editing} editValue={form.registro_mercantil_folio?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, registro_mercantil_folio: v ? parseInt(v) : null })} type="number"
              />
              <Field label="Libro" value={entidad.registro_mercantil_libro?.toString()}
                editing={editing} editValue={form.registro_mercantil_libro?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, registro_mercantil_libro: v ? parseInt(v) : null })} type="number"
              />
            </div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">Escritura Constitutiva</h3>
            <Field label="Escritura #" value={entidad.escritura_numero?.toString()}
              editing={editing} editValue={form.escritura_numero?.toString() ?? ''}
              onChange={(v: string) => setForm({ ...form, escritura_numero: v ? parseInt(v) : null })} type="number"
            />
            <Field label="Notario" value={entidad.escritura_notario}
              editing={editing} editValue={form.escritura_notario ?? ''}
              onChange={(v: string) => setForm({ ...form, escritura_notario: v })}
            />
          </div>

          {/* Col 3: Representante legal */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Representante Legal</h3>
            <Field label="Nombre" value={entidad.representante_legal_nombre}
              editing={editing} editValue={form.representante_legal_nombre ?? ''}
              onChange={(v: string) => setForm({ ...form, representante_legal_nombre: v })}
            />
            <Field label="Cargo" value={entidad.representante_legal_cargo}
              editing={editing} editValue={form.representante_legal_cargo ?? ''}
              onChange={(v: string) => setForm({ ...form, representante_legal_cargo: v })}
            />
            <div className="grid grid-cols-3 gap-2">
              <Field label="Reg #" value={entidad.representante_legal_registro?.toString()}
                editing={editing} editValue={form.representante_legal_registro?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, representante_legal_registro: v ? parseInt(v) : null })} type="number"
              />
              <Field label="Folio" value={entidad.representante_legal_folio?.toString()}
                editing={editing} editValue={form.representante_legal_folio?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, representante_legal_folio: v ? parseInt(v) : null })} type="number"
              />
              <Field label="Libro" value={entidad.representante_legal_libro?.toString()}
                editing={editing} editValue={form.representante_legal_libro?.toString() ?? ''}
                onChange={(v: string) => setForm({ ...form, representante_legal_libro: v ? parseInt(v) : null })} type="number"
              />
            </div>
            {(entidad.cliente_id || entidad.expediente_id) && (
              <div className="pt-2 space-y-1">
                {entidad.cliente_id && (
                  <a href={`/admin/clientes/${entidad.cliente_id}`}
                    className="text-xs text-[#0891B2] hover:underline block">
                    Ver cliente vinculado →
                  </a>
                )}
                {entidad.expediente_id && (
                  <a href={`/admin/expedientes/${entidad.expediente_id}`}
                    className="text-xs text-[#0891B2] hover:underline block">
                    Ver expediente vinculado →
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones rápidas ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-400 mr-1">Generar:</span>
        <button onClick={() => goGenerar('acta')} className={BTN_SECONDARY + ' text-xs'}>
          Acta de asamblea
        </button>
        <button onClick={() => goGenerar('certificacion')} className={BTN_SECONDARY + ' text-xs'}>
          Certificación
        </button>
        <button onClick={() => goGenerar('nombramiento')} className={BTN_SECONDARY + ' text-xs'}>
          Nombramiento
        </button>
      </div>

      {/* ── Timeline de documentos ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#0F172A]">
            Documentos ({docs.length})
          </h2>
        </div>

        {docs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">Aún no hay documentos para esta entidad</p>
            <p className="text-xs text-slate-300 mt-1">Genera un acta, certificación o nombramiento para empezar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc: Documento) => {
              const tipoBadge = TIPO_DOC_BADGE[doc.tipo] ?? TIPO_DOC_BADGE.otro;
              return (
                <div key={doc.id} className="border border-slate-100 rounded-lg p-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoBadge.bg}`}>
                          {tipoBadge.label}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[doc.estado] ?? ESTADO_BADGE.borrador}`}>
                          {doc.estado}
                        </span>
                        {doc.fecha_documento && (
                          <span className="text-xs text-slate-400">
                            {new Date(doc.fecha_documento + 'T12:00:00').toLocaleDateString('es-GT')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800">{doc.titulo}</p>
                      {doc.descripcion && (
                        <p className="text-xs text-slate-400 mt-0.5">{doc.descripcion}</p>
                      )}
                    </div>

                    {/* File slots */}
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.archivo_generado_nombre && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded flex items-center gap-1" title={doc.archivo_generado_nombre}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          DOCX
                        </span>
                      )}
                      {doc.archivo_escaneado_nombre && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded flex items-center gap-1" title={doc.archivo_escaneado_nombre}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          PDF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Field component ────────────────────────────────────────────────────────

function Field({ label, value, editing, editValue, onChange, type = 'text', options }: {
  label: string;
  value: string | null | undefined;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
}) {
  if (editing && onChange) {
    if (type === 'select' && options) {
      return (
        <div>
          <label className={LABEL}>{label}</label>
          <select className={INPUT} value={editValue ?? ''} onChange={(e) => onChange(e.target.value)}>
            {options.map((o: { value: string; label: string }) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <div>
        <label className={LABEL}>{label}</label>
        <input
          className={INPUT}
          type={type}
          value={editValue ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <span className="text-sm text-slate-700">{value || '—'}</span>
    </div>
  );
}
