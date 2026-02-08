// ============================================================================
// app/agendar/page.tsx
// Página pública para agendar citas — wizard de 5 pasos
// ============================================================================
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────────────────────

type TipoCita = 'consulta_nueva' | 'seguimiento';

interface SlotItem {
  hora_inicio: string;
  hora_fin: string;
  duracion_minutos: number;
}

interface BookingResult {
  success: boolean;
  cita_id: string;
  teams_link: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: TipoCita;
  costo: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const TIPO_INFO: Record<TipoCita, {
  label: string;
  desc: string;
  duracion: string;
  costo: string;
  costoNum: number;
  modalidad: string;
  dias: readonly number[];
  diasLabel: string;
}> = {
  consulta_nueva: {
    label: 'Consulta Legal',
    desc: 'Para nuevos asuntos o consultas generales.',
    duracion: 'Hasta 1 hora',
    costo: 'Q500',
    costoNum: 500,
    modalidad: 'Virtual por Teams',
    dias: [1, 3, 5],
    diasLabel: 'Lunes, miercoles y viernes',
  },
  seguimiento: {
    label: 'Seguimiento de Caso',
    desc: 'Para clientes con caso activo.',
    duracion: '15 minutos',
    costo: 'Sin costo',
    costoNum: 0,
    modalidad: 'Virtual por Teams',
    dias: [2, 3],
    diasLabel: 'Martes y miercoles',
  },
};

const DAY_NAMES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const STEP_LABELS = ['Tipo', 'Fecha', 'Hora', 'Datos', 'Confirmar'];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-GT', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Guatemala',
  });
}

function formatHora12(hora: string): string {
  const [h, m] = hora.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AgendarPage() {
  const [step, setStep] = useState(1);

  // Step 1
  const [tipo, setTipo] = useState<TipoCita | null>(null);

  // Step 2
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Step 3
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null);

  // Step 4
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [nit, setNit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [asunto, setAsunto] = useState('');
  const [numeroCaso, setNumeroCaso] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // Step 5
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BookingResult | null>(null);

  // Fetch slots when date is selected
  const fetchSlots = useCallback(async () => {
    if (!selectedDate || !tipo) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await fetch(
        `/api/public/disponibilidad?fecha=${selectedDate}&tipo=${tipo}`
      );
      const json = await res.json();
      setSlots(json.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [selectedDate, tipo]);

  useEffect(() => {
    if (step === 3) fetchSlots();
  }, [step, fetchSlots]);

  // Navigation
  const goNext = () => setStep((s) => Math.min(s + 1, 5));
  const goBack = () => {
    setError('');
    setStep((s) => Math.max(s - 1, 1));
  };

  // Submit
  const handleSubmit = async () => {
    if (!tipo || !selectedDate || !selectedSlot) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/public/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          fecha: selectedDate,
          hora: selectedSlot.hora_inicio,
          nombres: nombres.trim(),
          apellidos: apellidos.trim() || undefined,
          nit: nit.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
          empresa: empresa.trim() || undefined,
          asunto: asunto.trim(),
          numero_caso: numeroCaso.trim() || undefined,
          _hp: honeypot || undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Error al agendar cita');
      }

      setResult(json);
      setStep(6); // Success screen
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-600 to-cyan-500">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              AS
            </span>
            <div className="hidden sm:block">
              <p className="text-white font-semibold text-sm">Amanda Santizo</p>
              <p className="text-white/70 text-xs">& Asociados</p>
            </div>
          </Link>
          <Link
            href="/"
            className="text-white/80 hover:text-white text-sm transition"
          >
            Volver al sitio
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Title */}
        {step <= 5 && (
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              Agendar Cita
            </h1>
            <p className="text-gray-500">
              Reserve su cita en pocos pasos. Atendemos de forma virtual por Microsoft Teams.
            </p>
          </div>
        )}

        {/* Progress Bar */}
        {step <= 5 && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-2">
              {STEP_LABELS.map((label, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === step;
                const isDone = stepNum < step;
                return (
                  <div key={i} className="flex flex-col items-center flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        isDone
                          ? 'bg-teal-600 text-white'
                          : isActive
                          ? 'bg-teal-600 text-white ring-4 ring-teal-100'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isDone ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        stepNum
                      )}
                    </div>
                    <span className={`text-xs mt-1 hidden sm:block ${isActive ? 'text-teal-700 font-medium' : 'text-gray-400'}`}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-600 to-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${((step - 1) / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Steps */}
        {step === 1 && (
          <StepTipo
            selected={tipo}
            onSelect={(t) => {
              setTipo(t);
              setSelectedDate(null);
              setSelectedSlot(null);
              goNext();
            }}
          />
        )}

        {step === 2 && tipo && (
          <StepFecha
            tipo={tipo}
            selected={selectedDate}
            onSelect={(d) => {
              setSelectedDate(d);
              setSelectedSlot(null);
              goNext();
            }}
            onBack={goBack}
          />
        )}

        {step === 3 && tipo && selectedDate && (
          <StepHora
            tipo={tipo}
            fecha={selectedDate}
            slots={slots}
            loading={loadingSlots}
            selected={selectedSlot}
            onSelect={(s) => {
              setSelectedSlot(s);
              goNext();
            }}
            onBack={goBack}
          />
        )}

        {step === 4 && tipo && (
          <StepDatos
            tipo={tipo}
            nombres={nombres}
            apellidos={apellidos}
            nit={nit}
            email={email}
            telefono={telefono}
            empresa={empresa}
            asunto={asunto}
            numeroCaso={numeroCaso}
            honeypot={honeypot}
            onNombres={setNombres}
            onApellidos={setApellidos}
            onNit={setNit}
            onEmail={setEmail}
            onTelefono={setTelefono}
            onEmpresa={setEmpresa}
            onAsunto={setAsunto}
            onNumeroCaso={setNumeroCaso}
            onHoneypot={setHoneypot}
            onNext={goNext}
            onBack={goBack}
          />
        )}

        {step === 5 && tipo && selectedDate && selectedSlot && (
          <StepConfirmar
            tipo={tipo}
            fecha={selectedDate}
            slot={selectedSlot}
            nombres={nombres}
            apellidos={apellidos}
            nit={nit}
            email={email}
            telefono={telefono}
            empresa={empresa}
            asunto={asunto}
            numeroCaso={numeroCaso}
            submitting={submitting}
            error={error}
            onSubmit={handleSubmit}
            onBack={goBack}
          />
        )}

        {step === 6 && result && tipo && (
          <StepExito result={result} tipo={tipo} nombres={nombres} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-gray-400">
          Amanda Santizo & Asociados — amandasantizo.com
        </div>
      </footer>
    </div>
  );
}

// ── Step 1: Tipo ────────────────────────────────────────────────────────────

function StepTipo({
  selected,
  onSelect,
}: {
  selected: TipoCita | null;
  onSelect: (tipo: TipoCita) => void;
}) {
  const tipos: TipoCita[] = ['consulta_nueva', 'seguimiento'];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Seleccione el tipo de cita
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Elija la opcion que mejor se adapte a su necesidad.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        {tipos.map((t) => {
          const info = TIPO_INFO[t];
          const isSelected = selected === t;

          return (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className={`text-left p-6 rounded-xl border-2 transition-all hover:shadow-lg ${
                isSelected
                  ? 'border-teal-500 bg-teal-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-teal-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  t === 'consulta_nueva'
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {t === 'consulta_nueva' ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{info.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{info.desc}</p>

                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {info.duracion}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className={t === 'consulta_nueva' ? 'font-semibold text-gray-900' : 'text-emerald-600 font-medium'}>
                        {info.costo}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {info.modalidad}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {info.diasLabel}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 2: Fecha ───────────────────────────────────────────────────────────

function StepFecha({
  tipo,
  selected,
  onSelect,
  onBack,
}: {
  tipo: TipoCita;
  selected: string | null;
  onSelect: (date: string) => void;
  onBack: () => void;
}) {
  const info = TIPO_INFO[tipo];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  // Limit to 2 months ahead
  const maxMonth = (today.getMonth() + 2) % 12;
  const maxYear = today.getFullYear() + (today.getMonth() + 2 >= 12 ? 1 : 0);
  const canGoNext = viewYear < maxYear || (viewYear === maxYear && viewMonth < maxMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Generate calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  // Monday-based: Monday=0, Sunday=6
  const startDow = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isDayAllowed = (day: number): boolean => {
    const d = new Date(viewYear, viewMonth, day);
    if (d < today) return false;
    return info.dias.includes(d.getDay());
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Seleccione una fecha
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        {info.label}: disponible {info.diasLabel.toLowerCase()}.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 max-w-md mx-auto">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="font-semibold text-gray-900">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <button
            onClick={nextMonth}
            disabled={!canGoNext}
            className="p-2 rounded-lg hover:bg-gray-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_NAMES.map((name) => (
            <div key={name} className="text-center text-xs font-medium text-gray-400 py-2">
              {name}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) {
              return <div key={i} className="h-10" />;
            }

            const dateStr = formatDate(new Date(viewYear, viewMonth, day));
            const allowed = isDayAllowed(day);
            const isSelected = selected === dateStr;
            const isToday = dateStr === formatDate(today);

            return (
              <button
                key={i}
                disabled={!allowed}
                onClick={() => onSelect(dateStr)}
                className={`h-10 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-md'
                    : allowed
                    ? 'hover:bg-teal-50 hover:text-teal-700 text-gray-700'
                    : 'text-gray-300 cursor-not-allowed'
                } ${isToday && !isSelected ? 'ring-2 ring-teal-300' : ''}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Back button */}
      <div className="mt-6 text-center">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-700 transition"
        >
          Volver al paso anterior
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Hora ────────────────────────────────────────────────────────────

function StepHora({
  tipo,
  fecha,
  slots,
  loading,
  selected,
  onSelect,
  onBack,
}: {
  tipo: TipoCita;
  fecha: string;
  slots: SlotItem[];
  loading: boolean;
  selected: SlotItem | null;
  onSelect: (slot: SlotItem) => void;
  onBack: () => void;
}) {
  const info = TIPO_INFO[tipo];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Seleccione un horario
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        {info.label} — {formatDateLong(fecha)}
      </p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-500 font-medium">No hay horarios disponibles para esta fecha</p>
          <p className="text-gray-400 text-sm mt-1">Por favor seleccione otra fecha.</p>
          <button
            onClick={onBack}
            className="mt-4 px-4 py-2 text-sm text-teal-600 hover:text-teal-700 font-medium transition"
          >
            Elegir otra fecha
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 max-w-md mx-auto">
          <div className={`grid ${tipo === 'seguimiento' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'} gap-2`}>
            {slots.map((slot) => {
              const isSelected = selected?.hora_inicio === slot.hora_inicio;
              return (
                <button
                  key={slot.hora_inicio}
                  onClick={() => onSelect(slot)}
                  className={`py-3 px-2 rounded-lg text-sm font-medium transition-all border ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md'
                      : 'border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {formatHora12(slot.hora_inicio)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {slots.length > 0 && (
        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 transition"
          >
            Volver al paso anterior
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Datos ───────────────────────────────────────────────────────────

function StepDatos({
  tipo,
  nombres,
  apellidos,
  nit,
  email,
  telefono,
  empresa,
  asunto,
  numeroCaso,
  honeypot,
  onNombres,
  onApellidos,
  onNit,
  onEmail,
  onTelefono,
  onEmpresa,
  onAsunto,
  onNumeroCaso,
  onHoneypot,
  onNext,
  onBack,
}: {
  tipo: TipoCita;
  nombres: string;
  apellidos: string;
  nit: string;
  email: string;
  telefono: string;
  empresa: string;
  asunto: string;
  numeroCaso: string;
  honeypot: string;
  onNombres: (v: string) => void;
  onApellidos: (v: string) => void;
  onNit: (v: string) => void;
  onEmail: (v: string) => void;
  onTelefono: (v: string) => void;
  onEmpresa: (v: string) => void;
  onAsunto: (v: string) => void;
  onNumeroCaso: (v: string) => void;
  onHoneypot: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [formError, setFormError] = useState('');

  const validate = (): boolean => {
    if (!nombres.trim() || !nit.trim() || !email.trim() || !telefono.trim() || !asunto.trim()) {
      setFormError('Por favor complete todos los campos requeridos.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError('Por favor ingrese un email valido.');
      return false;
    }
    setFormError('');
    return true;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Sus datos de contacto
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Complete sus datos para confirmar la cita. Recibira un email de confirmacion.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 max-w-lg mx-auto space-y-4">
        {/* Honeypot — hidden from humans, bots fill it */}
        <div className="absolute opacity-0 -z-10" aria-hidden="true" tabIndex={-1}>
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => onHoneypot(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre(s) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nombres}
              onChange={(e) => onNombres(e.target.value)}
              placeholder="Ej: Maria"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellido(s) <span className="text-gray-400 text-xs font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={apellidos}
              onChange={(e) => onApellidos(e.target.value)}
              placeholder="Ej: Garcia Lopez"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            NIT <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nit}
            onChange={(e) => onNit(e.target.value)}
            placeholder="Ej: 12345678 o CF"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => onEmail(e.target.value)}
            placeholder="correo@ejemplo.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Telefono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => onTelefono(e.target.value)}
            placeholder="Ej: 5555-1234"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Empresa <span className="text-gray-400 text-xs font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={empresa}
            onChange={(e) => onEmpresa(e.target.value)}
            placeholder="Nombre de su empresa"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion breve del asunto <span className="text-red-500">*</span>
          </label>
          <textarea
            value={asunto}
            onChange={(e) => onAsunto(e.target.value)}
            rows={3}
            placeholder="Describa brevemente su consulta o necesidad legal..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
          />
        </div>

        {tipo === 'seguimiento' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Numero de caso o referencia <span className="text-gray-400 text-xs font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={numeroCaso}
              onChange={(e) => onNumeroCaso(e.target.value)}
              placeholder="Ej: EXP-2026-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
            />
          </div>
        )}

        {formError && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onBack}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            Atras
          </button>
          <button
            onClick={() => validate() && onNext()}
            className="flex-1 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 5: Confirmar ───────────────────────────────────────────────────────

function StepConfirmar({
  tipo,
  fecha,
  slot,
  nombres,
  apellidos,
  nit,
  email,
  telefono,
  empresa,
  asunto,
  numeroCaso,
  submitting,
  error,
  onSubmit,
  onBack,
}: {
  tipo: TipoCita;
  fecha: string;
  slot: SlotItem;
  nombres: string;
  apellidos: string;
  nit: string;
  email: string;
  telefono: string;
  empresa: string;
  asunto: string;
  numeroCaso: string;
  submitting: boolean;
  error: string;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const info = TIPO_INFO[tipo];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Confirme su cita
      </h2>
      <p className="text-gray-500 mb-6 text-sm">
        Verifique los datos antes de confirmar.
      </p>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden max-w-lg mx-auto">
        {/* Summary header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 p-4 text-white">
          <h3 className="font-semibold text-lg">{info.label}</h3>
          <p className="text-white/80 text-sm">{info.modalidad}</p>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Fecha</span>
              <p className="font-medium text-gray-900 mt-0.5">{formatDateLong(fecha)}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Horario</span>
              <p className="font-medium text-gray-900 mt-0.5">
                {formatHora12(slot.hora_inicio)} - {formatHora12(slot.hora_fin)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Duracion</span>
              <p className="font-medium text-gray-900 mt-0.5">{info.duracion}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Costo</span>
              <p className={`font-semibold mt-0.5 ${info.costoNum > 0 ? 'text-gray-900' : 'text-emerald-600'}`}>
                {info.costo}
                {info.costoNum > 0 && (
                  <span className="text-xs text-gray-400 font-normal block">Pago al momento de la consulta</span>
                )}
              </p>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Contact info */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Nombre</span>
              <span className="text-gray-900 font-medium">
                {nombres}{apellidos ? ` ${apellidos}` : ''}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">NIT</span>
              <span className="text-gray-900">{nit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-900">{email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Telefono</span>
              <span className="text-gray-900">{telefono}</span>
            </div>
            {empresa && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Empresa</span>
                <span className="text-gray-900">{empresa}</span>
              </div>
            )}
          </div>

          <hr className="border-gray-100" />

          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Asunto</span>
            <p className="text-sm text-gray-700 mt-1">{asunto}</p>
          </div>

          {numeroCaso && (
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Caso/Referencia</span>
              <p className="text-sm text-gray-700 mt-1">{numeroCaso}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onBack}
              disabled={submitting}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium disabled:opacity-50"
            >
              Atras
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Procesando...
                </span>
              ) : (
                'Confirmar cita'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 6: Exito ───────────────────────────────────────────────────────────

function StepExito({
  result,
  tipo,
  nombres,
}: {
  result: BookingResult;
  tipo: TipoCita;
  nombres: string;
}) {
  const info = TIPO_INFO[tipo];

  return (
    <div className="text-center max-w-lg mx-auto">
      {/* Success icon */}
      <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Cita agendada exitosamente
      </h2>
      <p className="text-gray-500 mb-8">
        {nombres}, su cita ha sido confirmada. Recibira un email con los detalles.
      </p>

      {/* Summary card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-left mb-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Tipo</span>
            <span className="text-sm font-medium text-gray-900">{info.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Fecha</span>
            <span className="text-sm font-medium text-gray-900">{formatDateLong(result.fecha)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Hora</span>
            <span className="text-sm font-medium text-gray-900">
              {formatHora12(result.hora_inicio)} - {formatHora12(result.hora_fin)}
            </span>
          </div>
          {result.costo > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Costo</span>
              <span className="text-sm font-semibold text-gray-900">Q{result.costo.toLocaleString('es-GT')}</span>
            </div>
          )}
        </div>

        {result.teams_link && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Enlace de la reunion</p>
            <a
              href={result.teams_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-lg hover:shadow-lg transition text-sm font-semibold w-full justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Unirse a Microsoft Teams
            </a>
            <p className="text-xs text-gray-400 mt-2">
              Tambien recibira el enlace por email.
            </p>
          </div>
        )}
      </div>

      <Link
        href="/"
        className="text-sm text-teal-600 hover:text-teal-700 font-medium transition"
      >
        Volver al sitio web
      </Link>
    </div>
  );
}
