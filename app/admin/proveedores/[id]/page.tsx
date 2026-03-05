// ============================================================================
// app/admin/proveedores/[id]/page.tsx
// Detalle de proveedor con edición inline
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { Section, Skeleton, EmptyState } from '@/components/admin/ui';

const INPUT = 'w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';

const TIPO_BADGE: Record<string, string> = {
  freelance: 'bg-purple-50 text-purple-700',
  empresa: 'bg-blue-50 text-blue-700',
  consultor: 'bg-teal-50 text-teal-700',
  perito: 'bg-amber-50 text-amber-700',
  traductor: 'bg-indigo-50 text-indigo-700',
  notificador: 'bg-rose-50 text-rose-700',
  otro: 'bg-slate-100 text-slate-600',
};

const TIPOS = [
  { value: 'freelance', label: 'Freelance' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'perito', label: 'Perito' },
  { value: 'traductor', label: 'Traductor' },
  { value: 'notificador', label: 'Notificador' },
  { value: 'otro', label: 'Otro' },
];

interface ProveedorDetalle {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  especialidad: string | null;
  nit: string | null;
  dpi: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  cuenta_nombre: string | null;
  tarifa_hora: number | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export default function ProveedorDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: p, loading, error, refetch } = useFetch<ProveedorDetalle>(
    `/api/admin/proveedores/${id}`
  );
  const { mutate, loading: saving } = useMutate();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = useCallback(() => {
    if (!p) return;
    setForm({
      nombre: p.nombre,
      tipo: p.tipo,
      especialidad: p.especialidad ?? '',
      nit: p.nit ?? '',
      dpi: p.dpi ?? '',
      email: p.email ?? '',
      telefono: p.telefono ?? '',
      direccion: p.direccion ?? '',
      banco: p.banco ?? '',
      tipo_cuenta: p.tipo_cuenta ?? '',
      numero_cuenta: p.numero_cuenta ?? '',
      cuenta_nombre: p.cuenta_nombre ?? '',
      tarifa_hora: p.tarifa_hora != null ? String(p.tarifa_hora) : '',
      notas: p.notas ?? '',
    });
    setEditing(true);
    setSaveError(null);
  }, [p]);

  const cancelEdit = () => { setEditing(false); setSaveError(null); };

  const saveEdit = useCallback(async () => {
    setSaveError(null);
    if (!form.nombre?.trim()) { setSaveError('El nombre es obligatorio'); return; }

    await mutate(`/api/admin/proveedores/${id}`, {
      method: 'PATCH',
      body: {
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        especialidad: form.especialidad.trim() || null,
        nit: form.nit.trim() || null,
        dpi: form.dpi.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        banco: form.banco.trim() || null,
        tipo_cuenta: form.tipo_cuenta.trim() || null,
        numero_cuenta: form.numero_cuenta.trim() || null,
        cuenta_nombre: form.cuenta_nombre.trim() || null,
        tarifa_hora: form.tarifa_hora ? parseFloat(form.tarifa_hora) : null,
        notas: form.notas.trim() || null,
      },
      onSuccess: () => { setEditing(false); refetch(); },
      onError: (err) => setSaveError(err),
    });
  }, [form, id, mutate, refetch]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    await mutate(`/api/admin/proveedores/${id}`, {
      method: 'DELETE',
      onSuccess: () => router.push('/admin/proveedores'),
      onError: (err) => { alert(`Error: ${err}`); setDeleting(false); setShowDeleteModal(false); },
    });
  }, [id, mutate, router]);

  // ── Loading / Error ─────────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-4 max-w-3xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (error || !p) return (
    <EmptyState icon="❌" title="Proveedor no encontrado"
      action={{ label: 'Volver a proveedores', onClick: () => router.push('/admin/proveedores') }} />
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/admin/proveedores')}
          className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          ← Proveedores
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl">🤝</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{p.nombre}</h1>
              <p className="text-sm text-slate-500">
                {p.codigo}
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                  TIPO_BADGE[p.tipo] ?? TIPO_BADGE.otro
                }`}>{p.tipo}</span>
                {p.especialidad && <span className="ml-2 text-slate-400">· {p.especialidad}</span>}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.activo && (
              <button onClick={() => setShowDeleteModal(true)}
                className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                Desactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit toggle */}
      <div className="flex justify-end">
        {!editing ? (
          <button onClick={startEdit}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Editar datos
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={cancelEdit}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{saveError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Contact info */}
        <Section title="Información de contacto">
          <div className="space-y-4">
            <Field label="Nombre" value={p.nombre} editValue={form.nombre} editing={editing} onChange={set('nombre')} />
            {editing && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                <select value={form.tipo} onChange={set('tipo')} className={INPUT}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            )}
            <Field label="Especialidad" value={p.especialidad} editValue={form.especialidad} editing={editing} onChange={set('especialidad')} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIT" value={p.nit} editValue={form.nit} editing={editing} onChange={set('nit')} mono />
              <Field label="DPI" value={p.dpi} editValue={form.dpi} editing={editing} onChange={set('dpi')} mono />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={p.email} editValue={form.email} editing={editing} onChange={set('email')} type="email" />
              <Field label="Teléfono" value={p.telefono} editValue={form.telefono} editing={editing} onChange={set('telefono')} type="tel" />
            </div>
            <Field label="Dirección" value={p.direccion} editValue={form.direccion} editing={editing} onChange={set('direccion')} />
          </div>
        </Section>

        {/* Bank info */}
        <Section title="Datos bancarios">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco" value={p.banco} editValue={form.banco} editing={editing} onChange={set('banco')} />
              <Field label="Tipo de cuenta" value={p.tipo_cuenta} editValue={form.tipo_cuenta} editing={editing} onChange={set('tipo_cuenta')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Número de cuenta" value={p.numero_cuenta} editValue={form.numero_cuenta} editing={editing} onChange={set('numero_cuenta')} mono />
              <Field label="Nombre en cuenta" value={p.cuenta_nombre} editValue={form.cuenta_nombre} editing={editing} onChange={set('cuenta_nombre')} />
            </div>
            <Field label="Tarifa por hora (Q)" value={p.tarifa_hora != null ? `Q${p.tarifa_hora.toFixed(2)}` : null}
              editValue={form.tarifa_hora} editing={editing} onChange={set('tarifa_hora')} type="number" mono />
          </div>
        </Section>
      </div>

      {/* Notas */}
      <Section title="Notas internas">
        {editing ? (
          <textarea value={form.notas} onChange={set('notas') as any} rows={3}
            placeholder="Notas internas..."
            className={`${INPUT} resize-y`} />
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{p.notas || <span className="text-slate-400">Sin notas</span>}</p>
        )}
      </Section>

      {/* Meta */}
      <div className="text-xs text-slate-400 flex gap-4">
        <span>Creado: {new Date(p.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span>ID: {p.id}</span>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Desactivar proveedor</h3>
            <p className="text-sm text-slate-600 mb-1">
              Se desactivará a <strong>{p.nombre}</strong>.
            </p>
            <p className="text-xs text-slate-400 mb-5">Esta acción se puede revertir reactivando al proveedor.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Field component ─────────────────────────────────────────────────

function Field({ label, value, editValue, editing, onChange, type = 'text', mono }: {
  label: string;
  value: string | null;
  editValue?: string;
  editing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editing ? (
        <input type={type} value={editValue ?? ''} onChange={onChange}
          className={`${INPUT} ${mono ? 'font-mono' : ''}`} />
      ) : (
        <p className={`text-sm text-slate-900 py-2.5 ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-slate-400">—</span>}
        </p>
      )}
    </div>
  );
}
