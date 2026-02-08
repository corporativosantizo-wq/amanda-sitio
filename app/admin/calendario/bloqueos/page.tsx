// ============================================================================
// app/admin/calendario/bloqueos/page.tsx
// Gestión de bloqueos de disponibilidad
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Bloqueo {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string | null;
  created_at: string;
}

function formatHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function BloqueosPage() {
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fecha, setFecha] = useState('');
  const [horaInicio, setHoraInicio] = useState('07:00');
  const [horaFin, setHoraFin] = useState('12:00');
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchBloqueos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/calendario/bloqueos');
      const json = await res.json();
      setBloqueos(json.bloqueos ?? []);
    } catch {
      setBloqueos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBloqueos(); }, [fetchBloqueos]);

  const handleCreate = async () => {
    if (!fecha || !horaInicio || !horaFin) {
      setError('Fecha, hora inicio y hora fin son requeridos');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/admin/calendario/bloqueos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          motivo: motivo.trim() || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error al crear bloqueo');
      }
      setFecha('');
      setMotivo('');
      fetchBloqueos();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este bloqueo?')) return;
    try {
      await fetch(`/api/admin/calendario/bloqueos?id=${id}`, { method: 'DELETE' });
      fetchBloqueos();
    } catch {
      // silent
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bloqueos de Horario</h1>
          <p className="text-gray-500 text-sm mt-1">Bloquea horarios para que no aparezcan como disponibles</p>
        </div>
        <Link
          href="/admin/calendario"
          className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          Volver al calendario
        </Link>
      </div>

      {/* Create Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Nuevo Bloqueo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hora fin</label>
            <input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo (opcional)</label>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Reunión interna"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          onClick={handleCreate}
          disabled={saving}
          className="mt-4 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold disabled:opacity-50"
        >
          {saving ? 'Creando...' : 'Crear Bloqueo'}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bloqueos.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No hay bloqueos registrados</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Fecha</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Horario</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Motivo</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bloqueos.map((b: Bloqueo) => (
                <tr key={b.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">
                    {new Date(b.fecha + 'T12:00:00').toLocaleDateString('es-GT', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {formatHora12(b.hora_inicio)} — {formatHora12(b.hora_fin)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{b.motivo ?? '—'}</td>
                  <td className="px-6 py-3 text-right">
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-red-500 hover:text-red-700 text-sm font-medium transition"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
