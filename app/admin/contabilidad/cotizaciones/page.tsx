// ============================================================================
// app/admin/contabilidad/cotizaciones/page.tsx
// Lista de cotizaciones con filtros, paginación, selección múltiple y acciones
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Section, EmptyState,
  TableSkeleton, Q,
} from '@/components/admin/ui';
import type { CotizacionConCliente, EstadoCotizacion } from '@/lib/types';

const CUENTAS_ENVIO = [
  { value: 'amanda@papeleo.legal', label: 'amanda@papeleo.legal' },
  { value: 'asistente@papeleo.legal', label: 'asistente@papeleo.legal' },
  { value: 'contador@papeleo.legal', label: 'contador@papeleo.legal' },
];

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
  { value: 'programadas', label: '📅 Programadas' },
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
  const [reenviarCot, setReenviarCot] = useState<any>(null);

  // ── Selección múltiple ──────────────────────────────────────────────
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [showEnvioMasivo, setShowEnvioMasivo] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Build URL
  const params = new URLSearchParams();
  if (estado === 'programadas') {
    params.set('programadas', 'true');
  } else if (estado) {
    params.set('estado', estado);
  }
  if (busqueda) params.set('q', busqueda);
  params.set('page', String(page));
  params.set('limit', '15');

  const url = `/api/admin/contabilidad/cotizaciones?${params.toString()}`;
  const { data: res, loading, error, refetch } = useFetch<ListResponse>(url);
  const { mutate, loading: mutating } = useMutate();

  // Clear selection on page/filter change
  useEffect(() => {
    setSeleccionados(new Set());
  }, [estado, busqueda, page]);

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Selection helpers ─────────────────────────────────────────────
  const toggleSeleccion = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTodas = () => {
    if (!res) return;
    if (seleccionados.size === res.data.length) {
      setSeleccionados(new Set());
    } else {
      setSeleccionados(new Set(res.data.map((c: any) => c.id)));
    }
  };

  const cotizacionesSeleccionadas = res?.data.filter((c: any) => seleccionados.has(c.id)) ?? [];

  // ── Bulk accept ───────────────────────────────────────────────────
  const handleAceptarMasivo = async () => {
    const ids = cotizacionesSeleccionadas
      .filter((c: any) => c.estado === 'enviada')
      .map((c: any) => c.id);
    if (ids.length === 0) {
      setToast({ type: 'warning', message: 'Solo se pueden aceptar cotizaciones en estado "enviada"' });
      return;
    }
    const result = await mutate('/api/admin/contabilidad/cotizaciones/masivo', {
      body: { accion: 'aceptar_masivo', ids },
    });
    if (result?.data) {
      const { aceptadas, errores } = result.data;
      if (errores.length > 0) {
        setToast({ type: 'warning', message: `${aceptadas} aceptadas, ${errores.length} con error` });
      } else {
        setToast({ type: 'success', message: `${aceptadas} cotizaciones marcadas como aceptadas` });
      }
    }
    setSeleccionados(new Set());
    refetch();
  };

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
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={res.data.length > 0 && seleccionados.size === res.data.length}
                        ref={(el) => {
                          if (el) el.indeterminate = seleccionados.size > 0 && seleccionados.size < res.data.length;
                        }}
                        onChange={toggleTodas}
                        className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#1E40AF]/20 cursor-pointer"
                      />
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Número</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Cliente</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Total</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Pagado</th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Estado</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Fecha</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {res.data.map((cot: any) => {
                    const clienteEmail = cot.cliente?.email;
                    const sinEmail = !clienteEmail;
                    return (
                      <tr
                        key={cot.id}
                        className={`hover:bg-slate-50 transition-colors cursor-pointer ${seleccionados.has(cot.id) ? 'bg-blue-50/50' : ''}`}
                        onClick={() => router.push(`/admin/contabilidad/cotizaciones/${cot.id}`)}
                      >
                        <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={seleccionados.has(cot.id)}
                            onChange={() => toggleSeleccion(cot.id)}
                            className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#1E40AF]/20 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-mono font-medium text-slate-900">{cot.numero}</span>
                            {sinEmail && <span title="Cliente sin email" className="text-amber-500 text-xs">⚠️</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700">{cot.cliente?.nombre ?? '—'}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm font-medium text-slate-900">{Q(cot.total)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {(cot as any).monto_pagado >= cot.total && cot.total > 0 ? (
                            <span className="text-emerald-600 text-sm font-medium">✅</span>
                          ) : (cot as any).monto_pagado > 0 ? (
                            <span className="text-sm font-medium text-emerald-600">{Q((cot as any).monto_pagado)}</span>
                          ) : (
                            <span className="text-sm text-slate-300">Q0</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant={cot.estado}>{cot.estado}</Badge>
                            {cot.envio_programado && cot.envio_programado_fecha && (
                              <>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded text-xs font-medium">
                                  📅 Programada
                                </span>
                                <span className="text-[10px] text-violet-500">
                                  {new Date(cot.envio_programado_fecha).toLocaleDateString('es-GT', {
                                    weekday: 'short', day: 'numeric', month: 'short',
                                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala',
                                  })}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-sm text-slate-500">{cot.created_at ? new Date(cot.created_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' }) : '—'}</span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <RowActions
                            estado={cot.estado}
                            cotId={cot.id}
                            onAccion={(accion) => ejecutarAccion(cot.id, accion)}
                            onDuplicar={() => ejecutarAccion(cot.id, 'duplicar')}
                            onReenviar={() => setReenviarCot(cot)}
                            disabled={mutating}
                          />
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── Floating action bar ─────────────────────────────────────────── */}
      {seleccionados.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium">
            {seleccionados.size} cotización{seleccionados.size > 1 ? 'es' : ''} seleccionada{seleccionados.size > 1 ? 's' : ''}
          </span>
          <div className="w-px h-5 bg-slate-600" />
          <button
            onClick={() => setShowEnvioMasivo(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            <span>📧</span> Enviar por correo
          </button>
          <button
            onClick={handleAceptarMasivo}
            disabled={mutating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <span>✅</span> Marcar aceptadas
          </button>
          <button
            onClick={() => setSeleccionados(new Set())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            <span>❌</span> Cancelar
          </button>
        </div>
      )}

      {/* ── Modal: Envío masivo ─────────────────────────────────────────── */}
      {showEnvioMasivo && (
        <EnvioMasivoModal
          cotizaciones={cotizacionesSeleccionadas}
          onClose={() => setShowEnvioMasivo(false)}
          onSent={(msg) => {
            setShowEnvioMasivo(false);
            setSeleccionados(new Set());
            setToast({ type: 'success', message: msg });
            refetch();
          }}
          onError={(msg) => {
            setToast({ type: 'warning', message: msg });
          }}
        />
      )}

      {/* ── Modal: Reenviar cotización ──────────────────────────────────── */}
      {reenviarCot && (
        <ReenviarModal
          cotizacion={reenviarCot}
          onClose={() => setReenviarCot(null)}
          onSent={() => { setReenviarCot(null); refetch(); }}
        />
      )}

      {/* ── Toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-4 ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' :
          toast.type === 'warning' ? 'bg-amber-500 text-white' :
          'bg-red-600 text-white'
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}
    </div>
  );
}

// ── Row Actions ─────────────────────────────────────────────────────────

function RowActions({ estado, cotId, onAccion, onDuplicar, onReenviar, disabled }: {
  estado: string;
  cotId: string;
  onAccion: (accion: string) => void;
  onDuplicar: () => void;
  onReenviar: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const descargarPDF = async () => {
    setOpen(false);
    setDescargando(true);
    try {
      const res = await fetch(`/api/admin/contabilidad/cotizaciones/${cotId}/pdf`, { redirect: 'manual' });
      if (res.type === 'opaqueredirect' || res.status === 405 || res.status === 401 || (res.status >= 300 && res.status < 400)) {
        throw new Error('Sesión expirada. Recarga la página para continuar.');
      }
      if (!res.ok) throw new Error('Error al generar PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion-${cotId.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message ?? 'Error al descargar PDF');
    }
    setDescargando(false);
  };

  const acciones: Array<{ label: string; accion: string; icon: string }> = [];

  acciones.push({ label: descargando ? 'Generando...' : 'Descargar PDF', accion: 'pdf', icon: '📄' });
  if (estado === 'borrador') {
    acciones.push({ label: 'Enviar', accion: 'enviar', icon: '📤' });
  }
  if (estado !== 'borrador') {
    acciones.push({ label: 'Reenviar', accion: 'reenviar', icon: '📧' });
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
        disabled={disabled || descargando}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
      >
        {descargando ? '⏳' : '⋯'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[160px]">
            {acciones.map(a => (
              <button
                key={a.accion}
                onClick={() => {
                  if (a.accion === 'pdf') descargarPDF();
                  else if (a.accion === 'duplicar') { setOpen(false); onDuplicar(); }
                  else if (a.accion === 'reenviar') { setOpen(false); onReenviar(); }
                  else { setOpen(false); onAccion(a.accion); }
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

// ── Modal: Envío masivo ─────────────────────────────────────────────────

function EnvioMasivoModal({ cotizaciones, onClose, onSent, onError }: {
  cotizaciones: any[];
  onClose: () => void;
  onSent: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [from, setFrom] = useState('amanda@papeleo.legal');
  const [mensaje, setMensaje] = useState(
    `Estimado/a {nombre},\n\nAdjunto encontrará la cotización {numero} por un monto de Q{total} correspondiente a los servicios profesionales solicitados.\n\nQuedamos a sus órdenes para cualquier consulta.\n\nLcda. Amanda Santizo\nAbogada y Notaria\nTel. 2335-3613 | amandasantizo.com`
  );
  const [sending, setSending] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);

  const sinEmail = cotizaciones.filter((c: any) => !c.cliente?.email);
  const yaEnviadas = cotizaciones.filter((c: any) => c.estado === 'enviada');
  const enviables = cotizaciones.filter((c: any) => c.cliente?.email);
  const tieneCC = cotizaciones.some((c: any) => c.cc_emails);

  const handleEnviar = async () => {
    if (enviables.length === 0) return;
    setSending(true);
    setProgreso(`Enviando 0/${enviables.length}...`);

    try {
      const res = await fetch('/api/admin/contabilidad/cotizaciones/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'enviar_masivo',
          ids: enviables.map((c: any) => c.id),
          from,
          subject_template: 'Cotización {numero} — Despacho Jurídico Amanda Santizo',
          mensaje_template: mensaje,
        }),
        redirect: 'manual',
      });

      // Clerk session expired → middleware redirects to login → 405
      if (res.type === 'opaqueredirect' || res.status === 405 || res.status === 401 || (res.status >= 300 && res.status < 400)) {
        onError('Sesión expirada. Recarga la página para continuar.');
        setSending(false);
        setProgreso(null);
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        onError(result.error || 'Error al enviar');
        setSending(false);
        setProgreso(null);
        return;
      }

      const { enviadas, errores } = result.data;

      if (errores && errores.length > 0) {
        const fallidas = errores.map((e: any) => e.numero).join(', ');
        onError(`${enviadas} enviadas, ${errores.length} fallaron: ${fallidas}`);
      }

      onSent(`${enviadas} cotización${enviadas > 1 ? 'es' : ''} enviada${enviadas > 1 ? 's' : ''} exitosamente`);
    } catch (err: any) {
      onError(err.message || 'Error de conexión');
    }

    setSending(false);
    setProgreso(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900 mb-1">Envío masivo de cotizaciones</h2>
        <p className="text-sm text-slate-500 mb-4">
          Se enviarán {enviables.length} correo{enviables.length !== 1 ? 's' : ''} individual{enviables.length !== 1 ? 'es' : ''} (uno por cliente)
        </p>

        {/* Lista de cotizaciones */}
        <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-3 font-medium text-slate-500">Número</th>
                <th className="text-left py-2 px-3 font-medium text-slate-500">Cliente</th>
                <th className="text-right py-2 px-3 font-medium text-slate-500">Monto</th>
                <th className="text-left py-2 px-3 font-medium text-slate-500">Email</th>
                {tieneCC && <th className="text-left py-2 px-3 font-medium text-slate-500">CC</th>}
                <th className="text-center py-2 px-3 font-medium text-slate-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cotizaciones.map((cot: any) => {
                const email = cot.cliente?.email;
                return (
                  <tr key={cot.id} className={!email ? 'bg-amber-50' : ''}>
                    <td className="py-2 px-3 font-mono text-slate-700">{cot.numero}</td>
                    <td className="py-2 px-3 text-slate-700">{cot.cliente?.nombre ?? '—'}</td>
                    <td className="py-2 px-3 text-right text-slate-700">{Q(cot.total)}</td>
                    <td className="py-2 px-3">
                      {email ? (
                        <span className="text-slate-600">{email}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">⚠️ Sin email</span>
                      )}
                    </td>
                    {tieneCC && (
                      <td className="py-2 px-3 text-xs text-slate-500 max-w-[200px] truncate">
                        {cot.cc_emails || '—'}
                      </td>
                    )}
                    <td className="py-2 px-3 text-center">
                      {cot.estado === 'enviada' ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Ya enviada</span>
                      ) : (
                        <Badge variant={cot.estado}>{cot.estado}</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Warnings */}
        {sinEmail.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-sm text-amber-800">
            ⚠️ {sinEmail.length} cotización{sinEmail.length > 1 ? 'es' : ''} sin email del cliente — no se enviarán
          </div>
        )}
        {yaEnviadas.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-sm text-blue-800">
            ℹ️ {yaEnviadas.length} cotización{yaEnviadas.length > 1 ? 'es' : ''} ya está{yaEnviadas.length > 1 ? 'n' : ''} marcada{yaEnviadas.length > 1 ? 's' : ''} como "enviada" — se reenviarán
          </div>
        )}

        <div className="space-y-3">
          {/* From */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Cuenta de envío</label>
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500"
            >
              {CUENTAS_ENVIO.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Subject preview */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Asunto (por cada correo)</label>
            <div className="mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
              Cotización [COT-XXXXXX] — Despacho Jurídico Amanda Santizo
            </div>
            <p className="text-xs text-slate-400 mt-1">Se personaliza automáticamente con el número de cada cotización</p>
          </div>

          {/* Mensaje */}
          <div>
            <label className="text-xs text-slate-500 font-medium">
              Mensaje (se usa para todas, se personaliza con {'{'}<code className="text-xs">nombre</code>{'}'}, {'{'}<code className="text-xs">numero</code>{'}'}, {'{'}<code className="text-xs">total</code>{'}'})
            </label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={8}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500 resize-none font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Progress */}
        {progreso && (
          <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 font-medium">
            {progreso}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={sending || enviables.length === 0}
            className="px-5 py-2 bg-[#1E40AF] text-white text-sm font-semibold rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? progreso ?? 'Enviando...' : `Enviar ${enviables.length > 1 ? 'todas' : ''} (${enviables.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Reenviar cotización ──────────────────────────────────────────

function ReenviarModal({ cotizacion, onClose, onSent }: {
  cotizacion: any;
  onClose: () => void;
  onSent: () => void;
}) {
  const clienteNombre = cotizacion.cliente?.nombre ?? 'Estimado/a';
  const clienteEmail = cotizacion.cliente?.email ?? '';

  const [to, setTo] = useState(clienteEmail);
  const [from, setFrom] = useState('amanda@papeleo.legal');
  const [subject, setSubject] = useState(
    `Cotización ${cotizacion.numero} — Despacho Jurídico Amanda Santizo`
  );
  const [mensaje, setMensaje] = useState(
    `Estimado/a ${clienteNombre},\n\nLe reenvío la cotización ${cotizacion.numero} por un monto de ${Q(cotizacion.total)}.\n\nQuedamos a sus órdenes.\n\nLcda. Amanda Santizo\nAbogada y Notaria\nTel. 2335-3613 | amandasantizo.com`
  );
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const { mutate } = useMutate();

  const handleEnviar = async () => {
    if (!to.trim()) { setError('Ingresa un email de destino'); return; }
    setSending(true);
    setError('');
    await mutate(
      `/api/admin/contabilidad/cotizaciones/${cotizacion.id}/acciones`,
      {
        body: { accion: 'reenviar', to, subject, mensaje, from },
        onSuccess: onSent,
        onError: (msg: string) => setError(msg),
      }
    );
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Reenviar cotización</h2>
        <p className="text-sm text-slate-500 mb-4">
          {cotizacion.numero} · {clienteNombre} · {Q(cotizacion.total)}
        </p>

        <div className="space-y-3">
          {/* From */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Cuenta de envío</label>
            <select
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500"
            >
              {CUENTAS_ENVIO.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Para</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="email@cliente.com"
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500"
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Mensaje</label>
            <textarea
              value={mensaje}
              onChange={e => setMensaje(e.target.value)}
              rows={8}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-cyan-500 resize-none font-mono leading-relaxed"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
            Cancelar
          </button>
          <button
            onClick={handleEnviar}
            disabled={sending || !to.trim()}
            className="px-4 py-2 bg-[#1E40AF] text-white text-sm font-semibold rounded-lg hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
