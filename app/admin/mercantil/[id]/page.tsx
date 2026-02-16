// ============================================================================
// app/admin/mercantil/[id]/page.tsx
// Detalle de trámite mercantil con edición inline e historial
// ============================================================================

'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { ArrowLeft, Pencil, X, Save, Plus, Trash2 } from 'lucide-react';
import {
  type TramiteMercantilConCliente,
  type HistorialMercantil,
  type CategoriaMercantil,
  type EstadoTramiteMercantil,
  type AccionHistorialMercantil,
  CATEGORIA_MERCANTIL_LABEL,
  ESTADO_MERCANTIL_LABEL,
  ESTADO_MERCANTIL_COLOR,
  ACCION_MERCANTIL_LABEL,
  getSemaforoMercantil,
  SEMAFORO_COLOR,
  SEMAFORO_DOT,
} from '@/lib/types/mercantil';

const CATEGORIAS = Object.entries(CATEGORIA_MERCANTIL_LABEL) as [CategoriaMercantil, string][];
const ESTADOS = Object.entries(ESTADO_MERCANTIL_LABEL) as [EstadoTramiteMercantil, string][];
const ACCIONES = Object.entries(ACCION_MERCANTIL_LABEL) as [AccionHistorialMercantil, string][];

export default function MercantilDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { mutate } = useMutate();

  const { data, loading, refetch } = useFetch<{
    tramite: TramiteMercantilConCliente;
    historial: HistorialMercantil[];
  }>(`/api/admin/mercantil/${id}`);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Historial form
  const [showHistorialForm, setShowHistorialForm] = useState(false);
  const [hAccion, setHAccion] = useState<AccionHistorialMercantil>('creado');
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
  const semaforo = getSemaforoMercantil(t.fecha_vencimiento, t.estado, t.alerta_dias_antes);

  function startEdit() {
    setForm({
      categoria: t.categoria,
      subtipo: t.subtipo ?? '',
      estado: t.estado,
      numero_registro: t.numero_registro ?? '',
      fecha_tramite: t.fecha_tramite,
      fecha_inscripcion: t.fecha_inscripcion ?? '',
      fecha_vencimiento: t.fecha_vencimiento ?? '',
      es_recurrente: t.es_recurrente,
      periodicidad_meses: t.periodicidad_meses?.toString() ?? '',
      alerta_dias_antes: t.alerta_dias_antes.toString(),
      numero_expediente_rm: t.numero_expediente_rm ?? '',
      notario_responsable: t.notario_responsable ?? '',
      descripcion: t.descripcion ?? '',
      notas: t.notas ?? '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const fields = ['categoria', 'subtipo', 'estado', 'numero_registro', 'fecha_tramite',
        'fecha_inscripcion', 'fecha_vencimiento', 'numero_expediente_rm', 'notario_responsable',
        'descripcion', 'notas'];
      for (const f of fields) {
        body[f] = form[f] || null;
      }
      body.es_recurrente = form.es_recurrente;
      body.periodicidad_meses = form.periodicidad_meses ? parseInt(form.periodicidad_meses) : null;
      body.alerta_dias_antes = parseInt(form.alerta_dias_antes) || 30;

      await mutate(`/api/admin/mercantil/${id}`, {
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
    if (!confirm('¿Eliminar este trámite mercantil? Esta acción no se puede deshacer.')) return;
    setDeleting(true);
    try {
      await mutate(`/api/admin/mercantil/${id}`, { method: 'DELETE' });
      router.push('/admin/mercantil');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddHistorial(e: React.FormEvent) {
    e.preventDefault();
    if (!hDescripcion.trim()) return;
    setSavingHistorial(true);
    try {
      await mutate(`/api/admin/mercantil/${id}/historial`, {
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
          <button onClick={() => router.push('/admin/mercantil')}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft size={14} /> Trámites Mercantiles
          </button>
          <h1 className="text-xl font-bold text-slate-900">
            {CATEGORIA_MERCANTIL_LABEL[t.categoria]}
            {t.subtipo && <span className="text-slate-400 font-normal ml-2">— {t.subtipo}</span>}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.cliente?.nombre}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${SEMAFORO_COLOR[semaforo]}`}>
            <span className={`w-2 h-2 rounded-full ${SEMAFORO_DOT[semaforo]}`} />
            {semaforo === 'verde' ? 'Al día' : semaforo === 'amarillo' ? 'Próximo a vencer' : semaforo === 'rojo' ? 'Vencido' : 'Inactivo'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_MERCANTIL_COLOR[t.estado]}`}>
            {ESTADO_MERCANTIL_LABEL[t.estado]}
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
            <div><span className={labelCls}>Categoría</span><p className="text-sm text-slate-900">{CATEGORIA_MERCANTIL_LABEL[t.categoria]}</p></div>
            <div><span className={labelCls}>Subtipo</span><p className="text-sm text-slate-900">{t.subtipo || '—'}</p></div>
            <div><span className={labelCls}>Estado</span><p className="text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_MERCANTIL_COLOR[t.estado]}`}>{ESTADO_MERCANTIL_LABEL[t.estado]}</span></p></div>
            <div><span className={labelCls}>No. de Registro</span><p className="text-sm text-slate-900 font-mono">{t.numero_registro || '—'}</p></div>
            <div><span className={labelCls}>Fecha del Trámite</span><p className="text-sm text-slate-900">{t.fecha_tramite}</p></div>
            <div><span className={labelCls}>Fecha de Inscripción</span><p className="text-sm text-slate-900">{t.fecha_inscripcion || '—'}</p></div>
            <div><span className={labelCls}>Fecha de Vencimiento</span><p className="text-sm text-slate-900">{t.fecha_vencimiento || '—'}</p></div>
            <div><span className={labelCls}>No. Expediente RM</span><p className="text-sm text-slate-900 font-mono">{t.numero_expediente_rm || '—'}</p></div>
            <div><span className={labelCls}>Notario Responsable</span><p className="text-sm text-slate-900">{t.notario_responsable || '—'}</p></div>
            <div><span className={labelCls}>Recurrente</span><p className="text-sm text-slate-900">{t.es_recurrente ? `Sí — cada ${t.periodicidad_meses ?? '?'} meses` : 'No'}</p></div>
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
                <label className={labelCls}>Subtipo</label>
                <input type="text" value={form.subtipo} onChange={e => setForm(p => ({ ...p, subtipo: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Estado</label>
                <select value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))} className={inputCls}>
                  {ESTADOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>No. de Registro</label>
                <input type="text" value={form.numero_registro} onChange={e => setForm(p => ({ ...p, numero_registro: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Fecha del Trámite</label>
                <input type="date" value={form.fecha_tramite} onChange={e => setForm(p => ({ ...p, fecha_tramite: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de Inscripción</label>
                <input type="date" value={form.fecha_inscripcion} onChange={e => setForm(p => ({ ...p, fecha_inscripcion: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de Vencimiento</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => setForm(p => ({ ...p, fecha_vencimiento: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>No. Expediente RM</label>
                <input type="text" value={form.numero_expediente_rm} onChange={e => setForm(p => ({ ...p, numero_expediente_rm: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notario Responsable</label>
                <input type="text" value={form.notario_responsable} onChange={e => setForm(p => ({ ...p, notario_responsable: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={form.es_recurrente} onChange={e => setForm(p => ({ ...p, es_recurrente: e.target.checked }))}
                className="w-4 h-4 rounded border-slate-300 text-[#1E40AF]" />
              <span className="text-sm text-slate-700">Es un trámite recurrente</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {form.es_recurrente && (
                <div>
                  <label className={labelCls}>Periodicidad (meses)</label>
                  <input type="number" value={form.periodicidad_meses} onChange={e => setForm(p => ({ ...p, periodicidad_meses: e.target.value }))} min="1" className={inputCls} />
                </div>
              )}
              <div>
                <label className={labelCls}>Alertar días antes</label>
                <input type="number" value={form.alerta_dias_antes} onChange={e => setForm(p => ({ ...p, alerta_dias_antes: e.target.value }))} min="1" className={inputCls} />
              </div>
            </div>
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
                <select value={hAccion} onChange={e => setHAccion(e.target.value as AccionHistorialMercantil)} className={inputCls}>
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
                    <span className="text-xs font-medium text-slate-900">{ACCION_MERCANTIL_LABEL[h.accion]}</span>
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
