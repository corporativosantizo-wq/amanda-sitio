// ============================================================================
// app/admin/calendario/page.tsx
// Calendario de citas — rediseño con header navy, sidebar, vista agenda/grilla
// ============================================================================
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { safeRedirect } from '@/lib/utils/validate-url';

// ── Types ───────────────────────────────────────────────────────────────────

type TipoCitaUI =
  | 'consulta_nueva'
  | 'seguimiento'
  | 'audiencia'
  | 'reunion'
  | 'bloqueo_personal'
  | 'evento_libre'
  | 'outlook'
  | 'audiencia_expediente';

interface CitaItem {
  id: string;
  tipo: TipoCitaUI;
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
  _source?: 'outlook' | 'expediente';
  isAllDay?: boolean;
  expediente_id?: string;
}

interface SlotItem {
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
  preferred?: boolean;
}

interface ClienteOption {
  id: string;
  codigo: string;
  nombre: string;
  email: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TIPO_COLORS: Record<string, { bg: string; border: string; text: string; hex: string }> = {
  consulta_nueva:       { bg: 'bg-blue-100',    border: 'border-blue-500',    text: 'text-blue-900',    hex: '#3B82F6' },
  seguimiento:          { bg: 'bg-emerald-100', border: 'border-emerald-500', text: 'text-emerald-900', hex: '#10B981' },
  outlook:              { bg: 'bg-purple-100',  border: 'border-purple-500',  text: 'text-purple-900',  hex: '#8B5CF6' },
  audiencia_expediente: { bg: 'bg-amber-100',   border: 'border-amber-500',   text: 'text-amber-900',   hex: '#F59E0B' },
  audiencia:            { bg: 'bg-red-100',     border: 'border-red-500',     text: 'text-red-900',     hex: '#EF4444' },
  reunion:              { bg: 'bg-yellow-100',  border: 'border-yellow-500',  text: 'text-yellow-900',  hex: '#EAB308' },
  bloqueo_personal:     { bg: 'bg-gray-200',    border: 'border-gray-500',    text: 'text-gray-800',    hex: '#6B7280' },
  evento_libre:         { bg: 'bg-violet-100',  border: 'border-violet-500',  text: 'text-violet-900',  hex: '#7C3AED' },
};

const TIPO_LABELS: Record<string, string> = {
  consulta_nueva: 'Consulta Nueva',
  seguimiento: 'Seguimiento',
  audiencia: 'Audiencia',
  reunion: 'Reunión',
  bloqueo_personal: 'Bloqueo Personal',
  evento_libre: 'Evento Libre',
  outlook: 'Outlook',
  audiencia_expediente: 'Audiencia/Diligencia',
};

const ESTADO_LABELS: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  confirmada: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800' },
  completada: { label: 'Completada', color: 'bg-green-100 text-green-800' },
  cancelada: { label: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_asistio: { label: 'No asistió', color: 'bg-gray-100 text-gray-700' },
  outlook: { label: 'Outlook', color: 'bg-purple-100 text-purple-700' },
  expediente: { label: 'Expediente', color: 'bg-amber-100 text-amber-700' },
};

const DEEP_WORK_END_HOUR = 14;

// Types that use slot-based availability (existing flow)
const SLOT_TIPOS = new Set(['consulta_nueva', 'seguimiento']);
// Types that use findFreeSlots() smart suggestions
const SMART_SLOT_TIPOS = new Set(['reunion', 'evento_libre']);
// Types that use free time picker (no slot suggestions)
const FREE_TIPOS = new Set(['audiencia', 'bloqueo_personal']);
// Admin-only types (all new types)
const ADMIN_ONLY_TIPOS = new Set(['audiencia', 'reunion', 'bloqueo_personal', 'evento_libre']);

const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1.5 horas' },
  { value: 120, label: '2 horas' },
];

// Grid: 06:00 – 21:00 (31 half-hour slots)
const HORAS = Array.from({ length: 31 }, (_, i) => {
  const h = Math.floor(i / 2) + 6;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

// IMPORTANT: Use LOCAL date parts, NOT toISOString() which converts to UTC
// and shifts the date forward by 1 day after 6pm in Guatemala (UTC-6).
function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function calcHoraFin(horaInicio: string, duracionMin: number): string {
  const [h, m] = horaInicio.split(':').map(Number);
  const total = h * 60 + m + duracionMin;
  const fh = Math.floor(total / 60);
  const fm = total % 60;
  return `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
}

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MINI_CAL_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

// ── Subcategories (inferred from existing data, no DB change) ───────────────

interface SubcatInfo {
  label: string;
  color: string; // tailwind classes for badge
}

const SUBCATEGORIAS: Record<string, SubcatInfo[]> = {
  consulta_nueva: [{ label: 'Nueva', color: 'bg-blue-100 text-blue-700' }],
  seguimiento:    [{ label: 'Seguimiento', color: 'bg-cyan-100 text-cyan-700' }],
  audiencia:      [
    { label: 'Civil', color: 'bg-red-100 text-red-700' },
    { label: 'Penal', color: 'bg-red-200 text-red-900' },
    { label: 'Laboral', color: 'bg-orange-100 text-orange-700' },
  ],
  audiencia_expediente: [
    { label: 'Civil', color: 'bg-red-100 text-red-700' },
    { label: 'Penal', color: 'bg-red-200 text-red-900' },
    { label: 'Laboral', color: 'bg-orange-100 text-orange-700' },
  ],
  reunion: [
    { label: 'Interna', color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Externa', color: 'bg-yellow-200 text-yellow-900' },
    { label: 'Teams', color: 'bg-yellow-100 text-yellow-700' },
  ],
  bloqueo_personal: [
    { label: 'Personal', color: 'bg-gray-100 text-gray-600' },
    { label: 'Preparación', color: 'bg-slate-100 text-slate-600' },
  ],
};

function inferSubcategoria(cita: CitaItem): SubcatInfo | null {
  const t = (cita.titulo + ' ' + (cita.descripcion ?? '')).toLowerCase();

  switch (cita.tipo) {
    case 'consulta_nueva':
      return SUBCATEGORIAS.consulta_nueva[0];
    case 'seguimiento':
      return SUBCATEGORIAS.seguimiento[0];
    case 'audiencia':
    case 'audiencia_expediente':
      if (t.includes('penal')) return SUBCATEGORIAS.audiencia[1];
      if (t.includes('laboral')) return SUBCATEGORIAS.audiencia[2];
      return SUBCATEGORIAS.audiencia[0]; // Civil default
    case 'reunion':
      if (cita.teams_link) return SUBCATEGORIAS.reunion[2]; // Teams
      if (t.includes('intern')) return SUBCATEGORIAS.reunion[0];
      return SUBCATEGORIAS.reunion[1]; // Externa default
    case 'bloqueo_personal':
      if (t.includes('prepar')) return SUBCATEGORIAS.bloqueo_personal[1];
      return SUBCATEGORIAS.bloqueo_personal[0];
    default:
      return null;
  }
}

// ── Mini-calendar helpers ───────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Convert Sunday=0 to Monday=0
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

// CreateModal type card definitions
const TIPO_CARDS = [
  { value: 'consulta_nueva' as TipoCitaUI, label: 'Consulta Nueva', sub: 'Q500, 30-60 min' },
  { value: 'seguimiento' as TipoCitaUI, label: 'Seguimiento', sub: 'Gratis, 15 min' },
  { value: 'audiencia' as TipoCitaUI, label: 'Audiencia', sub: 'Horario libre' },
  { value: 'reunion' as TipoCitaUI, label: 'Reunión', sub: 'Horario laboral' },
  { value: 'bloqueo_personal' as TipoCitaUI, label: 'Bloqueo Personal', sub: '' },
  { value: 'evento_libre' as TipoCitaUI, label: 'Evento Libre', sub: '' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function CalendarioPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 flex justify-center"><div className="w-8 h-8 border-4 border-cyan border-t-transparent rounded-full animate-spin" /></div>}>
      <CalendarioPage />
    </Suspense>
  );
}

function CalendarioPage() {
  const searchParams = useSearchParams();
  const [vista, setVista] = useState<'agenda' | 'grilla'>('agenda');
  const [fechaBase, setFechaBase] = useState(() => new Date());
  const [citas, setCitas] = useState<CitaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [outlookConnected, setOutlookConnected] = useState<boolean | null>(null);
  const [compact, setCompact] = useState(true);

  // Modal states
  const [showDetail, setShowDetail] = useState<CitaItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<CitaItem | null>(null);
  const [createDate, setCreateDate] = useState('');
  const [createTime, setCreateTime] = useState('');

  // Current time (used by sidebar + WeekView)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Mini-calendar state
  const [miniCalMonth, setMiniCalMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [monthEventDates, setMonthEventDates] = useState<Set<string>>(new Set());

  // Fetch month-level event dates for mini-calendar dots
  useEffect(() => {
    const { year, month } = miniCalMonth;
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    fetch(`/api/admin/calendario/eventos?fecha_inicio=${start}&fecha_fin=${end}&limit=200`)
      .then((r) => r.json())
      .then((json) => {
        const dates = new Set<string>((json.data ?? []).map((c: CitaItem) => c.fecha));
        setMonthEventDates(dates);
      })
      .catch(() => setMonthEventDates(new Set()));
  }, [miniCalMonth]);

  // Show OAuth result from URL params
  useEffect(() => {
    const error = searchParams.get('error');
    if (error) console.warn('Outlook OAuth error:', error);
  }, [searchParams]);

  // Fetch citas for current week range
  const fetchCitas = useCallback(async () => {
    setLoading(true);
    const lunes = getMonday(fechaBase);
    const fin = addDays(lunes, 6);
    const startStr = formatDate(lunes);
    const endStr = formatDate(fin);

    try {
      const res = await fetch(
        `/api/admin/calendario/eventos?fecha_inicio=${startStr}&fecha_fin=${endStr}&limit=200`
      );
      const json = await res.json();
      const data: CitaItem[] = json.data ?? [];
      setCitas(data);
      setOutlookConnected(json.outlook_connected ?? false);
    } catch {
      setCitas([]);
    } finally {
      setLoading(false);
    }
  }, [fechaBase]);

  useEffect(() => { fetchCitas(); }, [fetchCitas]);

  // Navigation — always by week
  const navPrev = () => setFechaBase((d) => addDays(d, -7));
  const navNext = () => setFechaBase((d) => addDays(d, 7));
  const navHoy = () => setFechaBase(new Date());

  // Outlook auth
  const connectOutlook = async () => {
    const res = await fetch('/api/admin/calendario/auth');
    const json = await res.json();
    if (json.url) safeRedirect(json.url);
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

  // Delete
  const handleDelete = async (citaId: string) => {
    await fetch(`/api/admin/calendario/eventos/${citaId}`, {
      method: 'DELETE',
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
  const headerText =
    `${lunes.toLocaleDateString('es-GT', { month: 'long', day: 'numeric' })} — ${addDays(lunes, 6).toLocaleDateString('es-GT', { month: 'long', day: 'numeric', year: 'numeric' })}`;

  // ── Computed values for sidebar ──
  const todayStr = formatDate(now);
  const todayCitas = citas.filter((c: CitaItem) => c.fecha === todayStr);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const nextEvent = todayCitas.find((c: CitaItem) => !c.isAllDay && c.hora_inicio > currentTime)
    ?? citas.find((c: CitaItem) => c.fecha > todayStr && !c.isAllDay);
  const weekConsultas = citas.filter((c: CitaItem) => c.tipo === 'consulta_nueva' || c.tipo === 'seguimiento').length;
  const weekAudiencias = citas.filter((c: CitaItem) => c.tipo === 'audiencia' || c.tipo === 'audiencia_expediente').length;
  const weekBilling = citas.reduce((sum: number, c: CitaItem) => sum + (c.costo ?? 0), 0);
  const weekFreeSlots = citas.filter((c: CitaItem) => c.tipo === 'evento_libre').length;
  const dayProgressHours = Math.max(0, Math.min(12, now.getHours() - 8 + now.getMinutes() / 60));
  const dayProgress = Math.round((dayProgressHours / 12) * 100);

  return (
    <div className="flex flex-col h-[calc(100vh-56px)] md:h-screen overflow-hidden">
      {/* ── HEADER ── */}
      <header className="bg-navy-dark border-b-2 border-cyan px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
        {/* Left: logo + title */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-azure to-cyan rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">AS</span>
          </div>
          <h1 className="text-white font-display text-lg font-semibold hidden sm:block">Calendario</h1>
          {outlookConnected && (
            <span className="text-[10px] font-medium text-cyan bg-cyan/10 border border-cyan/30 px-2 py-0.5 rounded-full hidden md:inline-block">
              Outlook sincronizado
            </span>
          )}
        </div>

        {/* Center: nav */}
        <div className="flex items-center gap-2">
          <button onClick={navPrev} className="p-1.5 rounded-lg text-slate-light hover:bg-navy-light hover:text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button onClick={navHoy} className="px-3 py-1 text-xs font-medium text-white border border-white/20 rounded-md hover:bg-navy-light transition">
            Hoy
          </button>
          <button onClick={navNext} className="p-1.5 rounded-lg text-slate-light hover:bg-navy-light hover:text-white transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="text-sm text-slate-light ml-2 hidden md:inline">{headerText}</span>
        </div>

        {/* Right: toggles + create */}
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/admin/calendario/bloqueos" className="px-3 py-1.5 text-xs font-medium text-slate-light hover:text-white transition hidden md:inline-block">
            Bloqueos
          </Link>

          {!outlookConnected && outlookConnected !== null && (
            <button onClick={connectOutlook} className="px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition hidden md:inline-block">
              Conectar Outlook
            </button>
          )}

          {/* Compact/Full toggle — only in grilla mode */}
          {vista === 'grilla' && (
            <div className="flex items-center bg-slate rounded-lg p-0.5 hidden sm:flex">
              <button
                onClick={() => setCompact(true)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition font-medium ${compact ? 'bg-azure text-white' : 'text-slate-light hover:text-white'}`}
              >
                Compacta
              </button>
              <button
                onClick={() => setCompact(false)}
                className={`px-2.5 py-1 text-[11px] rounded-md transition font-medium ${!compact ? 'bg-azure text-white' : 'text-slate-light hover:text-white'}`}
              >
                Completa
              </button>
            </div>
          )}

          {/* Vista toggle */}
          <div className="flex items-center bg-slate rounded-lg p-0.5">
            <button
              onClick={() => setVista('agenda')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${vista === 'agenda' ? 'bg-azure text-white' : 'text-slate-light hover:text-white'}`}
            >
              Agenda
            </button>
            <button
              onClick={() => setVista('grilla')}
              className={`px-3 py-1.5 text-xs rounded-md transition font-medium ${vista === 'grilla' ? 'bg-azure text-white' : 'text-slate-light hover:text-white'}`}
            >
              Grilla
            </button>
          </div>

          <button
            onClick={() => { setCreateDate(formatDate(new Date())); setCreateTime(''); setShowCreate(true); }}
            className="px-4 py-2 text-sm font-semibold bg-gradient-to-r from-azure to-azure-dark text-white rounded-lg shadow-glow-azure hover:shadow-glow-cyan transition-all"
          >
            + Nuevo evento
          </button>
        </div>
      </header>

      {/* ── BODY: sidebar + main ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar (hidden on mobile, visible on lg+) */}
        <aside className="hidden lg:flex flex-col w-[300px] bg-white border-r border-slate-light shrink-0 overflow-y-auto">
          {/* Hoy Card */}
          <div className="p-4">
            <div className="bg-gradient-to-br from-navy-dark to-navy rounded-xl p-4 text-white">
              <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-blue-200">◆ HOY</p>
              <p className="text-3xl font-extrabold mt-1">{now.getDate()}</p>
              <p className="text-sm text-blue-100 capitalize">
                {now.toLocaleDateString('es-GT', { weekday: 'long', month: 'long' })}
              </p>
              <p className="text-xs text-blue-200 mt-1">{todayCitas.length} evento{todayCitas.length !== 1 ? 's' : ''} hoy</p>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-blue-200 mb-1">
                  <span>Progreso del día</span>
                  <span className="font-mono">{dayProgress}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-progress rounded-full transition-all duration-1000" style={{ width: `${dayProgress}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Mini Calendar */}
          <div className="px-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-[#94A3B8]">◆ CALENDARIO</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMiniCalMonth((p) => {
                    const d = new Date(p.year, p.month - 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span className="text-[10px] font-medium text-gray-500 w-[80px] text-center capitalize">
                  {new Date(miniCalMonth.year, miniCalMonth.month).toLocaleDateString('es-GT', { month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setMiniCalMonth((p) => {
                    const d = new Date(p.year, p.month + 1, 1);
                    return { year: d.getFullYear(), month: d.getMonth() };
                  })}
                  className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {MINI_CAL_DAYS.map((d) => (
                <div key={d} className="text-center text-[9px] font-medium text-gray-400 py-0.5">{d}</div>
              ))}
              {getMonthGrid(miniCalMonth.year, miniCalMonth.month).flat().map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="h-7" />;
                const dateStr = `${miniCalMonth.year}-${String(miniCalMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = dateStr === formatDate(now);
                const hasEvents = monthEventDates.has(dateStr);
                return (
                  <button
                    key={dateStr}
                    onClick={() => {
                      const clickedDate = new Date(miniCalMonth.year, miniCalMonth.month, day);
                      setFechaBase(clickedDate);
                    }}
                    className={`h-7 flex flex-col items-center justify-center rounded-full text-[11px] transition ${
                      isToday
                        ? 'bg-azure text-white font-bold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{day}</span>
                    {hasEvents && !isToday && (
                      <span className="w-1 h-1 rounded-full bg-azure -mt-0.5" />
                    )}
                    {hasEvents && isToday && (
                      <span className="w-1 h-1 rounded-full bg-white -mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bullet Journal */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-[#94A3B8] mb-2">◆ BULLET JOURNAL</p>
            <div className="space-y-2">
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-[11px] font-semibold text-blue-900">Deep Work</p>
                <p className="text-[10px] text-blue-700">8:00 – 14:00 sin interrupciones</p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-[11px] font-semibold text-emerald-900">Follow-ups</p>
                <p className="text-[10px] text-emerald-700">14:00 – 16:00 seguimientos</p>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[11px] font-semibold text-amber-900">Buffer</p>
                <p className="text-[10px] text-amber-700">16:00+ admin y preparación</p>
              </div>
            </div>
          </div>

          {/* Week Stats */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-[#94A3B8] mb-2">◆ ESTA SEMANA</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900 font-mono">{weekConsultas}</p>
                <p className="text-[10px] text-gray-500">Consultas</p>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900 font-mono">{weekAudiencias}</p>
                <p className="text-[10px] text-gray-500">Audiencias</p>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-emerald-700 font-mono">Q{weekBilling.toLocaleString('es-GT')}</p>
                <p className="text-[10px] text-gray-500">Facturación est.</p>
              </div>
              <div className="p-2.5 bg-gray-50 rounded-lg">
                <p className="text-lg font-bold text-gray-900 font-mono">{weekFreeSlots}</p>
                <p className="text-[10px] text-gray-500">Slots libres</p>
              </div>
            </div>
          </div>

          {/* Event Type Legend */}
          <div className="px-4 pb-3">
            <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-[#94A3B8] mb-2">◆ TIPOS</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TIPO_COLORS).map(([key, colors]) => (
                <span key={key} className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}>
                  {TIPO_LABELS[key]}
                </span>
              ))}
            </div>
          </div>

          {/* Next Event */}
          {nextEvent && (
            <div className="px-4 pb-4">
              <p className="text-[10px] font-bold tracking-[2.5px] uppercase text-[#94A3B8] mb-2">◆ SIGUIENTE</p>
              <div
                className="p-3 bg-white rounded-lg border border-slate-light border-l-4 border-l-azure cursor-pointer hover:shadow-md transition"
                onClick={() => setShowDetail(nextEvent)}
              >
                <p className="text-sm font-semibold text-gray-900 truncate">{nextEvent.titulo}</p>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{formatHora12(nextEvent.hora_inicio)}</p>
                {nextEvent.cliente && <p className="text-xs text-gray-400 mt-0.5">{nextEvent.cliente.nombre}</p>}
              </div>
            </div>
          )}
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-lighter">
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-cyan border-t-transparent rounded-full animate-spin" />
            </div>
          ) : vista === 'agenda' ? (
            <AgendaView
              weekDays={weekDays}
              citasForDate={citasForDate}
              onClickCita={(c: CitaItem) => setShowDetail(c)}
              onClickSlot={(dateStr: string, hora?: string) => { setCreateDate(dateStr); setCreateTime(hora ?? ''); setShowCreate(true); }}
            />
          ) : (
            <WeekView
              weekDays={weekDays}
              citasForDate={citasForDate}
              onClickCita={(c: CitaItem) => setShowDetail(c)}
              onClickSlot={(dateStr: string, hora?: string) => { setCreateDate(dateStr); setCreateTime(hora ?? ''); setShowCreate(true); }}
              compact={compact}
              now={now}
            />
          )}
        </main>
      </div>

      {/* Detail Modal */}
      {showDetail && (
        <DetailModal
          cita={showDetail}
          onClose={() => setShowDetail(null)}
          onAction={handleAction}
          onEdit={(c) => { setShowDetail(null); setShowEdit(c); }}
          onDelete={handleDelete}
        />
      )}

      {/* Edit Modal */}
      {showEdit && (
        <EditModal
          cita={showEdit}
          onClose={() => setShowEdit(null)}
          onSaved={() => { setShowEdit(null); fetchCitas(); }}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          initialDate={createDate}
          initialTime={createTime}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchCitas(); }}
        />
      )}
    </div>
  );
}

// ── Agenda View ─────────────────────────────────────────────────────────────

function AgendaView({
  weekDays,
  citasForDate,
  onClickCita,
  onClickSlot,
}: {
  weekDays: Date[];
  citasForDate: (d: string) => CitaItem[];
  onClickCita: (c: CitaItem) => void;
  onClickSlot: (d: string, hora?: string) => void;
}) {
  const todayStr = formatDate(new Date());

  return (
    <div className="space-y-1 bg-white rounded-xl border border-slate-light overflow-hidden">
      {weekDays.map((day: Date) => {
        const dateStr = formatDate(day);
        const dayCitas = citasForDate(dateStr);
        const isToday = dateStr === todayStr;
        const isPast = dateStr < todayStr;
        const dayName = DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1];
        const monthDay = day.getDate();
        const monthName = day.toLocaleDateString('es-GT', { month: 'short' });

        // Separate deep work blocks from regular events
        const deepWorkCitas = dayCitas.filter((c: CitaItem) =>
          c.tipo === 'bloqueo_personal' && parseInt(c.hora_inicio, 10) < DEEP_WORK_END_HOUR
        );
        const regularCitas = dayCitas
          .filter((c: CitaItem) => !(c.tipo === 'bloqueo_personal' && parseInt(c.hora_inicio, 10) < DEEP_WORK_END_HOUR))
          .sort((a: CitaItem, b: CitaItem) => a.hora_inicio.localeCompare(b.hora_inicio));

        return (
          <div
            key={dateStr}
            className={`flex border-b border-gray-100 last:border-b-0 transition-opacity duration-200 ${isPast ? 'opacity-50 hover:opacity-80' : ''}`}
          >
            {/* Date column */}
            <div className={`w-[90px] shrink-0 py-3 pr-3 text-right ${isToday ? 'border-r-2 border-azure' : 'border-r border-gray-100'}`}>
              <p className="text-[10px] font-bold tracking-wider text-[#94A3B8] uppercase">{dayName}</p>
              {isToday ? (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-azure to-azure-dark flex items-center justify-center ml-auto mt-0.5">
                  <span className="text-white font-extrabold text-lg">{monthDay}</span>
                </div>
              ) : (
                <p className="text-2xl font-bold text-gray-800 mt-0.5">{monthDay}</p>
              )}
              <p className="text-[10px] text-gray-400 mt-0.5 capitalize">{monthName}</p>
            </div>

            {/* Events column */}
            <div className="flex-1 py-2 pl-4 min-h-[60px]">
              {/* Deep work notation */}
              {deepWorkCitas.length > 0 && (
                <p className="text-[10px] text-gray-400 font-mono mb-1">
                  deep work {deepWorkCitas.map((c: CitaItem) => `${c.hora_inicio.substring(0, 5)}–${c.hora_fin.substring(0, 5)}`).join(', ')}
                </p>
              )}

              {regularCitas.length === 0 && deepWorkCitas.length === 0 ? (
                <div
                  className="py-3 text-xs text-gray-300 cursor-pointer hover:text-gray-400 transition"
                  onClick={() => onClickSlot(dateStr)}
                >
                  Sin eventos — click para crear
                </div>
              ) : (
                <div className="space-y-0.5">
                  {regularCitas.map((cita: CitaItem) => {
                    const colors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;
                    return (
                      <div
                        key={cita.id}
                        onClick={() => onClickCita(cita)}
                        className="group flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all duration-200 hover:translate-x-1.5 hover:shadow-md"
                        onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.backgroundColor = colors.hex + '10'; }}
                        onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {/* Time */}
                        <span className="text-xs font-mono text-gray-500 w-[70px] shrink-0">
                          {cita.isAllDay ? 'Todo día' : formatHora12(cita.hora_inicio)}
                        </span>

                        {/* Color bar */}
                        <div className="w-0.5 h-8 rounded-full shrink-0" style={{ backgroundColor: colors.hex }} />

                        {/* Event info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{cita.titulo}</p>
                            {(() => {
                              const sub = inferSubcategoria(cita);
                              return sub ? (
                                <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium shrink-0 ${sub.color}`}>
                                  {sub.label}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            {cita.cliente && <span>{cita.cliente.nombre}</span>}
                            {cita.teams_link && <span className="text-purple-500">Teams</span>}
                          </div>
                        </div>

                        {/* Honorario badge */}
                        {cita.costo > 0 && (
                          <span className="text-[11px] font-mono font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                            Q{Number(cita.costo).toLocaleString('es-GT')}
                          </span>
                        )}

                        {/* Hover actions indicator */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center transition-opacity shrink-0">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Week View (Grilla) ──────────────────────────────────────────────────────

// Helper: snap a cita's hora_inicio to the nearest HORAS slot
function snapToSlot(horaInicio: string): string {
  const [ch, cm] = horaInicio.split(':').map(Number);
  const totalMin = ch * 60 + cm;
  const gridStart = 6 * 60;  // 06:00
  const gridEnd = 21 * 60;   // 21:00
  const clamped = Math.max(gridStart, Math.min(gridEnd, totalMin));
  const clampedH = Math.floor(clamped / 60);
  const clampedM = (clamped % 60) < 30 ? '00' : '30';
  return `${String(clampedH).padStart(2, '0')}:${clampedM}`;
}

type WeekSegment =
  | { type: 'visible'; hours: string[] }
  | { type: 'collapsed'; from: string; to: string };

function buildCompactSegments(
  weekDays: Date[],
  citasForDate: (d: string) => CitaItem[],
): WeekSegment[] {
  // 1. Find all slots that have events in ANY day
  const activeSlots = new Set<string>();
  for (const d of weekDays) {
    const dateStr = formatDate(d);
    for (const c of citasForDate(dateStr)) {
      if (c.isAllDay) continue;
      activeSlots.add(snapToSlot(c.hora_inicio));
    }
  }

  // 2. Add 1 slot of context before/after each active slot
  const withContext = new Set<string>(activeSlots);
  for (let i = 0; i < HORAS.length; i++) {
    if (activeSlots.has(HORAS[i])) {
      if (i > 0) withContext.add(HORAS[i - 1]);
      if (i < HORAS.length - 1) withContext.add(HORAS[i + 1]);
    }
  }

  // 3. Add current time slot
  const now = new Date();
  const curH = now.getHours();
  const curM = now.getMinutes() < 30 ? '00' : '30';
  const currentSlot = `${String(curH).padStart(2, '0')}:${curM}`;
  if (HORAS.includes(currentSlot)) {
    withContext.add(currentSlot);
    // Also add neighbors for context
    const idx = HORAS.indexOf(currentSlot);
    if (idx > 0) withContext.add(HORAS[idx - 1]);
    if (idx < HORAS.length - 1) withContext.add(HORAS[idx + 1]);
  }

  // 4. If no events at all, show a reasonable default range (8:00-18:00)
  if (activeSlots.size === 0) {
    for (const h of HORAS) {
      const hour = parseInt(h.split(':')[0], 10);
      if (hour >= 8 && hour <= 17) withContext.add(h);
    }
  }

  // 5. Build segments
  const segments: WeekSegment[] = [];
  let i = 0;
  while (i < HORAS.length) {
    if (withContext.has(HORAS[i])) {
      const start = i;
      while (i < HORAS.length && withContext.has(HORAS[i])) i++;
      segments.push({ type: 'visible', hours: HORAS.slice(start, i) });
    } else {
      const from = HORAS[i];
      while (i < HORAS.length && !withContext.has(HORAS[i])) i++;
      const to = i < HORAS.length ? HORAS[i] : '21:30';
      segments.push({ type: 'collapsed', from, to });
    }
  }

  return segments;
}

function WeekView({
  weekDays,
  citasForDate,
  onClickCita,
  onClickSlot,
  compact,
  now,
}: {
  weekDays: Date[];
  citasForDate: (d: string) => CitaItem[];
  onClickCita: (c: CitaItem) => void;
  onClickSlot: (d: string, hora?: string) => void;
  compact: boolean;
  now: Date;
}) {
  const todayStr = formatDate(new Date());
  const [hoveredCita, setHoveredCita] = useState<CitaItem | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  // Position within a 30-min slot: fraction 0–1
  const currentSlotStr = `${String(currentHour).padStart(2, '0')}:${currentMinute < 30 ? '00' : '30'}`;
  const currentFraction = (currentMinute % 30) / 30;

  // Separate all-day events from timed events
  const hasAllDay = weekDays.some((d: Date) => {
    const dateStr = formatDate(d);
    return citasForDate(dateStr).some((c: CitaItem) => c.isAllDay);
  });

  // Build segments for compact mode
  const segments = compact ? buildCompactSegments(weekDays, citasForDate) : null;
  const horasToRender = segments ?? [{ type: 'visible' as const, hours: HORAS }];

  // Hover handlers
  const handleMouseEnter = (cita: CitaItem, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
    setHoveredCita(cita);
  };
  const handleMouseLeave = () => setHoveredCita(null);

  // Render a single time row
  const renderTimeRow = (hora: string) => {
    const isCurrentSlot = hora === currentSlotStr && formatDate(now) >= formatDate(weekDays[0]) && formatDate(now) <= formatDate(weekDays[6]);
    const hourNum = parseInt(hora.split(':')[0], 10);
    const isDeepWorkHour = hourNum >= 8 && hourNum < DEEP_WORK_END_HOUR;
    const is2pmBoundary = hora === '14:00';

    return (
      <div key={hora} className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-gray-100 relative">
        <div className="p-1 pr-2 text-right text-xs text-gray-400 pt-1 font-mono">{hora}</div>
        {weekDays.map((d: Date, di: number) => {
          const dateStr = formatDate(d);
          const isToday = dateStr === todayStr;
          const citasEnSlot = citasForDate(dateStr).filter((c: CitaItem) => {
            if (c.isAllDay) return false;
            return snapToSlot(c.hora_inicio) === hora;
          });

          return (
            <div
              key={di}
              className={`border-l border-gray-100 min-h-[32px] min-w-0 overflow-visible relative cursor-pointer transition-colors ${
                isToday ? 'hover:bg-cyan/5' : 'hover:bg-gray-50'
              } ${isDeepWorkHour ? 'bg-blue-50/30' : ''}`}
              onClick={() => onClickSlot(dateStr, hora)}
            >
              {/* 2pm Bullet Journal divider */}
              {is2pmBoundary && (
                <div className="absolute top-0 left-0 right-0 h-0 border-t-2 border-dashed border-cyan/40 z-10 pointer-events-none" />
              )}

              {/* Current time indicator */}
              {isCurrentSlot && isToday && (
                <div
                  className="absolute left-0 right-0 z-20 pointer-events-none"
                  style={{ top: `${currentFraction * 100}%` }}
                >
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[2px] bg-red-500" />
                  </div>
                </div>
              )}

              {citasEnSlot.map((cita: CitaItem) => {
                const colors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;
                return (
                  <div
                    key={cita.id}
                    onClick={(e) => { e.stopPropagation(); onClickCita(cita); }}
                    onMouseEnter={(e) => handleMouseEnter(cita, e)}
                    onMouseLeave={handleMouseLeave}
                    className={`absolute inset-x-0.5 ${colors.bg} ${colors.text} ${colors.border} rounded px-1.5 py-0.5 text-xs cursor-pointer z-10 transition-all duration-150 hover:shadow-lg hover:shadow-azure/20 hover:scale-[1.03] hover:z-30`}
                    style={{ borderLeftWidth: '3px', borderLeftStyle: 'solid' }}
                  >
                    <div className="font-semibold truncate">{cita.titulo}</div>
                    <div className="text-[10px] opacity-75 truncate">
                      {cita.cliente?.nombre ?? (cita._source === 'outlook' ? cita.hora_inicio : formatHora12(cita.hora_inicio))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Render a collapsed divider
  const renderCollapsed = (seg: { from: string; to: string }) => (
    <div
      key={`collapsed-${seg.from}`}
      className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-dashed border-gray-200 bg-gray-50/50"
    >
      <div className="py-1 pr-2 text-right">
        <span className="text-[10px] text-gray-300 font-mono">{seg.from} – {seg.to}</span>
      </div>
      {weekDays.map((_: Date, di: number) => (
        <div key={di} className="border-l border-dashed border-gray-200 h-3" />
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-slate-light overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-gray-200">
        <div className="p-2" />
        {weekDays.map((d: Date, i: number) => {
          const dateStr = formatDate(d);
          const isToday = dateStr === todayStr;
          const dayEventCount = citasForDate(dateStr).filter((c: CitaItem) => !c.isAllDay).length;
          return (
            <div
              key={i}
              className={`p-2 text-center border-l border-gray-200 transition-colors ${isToday ? 'bg-azure/5' : ''}`}
            >
              <div className="text-xs text-gray-500">{DAY_NAMES[i]}</div>
              <div className={`text-lg font-semibold ${isToday ? 'text-azure' : 'text-gray-800'}`}>
                {d.getDate()}
              </div>
              {dayEventCount > 0 && (
                <div className="flex justify-center mt-0.5">
                  <span className="text-[9px] text-gray-400">{dayEventCount} evento{dayEventCount !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All-day events bar */}
      {hasAllDay && (
        <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] border-b border-gray-300 bg-gray-50">
          <div className="p-1 pr-2 text-right text-[10px] text-gray-400 pt-1.5">Todo el día</div>
          {weekDays.map((d: Date, di: number) => {
            const dateStr = formatDate(d);
            const allDayEvents = citasForDate(dateStr).filter((c: CitaItem) => c.isAllDay);
            return (
              <div key={di} className="border-l border-gray-200 px-0.5 py-1 space-y-0.5 min-h-[28px] min-w-0 overflow-hidden">
                {allDayEvents.map((cita: CitaItem) => (
                  <div
                    key={cita.id}
                    onClick={() => onClickCita(cita)}
                    className="bg-amber-200 text-amber-900 border-l-2 border-amber-500 rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:bg-amber-300 transition"
                  >
                    {cita.titulo}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Time Grid */}
      <div className={compact ? 'overflow-y-auto' : 'max-h-[600px] overflow-y-auto'}>
        {horasToRender.map((seg: WeekSegment) => {
          if (seg.type === 'collapsed') {
            return renderCollapsed(seg);
          }
          return seg.hours.map((hora: string) => renderTimeRow(hora));
        })}
      </div>

      {/* Hover Tooltip */}
      {hoveredCita && (
        <div
          className="fixed z-50 pointer-events-none animate-in fade-in duration-150"
          style={{
            left: Math.min(tooltipPos.x, typeof window !== 'undefined' ? window.innerWidth - 260 : 800),
            top: Math.max(tooltipPos.y - 8, 8),
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-navy-dark text-white rounded-lg shadow-xl px-3 py-2 text-xs max-w-[240px]">
            <div className="font-semibold mb-1">{hoveredCita.titulo}</div>
            <div className="space-y-0.5 text-gray-300">
              <div className="font-mono">{formatHora12(hoveredCita.hora_inicio)} — {formatHora12(hoveredCita.hora_fin)}</div>
              <div className="flex items-center gap-1.5">
                {TIPO_LABELS[hoveredCita.tipo] ?? hoveredCita.tipo}
                {(() => { const s = inferSubcategoria(hoveredCita); return s ? <span className="text-[9px] bg-white/20 px-1 rounded">{s.label}</span> : null; })()}
              </div>
              {hoveredCita.cliente && <div>{hoveredCita.cliente.nombre}</div>}
              {hoveredCita.descripcion && <div className="text-gray-400 truncate">{hoveredCita.descripcion}</div>}
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-navy-dark" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day View (Legacy — not rendered in current UI) ──────────────────────────

function DayView({
  date,
  citas,
  onClickCita,
}: {
  date: Date;
  citas: CitaItem[];
  onClickCita: (c: CitaItem) => void;
}) {
  const allDay = citas.filter((c: CitaItem) => c.isAllDay);
  const timed = citas.filter((c: CitaItem) => !c.isAllDay);

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
      {/* All-day events */}
      {allDay.length > 0 && (
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 space-y-2">
          <p className="text-xs font-medium text-amber-700 uppercase">Todo el día</p>
          {allDay.map((cita: CitaItem) => (
            <div
              key={cita.id}
              onClick={() => onClickCita(cita)}
              className="bg-white rounded-lg border border-amber-200 px-3 py-2 cursor-pointer hover:shadow-md transition"
            >
              <h3 className="font-semibold text-gray-900 text-sm">{cita.titulo}</h3>
              {cita.descripcion && <p className="text-xs text-gray-500 mt-0.5 truncate">{cita.descripcion}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Timed events */}
      {timed.map((cita: CitaItem) => {
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
                  {TIPO_LABELS[cita.tipo] ?? cita.tipo}
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
  onEdit,
  onDelete,
}: {
  cita: CitaItem;
  onClose: () => void;
  onAction: (id: string, accion: 'completar' | 'cancelar') => void;
  onEdit: (c: CitaItem) => void;
  onDelete: (id: string) => void;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const estado = ESTADO_LABELS[cita.estado] ?? ESTADO_LABELS.pendiente;
  const isOutlook = cita._source === 'outlook';
  const isExpediente = cita._source === 'expediente';
  const isLocal = !isOutlook && !isExpediente;
  const canEdit = !isExpediente && cita.estado !== 'cancelada'; // local + outlook
  const activo = isLocal && (cita.estado === 'pendiente' || cita.estado === 'confirmada');
  const tipoColors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,42,0.5)] backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-slideUp overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Type color bar */}
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${tipoColors.hex}, ${tipoColors.hex}80)` }} />

        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 font-display">{cita.titulo}</h2>
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
              <div className="flex items-center gap-2">
                <p className="font-medium">{TIPO_LABELS[cita.tipo] ?? cita.tipo}</p>
                {(() => { const s = inferSubcategoria(cita); return s ? <span className={`text-[10px] px-1.5 py-0 rounded-full font-medium ${s.color}`}>{s.label}</span> : null; })()}
              </div>
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
              <p className="font-medium font-mono">{cita.isAllDay ? 'Todo el día' : `${formatHora12(cita.hora_inicio)} — ${formatHora12(cita.hora_fin)}`}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase">Cliente</span>
              <p className="font-medium">{cita.cliente?.nombre ?? 'Sin cliente'}</p>
            </div>
            {cita.costo > 0 && (
              <div>
                <span className="text-xs text-gray-500 uppercase">Costo</span>
                <p className="font-medium font-mono">Q{Number(cita.costo).toLocaleString('es-GT')}</p>
              </div>
            )}
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

          {isExpediente && cita.expediente_id && (
            <a
              href={`/admin/expedientes/${cita.expediente_id}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium"
            >
              Ver expediente
            </a>
          )}

          {cita.notas && (
            <div>
              <span className="text-xs text-gray-500 uppercase">Notas</span>
              <p className="text-sm text-gray-600 mt-1">{cita.notas}</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {(canEdit || activo) && (
          <div className="p-6 border-t border-gray-100 space-y-3">
            {/* Edit / Delete — available for local + Outlook events (not expediente) */}
            {canEdit && (
              <div className="flex gap-3">
                <button
                  onClick={() => onEdit(cita)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                >
                  Editar
                </button>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition text-sm font-medium"
                  >
                    Eliminar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onDelete(cita.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700 transition"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Completar / Cancelar — only for active (pendiente/confirmada) local events */}
            {activo && (
              <div className="flex gap-3">
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
        )}
      </div>
    </div>
  );
}

// ── Edit Modal ──────────────────────────────────────────────────────────────

function EditModal({
  cita,
  onClose,
  onSaved,
}: {
  cita: CitaItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(cita.titulo);
  const [descripcion, setDescripcion] = useState(cita.descripcion ?? '');
  const [fecha, setFecha] = useState(cita.fecha);
  const [horaInicio, setHoraInicio] = useState(cita.hora_inicio.substring(0, 5));
  const [duracion, setDuracion] = useState(cita.duracion_minutos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const horaFin = calcHoraFin(horaInicio, duracion);
  const horaNum = parseInt(horaInicio.split(':')[0], 10);
  const isDeepWork = horaNum < DEEP_WORK_END_HOUR && !FREE_TIPOS.has(cita.tipo);
  const tipoColors = TIPO_COLORS[cita.tipo] ?? TIPO_COLORS.consulta_nueva;

  const handleSave = async () => {
    if (!titulo.trim()) { setError('El título es requerido'); return; }
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/calendario/eventos/${cita.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_minutos: duracion,
        }),
      });

      if (!res.ok) {
        let msg = `Error al actualizar (${res.status})`;
        try { const json = await res.json(); msg = json.error || msg; } catch {}
        throw new Error(msg);
      }

      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,42,0.5)] backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 font-display">Editar Evento</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo (read-only) */}
          <div>
            <span className="text-xs text-gray-500 uppercase">Tipo</span>
            <p className="font-medium text-sm">{TIPO_LABELS[cita.tipo] ?? cita.tipo}</p>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
            />
          </div>

          {/* Hora + Duración */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <select
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Hora fin (computed) */}
          <p className="text-xs text-gray-400 font-mono">
            Fin: {formatHora12(horaFin)}
          </p>

          {/* Deep work warning (advisory only) */}
          {isDeepWork && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
              <span>⚠</span> Horario de trabajo profundo — puedes crear el evento de todas formas
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent resize-none"
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
            onClick={handleSave}
            disabled={saving || !titulo.trim()}
            className="flex-1 px-4 py-2 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold disabled:opacity-50"
            style={{ background: `linear-gradient(to right, ${tipoColors.hex}, ${tipoColors.hex}CC)` }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Modal ────────────────────────────────────────────────────────────

function CreateModal({
  initialDate,
  initialTime,
  onClose,
  onCreated,
}: {
  initialDate: string;
  initialTime?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tipo, setTipo] = useState<TipoCitaUI>('consulta_nueva');
  const [fecha, setFecha] = useState(initialDate);
  const [duracion, setDuracion] = useState(30);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);
  const [customTime, setCustomTime] = useState(initialTime || '14:00');
  const [useCustomTime, setUseCustomTime] = useState(!!initialTime);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteSearch, setClienteSearch] = useState('');
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slotMode, setSlotMode] = useState<'fixed' | 'suggested' | 'free'>('fixed');

  const isFree = FREE_TIPOS.has(tipo);
  const isSmart = SMART_SLOT_TIPOS.has(tipo);
  const isSlot = SLOT_TIPOS.has(tipo);

  // Compute deep work warning
  const selectedHour = useCustomTime || isFree
    ? parseInt(customTime.split(':')[0], 10)
    : selectedSlot ? parseInt(selectedSlot.hora_inicio.split(':')[0], 10) : null;
  const showDeepWorkWarning = selectedHour !== null
    && selectedHour < DEEP_WORK_END_HOUR
    && !FREE_TIPOS.has(tipo);

  // Set defaults when tipo changes
  useEffect(() => {
    setSelectedSlot(null);
    setUseCustomTime(false);
    if (isFree) {
      setUseCustomTime(true);
      setDuracion(60);
    } else if (isSmart) {
      setDuracion(30);
    } else if (tipo === 'consulta_nueva') {
      setDuracion(60);
    } else if (tipo === 'seguimiento') {
      setDuracion(15);
    }
  }, [tipo, isFree, isSmart]);

  // Fetch disponibilidad
  useEffect(() => {
    if (!fecha || !tipo) return;
    if (isFree) {
      setSlots([]);
      setSlotMode('free');
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    const durParam = isSmart ? `&duracion=${duracion}` : '';
    fetch(`/api/admin/calendario/disponibilidad?fecha=${fecha}&tipo=${tipo}${durParam}`)
      .then((r) => r.json())
      .then((json) => {
        setSlots(json.slots ?? []);
        setSlotMode(json.mode ?? 'fixed');
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [fecha, tipo, duracion, isFree, isSmart]);

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
    if (!titulo.trim()) {
      setError('Escribe un título');
      return;
    }

    let horaInicio: string;
    let horaFin: string;
    let duracionFinal: number;

    if (useCustomTime || isFree) {
      horaInicio = customTime;
      duracionFinal = duracion;
      horaFin = calcHoraFin(horaInicio, duracionFinal);
    } else if (selectedSlot) {
      horaInicio = selectedSlot.hora_inicio;
      horaFin = selectedSlot.hora_fin;
      duracionFinal = selectedSlot.duracion_minutos;
    } else {
      setError('Selecciona un horario');
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
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          duracion_minutos: duracionFinal,
          cliente_id: clienteId || null,
        }),
      });

      if (!res.ok) {
        let msg = `Error al crear evento (${res.status})`;
        try { const json = await res.json(); msg = json.error || msg; } catch {}
        throw new Error(msg);
      }

      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const isBloqueo = tipo === 'bloqueo_personal';

  return (
    <div className="fixed inset-0 bg-[rgba(15,23,42,0.5)] backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 font-display">Nuevo Evento</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Tipo — card selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de evento</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPO_CARDS.map((opt) => {
                const colors = TIPO_COLORS[opt.value] ?? TIPO_COLORS.consulta_nueva;
                const isSelected = tipo === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTipo(opt.value)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      isSelected
                        ? `${colors.border} ${colors.bg}`
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                    style={isSelected ? { boxShadow: `0 0 12px ${colors.hex}30` } : undefined}
                  >
                    <p className={`text-sm font-semibold ${isSelected ? colors.text : 'text-gray-800'}`}>{opt.label}</p>
                    {opt.sub && <p className="text-[10px] text-gray-500 mt-0.5">{opt.sub}</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
            />
          </div>

          {/* Duration selector (for smart/free modes) */}
          {(isSmart || isFree) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDuracion(opt.value)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                      duracion === opt.value
                        ? 'border-azure bg-azure/10 text-azure font-medium'
                        : 'border-gray-200 hover:border-azure/30 text-gray-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Slots / Time picker */}
          {isSlot && (
            /* Fixed slot mode (consulta, seguimiento) */
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
                      onClick={() => { setSelectedSlot(s); setUseCustomTime(false); }}
                      className={`px-3 py-2 text-sm rounded-lg border transition font-mono ${
                        selectedSlot?.hora_inicio === s.hora_inicio && !useCustomTime
                          ? 'border-azure bg-azure/10 text-azure font-medium'
                          : 'border-gray-200 hover:border-azure/30 text-gray-700'
                      }`}
                    >
                      {formatHora12(s.hora_inicio)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {isSmart && (
            /* Smart slot mode (reunion, evento_libre) - suggested + custom */
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horarios sugeridos
                {loadingSlots && <span className="ml-2 text-gray-400 text-xs">cargando...</span>}
              </label>
              {slots.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {slots.map((s: SlotItem) => (
                    <button
                      key={s.hora_inicio}
                      onClick={() => { setSelectedSlot(s); setUseCustomTime(false); }}
                      className={`px-3 py-2 text-sm rounded-lg border transition text-left font-mono ${
                        selectedSlot?.hora_inicio === s.hora_inicio && !useCustomTime
                          ? 'border-azure bg-azure/10 text-azure font-medium'
                          : 'border-gray-200 hover:border-azure/30 text-gray-700'
                      }`}
                    >
                      <span>{formatHora12(s.hora_inicio)}</span>
                      {s.preferred && (
                        <span className="ml-1.5 text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-sans">
                          preferido
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!loadingSlots && slots.length === 0 && (
                <p className="text-sm text-gray-400 mb-2">No hay horarios sugeridos para esta fecha</p>
              )}
              <button
                onClick={() => setUseCustomTime(true)}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                  useCustomTime
                    ? 'border-azure bg-azure/10 text-azure font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-azure/30'
                }`}
              >
                Horario personalizado
              </button>
              {useCustomTime && (
                <div className="mt-2">
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent font-mono"
                  />
                  <span className="text-xs text-gray-400 ml-2 font-mono">
                    Fin: {formatHora12(calcHoraFin(customTime, duracion))}
                  </span>
                </div>
              )}
            </div>
          )}

          {isFree && (
            /* Free time picker mode (audiencia, bloqueo) */
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hora inicio</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin</label>
                <p className="px-3 py-2 text-sm text-gray-600 bg-gray-50 rounded-lg font-mono">
                  {formatHora12(calcHoraFin(customTime, duracion))}
                </p>
              </div>
            </div>
          )}

          {/* Deep work warning (advisory only) */}
          {showDeepWorkWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
              <span>⚠</span> Horario de trabajo profundo — puedes crear el evento de todas formas
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={isBloqueo ? 'Ej: Almuerzo, Cita médica' : 'Ej: Consulta sobre contrato'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
            />
          </div>

          {/* Cliente search (not for bloqueo_personal) */}
          {!isBloqueo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente (opcional)</label>
              <input
                type="text"
                value={clienteSearch}
                onChange={(e) => { setClienteSearch(e.target.value); setClienteId(''); }}
                placeholder="Buscar cliente por nombre..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent"
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
          )}

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-transparent resize-none"
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
            disabled={saving || !titulo.trim()}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-azure to-azure-dark text-white rounded-lg shadow-glow-azure hover:shadow-glow-cyan transition-all text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Creando...' : 'Crear Evento'}
          </button>
        </div>
      </div>
    </div>
  );
}
