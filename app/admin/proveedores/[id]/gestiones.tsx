// ============================================================================
// app/admin/proveedores/[id]/gestiones.tsx
// Panel "Gestiones asignadas" en la ficha de proveedor:
//  - Tabla de gestiones con estado, fechas y alerta de seguimiento.
//  - Modal crear/editar gestión (con dropdown de clientes).
//  - Timeline expandible de seguimientos + alta rápida de seguimiento.
//  - Atajo para enviar correo de seguimiento desde el centro de comunicaciones.
// ============================================================================

'use client';

import { Fragment, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';

const INPUT = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completado', label: 'Completado' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'cancelado', label: 'Cancelado' },
] as const;

const ESTADO_BADGE: Record<string, string> = {
  pendiente: 'bg-slate-100 text-slate-600',
  en_proceso: 'bg-blue-50 text-blue-700',
  completado: 'bg-emerald-50 text-emerald-700',
  suspendido: 'bg-red-50 text-red-700',
  cancelado: 'bg-slate-800 text-white',
};

const VIAS = [
  { value: 'email', label: '📧 Email' },
  { value: 'telefono', label: '📞 Teléfono' },
  { value: 'presencial', label: '🤝 Presencial' },
  { value: 'whatsapp', label: '💬 WhatsApp' },
  { value: 'teams', label: '👥 Teams' },
] as const;

interface Seguimiento {
  id: string;
  gestion_id: string;
  fecha: string;
  descripcion: string;
  via: string | null;
  respuesta: string | null;
}

interface Gestion {
  id: string;
  proveedor_id: string;
  cliente_id: string | null;
  numero_expediente: string | null;
  nombre_gestion: string;
  entidad: string | null;
  descripcion: string | null;
  estado: string;
  fecha_asignacion: string | null;
  fecha_limite: string | null;
  ultimo_seguimiento: string | null;
  notas: string | null;
  cliente?: { id: string; nombre: string } | null;
  seguimientos?: Seguimiento[];
}

interface ClienteOpt { id: string; nombre: string }

function hoyGT(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

function diasDesde(fecha: string): number {
  const a = new Date(fecha + 'T00:00:00');
  const b = new Date(hoyGT() + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function fmtFecha(fecha: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// Badge de alerta: NULL o > 15 días sin seguimiento.
function alertaSeguimiento(g: Gestion): { dias: number } | null {
  if (['completado', 'cancelado'].includes(g.estado)) return null;
  if (!g.ultimo_seguimiento) {
    const ref = g.fecha_asignacion;
    return { dias: ref ? diasDesde(ref) : -1 };
  }
  const dias = diasDesde(g.ultimo_seguimiento);
  return dias > 15 ? { dias } : null;
}

export function GestionesProveedor({
  proveedorId,
  proveedorNombre,
}: {
  proveedorId: string;
  proveedorNombre: string;
}) {
  const router = useRouter();
  const { data, loading, refetch } = useFetch<{ data: Gestion[] }>(
    `/api/admin/proveedores/${proveedorId}/gestiones`,
  );
  const gestiones = data?.data ?? [];

  const [expandida, setExpandida] = useState<string | null>(null);
  const [modalGestion, setModalGestion] = useState<{ mode: 'crear' | 'editar'; gestion?: Gestion } | null>(null);
  const [seguimientoDe, setSeguimientoDe] = useState<Gestion | null>(null);
  const [confirmarBorrar, setConfirmarBorrar] = useState<Gestion | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const enviarSeguimiento = () => {
    router.push(`/admin/email/comunicaciones?plantilla=seguimiento-proveedor&proveedor=${proveedorId}`);
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
        <h3 className="font-semibold text-slate-900">
          Gestiones asignadas
          {gestiones.length > 0 && <span className="ml-2 text-sm font-normal text-slate-400">({gestiones.length})</span>}
        </h3>
        <div className="flex gap-2">
          {gestiones.length > 0 && (
            <button
              onClick={enviarSeguimiento}
              className="px-3 py-1.5 text-sm font-medium text-[#0891B2] border border-cyan-200 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition-colors"
            >
              📧 Enviar seguimiento
            </button>
          )}
          <button
            onClick={() => setModalGestion({ mode: 'crear' })}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/90 transition-colors"
          >
            + Nueva gestión
          </button>
        </div>
      </div>

      {toast && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg text-sm bg-emerald-50 text-emerald-800 border border-emerald-200">
          {toast}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-slate-400">Cargando gestiones…</div>
      ) : gestiones.length === 0 ? (
        <div className="p-8 text-center">
          <span className="text-3xl">🗂️</span>
          <p className="text-sm text-slate-500 mt-2">Sin gestiones asignadas.</p>
          <button
            onClick={() => setModalGestion({ mode: 'crear' })}
            className="mt-3 text-sm font-medium text-[#0891B2] hover:underline"
          >
            + Crear la primera gestión
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 px-3 font-medium">Expediente</th>
                <th className="py-2 px-3 font-medium">Gestión</th>
                <th className="py-2 px-3 font-medium">Entidad</th>
                <th className="py-2 px-3 font-medium">Cliente</th>
                <th className="py-2 px-3 font-medium">Estado</th>
                <th className="py-2 px-3 font-medium">Asignación</th>
                <th className="py-2 px-3 font-medium">Último seguim.</th>
                <th className="py-2 px-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {gestiones.map((g) => {
                const alerta = alertaSeguimiento(g);
                const abierta = expandida === g.id;
                const segs = g.seguimientos ?? [];
                return (
                  <Fragment key={g.id}>
                    <tr
                      className="border-b border-slate-100 hover:bg-slate-50/60 cursor-pointer align-top"
                      onClick={() => setExpandida(abierta ? null : g.id)}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-600">{g.numero_expediente || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-800 max-w-[220px]">
                        <span className="text-slate-400 mr-1">{abierta ? '▾' : '▸'}</span>
                        {g.nombre_gestion}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{g.entidad || '—'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{g.cliente?.nombre || '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${ESTADO_BADGE[g.estado] ?? ESTADO_BADGE.pendiente}`}>
                          {ESTADOS.find((e) => e.value === g.estado)?.label ?? g.estado}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{fmtFecha(g.fecha_asignacion)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-slate-600">{fmtFecha(g.ultimo_seguimiento)}</span>
                        {alerta && (
                          <span className="block mt-0.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                            ⚠️ {alerta.dias < 0 ? 'Sin seguimiento' : `Sin seguimiento hace ${alerta.dias} días`}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSeguimientoDe(g)}
                          className="text-xs font-medium text-[#0891B2] hover:underline mr-2"
                          title="Registrar seguimiento"
                        >
                          + Seguim.
                        </button>
                        <button
                          onClick={() => setModalGestion({ mode: 'editar', gestion: g })}
                          className="text-xs text-slate-500 hover:text-slate-800 mr-2"
                          title="Editar gestión"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => setConfirmarBorrar(g)}
                          className="text-xs text-red-500 hover:text-red-700"
                          title="Eliminar gestión"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                    {abierta && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={8} className="px-6 py-4">
                          <Timeline gestion={g} segs={segs} onAdd={() => setSeguimientoDe(g)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalGestion && (
        <GestionModal
          mode={modalGestion.mode}
          gestion={modalGestion.gestion}
          proveedorId={proveedorId}
          onClose={() => setModalGestion(null)}
          onSaved={(msg) => { setModalGestion(null); setToast(msg); refetch(); }}
        />
      )}

      {seguimientoDe && (
        <SeguimientoModal
          gestion={seguimientoDe}
          onClose={() => setSeguimientoDe(null)}
          onSaved={() => { setSeguimientoDe(null); setToast('Seguimiento registrado'); refetch(); }}
        />
      )}

      {confirmarBorrar && (
        <BorrarModal
          gestion={confirmarBorrar}
          onClose={() => setConfirmarBorrar(null)}
          onDeleted={() => { setConfirmarBorrar(null); setToast('Gestión eliminada'); refetch(); }}
        />
      )}
    </section>
  );
}

// ── Timeline de seguimientos ─────────────────────────────────────────────

function Timeline({ gestion, segs, onAdd }: { gestion: Gestion; segs: Seguimiento[]; onAdd: () => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Seguimientos</h4>
        <button onClick={onAdd} className="text-xs font-medium text-[#0891B2] hover:underline">+ Seguimiento</button>
      </div>
      {gestion.descripcion && (
        <p className="text-xs text-slate-500 mb-3 italic">{gestion.descripcion}</p>
      )}
      {segs.length === 0 ? (
        <p className="text-sm text-slate-400">Aún no hay seguimientos registrados.</p>
      ) : (
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
          {segs.map((s) => (
            <li key={s.id} className="relative">
              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#0891B2]" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-slate-700">{fmtFecha(s.fecha)}</span>
                {s.via && (
                  <span className="text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                    {VIAS.find((v) => v.value === s.via)?.label ?? s.via}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-0.5">{s.descripcion}</p>
              {s.respuesta && (
                <p className="text-xs text-slate-500 mt-1">
                  <span className="font-medium">Respuesta:</span> {s.respuesta}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Modal crear / editar gestión ───────────────────────────────────────────

function GestionModal({
  mode, gestion, proveedorId, onClose, onSaved,
}: {
  mode: 'crear' | 'editar';
  gestion?: Gestion;
  proveedorId: string;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { mutate, loading } = useMutate();
  const { data: clientesData } = useFetch<{ data: ClienteOpt[] }>('/api/admin/clientes?activo=true&limit=300');
  const clientes = clientesData?.data ?? [];

  const [numeroExpediente, setNumeroExpediente] = useState(gestion?.numero_expediente ?? '');
  const [nombreGestion, setNombreGestion] = useState(gestion?.nombre_gestion ?? '');
  const [entidad, setEntidad] = useState(gestion?.entidad ?? '');
  const [clienteId, setClienteId] = useState(gestion?.cliente_id ?? '');
  const [descripcion, setDescripcion] = useState(gestion?.descripcion ?? '');
  const [estado, setEstado] = useState(gestion?.estado ?? 'pendiente');
  const [fechaAsignacion, setFechaAsignacion] = useState(gestion?.fecha_asignacion ?? hoyGT());
  const [fechaLimite, setFechaLimite] = useState(gestion?.fecha_limite ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useCallback(async () => {
    setError(null);
    if (!nombreGestion.trim()) { setError('El nombre de la gestión es obligatorio'); return; }

    const body = {
      numero_expediente: numeroExpediente.trim() || null,
      nombre_gestion: nombreGestion.trim(),
      entidad: entidad.trim() || null,
      cliente_id: clienteId || null,
      descripcion: descripcion.trim() || null,
      estado,
      fecha_asignacion: fechaAsignacion || null,
      fecha_limite: fechaLimite || null,
    };

    const url = mode === 'crear'
      ? `/api/admin/proveedores/${proveedorId}/gestiones`
      : `/api/admin/gestiones-proveedor/${gestion!.id}`;

    await mutate(url, {
      method: mode === 'crear' ? 'POST' : 'PATCH',
      body,
      onSuccess: () => onSaved(mode === 'crear' ? 'Gestión creada' : 'Gestión actualizada'),
      onError: (err) => setError(err),
    });
  }, [numeroExpediente, nombreGestion, entidad, clienteId, descripcion, estado, fechaAsignacion, fechaLimite, mode, gestion, proveedorId, mutate, onSaved]);

  return (
    <Modal onClose={onClose} title={mode === 'crear' ? 'Nueva gestión' : 'Editar gestión'} wide>
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Número de expediente</label>
            <input type="text" value={numeroExpediente} onChange={(e) => setNumeroExpediente(e.target.value)} className={`${INPUT} font-mono`} placeholder="DABI-S-00000-2025" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className={INPUT}>
              {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nombre de la gestión *</label>
          <input type="text" value={nombreGestion} onChange={(e) => setNombreGestion(e.target.value)} className={INPUT} autoFocus placeholder="Ej: Expediente ambiental…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Entidad</label>
            <input type="text" value={entidad} onChange={(e) => setEntidad(e.target.value)} className={INPUT} placeholder="Ej: Ministerio de Ambiente" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Cliente</label>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={INPUT}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Descripción</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={`${INPUT} resize-y`} placeholder="Detalle de la gestión encargada…" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha de asignación</label>
            <input type="date" value={fechaAsignacion} onChange={(e) => setFechaAsignacion(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha límite</label>
            <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className={INPUT} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={guardar} disabled={loading} className="px-5 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/90 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal seguimiento rápido ─────────────────────────────────────────────

function SeguimientoModal({ gestion, onClose, onSaved }: { gestion: Gestion; onClose: () => void; onSaved: () => void }) {
  const { mutate, loading } = useMutate();
  const [fecha, setFecha] = useState(hoyGT());
  const [descripcion, setDescripcion] = useState('');
  const [via, setVia] = useState('email');
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useCallback(async () => {
    setError(null);
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    await mutate(`/api/admin/gestiones-proveedor/${gestion.id}/seguimientos`, {
      method: 'POST',
      body: { fecha, descripcion: descripcion.trim(), via, respuesta: respuesta.trim() || null },
      onSuccess: () => onSaved(),
      onError: (err) => setError(err),
    });
  }, [fecha, descripcion, via, respuesta, gestion, mutate, onSaved]);

  return (
    <Modal onClose={onClose} title="Registrar seguimiento">
      <p className="text-xs text-slate-500 mb-3 -mt-1">{gestion.nombre_gestion}</p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Vía</label>
            <select value={via} onChange={(e) => setVia(e.target.value)} className={INPUT}>
              {VIAS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Descripción *</label>
          <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} autoFocus className={`${INPUT} resize-y`} placeholder="Qué se hizo / qué se solicitó…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Respuesta del proveedor (opcional)</label>
          <input type="text" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} className={INPUT} />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={guardar} disabled={loading} className="px-5 py-2 text-sm font-medium text-white bg-[#0891B2] rounded-lg hover:bg-[#0891B2]/90 disabled:opacity-50">
            {loading ? 'Guardando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Modal borrar ───────────────────────────────────────────────────────────

function BorrarModal({ gestion, onClose, onDeleted }: { gestion: Gestion; onClose: () => void; onDeleted: () => void }) {
  const { mutate, loading } = useMutate();
  return (
    <Modal onClose={onClose} title="Eliminar gestión">
      <p className="text-sm text-slate-600">
        Se eliminará la gestión <strong>{gestion.nombre_gestion}</strong> y todos sus seguimientos. Esta acción no se puede deshacer.
      </p>
      <div className="flex justify-end gap-2 pt-4">
        <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
        <button
          onClick={() => mutate(`/api/admin/gestiones-proveedor/${gestion.id}`, { method: 'DELETE', onSuccess: () => onDeleted(), onError: (e) => alert(`Error: ${e}`) })}
          disabled={loading}
          className="px-5 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? 'Eliminando…' : 'Sí, eliminar'}
        </button>
      </div>
    </Modal>
  );
}

// ── Modal genérico ───────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
