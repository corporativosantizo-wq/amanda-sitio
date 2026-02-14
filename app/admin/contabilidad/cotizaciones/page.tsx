// ============================================================================
// app/admin/contabilidad/cotizaciones/page.tsx
// Lista de cotizaciones con filtros, paginación y acciones rápidas
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Section, EmptyState,
  TableSkeleton, Q,
} from '@/components/admin/ui';
import type { CotizacionConCliente, EstadoCotizacion } from '@/lib/types';

// ── Types ───────────────────────────────────────────────────────────────

interface ListResponse {
  data: CotizacionConCliente[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ── Filters ─────────────────────────────────────────────────────────────

const ESTADOS = [
  { value: '', label: 'Todos' },
  { value: 'borrador', label: 'Borrador' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'aceptada', label: 'Aceptada' },
  { value: 'rechazada', label: 'Rechazada' },
  { value: 'vencida', label: 'Vencida' },
];

// ── Page ────────────────────────────────────────────────────────────────

export default function CotizacionesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [estado, setEstado] = useState(searchParams.get('estado') ?? '');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);

  // Build URL
  const params = new URLSearchParams();
  if (estado) params.set('estado', estado);
  if (busqueda) params.set('q', busqueda);
  params.set('page', String(page));
  params.set('limit', '15');

  const url = `/api/admin/contabilidad/cotizaciones?${params.toString()}`;
  const { data: res, loading, error, refetch } = useFetch<ListResponse>(url);
  const { mutate, loading: mutating } = useMutate();

  // ── Actions ─────────────────────────────────────────────────────────

  const ejecutarAccion = useCallback(async (id: string, accion: string) => {
    const result = await mutate(`/api/admin/contabilidad/cotizaciones/${id}/acciones`, {
      body: { accion },
      onSuccess: () => refetch(),
    });
    return result;
  }, [mutate, refetch]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cotizaciones"
        description={res ? `${res.total} cotizaciones` : undefined}
        action={{
          label: 'Nueva cotización',
          icon: '📝',
          onClick: () => router.push('/admin/contabilidad/cotizaciones/nueva'),
        }}
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Estado */}
        <div className="flex bg-white rounded-lg border border-slate-200 p-1 overflow-x-auto">
          {ESTADOS.map(e => (
            <button
              key={e.value}
              onClick={() => { setEstado(e.value); setPage(1); }}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                estado === e.value
                  ? 'bg-[#1E40AF] text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <input
            type="text"
            placeholder="Buscar por número o cliente..."
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-5">
            <TableSkeleton rows={8} />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">
            Error al cargar cotizaciones: {error}
          </div>
        ) : !res || res.data.length === 0 ? (
          <EmptyState
            icon="📝"
            title="No hay cotizaciones"
            description={estado ? `No hay cotizaciones con estado "${estado}"` : 'Crea tu primera cotización para comenzar'}
            action={{ label: 'Nueva cotización', onClick: () => router.push('/admin/contabilidad/cotizaciones/nueva') }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Número</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Cliente</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Total</th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Estado</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Fecha</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {res.data.map((cot: any) => (
                    <tr
                      key={cot.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/admin/contabilidad/cotizaciones/${cot.id}`)}
                    >
                      <td className="py-3 px-4">
                        <span className="text-sm font-mono font-medium text-slate-900">{cot.numero}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-700">{cot.cliente?.nombre ?? '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm font-medium text-slate-900">{Q(cot.total)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={cot.estado}>{cot.estado}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-slate-500">{cot.created_at ? new Date(cot.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' }) : '—'}</span>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <RowActions
                          estado={cot.estado}
                          onAccion={(accion) => ejecutarAccion(cot.id, accion)}
                          onDuplicar={() => ejecutarAccion(cot.id, 'duplicar')}
                          disabled={mutating}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {res.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Página {res.page} de {res.totalPages} ({res.total} resultados)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Anterior
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(res.totalPages, p + 1))}
                    disabled={page >= res.totalPages}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Row Actions ─────────────────────────────────────────────────────────

function RowActions({ estado, onAccion, onDuplicar, disabled }: {
  estado: string;
  onAccion: (accion: string) => void;
  onDuplicar: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const acciones: Array<{ label: string; accion: string; icon: string }> = [];

  if (estado === 'borrador') {
    acciones.push({ label: 'Enviar', accion: 'enviar', icon: '📤' });
  }
  if (estado === 'enviada') {
    acciones.push({ label: 'Aceptar', accion: 'aceptar', icon: '✅' });
    acciones.push({ label: 'Rechazar', accion: 'rechazar', icon: '❌' });
  }
  acciones.push({ label: 'Duplicar', accion: 'duplicar', icon: '📋' });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[140px]">
            {acciones.map(a => (
              <button
                key={a.accion}
                onClick={() => {
                  setOpen(false);
                  if (a.accion === 'duplicar') onDuplicar();
                  else onAccion(a.accion);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
