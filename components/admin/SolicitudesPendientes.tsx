// ============================================================================
// components/admin/SolicitudesPendientes.tsx
// Sección "📋 Solicitudes pendientes" (entrega/firma de documentos) para el
// panel admin de calendario. Lista las solicitudes con estado='pendiente' y
// permite a Amanda: confirmar la fecha del cliente, proponer otra, o rechazar.
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface SolicitudItem {
  id: string;
  modalidad: string | null;
  fecha: string | null;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  fecha_solicitada: string | null;
  hora_solicitada: string | null;
  comentarios_cliente: string | null;
  cliente: { id: string; codigo: string; nombre: string; email: string | null } | null;
  created_at: string;
}

const MODALIDAD_LABEL: Record<string, { label: string; icono: string }> = {
  entrega_documentos: { label: 'Entrega de documentos', icono: '📦' },
  firma_documentos: { label: 'Firma de documentos', icono: '✍️' },
};

function fmtFechaLarga(fecha?: string | null): string {
  if (!fecha) return '—';
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function fmtHora12(hora?: string | null): string {
  if (!hora) return '—';
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function addMinutes(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const tot = h * 60 + m + min;
  return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
}

export default function SolicitudesPendientes({ onChanged }: { onChanged?: () => void }) {
  const { getToken } = useAuth();
  const [solicitudes, setSolicitudes] = useState<SolicitudItem[]>([]);
  const [selected, setSelected] = useState<SolicitudItem | null>(null);

  const fetchSolicitudes = useCallback(async () => {
    try {
      await getToken().catch(() => {});
      const res = await adminFetch('/api/admin/calendario/solicitudes');
      const json = await res.json();
      setSolicitudes(json.data ?? []);
    } catch {
      setSolicitudes([]);
    }
  }, [getToken]);

  useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes]);

  const handleDone = () => {
    setSelected(null);
    fetchSolicitudes();
    onChanged?.();
  };

  if (solicitudes.length === 0) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-semibold text-amber-900">📋 Solicitudes pendientes</span>
        <span className="text-[11px] font-bold text-amber-900 bg-amber-300 rounded-full px-2 py-0.5">
          {solicitudes.length}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {solicitudes.map((s) => {
          const mod = MODALIDAD_LABEL[s.modalidad ?? ''] ?? { label: 'Solicitud', icono: '📋' };
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="shrink-0 text-left bg-white border border-amber-300 rounded-lg px-3 py-2 hover:border-amber-500 hover:shadow-sm transition min-w-[220px]"
            >
              <p className="text-xs font-semibold text-gray-900 truncate">
                {mod.icono} {s.cliente?.nombre ?? 'Cliente'}
              </p>
              <p className="text-[11px] text-gray-500 truncate">{mod.label}</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Pidió: {fmtFechaLarga(s.fecha_solicitada).replace(/^\w/, (c) => c.toUpperCase())} · {fmtHora12(s.hora_solicitada)}
              </p>
            </button>
          );
        })}
      </div>

      {selected && (
        <SolicitudModal solicitud={selected} onClose={() => setSelected(null)} onDone={handleDone} getToken={getToken} />
      )}
    </div>
  );
}

function SolicitudModal({
  solicitud,
  onClose,
  onDone,
  getToken,
}: {
  solicitud: SolicitudItem;
  onClose: () => void;
  onDone: () => void;
  getToken: () => Promise<string | null>;
}) {
  const mod = MODALIDAD_LABEL[solicitud.modalidad ?? ''] ?? { label: 'Solicitud', icono: '📋' };
  const [fecha, setFecha] = useState(solicitud.fecha_solicitada ?? solicitud.fecha ?? '');
  const [hora, setHora] = useState((solicitud.hora_solicitada ?? solicitud.hora_inicio ?? '').slice(0, 5));
  const [mensaje, setMensaje] = useState('');
  const [busy, setBusy] = useState<null | 'confirmar' | 'proponer' | 'rechazar'>(null);
  const [error, setError] = useState('');

  const patch = async (body: Record<string, unknown>) => {
    await getToken().catch(() => {});
    const res = await adminFetch(`/api/admin/calendario/eventos/${solicitud.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || 'Error al procesar la solicitud');
    }
  };

  const run = async (
    accion: 'confirmar' | 'proponer' | 'rechazar',
    body: Record<string, unknown>,
  ) => {
    setBusy(accion);
    setError('');
    try {
      await patch(body);
      onDone();
    } catch (e: any) {
      setError(e.message);
      setBusy(null);
    }
  };

  const confirmar = () => {
    if (!fecha || !hora) { setError('Seleccione fecha y hora.'); return; }
    run('confirmar', {
      accion: 'confirmar_solicitud',
      fecha,
      hora_inicio: hora,
      hora_fin: addMinutes(hora, solicitud.duracion_minutos),
      duracion_minutos: solicitud.duracion_minutos,
      mensaje: mensaje.trim() || undefined,
    });
  };

  const proponer = () => {
    if (!fecha || !hora) { setError('Seleccione la nueva fecha y hora.'); return; }
    if (fecha === solicitud.fecha_solicitada && hora === (solicitud.hora_solicitada ?? '').slice(0, 5)) {
      setError('Para proponer otra fecha, cambie la fecha u hora. Si la fecha del cliente sirve, use "Confirmar".');
      return;
    }
    run('proponer', {
      accion: 'proponer_fecha',
      fecha,
      hora_inicio: hora,
      hora_fin: addMinutes(hora, solicitud.duracion_minutos),
      duracion_minutos: solicitud.duracion_minutos,
      mensaje: mensaje.trim() || undefined,
    });
  };

  const rechazar = () => {
    run('rechazar', { accion: 'rechazar_solicitud', mensaje: mensaje.trim() || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{mod.icono} {mod.label}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Datos del cliente */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{solicitud.cliente?.nombre ?? 'Cliente'}</p>
            {solicitud.cliente?.email && <p className="text-gray-500 text-xs">{solicitud.cliente.email}</p>}
          </div>

          {/* Fecha/hora solicitada */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-[11px] uppercase tracking-wide text-amber-700 mb-1">Fecha solicitada por el cliente</p>
            <p className="font-medium text-gray-900 capitalize">
              {fmtFechaLarga(solicitud.fecha_solicitada)} · {fmtHora12(solicitud.hora_solicitada)}
            </p>
          </div>

          {/* Comentarios */}
          {solicitud.comentarios_cliente && (
            <div className="text-sm">
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Comentarios del cliente</p>
              <p className="text-gray-700 whitespace-pre-line">{solicitud.comentarios_cliente}</p>
            </div>
          )}

          {/* Selector fecha/hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>

          {/* Mensaje personalizado */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mensaje para el cliente (opcional)</label>
            <textarea
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              rows={2}
              placeholder="Se incluirá en el correo al cliente…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Acciones */}
        <div className="px-6 py-4 border-t border-gray-100 space-y-2">
          <button
            onClick={confirmar}
            disabled={busy !== null}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition"
          >
            {busy === 'confirmar' ? 'Confirmando…' : '✅ Confirmar y enviar al cliente'}
          </button>
          <button
            onClick={proponer}
            disabled={busy !== null}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition"
          >
            {busy === 'proponer' ? 'Enviando…' : '📅 Proponer otra fecha'}
          </button>
          <button
            onClick={rechazar}
            disabled={busy !== null}
            className="w-full bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg py-2.5 text-sm font-semibold transition"
          >
            {busy === 'rechazar' ? 'Procesando…' : '❌ Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}
