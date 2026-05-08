// ============================================================================
// app/admin/configuracion/mensajes-telegram/page.tsx
// Admin de mensajes programados al bot de Telegram (legal.mensajes_programados_telegram)
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { PageHeader, Badge, EmptyState, TableSkeleton, Section } from '@/components/admin/ui';

// ── Types ──────────────────────────────────────────────────────────────────

type Destino = 'grupo' | 'privado';

interface MensajeRow {
  id: string;
  nombre: string;
  destino: Destino;
  hora_envio: string;       // 'HH:MM:SS'
  dias_semana: number[];    // 1..7
  mensaje_template: string;
  usar_frase_motivante: boolean;
  activo: boolean;
  ultima_enviada: string | null;
  created_at: string;
  updated_at: string;
}

interface FormState {
  nombre: string;
  destino: Destino;
  hora_envio: string;       // 'HH:MM'
  dias_semana: number[];
  mensaje_template: string;
  usar_frase_motivante: boolean;
  activo: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const DIAS = [
  { iso: 1, label: 'Lun' },
  { iso: 2, label: 'Mar' },
  { iso: 3, label: 'Mié' },
  { iso: 4, label: 'Jue' },
  { iso: 5, label: 'Vie' },
  { iso: 6, label: 'Sáb' },
  { iso: 7, label: 'Dom' },
];

const EMPTY_FORM: FormState = {
  nombre: '',
  destino: 'grupo',
  hora_envio: '08:00',
  dias_semana: [1, 2, 3, 4, 5],
  mensaje_template: '',
  usar_frase_motivante: false,
  activo: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function diasResumen(dias: number[]): string {
  if (dias.length === 7) return 'Todos los días';
  if (dias.length === 5 && dias.every(d => d >= 1 && d <= 5)) return 'Lun-Vie';
  if (dias.length === 2 && dias.includes(6) && dias.includes(7)) return 'Sáb-Dom';
  return dias.sort((a, b) => a - b).map(d => DIAS.find(x => x.iso === d)?.label).join(', ');
}

function horaCorta(h: string): string {
  return h.slice(0, 5);
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MensajesTelegramPage() {
  const { data, loading, refetch } = useFetch<{ data: MensajeRow[] }>(
    '/api/admin/config/mensajes-telegram',
  );
  const mensajes = data?.data ?? [];

  const [editing, setEditing] = useState<MensajeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MensajeRow | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);
  const { mutate } = useMutate();

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const enviarAhora = async (m: MensajeRow) => {
    setSendingId(m.id);
    try {
      const res = await adminFetch(`/api/admin/config/mensajes-telegram/${m.id}/enviar`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al enviar');
      addToast(`"${m.nombre}" enviado a Telegram`, 'success');
      refetch();
    } catch (err: any) {
      addToast(err.message ?? 'Error al enviar', 'error');
    } finally {
      setSendingId(null);
    }
  };

  const eliminarMensaje = async () => {
    if (!deleteTarget) return;
    const result = await mutate(`/api/admin/config/mensajes-telegram/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (result) {
      addToast('Mensaje eliminado', 'success');
      refetch();
      setDeleteTarget(null);
    } else {
      addToast('Error al eliminar', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mensajes programados de Telegram"
        description="Mensajes que el bot envía automáticamente según la hora y día."
        action={{
          label: 'Nuevo mensaje',
          icon: '+',
          onClick: () => setCreating(true),
        }}
      />

      {loading ? <TableSkeleton rows={4} /> : mensajes.length === 0 ? (
        <EmptyState
          icon="🤖"
          title="Sin mensajes programados"
          description="Crea el primer mensaje que el bot enviará automáticamente."
          action={{ label: '+ Nuevo mensaje', onClick: () => setCreating(true) }}
        />
      ) : (
        <Section title={`Mensajes (${mensajes.length})`} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Nombre', 'Destino', 'Hora', 'Días', 'Frase', 'Activo', 'Última', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mensajes.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 pl-5">
                      <p className="text-sm font-medium text-slate-900">{m.nombre}</p>
                      <p className="text-xs text-slate-400 max-w-xs truncate" title={m.mensaje_template}>{m.mensaje_template}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={m.destino === 'grupo' ? 'info' : 'default'}>
                        {m.destino === 'grupo' ? 'Grupo' : 'Privado'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-slate-700">{horaCorta(m.hora_envio)}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{diasResumen(m.dias_semana)}</td>
                    <td className="py-3 px-4 text-xs">
                      {m.usar_frase_motivante ? '⭐ Sí' : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={m.activo ? 'success' : 'default'}>
                        {m.activo ? 'Activo' : 'Pausado'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {m.ultima_enviada ?? '—'}
                    </td>
                    <td className="py-3 px-4 pr-5 text-xs">
                      <div className="flex items-center gap-3">
                        <button onClick={() => enviarAhora(m)} disabled={sendingId === m.id}
                          className="text-[#0F172A] hover:underline font-medium disabled:opacity-40">
                          {sendingId === m.id ? 'Enviando…' : 'Enviar ahora'}
                        </button>
                        <button onClick={() => setEditing(m)}
                          className="text-[#0F172A] hover:underline font-medium">
                          Editar
                        </button>
                        <button onClick={() => setDeleteTarget(m)}
                          className="text-red-600 hover:underline font-medium">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <p className="font-semibold mb-2">📝 Plantillas disponibles:</p>
        <ul className="space-y-1 text-xs">
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{frase_motivante}'}</code> — frase rotativa (requiere toggle activado)</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{nombre_asistente}'}</code> — Mariano</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{fecha_hoy}'}</code> — fecha de hoy en español</li>
        </ul>
        <p className="text-xs mt-2 text-blue-700">
          El cron corre cada 15 min y envía el mensaje cuando la hora actual GT está dentro de ±7 min de <code className="bg-white px-1 py-0.5 rounded">hora_envio</code>.
        </p>
      </div>

      {(creating || editing) && (
        <MensajeFormModal
          mensaje={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSuccess={() => { setCreating(false); setEditing(null); refetch(); addToast(editing ? 'Mensaje actualizado' : 'Mensaje creado', 'success'); }}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar mensaje</h3>
            <p className="text-sm text-slate-600 mb-5">
              ¿Eliminar <strong>"{deleteTarget.nombre}"</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={eliminarMensaje}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal: crear/editar ─────────────────────────────────────────────────────

function MensajeFormModal({
  mensaje,
  onClose,
  onSuccess,
  onError,
}: {
  mensaje: MensajeRow | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!mensaje;
  const [form, setForm] = useState<FormState>(() => mensaje ? {
    nombre: mensaje.nombre,
    destino: mensaje.destino,
    hora_envio: horaCorta(mensaje.hora_envio),
    dias_semana: mensaje.dias_semana,
    mensaje_template: mensaje.mensaje_template,
    usar_frase_motivante: mensaje.usar_frase_motivante,
    activo: mensaje.activo,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const toggleDia = (iso: number) => {
    setForm(f => ({
      ...f,
      dias_semana: f.dias_semana.includes(iso)
        ? f.dias_semana.filter(d => d !== iso)
        : [...f.dias_semana, iso].sort((a, b) => a - b),
    }));
  };

  const guardar = async () => {
    setError(null);
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.mensaje_template.trim()) { setError('El mensaje no puede estar vacío'); return; }
    if (form.dias_semana.length === 0) { setError('Selecciona al menos un día'); return; }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/config/mensajes-telegram/${mensaje!.id}`
        : '/api/admin/config/mensajes-telegram';
      const res = await adminFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error (${res.status})`);
      onSuccess();
    } catch (err: any) {
      const msg = err.message ?? 'Error al guardar';
      setError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!saving) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEdit ? 'Editar mensaje' : 'Nuevo mensaje programado'}
          </h2>
          <button onClick={onClose} disabled={saving}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30"
            aria-label="Cerrar">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre interno</label>
            <input type="text" value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Saludo matutino Mariano"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Destino</label>
              <select value={form.destino}
                onChange={e => setForm(f => ({ ...f, destino: e.target.value as Destino }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]">
                <option value="grupo">Grupo (oficina)</option>
                <option value="privado">Privado (Amanda)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Hora (zona Guatemala)</label>
              <input type="time" value={form.hora_envio}
                onChange={e => setForm(f => ({ ...f, hora_envio: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Días de la semana</label>
            <div className="flex flex-wrap gap-2">
              {DIAS.map(d => {
                const active = form.dias_semana.includes(d.iso);
                return (
                  <button key={d.iso} type="button" onClick={() => toggleDia(d.iso)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-all ${
                      active
                        ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}>
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mensaje (HTML soportado: {`<b>, <i>, <code>, <a>`})
            </label>
            <textarea value={form.mensaje_template}
              onChange={e => setForm(f => ({ ...f, mensaje_template: e.target.value }))}
              rows={6}
              placeholder="Escribe el mensaje. Usa {frase_motivante}, {nombre_asistente}, {fecha_hoy} para reemplazos dinámicos."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2] font-mono" />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Usar frase motivante</p>
              <p className="text-xs text-slate-500">Reemplaza {`{frase_motivante}`} con una frase rotativa.</p>
            </div>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, usar_frase_motivante: !f.usar_frase_motivante }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.usar_frase_motivante ? 'bg-[#0891B2]' : 'bg-slate-300'
              }`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform ${
                form.usar_frase_motivante ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Activo</p>
              <p className="text-xs text-slate-500">Si está pausado, el cron lo ignora.</p>
            </div>
            <button type="button"
              onClick={() => setForm(f => ({ ...f, activo: !f.activo }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                form.activo ? 'bg-emerald-500' : 'bg-slate-300'
              }`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform ${
                form.activo ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30">
            Cancelar
          </button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg disabled:opacity-40">
            {saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear mensaje')}
          </button>
        </div>
      </div>
    </div>
  );
}
