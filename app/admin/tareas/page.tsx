'use client';

import { useState, useCallback, useMemo } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import type { TareaConCliente } from '@/lib/types';
import {
  TipoTarea,
  EstadoTarea,
  CategoriaTarea,
  AsignadoTarea,
  TIPO_TAREA_SYMBOL,
  ESTADO_TAREA_LABEL,
  CATEGORIA_TAREA_LABEL,
  CATEGORIA_TAREA_COLOR,
  ASIGNADO_TAREA_ICON,
  ASIGNADO_TAREA_LABEL,
  PRIORIDAD_COLOR,
} from '@/lib/types';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD in Guatemala timezone */
function fechaGT(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

const HOY = fechaGT();

function fechaDisplay(fecha: string | null): string {
  if (!fecha) return '';
  const d = new Date(fecha + 'T12:00:00');
  return d.toLocaleDateString('es-GT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'America/Guatemala',
  });
}

function fechaClass(fecha: string | null): string {
  if (!fecha) return 'text-slate-400';
  if (fecha < HOY) return 'text-red-600 font-semibold';
  if (fecha === HOY) return 'text-amber-600 font-semibold';
  return 'text-slate-500';
}

const FILTROS_RAPIDOS = [
  { label: 'Todas', value: '' },
  { label: 'Hoy', value: 'hoy' },
  { label: 'Esta semana', value: 'semana' },
  { label: 'Vencidas', value: 'vencidas' },
];

const CATEGORIAS_FILTRO = [
  { label: 'Todas', value: '' },
  ...Object.values(CategoriaTarea).map((c) => ({ label: CATEGORIA_TAREA_LABEL[c], value: c })),
];

// ── Main Page ───────────────────────────────────────────────────────────────

export default function TareasPage() {
  const [filtroRapido, setFiltroRapido] = useState('');
  const [filtroCat, setFiltroCat] = useState('');
  const [search, setSearch] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build URL params
  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set('limit', '200');
    if (filtroCat) p.set('categoria', filtroCat);
    if (search) p.set('q', search);
    // Don't filter by estado — we fetch all and split into columns client-side
    return p.toString();
  }, [filtroCat, search]);

  const { data, loading, refetch } = useFetch<{
    data: TareaConCliente[];
    total: number;
  }>(`/api/admin/tareas?${params}`);

  const { mutate } = useMutate();

  const allTareas = data?.data ?? [];

  // Apply quick filter
  const filtered = useMemo(() => {
    let list = allTareas;
    if (filtroRapido === 'hoy') {
      list = list.filter((t: TareaConCliente) => t.fecha_limite === HOY || (!t.fecha_limite && t.estado !== 'completada' && t.estado !== 'cancelada'));
    } else if (filtroRapido === 'semana') {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));
      const weekEndStr = fechaGT(weekEnd);
      list = list.filter((t: TareaConCliente) =>
        (t.fecha_limite && t.fecha_limite <= weekEndStr) || !t.fecha_limite
      );
    } else if (filtroRapido === 'vencidas') {
      list = list.filter((t: TareaConCliente) => t.fecha_limite && t.fecha_limite < HOY && t.estado !== 'completada' && t.estado !== 'cancelada');
    }
    return list;
  }, [allTareas, filtroRapido]);

  // Split into columns
  const pendientes = filtered.filter((t: TareaConCliente) => t.estado === 'pendiente')
    .sort((a: TareaConCliente, b: TareaConCliente) => {
      const p: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      return (p[a.prioridad] ?? 1) - (p[b.prioridad] ?? 1);
    });
  const enProgreso = filtered.filter((t: TareaConCliente) => t.estado === 'en_progreso');
  const completadas = filtered.filter((t: TareaConCliente) => t.estado === 'completada')
    .sort((a: TareaConCliente, b: TareaConCliente) =>
      (b.fecha_completada ?? '').localeCompare(a.fecha_completada ?? '')
    );

  // ── Actions ─────────────────────────────────────────────────────────────

  const handleComplete = useCallback(async (id: string) => {
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'PATCH',
      body: { estado: EstadoTarea.COMPLETADA },
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  const handleStartProgress = useCallback(async (id: string) => {
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'PATCH',
      body: { estado: EstadoTarea.EN_PROGRESO },
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  const handleReopen = useCallback(async (id: string) => {
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'PATCH',
      body: { estado: EstadoTarea.PENDIENTE },
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Eliminar esta tarea?')) return;
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'DELETE',
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  const handleMigrate = useCallback(async (id: string) => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = fechaGT(manana);
    await mutate(`/api/admin/tareas/${id}`, {
      method: 'PATCH',
      body: { fecha_limite: mananaStr, estado: EstadoTarea.PENDIENTE },
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  // ── Quick Input ─────────────────────────────────────────────────────────

  const handleQuickInput = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || !quickInput.trim()) return;
    const text = quickInput.trim();

    // Parse bullet journal notation
    let tipo: TipoTarea = TipoTarea.TAREA;
    let titulo = text;
    let categoria: CategoriaTarea = CategoriaTarea.TRAMITES;
    let prioridad: 'alta' | 'media' | 'baja' = 'media';

    if (text.startsWith('\u2022 ') || text.startsWith('* ')) {
      tipo = TipoTarea.TAREA;
      titulo = text.slice(2);
    } else if (text.startsWith('\u25CB ') || text.startsWith('o ') || text.startsWith('O ')) {
      tipo = TipoTarea.EVENTO;
      titulo = text.slice(2);
    } else if (text.startsWith('\u2014 ') || text.startsWith('- ')) {
      tipo = TipoTarea.NOTA;
      titulo = text.slice(2);
    }

    // Auto-detect category from keywords
    const lower = titulo.toLowerCase();
    if (lower.includes('cobr') || lower.includes('pago') || lower.includes('q ') || /q\d/.test(lower)) {
      categoria = CategoriaTarea.COBROS;
    } else if (lower.includes('documento') || lower.includes('contrato') || lower.includes('escritura')) {
      categoria = CategoriaTarea.DOCUMENTOS;
    } else if (lower.includes('audiencia') || lower.includes('juzgado') || lower.includes('tribunal')) {
      categoria = CategoriaTarea.AUDIENCIAS;
    } else if (lower.includes('seguimiento') || lower.includes('revisar')) {
      categoria = CategoriaTarea.SEGUIMIENTO;
    }

    // Detect priority from !, !!, !!!
    if (text.includes('!!!') || lower.includes('urgente')) {
      prioridad = 'alta';
    } else if (text.includes('!!')) {
      prioridad = 'alta';
    } else if (text.includes('!')) {
      prioridad = 'media';
    }

    // Clean up title
    titulo = titulo.replace(/!+/g, '').trim();

    await mutate('/api/admin/tareas', {
      method: 'POST',
      body: { titulo, tipo, categoria, prioridad, fecha_limite: HOY },
      onSuccess: () => {
        setQuickInput('');
        refetch();
      },
    });
  }, [quickInput, mutate, refetch]);

  // ── Render ─────────────────────────────────────────────────────────────

  const todayFormatted = new Date().toLocaleDateString('es-GT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Guatemala',
  });

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda del Despacho</h1>
          <p className="text-sm text-slate-500 capitalize">{todayFormatted}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-medium">
            {pendientes.length} pendientes
          </span>
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
            {enProgreso.length} en progreso
          </span>
          <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
            {completadas.length} completadas
          </span>
        </div>
      </div>

      {/* Quick Input */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl text-teal-500 font-bold">{'\u2022'}</span>
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={handleQuickInput}
            placeholder="Escribe una tarea...  (\u2022 tarea, \u25CB evento, \u2014 nota, !!! urgente)"
            className="flex-1 text-sm text-slate-700 placeholder:text-slate-400 outline-none bg-transparent"
          />
          <span className="text-xs text-slate-400">Enter para crear</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Quick filters */}
        <div className="flex gap-1">
          {FILTROS_RAPIDOS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltroRapido(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filtroRapido === f.value
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200" />

        {/* Category filter */}
        <div className="flex gap-1">
          {CATEGORIAS_FILTRO.map((c) => (
            <button
              key={c.value}
              onClick={() => setFiltroCat(c.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filtroCat === c.value
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-200" />

        {/* Search */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 outline-none focus:border-teal-400 w-40"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-24 bg-white rounded-xl animate-pulse border border-slate-100" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Kanban Columns */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Pendientes */}
          <Column
            title="Pendientes"
            symbol={'\u2022'}
            color="amber"
            tareas={pendientes}
            expandedId={expandedId}
            onToggle={setExpandedId}
            actions={(t: TareaConCliente) => (
              <div className="flex gap-1">
                <ActionBtn label={'\u2192'} title="Iniciar" onClick={() => handleStartProgress(t.id)} color="blue" />
                <ActionBtn label={'\u2715'} title="Completar" onClick={() => handleComplete(t.id)} color="green" />
                <ActionBtn label=">" title="Migrar a ma\u00f1ana" onClick={() => handleMigrate(t.id)} color="purple" />
                <ActionBtn label={'\u00D7'} title="Eliminar" onClick={() => handleDelete(t.id)} color="red" />
              </div>
            )}
          />

          {/* En progreso */}
          <Column
            title="En progreso"
            symbol={'\u2192'}
            color="blue"
            tareas={enProgreso}
            expandedId={expandedId}
            onToggle={setExpandedId}
            actions={(t: TareaConCliente) => (
              <div className="flex gap-1">
                <ActionBtn label={'\u2715'} title="Completar" onClick={() => handleComplete(t.id)} color="green" />
                <ActionBtn label={'\u2190'} title="Regresar a pendiente" onClick={() => handleReopen(t.id)} color="amber" />
                <ActionBtn label={'\u00D7'} title="Eliminar" onClick={() => handleDelete(t.id)} color="red" />
              </div>
            )}
          />

          {/* Completadas */}
          <Column
            title="Completadas"
            symbol={'\u2715'}
            color="green"
            tareas={completadas}
            expandedId={expandedId}
            onToggle={setExpandedId}
            actions={(t: TareaConCliente) => (
              <div className="flex gap-1">
                <ActionBtn label={'\u2190'} title="Reabrir" onClick={() => handleReopen(t.id)} color="amber" />
                <ActionBtn label={'\u00D7'} title="Eliminar" onClick={() => handleDelete(t.id)} color="red" />
              </div>
            )}
          />
        </div>
      )}

      {/* Empty state */}
      {!loading && allTareas.length === 0 && (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">{'\u2022'}</p>
          <p className="text-slate-500 font-medium">No hay tareas a\u00fan</p>
          <p className="text-sm text-slate-400 mt-1">Escribe tu primera tarea en el campo de arriba</p>
        </div>
      )}
    </div>
  );
}

// ── Column Component ────────────────────────────────────────────────────────

function Column({
  title,
  symbol,
  color,
  tareas,
  expandedId,
  onToggle,
  actions,
}: {
  title: string;
  symbol: string;
  color: string;
  tareas: TareaConCliente[];
  expandedId: string | null;
  onToggle: (id: string | null) => void;
  actions: (t: TareaConCliente) => React.ReactNode;
}) {
  const colorMap: Record<string, { bg: string; text: string; border: string; header: string }> = {
    amber: { bg: 'bg-amber-50/50', text: 'text-amber-700', border: 'border-amber-200', header: 'bg-amber-100' },
    blue: { bg: 'bg-blue-50/50', text: 'text-blue-700', border: 'border-blue-200', header: 'bg-blue-100' },
    green: { bg: 'bg-green-50/50', text: 'text-green-700', border: 'border-green-200', header: 'bg-green-100' },
  };
  const c = colorMap[color] ?? colorMap.amber;

  return (
    <div className={`rounded-xl border ${c.border} ${c.bg} min-h-[200px]`}>
      <div className={`flex items-center gap-2 px-4 py-3 ${c.header} rounded-t-xl`}>
        <span className={`text-lg font-bold ${c.text}`}>{symbol}</span>
        <span className={`text-sm font-semibold ${c.text}`}>{title}</span>
        <span className={`ml-auto text-xs font-medium ${c.text} bg-white/60 px-2 py-0.5 rounded-full`}>
          {tareas.length}
        </span>
      </div>
      <div className="p-3 space-y-2">
        {tareas.map((t: TareaConCliente) => (
          <TareaCard
            key={t.id}
            tarea={t}
            expanded={expandedId === t.id}
            onToggle={() => onToggle(expandedId === t.id ? null : t.id)}
            actions={actions(t)}
          />
        ))}
        {tareas.length === 0 && (
          <p className="text-center text-xs text-slate-400 py-6">Sin tareas</p>
        )}
      </div>
    </div>
  );
}

// ── Tarea Card Component ────────────────────────────────────────────────────

function TareaCard({
  tarea,
  expanded,
  onToggle,
  actions,
}: {
  tarea: TareaConCliente;
  expanded: boolean;
  onToggle: () => void;
  actions: React.ReactNode;
}) {
  const t = tarea;
  const symbol = TIPO_TAREA_SYMBOL[t.tipo as TipoTarea] ?? '\u2022';
  const catColor = CATEGORIA_TAREA_COLOR[t.categoria as CategoriaTarea] ?? 'bg-gray-100 text-gray-600';
  const catLabel = CATEGORIA_TAREA_LABEL[t.categoria as CategoriaTarea] ?? t.categoria;
  const prioColor = PRIORIDAD_COLOR[t.prioridad] ?? '';
  const asigIcon = ASIGNADO_TAREA_ICON[t.asignado_a as AsignadoTarea] ?? '';
  const asigLabel = ASIGNADO_TAREA_LABEL[t.asignado_a as AsignadoTarea] ?? t.asignado_a;
  const isComplete = t.estado === 'completada';

  return (
    <div
      className={`bg-white rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 ${
        isComplete ? 'opacity-70' : ''
      }`}
    >
      {/* Main row */}
      <div
        className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer"
        onClick={onToggle}
      >
        <span className={`text-base font-bold mt-0.5 ${isComplete ? 'text-green-500' : 'text-slate-400'}`}>
          {isComplete ? '\u2715' : symbol}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isComplete ? 'line-through text-slate-400' : 'text-slate-700'}`}>
            {t.titulo}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${catColor}`}>
              {catLabel}
            </span>
            {t.prioridad === 'alta' && (
              <span className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded-full ${prioColor}`}>
                Alta
              </span>
            )}
            {t.cliente && (
              <span className="text-[10px] text-slate-400">{t.cliente.nombre}</span>
            )}
            {t.fecha_limite && (
              <span className={`text-[10px] ${fechaClass(t.fecha_limite)}`}>
                {fechaDisplay(t.fecha_limite)}
              </span>
            )}
            <span className="text-[10px]" title={asigLabel}>{asigIcon}</span>
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-50 space-y-2">
          {t.descripcion && (
            <p className="text-xs text-slate-500">{t.descripcion}</p>
          )}
          {t.notas && (
            <p className="text-xs text-slate-400 italic">{t.notas}</p>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              Creada: {new Date(t.created_at).toLocaleDateString('es-GT')}
              {t.fecha_completada && ` | Completada: ${new Date(t.fecha_completada).toLocaleDateString('es-GT')}`}
            </span>
            {actions}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Action Button ───────────────────────────────────────────────────────────

function ActionBtn({
  label,
  title,
  onClick,
  color,
}: {
  label: string;
  title: string;
  onClick: () => void;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    green: 'hover:bg-green-100 text-green-600',
    blue: 'hover:bg-blue-100 text-blue-600',
    amber: 'hover:bg-amber-100 text-amber-600',
    purple: 'hover:bg-purple-100 text-purple-600',
    red: 'hover:bg-red-100 text-red-600',
  };

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={title}
      className={`w-6 h-6 flex items-center justify-center rounded text-xs font-bold transition-colors ${colorMap[color] ?? ''}`}
    >
      {label}
    </button>
  );
}
