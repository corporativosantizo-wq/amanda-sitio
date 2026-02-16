// ============================================================================
// app/admin/laboral/[id]/page.tsx
// Detalle de trámite laboral con edición inline e historial
// ============================================================================

'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { ArrowLeft, Pencil, X, Save, Plus, Trash2 } from 'lucide-react';
import {
  type TramiteLaboralConCliente,
  type HistorialLaboral,
  type CategoriaLaboral,
  type EstadoTramiteLaboral,
  type AccionHistorialLaboral,
  CATEGORIA_LABORAL_LABEL,
  ESTADO_LABORAL_LABEL,
  ESTADO_LABORAL_COLOR,
  ACCION_LABORAL_LABEL,
  getSemaforoLaboral,
  SEMAFORO_LABORAL_COLOR,
  SEMAFORO_LABORAL_DOT,
} from '@/lib/types/laboral';

const CATEGORIAS = Object.entries(CATEGORIA_LABORAL_LABEL) as [CategoriaLaboral, string][];
const ESTADOS = Object.entries(ESTADO_LABORAL_LABEL) as [EstadoTramiteLaboral, string][];
const ACCIONES = Object.entries(ACCION_LABORAL_LABEL) as [AccionHistorialLaboral, string][];

function formatSalario(val: number | null, moneda: string): string {
  if (val === null) return '—';
  return `${moneda} ${val.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
}

export default function LaboralDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate } = useMutate();

  const { data, loading, refetch } = useFetch<{
    tramite: TramiteLaboralConCliente;
    historial: HistorialLaboral[];
  }>(`/api/admin/laboral/${id}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Historial form
  const [showHistorialForm, setShowHistorialForm] = useState(false);
  const [hAccion, setHAccion] = useState<AccionHistorialLaboral>('creado');
  const [hFecha, setHFecha] = useState(new Date().toISOString().slice(0, 10));
  const [hDescripcion, setHDescripcion] = useState('');
  const [savingHistorial, setSavingHistorial] = useState(false);

  if (loading) return (
    <div className="p-6"><div className="animate-pulse space-y-4">
      <div className="h-8 bg-slate-200 rounded w-1/3" />
      <div className="h-64 bg-slate-100 rounded-xl" />
    </div></div>
  );

  if (!data) return (
    <div className="p-6 text-center text-slate-500">Trámite no encontrado</div>
  );

  const t = data.tramite;
  const historial = data.historial;
  const semaforo = getSemaforoLaboral(t.fecha_fin, t.estado, t.alerta_dias_antes);

  function startEdit() {
    setForm({
      categoria: t.categoria,
      estado: t.estado,
      nombre_empleado: t.nombre_empleado ?? '',
      puesto: t.puesto ?? '',
      fecha_inicio: t.fecha_inicio ?? '',
      fecha_fin: t.fecha_fin ?? '',
      fecha_registro_igt: t.fecha_registro_igt ?? '',
      numero_registro_igt: t.numero_registro_igt ?? '',
      salario: t.salario?.toString() ?? '',
      moneda: t.moneda,
      es_temporal: t.es_temporal,
      duracion_meses: t.duracion_meses?.toString() ?? '',
      alerta_dias_antes: t.alerta_dias_antes.toString(),
      descripcion: t.descripcion ?? '',
      notas: t.notas ?? '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const strFields = ['categoria', 'estado', 'nombre_empleado', 'puesto',
        'fecha_inicio', 'fecha_fin', 'fecha_registro_igt', 'numero_registro_igt',
        'descripcion', 'notas'];
      for (const f of strFields) {
        body[f] = form[f] || null;
      }
      body.moneda = form.moneda;
      body.es_temporal = form.es_temporal;
      body.salario = form.salario ? parseFloat(form.salario) : null;
      body.duracion_meses = form.duracion_meses ? parseInt(form.duracion_meses) : null;
      body.alerta_dias_antes = parseInt(form.alerta_dias_antes) || 30;

      await mutate(`/api/admin/laboral/${id}`, {
        method: 'PATCH',
        body,
      });
      setEditing(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar este trámite laboral? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await mutate(`/api/admin/laboral/${id}`, { method: 'DELETE' });
      router.push('/admin/laboral');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddHistorial(e: React.FormEvent) {
    e.preventDefault();
    if (!hDescripcion.trim()) return;
    setSavingHistorial(true);
    try {
      await mutate(`/api/admin/laboral/${id}/historial`, {
        body: { accion: hAccion, fecha: hFecha, descripcion: hDescripcion },
      });
      setShowHistorialForm(false);
      setHAccion('creado');
      setHDescripcion('');
      setHFecha(new Date().toISOString().slice(0, 10));
      refetch();
    } finally {
      setSavingHistorial(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
  const labelCls = 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => router.push('/admin/laboral')}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={14} /> Trámites Laborales
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {CATEGORIA_LABORAL_LABEL[t.categoria]}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {t.cliente?.nombre}
            {t.nombre_empleado && <span className="ml-2">— {t.nombre_empleado}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${SEMAFORO_LABORAL_COLOR[semaforo]}`}>
            <span className={`w-2 h-2 rounded-full ${SEMAFORO_LABORAL_DOT[semaforo]}`} />
            {semaforo === 'verde' ? 'Al día' : semaforo === 'amarillo' ? 'Próximo a vencer' : semaforo === 'rojo' ? 'Vencido' : 'Inactivo'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_LABORAL_COLOR[t.estado]}`}>
            {ESTADO_LABORAL_LABEL[t.estado]}
          </span>
        </div>
      </div>

      {/* Datos Generales */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Datos Generales</h2>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <button onClick={startEdit} className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-[#1E40AF] transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
                  <Trash2 size={14} /> {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(false)} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                  <X size={14} /> Cancelar
                </button>
                <button onClick={saveEdit} disabled={saving}
                  className="inline-flex items-center gap-1 text-sm text-white bg-[#1E40AF] px-3 py-1 rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50">
                  <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            )}
          </div>
        </div>

        {!editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
            <div><span className={labelCls}>Categoría</span><p className="text-sm text-slate-900">{CATEGORIA_LABORAL_LABEL[t.categoria]}</p></div>
            <div><span className={labelCls}>Estado</span><p className="text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_LABORAL_COLOR[t.estado]}`}>{ESTADO_LABORAL_LABEL[t.estado]}</span></p></div>
            <div><span className={labelCls}>Empleado</span><p className="text-sm text-slate-900">{t.nombre_empleado || '—'}</p></div>
            <div><span className={labelCls}>Puesto</span><p className="text-sm text-slate-900">{t.puesto || '—'}</p></div>
            <div><span className={labelCls}>Fecha de Inicio</span><p className="text-sm text-slate-900">{t.fecha_inicio || '—'}</p></div>
            <div><span className={labelCls}>Fecha de Finalización</span><p className="text-sm text-slate-900">{t.fecha_fin || '—'}</p></div>
            <div><span className={labelCls}>Salario</span><p className="text-sm text-slate-900">{formatSalario(t.salario, t.moneda)}</p></div>
            <div><span className={labelCls}>Temporal</span><p className="text-sm text-slate-900">{t.es_temporal ? `Sí — ${t.duracion_meses ?? '?'} meses` : 'No'}</p></div>
            <div><span className={labelCls}>Registro IGT</span><p className="text-sm text-slate-900 font-mono">{t.numero_registro_igt || '—'}</p></div>
            <div><span className={labelCls}>Fecha Registro IGT</span><p className="text-sm text-slate-900">{t.fecha_registro_igt || '—'}</p></div>
            <div><span className={labelCls}>Alerta</span><p className="text-sm text-slate-900">{t.alerta_dias_antes} días antes</p></div>
            <div className="md:col-span-2"><span className={labelCls}>Descripción</span><p className="text-sm text-slate-900 whitespace-pre-wrap">{t.descripcion || '—'}</p></div>
            <div className="md:col-span-2"><span className={labelCls}>Notas</span><p className="text-sm text-slate-700 whitespace-pre-wrap">{t.notas || '—'}</p></div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Categoría</label>
                <select value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} className={inputCls}>
                  {CATEGORIAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={inputCls}>
                  {ESTADOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombre del Empleado</label>
                <input type="text" value={form.nombre_empleado} onChange={e => setForm(p => ({ ...p, nombre_empleado: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Puesto</label>
                <input type="text" value={form.puesto} onChange={e => setForm(p => ({ ...p, puesto: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Fecha de Inicio</label>
                <input type="date" value={form.fecha_inicio} onChange={e => setForm(p => ({ ...p, fecha_inicio: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de Finalización</label>
                <input type="date" value={form.fecha_fin} onChange={e => setForm(p => ({ ...p, fecha_fin: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Salario</label>
                <input type="number" value={form.salario} onChange={e => setForm(p => ({ ...p, salario: e.target.value }))} step="0.01" min="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Moneda</label>
                <select value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value }))} className={inputCls}>
                  <option value="GTQ">GTQ</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Alertar días antes</label>
                <input type="number" value={form.alerta_dias_antes} onChange={e => setForm(p => ({ ...p, alerta_dias_antes: e.target.value }))} min="1" className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>No. Registro IGT</label>
                <input type="text" value={form.numero_registro_igt} onChange={e => setForm(p => ({ ...p, numero_registro_igt: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha Registro IGT</label>
                <input type="date" value={form.fecha_registro_igt} onChange={e => setForm(p => ({ ...p, fecha_registro_igt: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.es_temporal} onChange={e => setForm(p => ({ ...p, es_temporal: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#1E40AF]" />
              <span className="text-sm text-slate-700">Es contrato temporal</span>
            </div>
            {form.es_temporal && (
              <div className="max-w-xs">
                <label className={labelCls}>Duración (meses)</label>
                <input type="number" value={form.duracion_meses} onChange={e => setForm(p => ({ ...p, duracion_meses: e.target.value }))} min="1" className={inputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>Descripción</label>
              <textarea value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} rows={3} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notas</label>
              <textarea value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} rows={2} className={inputCls} />
            </div>
          </div>
        )}
      </div>

      {/* Historial */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Historial</h2>
          <button onClick={() => setShowHistorialForm(!showHistorialForm)}
            className="inline-flex items-center gap-1.5 text-sm text-[#1E40AF] hover:text-[#1E3A8A] transition-colors">
            <Plus size={14} /> Agregar
          </button>
        </div>

        {showHistorialForm && (
          <form onSubmit={handleAddHistorial} className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Acción</label>
                <select value={hAccion} onChange={e => setHAccion(e.target.value as AccionHistorialLaboral)} className={inputCls}>
                  {ACCIONES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Fecha</label>
                <input type="date" value={hFecha} onChange={e => setHFecha(e.target.value)} className={inputCls} />
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={savingHistorial || !hDescripcion.trim()}
                  className="px-4 py-2 text-sm text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50">
                  {savingHistorial ? 'Guardando...' : 'Agregar'}
                </button>
                <button type="button" onClick={() => setShowHistorialForm(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Cancelar</button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Descripción *</label>
              <textarea value={hDescripcion} onChange={e => setHDescripcion(e.target.value)} rows={2} className={inputCls}
                placeholder="Describe la acción realizada..." required />
            </div>
          </form>
        )}

        {historial.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Sin registros en el historial</p>
        ) : (
          <div className="space-y-0 divide-y divide-slate-100">
            {historial.map(h => (
              <div key={h.id} className="py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-[#1E40AF] mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-slate-900">{ACCION_LABORAL_LABEL[h.accion]}</span>
                    <span className="text-xs text-slate-400">{h.fecha}</span>
                  </div>
                  <p className="text-sm text-slate-600">{h.descripcion}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
