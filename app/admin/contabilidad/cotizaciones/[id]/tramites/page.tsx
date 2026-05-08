// ============================================================================
// app/admin/contabilidad/cotizaciones/[id]/tramites/page.tsx
// Vista de trámites + avances de una cotización. Permite:
//   - Ver lista de trámites con badge de estado
//   - Cambiar estado del trámite con un click
//   - Editar nombre inline
//   - Crear avance rápido inline (fecha + textarea + adjunto opcional)
//   - Eliminar / fusionar trámites
//   - Crear nuevo trámite (sin items asignados — útil para casos no auto-mapeados)
//   - Botón "Informar al cliente" que abre el modal con borrador pre-llenado
// ============================================================================

'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q } from '@/components/admin/ui';
import { InformarAvanceModal } from '@/components/admin/informar-avance-modal';
import type { EstadoTramite, TramiteConDetalle } from '@/lib/types';

const ESTADOS: { value: EstadoTramite; label: string; classes: string }[] = [
  { value: 'pendiente',   label: 'Pendiente',   classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  { value: 'en_proceso',  label: 'En proceso',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'completado',  label: 'Completado',  classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'suspendido',  label: 'Suspendido',  classes: 'bg-red-50 text-red-700 border-red-200' },
];

const estadoMeta = (e: EstadoTramite) => ESTADOS.find(s => s.value === e) ?? ESTADOS[0];

interface CotizacionMin {
  id: string;
  numero: string;
  estado: string;
  cliente: { id: string; nombre: string; email: string | null } | null;
}

export default function TramitesPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data: cot } = useFetch<CotizacionMin>(
    id ? `/api/admin/contabilidad/cotizaciones/${id}` : null,
  );
  const { data: tramitesRes, refetch } = useFetch<{ data: TramiteConDetalle[] }>(
    id ? `/api/admin/contabilidad/cotizaciones/${id}/tramites` : null,
  );
  const tramites = tramitesRes?.data ?? [];
  const totalAvancesPendientes = tramites.reduce(
    (sum, t) => sum + t.avances.filter(a => !a.notificado).length, 0,
  );

  const [showInformar, setShowInformar] = useState(false);
  const [showNuevoTramite, setShowNuevoTramite] = useState(false);

  if (!id) return null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trámites y avances"
        description={cot ? `Cotización ${cot.numero} · ${cot.cliente?.nombre ?? '—'}` : 'Cargando…'}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => router.push(`/admin/contabilidad/cotizaciones/${id}`)}
          className="px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
        >
          ← Volver al detalle
        </button>
        <button
          onClick={() => setShowNuevoTramite(true)}
          className="px-3 py-2 text-sm border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
        >
          + Nuevo trámite
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowInformar(true)}
          disabled={totalAvancesPendientes === 0}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          title={totalAvancesPendientes === 0 ? 'No hay avances pendientes de notificar' : `Informar ${totalAvancesPendientes} avance(s)`}
        >
          📧 Informar al cliente {totalAvancesPendientes > 0 && `(${totalAvancesPendientes})`}
        </button>
      </div>

      {tramites.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <p className="text-sm text-slate-500">Esta cotización no tiene trámites todavía.</p>
          <button
            onClick={() => setShowNuevoTramite(true)}
            className="mt-3 px-4 py-2 text-sm text-[#1E40AF] hover:underline"
          >Crear el primer trámite</button>
        </div>
      ) : (
        <div className="space-y-4">
          {tramites.map(t => (
            <TramiteCard key={t.id} tramite={t} tramites={tramites} onChange={refetch} />
          ))}
        </div>
      )}

      {showInformar && (
        <InformarAvanceModal
          cotizacionId={id}
          onClose={() => setShowInformar(false)}
          onSuccess={() => { setShowInformar(false); refetch(); }}
        />
      )}

      {showNuevoTramite && (
        <NuevoTramiteModal
          cotizacionId={id}
          onClose={() => setShowNuevoTramite(false)}
          onSuccess={() => { setShowNuevoTramite(false); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Tramite Card ────────────────────────────────────────────────────────────

function TramiteCard({
  tramite,
  tramites,
  onChange,
}: {
  tramite: TramiteConDetalle;
  tramites: TramiteConDetalle[];
  onChange: () => void;
}) {
  const { mutate } = useMutate();
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombre, setNombre] = useState(tramite.nombre);
  const [showAvanceForm, setShowAvanceForm] = useState(false);
  const [showFusionar, setShowFusionar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const totalItems = tramite.items.reduce((sum, it) => sum + Number(it.total), 0);

  const guardarNombre = async () => {
    const n = nombre.trim();
    if (!n || n === tramite.nombre) { setEditandoNombre(false); return; }
    await mutate(`/api/admin/contabilidad/tramites/${tramite.id}`, {
      method: 'PATCH',
      body: { nombre: n },
      onSuccess: () => { setEditandoNombre(false); onChange(); },
      onError: () => setEditandoNombre(false),
    });
  };

  const cambiarEstado = async (estado: EstadoTramite) => {
    if (estado === tramite.estado) return;
    await mutate(`/api/admin/contabilidad/tramites/${tramite.id}`, {
      method: 'PATCH',
      body: { estado },
      onSuccess: () => onChange(),
    });
  };

  const eliminar = async () => {
    await mutate(`/api/admin/contabilidad/tramites/${tramite.id}`, {
      method: 'DELETE',
      onSuccess: () => { setConfirmDelete(false); onChange(); },
    });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {editandoNombre ? (
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={e => {
                if (e.key === 'Enter') guardarNombre();
                if (e.key === 'Escape') { setNombre(tramite.nombre); setEditandoNombre(false); }
              }}
              className="w-full px-2 py-1 text-base font-semibold border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30"
            />
          ) : (
            <button
              onClick={() => setEditandoNombre(true)}
              className="text-left text-base font-semibold text-slate-900 hover:underline"
              title="Editar nombre"
            >
              {tramite.nombre}
            </button>
          )}
          {tramite.items.length > 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {tramite.items.length} ítem{tramite.items.length === 1 ? '' : 's'} · Total {Q(totalItems)}
            </p>
          )}
        </div>

        <EstadoSelector estado={tramite.estado} onChange={cambiarEstado} />

        <div className="relative">
          <details className="group">
            <summary className="list-none cursor-pointer p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100">⋯</summary>
            <div className="absolute right-0 top-9 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[180px]">
              {tramites.length > 1 && (
                <button
                  onClick={() => setShowFusionar(true)}
                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  🔗 Combinar con…
                </button>
              )}
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                🗑 Eliminar trámite
              </button>
            </div>
          </details>
        </div>
      </div>

      {/* Items asignados (si los hay) */}
      {tramite.items.length > 0 && (
        <div className="px-5 py-2 bg-slate-50/50 border-b border-slate-100">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Ítems</p>
          <ul className="space-y-0.5">
            {tramite.items.map(it => (
              <li key={it.id} className="text-xs text-slate-600 flex items-center gap-2">
                <span className="flex-1 truncate">• {it.descripcion}</span>
                <span className="text-slate-400">{Q(it.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Avances */}
      <div className="px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">
            Avances {tramite.avances.length > 0 && `(${tramite.avances.length})`}
          </p>
          {!showAvanceForm && (
            <button
              onClick={() => setShowAvanceForm(true)}
              className="text-xs font-medium text-[#1E40AF] hover:underline"
            >
              + Avance
            </button>
          )}
        </div>

        {showAvanceForm && (
          <AvanceForm
            tramiteId={tramite.id}
            onCancel={() => setShowAvanceForm(false)}
            onSuccess={() => { setShowAvanceForm(false); onChange(); }}
          />
        )}

        {tramite.avances.length === 0 && !showAvanceForm ? (
          <p className="text-sm text-slate-400 italic py-2">Sin avances registrados.</p>
        ) : (
          <ul className="space-y-2 mt-2">
            {tramite.avances.map(a => (
              <AvanceItem key={a.id} avance={a} onChange={onChange} />
            ))}
          </ul>
        )}
      </div>

      {showFusionar && (
        <FusionarModal
          tramite={tramite}
          opciones={tramites.filter(t => t.id !== tramite.id)}
          onClose={() => setShowFusionar(false)}
          onSuccess={() => { setShowFusionar(false); onChange(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          tramite={tramite}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={eliminar}
        />
      )}
    </div>
  );
}

// ── Estado selector ────────────────────────────────────────────────────────

function EstadoSelector({ estado, onChange }: { estado: EstadoTramite; onChange: (e: EstadoTramite) => void }) {
  const meta = estadoMeta(estado);
  return (
    <details className="relative">
      <summary
        className={`list-none cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border ${meta.classes}`}
        title="Cambiar estado"
      >
        {meta.label} ▾
      </summary>
      <div className="absolute right-0 top-8 z-10 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
        {ESTADOS.map(s => (
          <button
            key={s.value}
            onClick={() => { onChange(s.value); (document.activeElement as HTMLElement)?.blur(); }}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 ${s.value === estado ? 'font-semibold' : ''}`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </details>
  );
}

// ── Avance form (inline rápido) ────────────────────────────────────────────

function AvanceForm({ tramiteId, onCancel, onSuccess }: {
  tramiteId: string; onCancel: () => void; onSuccess: () => void;
}) {
  const [fecha, setFecha] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }));
  const [descripcion, setDescripcion] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const guardar = async () => {
    setError(null);
    if (!descripcion.trim()) return setError('La descripción es obligatoria');
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('fecha', fecha);
      fd.append('descripcion', descripcion.trim());
      if (file) fd.append('documento', file);
      const res = await fetch(`/api/admin/contabilidad/tramites/${tramiteId}/avances`, {
        method: 'POST', body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el avance');
    }
    setEnviando(false);
  };

  return (
    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <input
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          className="px-2 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 bg-white"
        />
        <textarea
          autoFocus
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) guardar();
            if (e.key === 'Escape') onCancel();
          }}
          placeholder="¿Qué pasó? (Ctrl+Enter para guardar)"
          rows={2}
          className="flex-1 min-w-64 px-3 py-1.5 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 bg-white resize-y"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-1 text-xs border border-slate-200 rounded text-slate-600 hover:bg-white"
          >
            📎 {file ? file.name : 'Adjunto opcional'}
          </button>
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-xs text-red-600 hover:underline"
            >×</button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            disabled={enviando}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900"
          >Cancelar</button>
          <button
            onClick={guardar}
            disabled={enviando || !descripcion.trim()}
            className="px-3 py-1.5 text-xs font-medium text-white bg-[#1E40AF] rounded hover:bg-[#1E3A8A] disabled:opacity-40"
          >
            {enviando ? 'Guardando…' : 'Guardar avance'}
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

// ── Avance item ────────────────────────────────────────────────────────────

function AvanceItem({ avance, onChange }: { avance: TramiteConDetalle['avances'][number]; onChange: () => void }) {
  const { mutate } = useMutate();
  const [confirmDel, setConfirmDel] = useState(false);

  const eliminar = async () => {
    await mutate(`/api/admin/contabilidad/tramites/avances/${avance.id}`, {
      method: 'DELETE',
      onSuccess: () => { setConfirmDel(false); onChange(); },
    });
  };

  const fechaFmt = new Date(`${avance.fecha}T12:00:00-06:00`).toLocaleDateString('es-GT', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
  });

  return (
    <li className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-50/80">
      <div className="text-xs text-slate-500 font-medium pt-0.5 min-w-[80px]">{fechaFmt}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{avance.descripcion}</p>
        <div className="mt-1 flex items-center gap-3 text-xs">
          {avance.documento_url && (
            <a
              href={`/api/admin/contabilidad/tramites/avances/${avance.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1E40AF] hover:underline"
            >📎 Adjunto</a>
          )}
          {avance.notificado ? (
            <span className="text-emerald-600">✓ Notificado al cliente</span>
          ) : (
            <span className="text-amber-600">○ Pendiente de notificar</span>
          )}
        </div>
      </div>
      {confirmDel ? (
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">¿Eliminar?</span>
          <button onClick={eliminar} className="text-xs text-red-600 font-medium hover:underline">Sí</button>
          <button onClick={() => setConfirmDel(false)} className="text-xs text-slate-500 hover:underline">No</button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDel(true)}
          className="text-xs text-slate-400 hover:text-red-600 transition-colors"
          title="Eliminar avance"
        >×</button>
      )}
    </li>
  );
}

// ── Modales ─────────────────────────────────────────────────────────────────

function NuevoTramiteModal({ cotizacionId, onClose, onSuccess }: {
  cotizacionId: string; onClose: () => void; onSuccess: () => void;
}) {
  const { mutate } = useMutate();
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = async () => {
    setError(null);
    if (!nombre.trim()) return setError('El nombre es obligatorio');
    setEnviando(true);
    let ok = false;
    await mutate(`/api/admin/contabilidad/cotizaciones/${cotizacionId}/tramites`, {
      body: { nombre: nombre.trim() },
      onSuccess: () => { ok = true; },
      onError: (err: unknown) => setError(typeof err === 'string' ? err : 'Error al crear'),
    });
    setEnviando(false);
    if (ok) onSuccess();
  };

  return (
    <ModalShell title="Nuevo trámite" onClose={onClose} disabled={enviando}>
      <div className="px-6 py-5 space-y-3">
        <label className="block text-sm font-medium text-slate-700">Nombre del trámite</label>
        <input
          autoFocus
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') crear(); }}
          placeholder="Ej: Inscripción de mandato en Registro Mercantil"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
      <ModalActions onClose={onClose} onConfirm={crear} confirmLabel={enviando ? 'Creando…' : 'Crear'} disabled={enviando} />
    </ModalShell>
  );
}

function FusionarModal({ tramite, opciones, onClose, onSuccess }: {
  tramite: TramiteConDetalle; opciones: TramiteConDetalle[]; onClose: () => void; onSuccess: () => void;
}) {
  const { mutate } = useMutate();
  const [targetId, setTargetId] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fusionar = async () => {
    setError(null);
    if (!targetId) return setError('Selecciona el trámite destino');
    setEnviando(true);
    let ok = false;
    await mutate(`/api/admin/contabilidad/tramites/${tramite.id}/fusionar`, {
      body: { target_id: targetId },
      onSuccess: () => { ok = true; },
      onError: (err: unknown) => setError(typeof err === 'string' ? err : 'Error al fusionar'),
    });
    setEnviando(false);
    if (ok) onSuccess();
  };

  return (
    <ModalShell title={`Combinar "${tramite.nombre}" con…`} onClose={onClose} disabled={enviando}>
      <div className="px-6 py-5 space-y-3">
        <p className="text-xs text-slate-500">
          Los ítems y avances de este trámite se moverán al trámite destino. Este trámite se eliminará.
        </p>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30"
        >
          <option value="">— Selecciona un trámite —</option>
          {opciones.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
      <ModalActions onClose={onClose} onConfirm={fusionar} confirmLabel={enviando ? 'Combinando…' : 'Combinar'} disabled={enviando || !targetId} />
    </ModalShell>
  );
}

function ConfirmDeleteModal({ tramite, onCancel, onConfirm }: {
  tramite: TramiteConDetalle; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <ModalShell title="Eliminar trámite" onClose={onCancel}>
      <div className="px-6 py-5 space-y-2">
        <p className="text-sm text-slate-700">
          ¿Eliminar <strong>{tramite.nombre}</strong>?
        </p>
        <p className="text-xs text-slate-500">
          Los {tramite.avances.length} avance{tramite.avances.length === 1 ? '' : 's'} se eliminarán también.
          Los {tramite.items.length} ítem{tramite.items.length === 1 ? '' : 's'} de la cotización quedarán sin trámite asignado.
        </p>
      </div>
      <ModalActions onClose={onCancel} onConfirm={onConfirm} confirmLabel="Eliminar" danger />
    </ModalShell>
  );
}

function ModalShell({ title, onClose, disabled, children }: {
  title: string; onClose: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!disabled) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            disabled={disabled}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30"
          >×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, onConfirm, confirmLabel, disabled, danger }: {
  onClose: () => void; onConfirm: () => void; confirmLabel: string; disabled?: boolean; danger?: boolean;
}) {
  return (
    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
      <button
        onClick={onClose}
        disabled={disabled}
        className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
      >Cancelar</button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${
          danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0F172A] hover:bg-slate-800'
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
