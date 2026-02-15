// ============================================================================
// app/admin/expedientes/[id]/page.tsx
// Detalle de expediente con tabs: Datos, Actuaciones, Plazos, Documentos, Vinculados
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { Section, Badge, Skeleton, EmptyState, Q } from '@/components/admin/ui';
import {
  Scale, Shield, Building2, Plus, Clock, AlertTriangle, Link2,
  FileText, ChevronRight, CheckCircle, XCircle, Calendar, Edit3, Save, X,
} from 'lucide-react';
import {
  type OrigenExpediente, type TipoProceso, type FaseExpediente,
  type RolClienteExpediente, type MonedaExpediente,
  type SedeActuacion, type TipoActuacion, type RealizadoPor,
  type TipoPlazo, type EstadoPlazo, type TipoVinculo,
  type ActuacionProcesal, type PlazoProcesal,
  ORIGEN_LABEL, ORIGEN_COLOR, TIPO_PROCESO_LABEL, FASE_LABEL,
  ROL_CLIENTE_LABEL, ESTADO_EXPEDIENTE_LABEL, ESTADO_EXPEDIENTE_COLOR,
  SEDE_LABEL, TIPO_ACTUACION_LABEL, REALIZADO_POR_LABEL,
  TIPO_PLAZO_LABEL, ESTADO_PLAZO_LABEL, ESTADO_PLAZO_COLOR,
  TIPO_VINCULO_LABEL, getFasesForOrigen,
  TIPOS_PROCESO_FISCAL, TIPOS_PROCESO_ADMINISTRATIVO, TIPOS_PROCESO_JUDICIAL,
  DEPARTAMENTOS_GUATEMALA,
} from '@/lib/types/expedientes';

// ── Types ─────────────────────────────────────────────────────────────────

interface ExpedienteDetalle {
  id: string;
  numero_expediente: string | null;
  numero_mp: string | null;
  numero_administrativo: string | null;
  cliente_id: string;
  origen: OrigenExpediente;
  tipo_proceso: TipoProceso;
  subtipo: string | null;
  fase_actual: FaseExpediente;
  fiscalia: string | null;
  agente_fiscal: string | null;
  entidad_administrativa: string | null;
  dependencia: string | null;
  monto_multa: number | null;
  resolucion_administrativa: string | null;
  juzgado: string | null;
  departamento: string | null;
  actor: string | null;
  demandado: string | null;
  rol_cliente: RolClienteExpediente | null;
  estado: string;
  fecha_inicio: string;
  fecha_ultima_actuacion: string | null;
  fecha_finalizacion: string | null;
  descripcion: string | null;
  notas_internas: string | null;
  monto_pretension: number | null;
  moneda: MonedaExpediente;
  created_at: string;
  updated_at: string;
  cliente: {
    id: string; codigo: string; nombre: string; nit: string | null;
    tipo: string; email: string | null; telefono: string | null;
    grupo_empresarial_id: string | null;
  };
}

interface VinculadoRow {
  id: string;
  expediente_origen_id: string;
  expediente_destino_id: string;
  tipo_vinculo: TipoVinculo;
  descripcion: string | null;
  direccion: 'origen' | 'destino';
  expediente_vinculado: {
    id: string;
    numero_expediente: string | null;
    numero_mp: string | null;
    numero_administrativo: string | null;
    origen: OrigenExpediente;
    tipo_proceso: TipoProceso;
    estado: string;
  } | null;
}

interface ExpedienteData {
  expediente: ExpedienteDetalle;
  actuaciones: ActuacionProcesal[];
  plazos: PlazoProcesal[];
  vinculados: VinculadoRow[];
}

type TabKey = 'datos' | 'actuaciones' | 'plazos' | 'documentos' | 'vinculados';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'datos', label: 'Datos', icon: <FileText size={14} /> },
  { key: 'actuaciones', label: 'Actuaciones', icon: <Clock size={14} /> },
  { key: 'plazos', label: 'Plazos', icon: <AlertTriangle size={14} /> },
  { key: 'documentos', label: 'Documentos', icon: <FileText size={14} /> },
  { key: 'vinculados', label: 'Vinculados', icon: <Link2 size={14} /> },
];

const INPUT = 'w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';
const SELECT = `${INPUT} bg-white`;

const OrigenIcon = ({ origen, size = 16 }: { origen: OrigenExpediente; size?: number }) => {
  switch (origen) {
    case 'judicial': return <Scale size={size} />;
    case 'fiscal': return <Shield size={size} />;
    case 'administrativo': return <Building2 size={size} />;
  }
};

function getNumeroDisplay(e: ExpedienteDetalle): string {
  const nums: string[] = [];
  if (e.numero_expediente) nums.push(e.numero_expediente);
  if (e.numero_mp) nums.push(`MP: ${e.numero_mp}`);
  if (e.numero_administrativo) nums.push(`Admin: ${e.numero_administrativo}`);
  return nums.join(' / ') || '—';
}

function getSedeDisplay(e: ExpedienteDetalle): string {
  if (e.juzgado) return e.juzgado;
  if (e.fiscalia) return e.fiscalia;
  if (e.entidad_administrativa) return e.entidad_administrativa;
  return '—';
}

// ── Field display ───────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function ExpedienteDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data, loading, error, refetch } = useFetch<ExpedienteData>(
    `/api/admin/expedientes/${id}`
  );
  const { mutate, loading: saving } = useMutate();

  const [tab, setTab] = useState<TabKey>('datos');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  const e = data?.expediente;
  const actuaciones = data?.actuaciones ?? [];
  const plazos = data?.plazos ?? [];
  const vinculados = data?.vinculados ?? [];

  // Count plazos pendientes/vencidos for badge
  const hoy = new Date().toISOString().slice(0, 10);
  const plazosPendientes = plazos.filter(p => p.estado === 'pendiente').length;
  const plazosVencidos = plazos.filter(
    p => p.estado === 'pendiente' && p.fecha_vencimiento < hoy
  ).length;

  // ── Edit handlers ─────────────────────────────────────────────────────

  const startEdit = useCallback(() => {
    if (!e) return;
    setForm({
      numero_expediente: e.numero_expediente ?? '',
      numero_mp: e.numero_mp ?? '',
      numero_administrativo: e.numero_administrativo ?? '',
      origen: e.origen,
      tipo_proceso: e.tipo_proceso,
      fase_actual: e.fase_actual,
      juzgado: e.juzgado ?? '',
      departamento: e.departamento ?? '',
      fiscalia: e.fiscalia ?? '',
      agente_fiscal: e.agente_fiscal ?? '',
      entidad_administrativa: e.entidad_administrativa ?? '',
      dependencia: e.dependencia ?? '',
      monto_multa: e.monto_multa != null ? String(e.monto_multa) : '',
      resolucion_administrativa: e.resolucion_administrativa ?? '',
      actor: e.actor ?? '',
      demandado: e.demandado ?? '',
      rol_cliente: e.rol_cliente ?? '',
      estado: e.estado,
      fecha_inicio: e.fecha_inicio,
      fecha_finalizacion: e.fecha_finalizacion ?? '',
      descripcion: e.descripcion ?? '',
      notas_internas: e.notas_internas ?? '',
      monto_pretension: e.monto_pretension != null ? String(e.monto_pretension) : '',
      moneda: e.moneda,
    });
    setEditing(true);
    setSaveError(null);
  }, [e]);

  const cancelEdit = () => { setEditing(false); setSaveError(null); };

  const saveEdit = useCallback(async () => {
    setSaveError(null);
    const body: Record<string, unknown> = {};
    const strFields = [
      'numero_expediente', 'numero_mp', 'numero_administrativo',
      'tipo_proceso', 'fase_actual', 'juzgado', 'departamento',
      'fiscalia', 'agente_fiscal', 'entidad_administrativa', 'dependencia',
      'resolucion_administrativa', 'actor', 'demandado', 'rol_cliente',
      'estado', 'fecha_inicio', 'fecha_finalizacion', 'descripcion',
      'notas_internas', 'moneda',
    ];
    for (const f of strFields) {
      body[f] = form[f]?.trim() || null;
    }
    body.monto_multa = form.monto_multa ? parseFloat(form.monto_multa) : null;
    body.monto_pretension = form.monto_pretension ? parseFloat(form.monto_pretension) : null;

    await mutate(`/api/admin/expedientes/${id}`, {
      method: 'PATCH',
      body,
      onSuccess: () => { setEditing(false); refetch(); },
      onError: (err) => setSaveError(err),
    });
  }, [form, id, mutate, refetch]);

  const set = (key: string) => (
    ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [key]: ev.target.value }));

  // ── Loading / Error ───────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-4 max-w-5xl p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (error || !e) return (
    <div className="p-6">
      <EmptyState icon="❌" title="Expediente no encontrado"
        action={{ label: 'Volver a expedientes', onClick: () => router.push('/admin/expedientes') }} />
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Breadcrumb + Header */}
      <div>
        <button onClick={() => router.push('/admin/expedientes')}
          className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          ← Expedientes
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ORIGEN_COLOR[e.origen]}`}>
              <OrigenIcon origen={e.origen} size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 font-mono">
                {getNumeroDisplay(e)}
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ORIGEN_COLOR[e.origen]}`}>
                  {ORIGEN_LABEL[e.origen]}
                </span>
                <span>{TIPO_PROCESO_LABEL[e.tipo_proceso]}</span>
                <span>·</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_EXPEDIENTE_COLOR[e.estado]}`}>
                  {ESTADO_EXPEDIENTE_LABEL[e.estado]}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Fase actual" value={FASE_LABEL[e.fase_actual]} />
        <SummaryCard label="Sede" value={getSedeDisplay(e)} />
        <SummaryCard label="Cliente" value={e.cliente.nombre}
          sub={e.cliente.codigo}
          link={`/admin/clientes/${e.cliente.id}`} />
        <SummaryCard label="Plazos pendientes"
          value={String(plazosPendientes)}
          accent={plazosVencidos > 0 ? 'red' : plazosPendientes > 0 ? 'amber' : undefined}
          sub={plazosVencidos > 0 ? `${plazosVencidos} vencido${plazosVencidos > 1 ? 's' : ''}` : undefined} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px inline-flex items-center gap-1.5 ${
              tab === t.key
                ? 'border-[#0891B2] text-[#0891B2]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon}{t.label}
            {t.key === 'actuaciones' && actuaciones.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{actuaciones.length}</span>
            )}
            {t.key === 'plazos' && plazosPendientes > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                plazosVencidos > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>{plazosPendientes}</span>
            )}
            {t.key === 'vinculados' && vinculados.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{vinculados.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'datos' && (
        <TabDatos exp={e} editing={editing} form={form} set={set}
          onStartEdit={startEdit} onCancel={cancelEdit} onSave={saveEdit}
          saving={saving} saveError={saveError} />
      )}
      {tab === 'actuaciones' && (
        <TabActuaciones actuaciones={actuaciones} expedienteId={id}
          origen={e.origen} mutate={mutate} refetch={refetch} />
      )}
      {tab === 'plazos' && (
        <TabPlazos plazos={plazos} expedienteId={id}
          mutate={mutate} refetch={refetch} />
      )}
      {tab === 'documentos' && (
        <TabDocumentos expedienteId={id} />
      )}
      {tab === 'vinculados' && (
        <TabVinculados vinculados={vinculados} expedienteId={id}
          mutate={mutate} refetch={refetch} />
      )}
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, accent, link }: {
  label: string; value: string; sub?: string;
  accent?: 'red' | 'amber'; link?: string;
}) {
  const inner = (
    <div className={`rounded-xl p-4 border ${
      accent === 'red' ? 'border-red-200 bg-red-50' :
      accent === 'amber' ? 'border-amber-200 bg-amber-50' :
      'border-slate-200 bg-white'
    } shadow-sm`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-semibold mt-1 ${
        accent === 'red' ? 'text-red-700' :
        accent === 'amber' ? 'text-amber-700' :
        'text-slate-900'
      } truncate`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
  if (link) return <Link href={link} className="hover:shadow-md transition-shadow rounded-xl">{inner}</Link>;
  return inner;
}

// ── Tab: Datos ───────────────────────────────────────────────────────────

function TabDatos({ exp, editing, form, set, onStartEdit, onCancel, onSave, saving, saveError }: {
  exp: ExpedienteDetalle; editing: boolean; form: Record<string, string>;
  set: (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onStartEdit: () => void; onCancel: () => void; onSave: () => void;
  saving: boolean; saveError: string | null;
}) {
  const origen = editing ? (form.origen as OrigenExpediente) : exp.origen;
  const fases = getFasesForOrigen(origen);
  const tiposProceso = origen === 'fiscal' ? TIPOS_PROCESO_FISCAL
    : origen === 'administrativo' ? TIPOS_PROCESO_ADMINISTRATIVO
    : TIPOS_PROCESO_JUDICIAL;

  return (
    <div className="space-y-5">
      {/* Edit toggle */}
      <div className="flex justify-end gap-2">
        {editing ? (
          <>
            <button onClick={onCancel} disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <X size={14} /> Cancelar
            </button>
            <button onClick={onSave} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        ) : (
          <button onClick={onStartEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            <Edit3 size={14} /> Editar
          </button>
        )}
      </div>

      {saveError && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {saveError}
        </div>
      )}

      {/* Números */}
      <Section title="Números de expediente">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">No. Expediente Judicial</label>
              <input value={form.numero_expediente} onChange={set('numero_expediente')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">No. MP</label>
              <input value={form.numero_mp} onChange={set('numero_mp')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">No. Administrativo</label>
              <input value={form.numero_administrativo} onChange={set('numero_administrativo')} className={INPUT} />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="No. Expediente" value={exp.numero_expediente} />
            <Field label="No. MP" value={exp.numero_mp} />
            <Field label="No. Administrativo" value={exp.numero_administrativo} />
          </dl>
        )}
      </Section>

      {/* Clasificación */}
      <Section title="Clasificación">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Proceso</label>
              <select value={form.tipo_proceso} onChange={set('tipo_proceso')} className={SELECT}>
                {tiposProceso.map(t => (
                  <option key={t} value={t}>{TIPO_PROCESO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fase actual</label>
              <select value={form.fase_actual} onChange={set('fase_actual')} className={SELECT}>
                {fases.map(f => (
                  <option key={f} value={f}>{FASE_LABEL[f]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={form.estado} onChange={set('estado')} className={SELECT}>
                {Object.entries(ESTADO_EXPEDIENTE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Tipo de proceso" value={TIPO_PROCESO_LABEL[exp.tipo_proceso]} />
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Fase actual</dt>
              <dd className="mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                  {FASE_LABEL[exp.fase_actual]}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Estado</dt>
              <dd className="mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_EXPEDIENTE_COLOR[exp.estado]}`}>
                  {ESTADO_EXPEDIENTE_LABEL[exp.estado]}
                </span>
              </dd>
            </div>
          </dl>
        )}
      </Section>

      {/* Sede */}
      <Section title={`Sede ${ORIGEN_LABEL[origen]}`}>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {origen === 'judicial' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Juzgado</label>
                  <input value={form.juzgado} onChange={set('juzgado')} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Departamento</label>
                  <select value={form.departamento} onChange={set('departamento')} className={SELECT}>
                    <option value="">— Seleccionar —</option>
                    {DEPARTAMENTOS_GUATEMALA.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </>
            )}
            {origen === 'fiscal' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fiscalía</label>
                  <input value={form.fiscalia} onChange={set('fiscalia')} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Agente Fiscal</label>
                  <input value={form.agente_fiscal} onChange={set('agente_fiscal')} className={INPUT} />
                </div>
              </>
            )}
            {origen === 'administrativo' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Entidad</label>
                  <input value={form.entidad_administrativa} onChange={set('entidad_administrativa')} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Dependencia</label>
                  <input value={form.dependencia} onChange={set('dependencia')} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Monto multa</label>
                  <input type="number" step="0.01" value={form.monto_multa} onChange={set('monto_multa')} className={INPUT} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Resolución</label>
                  <input value={form.resolucion_administrativa} onChange={set('resolucion_administrativa')} className={INPUT} />
                </div>
              </>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {origen === 'judicial' && (
              <>
                <Field label="Juzgado" value={exp.juzgado} />
                <Field label="Departamento" value={exp.departamento} />
              </>
            )}
            {origen === 'fiscal' && (
              <>
                <Field label="Fiscalía" value={exp.fiscalia} />
                <Field label="Agente Fiscal" value={exp.agente_fiscal} />
              </>
            )}
            {origen === 'administrativo' && (
              <>
                <Field label="Entidad" value={exp.entidad_administrativa} />
                <Field label="Dependencia" value={exp.dependencia} />
                <Field label="Monto multa" value={exp.monto_multa != null ? Q(exp.monto_multa) : null} />
                <Field label="Resolución" value={exp.resolucion_administrativa} />
              </>
            )}
          </dl>
        )}
      </Section>

      {/* Partes */}
      <Section title="Partes procesales">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Actor / Denunciante</label>
              <input value={form.actor} onChange={set('actor')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Demandado / Denunciado</label>
              <input value={form.demandado} onChange={set('demandado')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol del cliente</label>
              <select value={form.rol_cliente} onChange={set('rol_cliente')} className={SELECT}>
                <option value="">— Seleccionar —</option>
                {Object.entries(ROL_CLIENTE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Actor / Denunciante" value={exp.actor} />
            <Field label="Demandado / Denunciado" value={exp.demandado} />
            <Field label="Rol del cliente" value={exp.rol_cliente ? ROL_CLIENTE_LABEL[exp.rol_cliente] : null} />
          </dl>
        )}
      </Section>

      {/* Datos generales */}
      <Section title="Datos generales">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
              <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha finalización</label>
              <input type="date" value={form.fecha_finalizacion} onChange={set('fecha_finalizacion')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto pretensión</label>
              <input type="number" step="0.01" value={form.monto_pretension} onChange={set('monto_pretension')} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Moneda</label>
              <select value={form.moneda} onChange={set('moneda')} className={SELECT}>
                <option value="GTQ">Quetzales (GTQ)</option>
                <option value="USD">Dólares (USD)</option>
                <option value="EUR">Euros (EUR)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción</label>
              <textarea value={form.descripcion} onChange={set('descripcion')} rows={3} className={INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Notas internas</label>
              <textarea value={form.notas_internas} onChange={set('notas_internas')} rows={3} className={INPUT} />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Fecha inicio" value={exp.fecha_inicio} />
            <Field label="Fecha finalización" value={exp.fecha_finalizacion} />
            <Field label="Última actuación" value={exp.fecha_ultima_actuacion} />
            <Field label="Monto pretensión" value={exp.monto_pretension != null ? `${Q(exp.monto_pretension)} ${exp.moneda}` : null} />
            {exp.descripcion && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Descripción</dt>
                <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{exp.descripcion}</dd>
              </div>
            )}
            {exp.notas_internas && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wider">Notas internas</dt>
                <dd className="mt-1 text-sm text-slate-700 whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg p-3">{exp.notas_internas}</dd>
              </div>
            )}
          </dl>
        )}
      </Section>
    </div>
  );
}

// ── Tab: Actuaciones ─────────────────────────────────────────────────────

function TabActuaciones({ actuaciones, expedienteId, origen, mutate, refetch }: {
  actuaciones: ActuacionProcesal[]; expedienteId: string;
  origen: OrigenExpediente;
  mutate: ReturnType<typeof useMutate>['mutate'];
  refetch: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [sede, setSede] = useState<SedeActuacion>(origen === 'fiscal' ? 'fiscal' : origen === 'administrativo' ? 'administrativa' : 'judicial');
  const [tipo, setTipo] = useState<TipoActuacion>('memorial');
  const [descripcion, setDescripcion] = useState('');
  const [realizadoPor, setRealizadoPor] = useState<RealizadoPor>('bufete');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!descripcion.trim()) return;
    setSubmitting(true);
    await mutate(`/api/admin/expedientes/${expedienteId}/actuaciones`, {
      method: 'POST',
      body: { fecha, sede, tipo, descripcion: descripcion.trim(), realizado_por: realizadoPor },
      onSuccess: () => {
        setShowForm(false);
        setDescripcion('');
        refetch();
      },
    });
    setSubmitting(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
          <Plus size={14} /> Nueva actuación
        </button>
      </div>

      {showForm && (
        <Section title="Nueva actuación">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={ev => setFecha(ev.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sede</label>
              <select value={sede} onChange={ev => setSede(ev.target.value as SedeActuacion)} className={SELECT}>
                {Object.entries(SEDE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
              <select value={tipo} onChange={ev => setTipo(ev.target.value as TipoActuacion)} className={SELECT}>
                {Object.entries(TIPO_ACTUACION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Realizado por</label>
              <select value={realizadoPor} onChange={ev => setRealizadoPor(ev.target.value as RealizadoPor)} className={SELECT}>
                {Object.entries(REALIZADO_POR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
              <textarea value={descripcion} onChange={ev => setDescripcion(ev.target.value)}
                rows={3} className={INPUT} placeholder="Describe la actuación..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={submitting || !descripcion.trim()}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Section>
      )}

      {actuaciones.length === 0 ? (
        <EmptyState icon="📋" title="Sin actuaciones" description="Registra la primera actuación procesal" />
      ) : (
        <div className="space-y-3">
          {actuaciones.map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                  a.sede === 'judicial' ? 'bg-blue-100 text-blue-700' :
                  a.sede === 'fiscal' ? 'bg-amber-100 text-amber-700' :
                  'bg-purple-100 text-purple-700'
                }`}>
                  {a.sede === 'judicial' ? <Scale size={14} /> :
                   a.sede === 'fiscal' ? <Shield size={14} /> :
                   <Building2 size={14} />}
                </span>
                <span className="text-[10px] text-slate-400">{SEDE_LABEL[a.sede]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {TIPO_ACTUACION_LABEL[a.tipo]}
                  </span>
                  <span className="text-xs text-slate-400">{REALIZADO_POR_LABEL[a.realizado_por]}</span>
                  <span className="text-xs text-slate-400 ml-auto">{a.fecha}</span>
                </div>
                <p className="text-sm text-slate-700 mt-1.5 whitespace-pre-wrap">{a.descripcion}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Plazos ──────────────────────────────────────────────────────────

function TabPlazos({ plazos, expedienteId, mutate, refetch }: {
  plazos: PlazoProcesal[]; expedienteId: string;
  mutate: ReturnType<typeof useMutate>['mutate'];
  refetch: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [tipoPlazo, setTipoPlazo] = useState<TipoPlazo>('contestacion_demanda');
  const [descripcion, setDescripcion] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [diasHabiles, setDiasHabiles] = useState(true);
  const [alertaDias, setAlertaDias] = useState('3');
  const [submitting, setSubmitting] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);

  async function handleSubmit() {
    if (!descripcion.trim() || !fechaVencimiento) return;
    setSubmitting(true);
    await mutate(`/api/admin/expedientes/${expedienteId}/plazos`, {
      method: 'POST',
      body: {
        tipo_plazo: tipoPlazo,
        descripcion: descripcion.trim(),
        fecha_inicio: fechaInicio,
        fecha_vencimiento: fechaVencimiento,
        dias_habiles: diasHabiles,
        alerta_dias_antes: parseInt(alertaDias) || 3,
      },
      onSuccess: () => {
        setShowForm(false);
        setDescripcion('');
        setFechaVencimiento('');
        refetch();
      },
    });
    setSubmitting(false);
  }

  async function togglePlazo(plazoId: string, nuevoEstado: EstadoPlazo) {
    await mutate(`/api/admin/expedientes/${expedienteId}/plazos`, {
      method: 'PATCH',
      body: { plazo_id: plazoId, estado: nuevoEstado },
      onSuccess: refetch,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
          <Plus size={14} /> Nuevo plazo
        </button>
      </div>

      {showForm && (
        <Section title="Nuevo plazo">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de plazo</label>
              <select value={tipoPlazo} onChange={ev => setTipoPlazo(ev.target.value as TipoPlazo)} className={SELECT}>
                {Object.entries(TIPO_PLAZO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Alerta (días antes)</label>
              <input type="number" value={alertaDias} onChange={ev => setAlertaDias(ev.target.value)} className={INPUT} min="1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha inicio</label>
              <input type="date" value={fechaInicio} onChange={ev => setFechaInicio(ev.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha vencimiento *</label>
              <input type="date" value={fechaVencimiento} onChange={ev => setFechaVencimiento(ev.target.value)} className={INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción *</label>
              <textarea value={descripcion} onChange={ev => setDescripcion(ev.target.value)}
                rows={2} className={INPUT} placeholder="Describe el plazo..." />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="diasHabiles" checked={diasHabiles}
                onChange={ev => setDiasHabiles(ev.target.checked)}
                className="rounded border-slate-300 text-[#0891B2] focus:ring-[#0891B2]/20" />
              <label htmlFor="diasHabiles" className="text-sm text-slate-600">Días hábiles</label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={submitting || !descripcion.trim() || !fechaVencimiento}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors">
              {submitting ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </Section>
      )}

      {plazos.length === 0 ? (
        <EmptyState icon="⏰" title="Sin plazos" description="Agrega el primer plazo procesal" />
      ) : (
        <div className="space-y-3">
          {plazos.map(p => {
            const vencido = p.estado === 'pendiente' && p.fecha_vencimiento < hoy;
            const diasRestantes = Math.ceil(
              (new Date(p.fecha_vencimiento).getTime() - Date.now()) / 86400000
            );
            const urgente = p.estado === 'pendiente' && diasRestantes <= 5 && diasRestantes >= 0;

            return (
              <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-4 ${
                vencido ? 'border-red-200 bg-red-50/50' :
                urgente ? 'border-amber-200 bg-amber-50/50' :
                'border-slate-200'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {TIPO_PLAZO_LABEL[p.tipo_plazo]}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_PLAZO_COLOR[p.estado]}`}>
                        {vencido ? 'Vencido' : ESTADO_PLAZO_LABEL[p.estado]}
                      </span>
                      {urgente && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <AlertTriangle size={12} /> {diasRestantes}d restantes
                        </span>
                      )}
                      {vencido && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                          <AlertTriangle size={12} /> Vencido hace {Math.abs(diasRestantes)}d
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 mt-1.5">{p.descripcion}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {p.fecha_inicio} → {p.fecha_vencimiento}
                      {p.dias_habiles && ' (días hábiles)'}
                    </p>
                  </div>

                  {p.estado === 'pendiente' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => togglePlazo(p.id, 'cumplido')}
                        className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition-colors" title="Marcar cumplido">
                        <CheckCircle size={18} />
                      </button>
                      <button onClick={() => togglePlazo(p.id, 'vencido')}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors" title="Marcar vencido">
                        <XCircle size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Tab: Documentos ──────────────────────────────────────────────────────

function TabDocumentos({ expedienteId }: { expedienteId: string }) {
  // Placeholder — Supabase Storage integration will be added
  return (
    <EmptyState icon="📁" title="Documentos"
      description="La integración con Supabase Storage se configurará próximamente." />
  );
}

// ── Tab: Vinculados ──────────────────────────────────────────────────────

function TabVinculados({ vinculados, expedienteId, mutate, refetch }: {
  vinculados: VinculadoRow[]; expedienteId: string;
  mutate: ReturnType<typeof useMutate>['mutate'];
  refetch: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>('relacionado');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/expedientes?q=${encodeURIComponent(search)}&limit=5`);
        const json = await res.json();
        setResults((json.data ?? []).filter((e: any) => e.id !== expedienteId));
      } catch { setResults([]); }
    }, 300);
  }, [search, expedienteId]);

  async function handleSubmit() {
    if (!selectedId) return;
    setSubmitting(true);
    await mutate(`/api/admin/expedientes/${expedienteId}/vinculados`, {
      method: 'POST',
      body: {
        expediente_destino_id: selectedId,
        tipo_vinculo: tipoVinculo,
        descripcion: descripcion.trim() || null,
      },
      onSuccess: () => {
        setShowForm(false);
        setSearch('');
        setSelectedId('');
        setDescripcion('');
        refetch();
      },
    });
    setSubmitting(false);
  }

  async function handleDelete(vinculoId: string) {
    await mutate(`/api/admin/expedientes/${expedienteId}/vinculados`, {
      method: 'DELETE',
      body: { vinculo_id: vinculoId },
      onSuccess: refetch,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
          <Plus size={14} /> Vincular expediente
        </button>
      </div>

      {showForm && (
        <Section title="Vincular expediente">
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">Buscar expediente</label>
              <input value={search} onChange={ev => { setSearch(ev.target.value); setSelectedId(''); }}
                className={INPUT} placeholder="Buscar por número..." />
              {results.length > 0 && !selectedId && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {results.map((r: any) => {
                    const nums = [r.numero_expediente, r.numero_mp ? `MP: ${r.numero_mp}` : null, r.numero_administrativo ? `Admin: ${r.numero_administrativo}` : null].filter(Boolean).join(' / ');
                    return (
                      <button key={r.id} onClick={() => { setSelectedId(r.id); setSearch(nums); setResults([]); }}
                        className="w-full px-4 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <div className="text-sm font-medium text-slate-900 font-mono">{nums || '(sin número)'}</div>
                        <div className="text-xs text-slate-500">{ORIGEN_LABEL[r.origen as OrigenExpediente]} · {TIPO_PROCESO_LABEL[r.tipo_proceso as TipoProceso]}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de vínculo</label>
              <select value={tipoVinculo} onChange={ev => setTipoVinculo(ev.target.value as TipoVinculo)} className={SELECT}>
                {Object.entries(TIPO_VINCULO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Descripción (opcional)</label>
              <input value={descripcion} onChange={ev => setDescripcion(ev.target.value)} className={INPUT} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={handleSubmit} disabled={submitting || !selectedId}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors">
              {submitting ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </Section>
      )}

      {vinculados.length === 0 ? (
        <EmptyState icon="🔗" title="Sin expedientes vinculados"
          description="Vincula expedientes relacionados (amparos, apelaciones, etc.)" />
      ) : (
        <div className="space-y-3">
          {vinculados.map(v => {
            const linked = v.expediente_vinculado;
            if (!linked) return null;
            const nums = [linked.numero_expediente, linked.numero_mp ? `MP: ${linked.numero_mp}` : null, linked.numero_administrativo ? `Admin: ${linked.numero_administrativo}` : null].filter(Boolean).join(' / ');

            return (
              <div key={v.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${ORIGEN_COLOR[linked.origen]}`}>
                  <OrigenIcon origen={linked.origen} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/admin/expedientes/${linked.id}`}
                    className="text-sm font-medium text-slate-900 font-mono hover:text-[#0891B2] transition-colors">
                    {nums || '(sin número)'}
                    <ChevronRight size={12} className="inline ml-1" />
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                      {TIPO_VINCULO_LABEL[v.tipo_vinculo]}
                    </span>
                    <span className="text-xs text-slate-500">{TIPO_PROCESO_LABEL[linked.tipo_proceso]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_EXPEDIENTE_COLOR[linked.estado]}`}>
                      {ESTADO_EXPEDIENTE_LABEL[linked.estado]}
                    </span>
                  </div>
                  {v.descripcion && <p className="text-xs text-slate-500 mt-1">{v.descripcion}</p>}
                </div>
                <button onClick={() => handleDelete(v.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition-colors shrink-0" title="Eliminar vínculo">
                  <XCircle size={16} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
