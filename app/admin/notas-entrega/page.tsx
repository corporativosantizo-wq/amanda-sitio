// ============================================================================
// app/admin/notas-entrega/page.tsx
// Notas de entrega de documentos (NE-NNNN): listar, editar (llenar documentos),
// imprimir/descargar PDF. Se crean automáticamente al agendar una cita de
// entrega; aquí el admin las completa antes de la cita.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { adminFetch, parseJsonResponse } from '@/lib/utils/admin-fetch';
import type { NotaEntrega, EstadoNotaEntrega } from '@/lib/types';

const ESTADO_BADGE: Record<EstadoNotaEntrega, string> = {
  pendiente:  'bg-amber-100 text-amber-800',
  completada: 'bg-emerald-100 text-emerald-800',
  cancelada:  'bg-red-100 text-red-700',
};

function fechaCorta(f: string): string {
  return new Date(f + 'T12:00:00').toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function NotasEntregaPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Cargando…</div>}>
      <NotasEntregaPage />
    </Suspense>
  );
}

function NotasEntregaPage() {
  const searchParams = useSearchParams();
  const citaId = searchParams.get('cita');

  const [notas, setNotas] = useState<NotaEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [editing, setEditing] = useState<NotaEntrega | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }
  }, [toast]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (citaId) qs.set('cita_id', citaId);
      if (estadoFilter) qs.set('estado', estadoFilter);
      qs.set('limit', '100');
      const res = await adminFetch(`/api/admin/notas-entrega?${qs.toString()}`);
      const json = await parseJsonResponse<{ data: NotaEntrega[] }>(res);
      setNotas(json.data ?? []);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'Error al cargar' });
    } finally {
      setLoading(false);
    }
  }, [citaId, estadoFilter]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>{toast.msg}</div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">📦 Notas de entrega de documentos</h1>
          <p className="text-sm text-slate-500">Complete los documentos a entregar/recibir e imprima para firma.</p>
        </div>
        <select
          value={estadoFilter}
          onChange={(e) => setEstadoFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="completada">Completadas</option>
          <option value="cancelada">Canceladas</option>
        </select>
      </div>

      {citaId && (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          Mostrando notas de la cita seleccionada. <a href="/admin/notas-entrega" className="text-cyan-700 underline">Ver todas</a>
        </p>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Cargando…</div>
      ) : notas.length === 0 ? (
        <div className="text-sm text-slate-400 py-12 text-center bg-white rounded-xl border border-slate-200">
          No hay notas de entrega.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
          {notas.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-slate-900">{n.numero}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[n.estado]}`}>{n.estado}</span>
                </div>
                <p className="text-sm text-slate-700 truncate">{n.cliente?.nombre ?? 'Sin cliente'}</p>
                <p className="text-xs text-slate-400">{fechaCorta(n.fecha)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditing(n)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Editar
                </button>
                <a
                  href={`/api/admin/notas-entrega/${n.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/90"
                >
                  PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditarNotaModal
          nota={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setToast({ type: 'success', msg: 'Nota actualizada' }); cargar(); }}
          onError={(m) => setToast({ type: 'error', msg: m })}
        />
      )}
    </div>
  );
}

function EditarNotaModal({
  nota, onClose, onSaved, onError,
}: {
  nota: NotaEntrega;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [fecha, setFecha] = useState(nota.fecha);
  const [entregados, setEntregados] = useState(nota.documentos_entregados ?? '');
  const [recibidos, setRecibidos] = useState(nota.documentos_recibidos ?? '');
  const [notas, setNotas] = useState(nota.notas ?? '');
  const [estado, setEstado] = useState<EstadoNotaEntrega>(nota.estado);
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/notas-entrega/${nota.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          documentos_entregados: entregados.trim() || null,
          documentos_recibidos: recibidos.trim() || null,
          notas: notas.trim() || null,
          estado,
        }),
      });
      await parseJsonResponse(res);
      onSaved();
    } catch (err: any) {
      onError(err.message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500';

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Nota {nota.numero}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-500">Cliente: <span className="text-slate-800 font-medium">{nota.cliente?.nombre ?? '—'}</span></p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
              <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoNotaEntrega)} className={INPUT}>
                <option value="pendiente">Pendiente</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Documentos entregados (del despacho al cliente)</label>
            <textarea value={entregados} onChange={(e) => setEntregados(e.target.value)} rows={3} className={`${INPUT} resize-y`} placeholder="Ej: Escritura inscrita No. 123, certificación RGP…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Documentos recibidos (del cliente al despacho)</label>
            <textarea value={recibidos} onChange={(e) => setRecibidos(e.target.value)} rows={3} className={`${INPUT} resize-y`} placeholder="Ej: DPI original, recibo de servicios…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notas</label>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={`${INPUT} resize-y`} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between gap-3">
          <a
            href={`/api/admin/notas-entrega/${nota.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Ver PDF
          </a>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <button onClick={guardar} disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/90 disabled:opacity-50">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
