// ============================================================================
// app/admin/configuracion/notificaciones-email/page.tsx
// CRUD de reglas de notificación email → Telegram
// (legal.notificaciones_email_telegram)
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { PageHeader, Badge, EmptyState, TableSkeleton, Section } from '@/components/admin/ui';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReglaRow {
  id: string;
  email_destinatario: string;
  email_remitente: string | null;
  telegram_chat_id: string;
  nombre_destinatario: string;
  mensaje_saludo: string | null;
  activo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

interface FormState {
  nombre_destinatario: string;
  email_destinatario: string;
  email_remitente: string;
  telegram_chat_id: string;
  mensaje_saludo: string;
  activo: boolean;
}

const CUENTAS_REMITENTE = [
  { value: '', label: 'Cualquier cuenta' },
  { value: 'contador@papeleo.legal', label: 'contador@papeleo.legal' },
  { value: 'asistente@papeleo.legal', label: 'asistente@papeleo.legal' },
  { value: 'amanda@papeleo.legal', label: 'amanda@papeleo.legal' },
];

const EMPTY_FORM: FormState = {
  nombre_destinatario: '',
  email_destinatario: '',
  email_remitente: '',
  telegram_chat_id: '',
  mensaje_saludo: '',
  activo: true,
};

const SALUDO_DEFAULT_PREVIEW =
  '👋 ¡Hola {nombre}, buen día!\n\n' +
  '📧 Se te ha enviado un correo desde {cuenta_remitente}\n\n' +
  '📌 Asunto: {asunto}\n' +
  '📝 Resumen: {resumen}\n\n' +
  'Por favor revisa tu bandeja de entrada.\n\n' +
  '— Despacho Jurídico Amanda Santizo';

// ── Page ───────────────────────────────────────────────────────────────────

export default function NotificacionesEmailPage() {
  const { data, loading, refetch } = useFetch<{ data: ReglaRow[] }>(
    '/api/admin/notificaciones-email-telegram',
  );
  const reglas = data?.data ?? [];

  const [editing, setEditing] = useState<ReglaRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ReglaRow | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);
  const { mutate } = useMutate();

  const addToast = (message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const toggleActivo = async (r: ReglaRow) => {
    const result = await mutate(`/api/admin/notificaciones-email-telegram/${r.id}`, {
      method: 'PATCH',
      body: { activo: !r.activo },
    });
    if (result) { refetch(); } else { addToast('Error al actualizar', 'error'); }
  };

  const eliminar = async () => {
    if (!deleteTarget) return;
    const result = await mutate(`/api/admin/notificaciones-email-telegram/${deleteTarget.id}`, {
      method: 'DELETE',
    });
    if (result) {
      addToast('Regla eliminada', 'success');
      refetch();
      setDeleteTarget(null);
    } else {
      addToast('Error al eliminar', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notificaciones por email → Telegram"
        description="Cuando se envía un correo a cierto destinatario, avisa automáticamente a un chat de Telegram."
        action={{ label: 'Nueva regla', icon: '+', onClick: () => setCreating(true) }}
      />

      {loading ? <TableSkeleton rows={3} /> : reglas.length === 0 ? (
        <EmptyState
          icon="🔔"
          title="Sin reglas configuradas"
          description="Crea la primera regla para avisar por Telegram cuando se envíe un correo a alguien."
          action={{ label: '+ Nueva regla', onClick: () => setCreating(true) }}
        />
      ) : (
        <Section title={`Reglas (${reglas.length})`} noPadding>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Destinatario', 'Email', 'Remitente', 'Chat ID', 'Activo', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reglas.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm font-medium text-slate-900">{r.nombre_destinatario}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{r.email_destinatario}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{r.email_remitente ?? 'Cualquiera'}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">{r.telegram_chat_id}</td>
                    <td className="py-3 px-4">
                      <button onClick={() => toggleActivo(r)} title="Activar / pausar"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${r.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform ${r.activo ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="py-3 px-4 pr-5 text-xs">
                      <div className="flex items-center gap-3">
                        <button onClick={() => setEditing(r)} className="text-[#0F172A] hover:underline font-medium">Editar</button>
                        <button onClick={() => setDeleteTarget(r)} className="text-red-600 hover:underline font-medium">Eliminar</button>
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
        <p className="font-semibold mb-2">📝 Variables del saludo personalizado:</p>
        <ul className="space-y-1 text-xs">
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{nombre}'}</code> — nombre del destinatario</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{asunto}'}</code> — asunto del correo</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{resumen}'}</code> — primeras palabras del cuerpo</li>
          <li><code className="bg-white px-1.5 py-0.5 rounded">{'{cuenta_remitente}'}</code> — cuenta desde la que se envió</li>
        </ul>
        <p className="text-xs mt-2 text-blue-700">Si dejas el saludo vacío, se usa el formato por defecto. El aviso se dispara al enviar (To o CC) hacia el email de la regla.</p>
      </div>

      {(creating || editing) && (
        <ReglaFormModal
          regla={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSuccess={() => { setCreating(false); setEditing(null); refetch(); addToast(editing ? 'Regla actualizada' : 'Regla creada', 'success'); }}
          onError={(msg) => addToast(msg, 'error')}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar regla</h3>
            <p className="text-sm text-slate-600 mb-5">
              ¿Eliminar la regla de <strong>{deleteTarget.nombre_destinatario}</strong> ({deleteTarget.email_destinatario})? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={eliminar} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal crear/editar ───────────────────────────────────────────────────────

function ReglaFormModal({
  regla, onClose, onSuccess, onError,
}: {
  regla: ReglaRow | null;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const isEdit = !!regla;
  const [form, setForm] = useState<FormState>(() => regla ? {
    nombre_destinatario: regla.nombre_destinatario,
    email_destinatario: regla.email_destinatario,
    email_remitente: regla.email_remitente ?? '',
    telegram_chat_id: regla.telegram_chat_id,
    mensaje_saludo: regla.mensaje_saludo ?? '',
    activo: regla.activo,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const set = (key: keyof FormState) => (v: string | boolean) => setForm(f => ({ ...f, [key]: v }));

  const guardar = async () => {
    setError(null);
    if (!form.nombre_destinatario.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.email_destinatario.trim()) { setError('El email destinatario es obligatorio'); return; }
    if (!form.telegram_chat_id.trim()) { setError('El chat ID de Telegram es obligatorio'); return; }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/admin/notificaciones-email-telegram/${regla!.id}`
        : '/api/admin/notificaciones-email-telegram';
      const res = await adminFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          email_remitente: form.email_remitente || null,
          mensaje_saludo: form.mensaje_saludo.trim() || null,
        }),
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

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { if (!saving) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? 'Editar regla' : 'Nueva regla de notificación'}</h2>
          <button onClick={onClose} disabled={saving} className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30" aria-label="Cerrar">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre del destinatario *</label>
              <input type="text" value={form.nombre_destinatario} onChange={e => set('nombre_destinatario')(e.target.value)} placeholder="Ej: Anita" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email del destinatario *</label>
              <input type="email" value={form.email_destinatario} onChange={e => set('email_destinatario')(e.target.value)} placeholder="aibarguen7@gmail.com" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta remitente que dispara</label>
              <select value={form.email_remitente} onChange={e => set('email_remitente')(e.target.value)} className={`${inputCls} bg-white`}>
                {CUENTAS_REMITENTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Chat ID de Telegram *</label>
              <input type="text" value={form.telegram_chat_id} onChange={e => set('telegram_chat_id')(e.target.value)} placeholder="-1001234567890" className={`${inputCls} font-mono`} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Saludo personalizado <span className="text-slate-400 font-normal">(opcional — vacío usa el formato por defecto)</span>
            </label>
            <textarea value={form.mensaje_saludo} onChange={e => set('mensaje_saludo')(e.target.value)} rows={7}
              placeholder={SALUDO_DEFAULT_PREVIEW}
              className={`${inputCls} font-mono`} />
            <p className="text-xs text-slate-400 mt-1">Variables: {'{nombre}'}, {'{asunto}'}, {'{resumen}'}, {'{cuenta_remitente}'}.</p>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-900">Activo</p>
              <p className="text-xs text-slate-500">Si está pausado, no se envía la notificación.</p>
            </div>
            <button type="button" onClick={() => set('activo')(!form.activo)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activo ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white transform transition-transform ${form.activo ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30">Cancelar</button>
          <button onClick={guardar} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg disabled:opacity-40">
            {saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Crear regla')}
          </button>
        </div>
      </div>
    </div>
  );
}
