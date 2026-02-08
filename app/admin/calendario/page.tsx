// ============================================================================
// app/admin/calendario/page.tsx
// Calendario de citas con vista semana/día
// ============================================================================
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────────────────────

interface CitaItem {
  id: string;
  tipo: 'consulta_nueva' | 'seguimiento' | 'outlook';
  titulo: string;
  descripcion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  estado: string;
  costo: number;
  teams_link: string | null;
  notas: string | null;
  cliente: { id: string; codigo: string; nombre: string; email: string | null } | null;
  _source?: 'outlook';
}

interface SlotItem {
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
}

interface ClienteOption {
  id: string;
  codigo: string;
  nombre: string;
  email: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  consulta_nueva: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800' },
  seguimiento: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800' },
  outlook: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-800' },
};

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  confirmada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_asistio: { label: 'No asistió', color: 'bg-gray-100 text-gray-700' },
  outlook: { label: 'Outlook', color: 'bg-purple-100 text-purple-700' },
};

const HORAS = Array.from({ length: 23 }, (_, i) => {
  const h = Math.floor(i / 2) + 7;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function formatHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarioPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 flex justify-center"><div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <CalendarioPage />
    </Suspense>
  );
}

function CalendarioPage() {
  const searchParams = useSearchParams();
  const [vista, setVista] = useState<'semana' | 'dia'>('semana');
  const [fechaBase, setFechaBase] = useState(() => new Date());
  const [citas, setCitas] = useState<CitaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);

  // Modal states
  const [showDetail, setShowDetail] = useState<CitaItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createDate, setCreateDate] = useState('');

  // Outlook connection status check
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected === 'true') setOutlookConnected(true);
    if (error) console.warn('Outlook OAuth error:', error);
  }, [searchParams]);

  // Check Outlook status on load
  useEffect(() => {
    fetch('/api/admin/calendario/auth')
      .then((r) => r.ok ? setOutlookConnected(true) : setOutlookConnected(false))
      .catch(() => setOutlookConnected(false));
  }, []);

  // Fetch citas for current range
  const fetchCitas = useCallback(async () => {
    setLoading(true);
    const lunes = vista === 'semana' ? getMonday(fechaBase) : fechaBase;
    const fin = vista === 'semana' ? addDays(lunes, 6) : fechaBase;

    try {
      const res = await fetch(
        `/api/admin/calendario/eventos?fecha_inicio=${formatDate(lunes)}&fecha_fin=${formatDate(fin)}&limit=200`
      );
      const json = await res.json();
      setCitas(json.data ?? []);
    } catch {
      setCitas([]);
    } finally {
      setLoading(false);
    }
  }, [fechaBase, vista]);

  useEffect(() => { fetchCitas(); }, [fetchCitas]);

  // Navigation
  const navPrev = () => setFechaBase((d) => addDays(d, vista === 'semana' ? -7 : -1));
  const navNext = () => setFechaBase((d) => addDays(d, vista === 'semana' ? 7 : 1));
  const navHoy = () => setFechaBase(new Date());

  // Outlook auth
  const connectOutlook = async () => {
    const res = await fetch('/api/admin/calendario/auth');
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  };

  // Actions
  const handleAction = async (citaId: string, accion: 'completar' | 'cancelar') => {
    await fetch(`/api/admin/calendario/eventos/${citaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion }),
    });
    setShowDetail(null);
    fetchCitas();
  };

  // Week days for header
  const lunes = getMonday(fechaBase);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(lunes, i));

  // Filter citas for a specific date
  const citasForDate = (dateStr: string) => citas.filter((c: CitaItem) => c.fecha === dateStr);

  // Header date range text
  const headerText = vista === 'semana'
    ? `${lunes.toLocaleDateString('es-GT', { month: 'long', day: 'numeric' })} — ${addDays(lunes, 6).toLocaleDateString('es-GT', { month: 'long', day: 'numeric', year: 'numeric' })}`
    : fechaBase.toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
          <p className="text-gray-500 text-sm mt-1">{headerText}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Outlook Status */}
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${outlookConnected ? 'bg-emerald-500' : 'bg-red-400'}`} />
            <span className="text-xs text-gray-500">{outlookConnected ? 'Outlook conectado' : 'Outlook desconectado'}</span>
          </div>
          {!outlookConnected && (
            <button
              onClick={connectOutlook}
              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Conectar Outlook
            </button>
          )}
          <Link
            href="/admin/calendario/bloqueos"
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Bloqueos
          </Link>
          <button
            onClick={() => { setCreateDate(formatDate(new Date())); setShowCreate(true); }}
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition"
          >
            + Nueva cita
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={navPrev} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button onClick={navHoy} className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Hoy
        </button>
        <button onClick={navNext} className="p-2 rounded-lg hover:bg-gray-100 transition">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="ml-auto flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setVista('semana')}
            className={`px-3 py-1.5 text-sm rounded-md transition ${vista === 'semana' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setVista('dia')}
            className={`px-3 py-1.5 text-sm rounded-md transition ${vista === 'dia' ? 'bg-white shadow font-medium' : 'text-gray-600'}`}
          >
            Día
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vista === 'semana' ? (
        <WeekView
          weekDays={weekDays}
          citasForDate={citasForDate}
          onClickCita={(c: CitaItem) => setShowDetail(c)}
          onClickSlot={(dateStr: string) => { setCreateDate(dateStr); setShowCreate(true); }}
        />
      ) : (
        <DayView
          date={fechaBase}
          citas={citasForDate(formatDate(fechaBase))}
          onClickCita={(c: CitaItem) => setShowDetail(c)}
        />
      )}

      {/* Detail Modal */}
      {showDetail && (
        <DetailModal
          cita={showDetail}
          onClose={() => setShowDetail(null)}
          onAction={handleAction}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          initialDate={createDate}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchCitas(); }}
        />
      )}
    </div>
  );
}

// ── Week View ───────────────────────────────────────────────────────────────

function WeekView({
  weekDays,
  citasForDate,
  onClickCita,
  onClickSlot,
}: {
  weekDays: Date[];
  citasForDate: (d: string) => CitaItem[];
  onClickCita: (c: CitaItem) => void;
  onClickSlot: (d: string) => void;
}) {
  const todayStr = formatDate(new Date());

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-200">
        <div className="p-2" />
        {weekDays.map((d: Date, i: number) => {
          const dateStr = formatDate(d);
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`p-2 text-center border-l border-gray-200 ${isToday ? 'bg-cyan-50' : ''}`}
            >
              <div className="text-xs text-gray-500">{DAY_NAMES[i]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-cyan-700' : 'text-gray-800'}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time Grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {HORAS.map((hora: string) => (
          <div key={hora} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-100">
            <div className="p-1 pr-2 text-right text-xs text-gray-400 pt-1">{hora}</div>
            {weekDays.map((d: Date, di: number) => {
              const dateStr = formatDate(d);
              const citasEnSlot = citasForDate(dateStr).filter((c: CitaItem) => {
                // Snap to nearest 30-min slot for matching
                const [ch, cm] = c.hora_inicio.split(':').map(Number);
                const snapped = `${String(ch).padStart(2, '0')}:${cm < 30 ? '00' : '30'}`;
                return snapped === hora;
              });

              return (
                <div
                  key={di}
                  className="border-l border-gray-100 min-h-[32px] relative cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => onClickSlot(dateStr)}
                >
                  {citasEnSlot.map((cita: CitaItem) => {
                    const colors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;
                    return (
                      <div
                        key={cita.id}
                        onClick={(e) => { e.stopPropagation(); onClickCita(cita); }}
                        className={`absolute inset-x-0.5 ${colors.bg} ${colors.text} border-l-3 ${colors.border} rounded px-1.5 py-0.5 text-xs cursor-pointer hover:shadow-md transition z-10`}
                        style={{ borderLeftWidth: '3px' }}
                      >
                        <div className="font-medium truncate">{cita.titulo}</div>
                        <div className="text-[10px] opacity-70 truncate">
                          {cita.cliente?.nombre ?? (cita._source === 'outlook' ? `${cita.hora_inicio}` : 'Sin cliente')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Day View ────────────────────────────────────────────────────────────────

function DayView({
  date,
  citas,
  onClickCita,
}: {
  date: Date;
  citas: CitaItem[];
  onClickCita: (c: CitaItem) => void;
}) {
  if (citas.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-gray-500">No hay citas para este día</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {citas.map((cita: CitaItem) => {
        const colors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;
        const estado = ESTADO_LABELS[cita.estado] ?? ESTADO_LABELS.pendiente;

        return (
          <div
            key={cita.id}
            onClick={() => onClickCita(cita)}
            className={`bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:shadow-md transition border-l-4 ${colors.border}`}
            style={{ borderLeftWidth: '4px' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{cita.titulo}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatHora12(cita.hora_inicio)} — {formatHora12(cita.hora_fin)}
                  <span className="mx-2">|</span>
                  {cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : cita.tipo === 'seguimiento' ? 'Seguimiento' : 'Outlook'}
                </p>
                {cita.cliente && (
                  <p className="text-sm text-gray-600 mt-1">{cita.cliente.nombre}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${estado.color}`}>
                  {estado.label}
                </span>
                {cita.teams_link && (
                  <a
                    href={cita.teams_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition"
                  >
                    Teams
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Detail Modal ────────────────────────────────────────────────────────────

function DetailModal({
  cita,
  onClose,
  onAction,
}: {
  cita: CitaItem;
  onClose: () => void;
  onAction: (id: string, accion: 'completar' | 'cancelar') => void;
}) {
  const estado = ESTADO_LABELS[cita.estado] ?? ESTADO_LABELS.pendiente;
  const isOutlook = cita._source === 'outlook';
  const activo = !isOutlook && (cita.estado === 'pendiente' || cita.estado === 'confirmada');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{cita.titulo}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase">Tipo</span>
              <p className="font-medium">{cita.tipo === 'consulta_nueva' ? 'Consulta Nueva' : cita.tipo === 'seguimiento' ? 'Seguimiento' : 'Outlook'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Estado</span>
              <p><span className={`text-xs px-2 py-0.5 rounded-full ${estado.color}`}>{estado.label}</span></p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Fecha</span>
              <p className="font-medium">
                {new Date(cita.fecha + 'T12:00:00').toLocaleDateString('es-GT', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Horario</span>
              <p className="font-medium">{formatHora12(cita.hora_inicio)} — {formatHora12(cita.hora_fin)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Cliente</span>
              <p className="font-medium">{cita.cliente?.nombre ?? 'Sin cliente'}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Costo</span>
              <p className="font-medium">Q{Number(cita.costo).toLocaleString('es-GT')}</p>
            </div>
          </div>

          {cita.descripcion && (
            <div>
              <span className="text-xs text-gray-500 uppercase">Descripción</span>
              <p className="text-sm text-gray-700 mt-1">{cita.descripcion}</p>
            </div>
          )}

          {cita.teams_link && (
            <a
              href={cita.teams_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
              Unirse a Teams
            </a>
          )}

          {cita.notas && (
            <div>
              <span className="text-xs text-gray-500 uppercase">Notas</span>
              <p className="text-sm text-gray-600 mt-1">{cita.notas}</p>
            </div>
          )}
        </div>

        {activo && (
          <div className="p-6 border-t border-gray-100 flex gap-3">
            <button
              onClick={() => onAction(cita.id, 'completar')}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
            >
              Marcar completada
            </button>
            <button
              onClick={() => onAction(cita.id, 'cancelar')}
              className="flex-1 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition text-sm font-medium"
            >
              Cancelar cita
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Modal ────────────────────────────────────────────────────────────

function CreateModal({
  initialDate,
  onClose,
  onCreated,
}: {
  initialDate: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<'consulta_nueva' | 'seguimiento'>('consulta_nueva');
  const [fecha, setFecha] = useState(initialDate);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch disponibilidad
  useEffect(() => {
    if (!fecha || !tipo) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    fetch(`/api/admin/calendario/disponibilidad?fecha=${fecha}&tipo=${tipo}`)
      .then((r) => r.json())
      .then((json) => setSlots(json.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [fecha, tipo]);

  // Search clientes
  useEffect(() => {
    if (clienteSearch.length < 2) { setClientes([]); return; }
    const timer = setTimeout(() => {
      fetch(`/api/admin/clientes?busqueda=${encodeURIComponent(clienteSearch)}&limit=5`)
        .then((r) => r.json())
        .then((json) => setClientes(json.data ?? []))
        .catch(() => setClientes([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [clienteSearch]);

  const handleSubmit = async () => {
    if (!selectedSlot || !titulo.trim()) {
      setError('Selecciona un horario y escribe un título');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await fetch('/api/admin/calendario/eventos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          fecha,
          hora_inicio: selectedSlot.hora_inicio,
          hora_fin: selectedSlot.hora_fin,
          duracion_minutos: selectedSlot.duracion_minutos,
          cliente_id: clienteId || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Error al crear cita');
      }

      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Nueva Cita</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de cita</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="consulta_nueva">Consulta Nueva (Q500, 30-60 min)</option>
              <option value="seguimiento">Seguimiento (gratis, 15 min)</option>
            </select>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Slots */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horario disponible
              {loadingSlots && <span className="ml-2 text-gray-400 text-xs">cargando...</span>}
            </label>
            {slots.length === 0 && !loadingSlots ? (
              <p className="text-sm text-gray-400">No hay horarios disponibles para esta fecha/tipo</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {slots.map((s: SlotItem) => (
                  <button
                    key={s.hora_inicio}
                    onClick={() => setSelectedSlot(s)}
                    className={`px-3 py-2 text-sm rounded-lg border transition ${
                      selectedSlot?.hora_inicio === s.hora_inicio
                        ? 'border-cyan-500 bg-cyan-50 text-cyan-800 font-medium'
                        : 'border-gray-200 hover:border-cyan-300 text-gray-700'
                    }`}
                  >
                    {formatHora12(s.hora_inicio)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Consulta sobre contrato de arrendamiento"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Cliente search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
            <input
              type="text"
              value={clienteSearch}
              onChange={(e) => { setClienteSearch(e.target.value); setClienteId(''); }}
              placeholder="Buscar cliente por nombre..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
            {clientes.length > 0 && !clienteId && (
              <div className="mt-1 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                {clientes.map((c: ClienteOption) => (
                  <button
                    key={c.id}
                    onClick={() => { setClienteId(c.id); setClienteSearch(c.nombre); setClientes([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition"
                  >
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-gray-400 ml-2">{c.codigo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !selectedSlot || !titulo.trim()}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear Cita'}
          </button>
        </div>
      </div>
    </div>
  );
}
