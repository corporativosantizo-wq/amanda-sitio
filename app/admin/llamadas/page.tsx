// ============================================================================
// app/admin/llamadas/page.tsx
// Agendar llamadas telefónicas: cliente existente (autocompletado) o contacto
// libre. Verifica disponibilidad en Outlook, crea el evento y envía confirmación.
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface ClienteOption {
  id: string;
  codigo: string;
  nombre: string;
  email: string | null;
}

interface Llamada {
  id: string;
  nombre_contacto: string;
  email_contacto: string;
  telefono_contacto: string | null;
  fecha: string;
  hora: string;
  duracion_minutos: number | null;
  asunto: string;
  estado: string;
  emails_cc: string[] | null;
}

const DURACIONES = [15, 30, 45, 60];

const ESTADO_BADGE: Record<string, string> = {
  programada: 'bg-blue-100 text-blue-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-red-100 text-red-700',
  reprogramada: 'bg-amber-100 text-amber-800',
};

function fmtFecha(fecha: string): string {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function fmtHora(hora?: string | null): string {
  if (!hora) return '—';
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function LlamadasPage() {
  const { getToken } = useAuth();

  // ── Formulario ──
  const [modo, setModo] = useState<'cliente' | 'libre'>('cliente');
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState<ClienteOption[]>([]);
  const [clienteId, setClienteId] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [cc, setCc] = useState<string[]>([]);
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [duracion, setDuracion] = useState(30);
  const [asunto, setAsunto] = useState('');
  const [notas, setNotas] = useState('');

  const [dispo, setDispo] = useState<null | 'checking' | { disponible: boolean; outlook: boolean }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  // ── Listado ──
  const [llamadas, setLlamadas] = useState<Llamada[]>([]);
  const [reprog, setReprog] = useState<Llamada | null>(null);

  const fetchLlamadas = useCallback(async () => {
    try {
      await getToken().catch(() => {});
      const res = await adminFetch('/api/admin/llamadas');
      const json = await res.json();
      setLlamadas(json.data ?? []);
    } catch {
      setLlamadas([]);
    }
  }, [getToken]);

  useEffect(() => { fetchLlamadas(); }, [fetchLlamadas]);

  // Búsqueda de clientes (modo cliente)
  useEffect(() => {
    if (modo !== 'cliente' || busqueda.trim().length < 2) { setResultados([]); return; }
    let cancel = false;
    (async () => {
      try {
        await getToken().catch(() => {});
        // limit alto + activo=true: una búsqueda puede coincidir por email
        // compartido en muchos clientes (p.ej. un grupo corporativo cuyos
        // miembros usan el mismo correo), empujando la coincidencia por nombre
        // fuera de un límite bajo. Pedimos solo clientes activos.
        const res = await adminFetch(`/api/admin/clientes?q=${encodeURIComponent(busqueda.trim())}&activo=true&limit=50`);
        const json = await res.json();
        // Ordenar por relevancia: coincidencias en nombre/código primero (las de
        // solo-email al final), para que la empresa buscada quede arriba.
        const q = busqueda.trim().toLowerCase();
        const hit = (c: ClienteOption) =>
          (c.nombre?.toLowerCase().includes(q) || c.codigo?.toLowerCase().includes(q)) ? 0 : 1;
        const ranked = ((json.data ?? []) as ClienteOption[]).slice().sort((a, b) => hit(a) - hit(b));
        if (!cancel) setResultados(ranked);
      } catch {
        if (!cancel) setResultados([]);
      }
    })();
    return () => { cancel = true; };
  }, [busqueda, modo, getToken]);

  const seleccionarCliente = async (c: ClienteOption) => {
    setClienteId(c.id);
    setNombre(c.nombre);
    setEmail(c.email ?? '');
    setBusqueda(c.nombre);
    setResultados([]);
    // Detalle para auto-llenar teléfono y CC
    try {
      await getToken().catch(() => {});
      const res = await adminFetch(`/api/admin/clientes/${c.id}`);
      const d = await res.json();
      if (d?.telefono) setTelefono(d.telefono);
      if (Array.isArray(d?.emails_cc) && d.emails_cc.length) setCc(d.emails_cc);
    } catch { /* opcional */ }
  };

  // Verificación de disponibilidad (Outlook) cuando hay fecha + hora
  useEffect(() => {
    if (!fecha || !hora) { setDispo(null); return; }
    let cancel = false;
    setDispo('checking');
    (async () => {
      try {
        await getToken().catch(() => {});
        const res = await adminFetch(`/api/admin/llamadas/disponibilidad?fecha=${fecha}&hora=${hora}&duracion=${duracion}`);
        const json = await res.json();
        if (!cancel) setDispo({ disponible: !!json.disponible, outlook: !!json.outlook });
      } catch {
        if (!cancel) setDispo(null);
      }
    })();
    return () => { cancel = true; };
  }, [fecha, hora, duracion, getToken]);

  const addCc = () => {
    const v = ccInput.trim().replace(/,$/, '');
    if (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !cc.includes(v)) {
      setCc([...cc, v]);
      setCcInput('');
    }
  };

  const resetForm = () => {
    setClienteId(null); setBusqueda(''); setResultados([]);
    setNombre(''); setEmail(''); setTelefono(''); setCc([]); setCcInput('');
    setFecha(''); setHora(''); setDuracion(30); setAsunto(''); setNotas('');
    setDispo(null);
  };

  const agendar = async () => {
    setError(''); setOk('');
    if (!nombre.trim() || !email.trim() || !fecha || !hora || !asunto.trim()) {
      setError('Complete nombre, email, fecha, hora y asunto.');
      return;
    }
    setSubmitting(true);
    try {
      await getToken().catch(() => {});
      const res = await adminFetch('/api/admin/llamadas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: modo === 'cliente' ? clienteId : null,
          nombre_contacto: nombre.trim(),
          email_contacto: email.trim(),
          telefono_contacto: telefono.trim() || null,
          emails_cc: cc,
          fecha, hora, duracion_minutos: duracion,
          asunto: asunto.trim(),
          notas: notas.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Error al agendar la llamada');
      }
      setOk('📞 Llamada agendada y confirmación enviada al cliente.');
      resetForm();
      fetchLlamadas();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const accion = async (id: string, body: Record<string, unknown>) => {
    await getToken().catch(() => {});
    await adminFetch(`/api/admin/llamadas/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    fetchLlamadas();
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📞 Llamadas</h1>
          <p className="text-gray-500 text-sm mt-1">Agende llamadas telefónicas con confirmación automática al cliente.</p>
        </div>
        <Link href="/admin/calendario" className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
          Calendario
        </Link>
      </div>

      {/* ── Formulario ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-8">
        {/* Modo */}
        <div className="inline-flex rounded-lg border border-gray-200 p-1 mb-4">
          <button
            onClick={() => { setModo('cliente'); resetForm(); }}
            className={`px-3 py-1.5 text-sm rounded-md transition ${modo === 'cliente' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >Cliente existente</button>
          <button
            onClick={() => { setModo('libre'); resetForm(); }}
            className={`px-3 py-1.5 text-sm rounded-md transition ${modo === 'libre' ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >Contacto libre</button>
        </div>

        {/* Búsqueda de cliente */}
        {modo === 'cliente' && (
          <div className="relative mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Buscar cliente</label>
            <input
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setClienteId(null); }}
              placeholder="Nombre o código del cliente…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            />
            {resultados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    className="w-full text-left px-3 py-2 hover:bg-teal-50 text-sm border-b border-gray-50 last:border-0"
                  >
                    <span className="font-medium text-gray-900">{c.nombre}</span>
                    <span className="text-gray-400 text-xs ml-2">{c.codigo}</span>
                    {c.email && <span className="block text-xs text-gray-400">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
            {clienteId && <p className="text-xs text-emerald-600 mt-1">✓ Cliente seleccionado (puede editar los datos abajo)</p>}
          </div>
        )}

        {/* Datos de contacto */}
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="5555-1234" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>

        {/* Fecha / hora / duración */}
        <div className="grid sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha *</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hora *</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duración</label>
            <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500">
              {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>

        {/* Disponibilidad */}
        {dispo && (
          <div className="mb-4 text-sm">
            {dispo === 'checking' ? (
              <span className="text-gray-400">Verificando disponibilidad…</span>
            ) : dispo.outlook ? (
              dispo.disponible
                ? <span className="text-emerald-600 font-medium">✅ Amanda está disponible a esa hora</span>
                : <span className="text-red-600 font-medium">❌ Amanda está ocupada a esa hora</span>
            ) : (
              <span className="text-gray-400">Outlook no conectado — no se pudo verificar disponibilidad</span>
            )}
          </div>
        )}

        {/* Asunto */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Asunto *</label>
          <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Motivo de la llamada" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
        </div>

        {/* CC */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">CC (opcional)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {cc.map((e) => (
              <span key={e} className="inline-flex items-center gap-1 bg-teal-50 text-teal-700 text-xs rounded-full px-2 py-1">
                {e}
                <button onClick={() => setCc(cc.filter((x) => x !== e))} className="hover:text-teal-900">×</button>
              </span>
            ))}
          </div>
          <input
            value={ccInput}
            onChange={(e) => setCcInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCc(); } }}
            onBlur={addCc}
            placeholder="correo@ejemplo.com (Enter para agregar)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Notas */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas (opcional)</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>}
        {ok && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg mb-3">{ok}</p>}

        <button
          onClick={agendar}
          disabled={submitting}
          className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-sm font-semibold transition"
        >
          {submitting ? 'Agendando…' : '📞 Agendar llamada'}
        </button>
      </div>

      {/* ── Listado ── */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Llamadas programadas</h2>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {llamadas.length === 0 ? (
          <p className="text-sm text-gray-400 p-6 text-center">No hay llamadas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Fecha</th>
                  <th className="text-left px-4 py-2 font-medium">Hora</th>
                  <th className="text-left px-4 py-2 font-medium">Contacto</th>
                  <th className="text-left px-4 py-2 font-medium">Asunto</th>
                  <th className="text-left px-4 py-2 font-medium">Estado</th>
                  <th className="text-right px-4 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {llamadas.map((ll) => (
                  <tr key={ll.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 whitespace-nowrap">{fmtFecha(ll.fecha)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{fmtHora(ll.hora)}</td>
                    <td className="px-4 py-2">
                      <span className="font-medium text-gray-900">{ll.nombre_contacto}</span>
                      {ll.telefono_contacto && <span className="block text-xs text-gray-400">{ll.telefono_contacto}</span>}
                    </td>
                    <td className="px-4 py-2 text-gray-600">{ll.asunto}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs rounded-full px-2 py-0.5 ${ESTADO_BADGE[ll.estado] ?? 'bg-gray-100 text-gray-600'}`}>{ll.estado}</span>
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      {ll.estado === 'programada' && (
                        <div className="inline-flex gap-1">
                          <button onClick={() => accion(ll.id, { accion: 'completar' })} className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100">Completar</button>
                          <button onClick={() => setReprog(ll)} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100">Reprogramar</button>
                          <button onClick={() => { if (confirm('¿Cancelar esta llamada?')) accion(ll.id, { accion: 'cancelar' }); }} className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 hover:bg-red-100">Cancelar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {reprog && (
        <ReprogramarModal
          llamada={reprog}
          onClose={() => setReprog(null)}
          onDone={() => { setReprog(null); fetchLlamadas(); }}
          accion={accion}
        />
      )}
    </div>
  );
}

function ReprogramarModal({
  llamada,
  onClose,
  onDone,
  accion,
}: {
  llamada: Llamada;
  onClose: () => void;
  onDone: () => void;
  accion: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(llamada.fecha);
  const [hora, setHora] = useState((llamada.hora ?? '').slice(0, 5));
  const [duracion, setDuracion] = useState(llamada.duracion_minutos ?? 30);
  const [busy, setBusy] = useState(false);

  const guardar = async () => {
    setBusy(true);
    await accion(llamada.id, { accion: 'reprogramar', fecha, hora, duracion_minutos: duracion });
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-4">Reprogramar llamada</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duración</label>
            <select value={duracion} onChange={(e) => setDuracion(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {DURACIONES.map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={busy} className="flex-1 bg-teal-600 text-white rounded-lg py-2 text-sm disabled:opacity-50">
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
