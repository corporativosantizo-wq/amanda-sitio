// ============================================================================
// app/admin/contabilidad/recibos-caja/page.tsx
// Listado de Recibos de Caja (gastos del trámite, comprobante NO fiscal)
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';
import { EnviarReciboEmailModal } from '@/components/admin/enviar-recibo-email-modal';

interface ReciboItem {
  id: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  concepto: string;
  email_enviado_at: string | null;
  email_error: string | null;
  pdf_url: string | null;
  origen: 'manual' | 'automatico';
  pago_id: string | null;
  cliente: { id: string; nombre: string; nit: string | null; email: string | null } | null;
  cotizacion: { id: string; numero: string } | null;
}

export default function RecibosCajaListPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);
  const [reciboModal, setReciboModal] = useState<ReciboItem | null>(null);
  const [reciboEliminar, setReciboEliminar] = useState<ReciboItem | null>(null);

  const params = new URLSearchParams();
  if (search) params.set('q', search);
  if (desde)  params.set('desde', desde);
  if (hasta)  params.set('hasta', hasta);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: ReciboItem[]; total: number; page: number; limit: number;
  }>(`/api/admin/contabilidad/recibos-caja?${params}`);

  const recibos = data?.data ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recibos de Caja"
        description={`${data?.total ?? 0} recibos · comprobante NO fiscal`}
        action={{
          label: 'Nuevo Recibo de Caja',
          icon: '+',
          onClick: () => router.push('/admin/contabilidad/recibos-caja/nuevo'),
        }}
      />

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por número (ej. RC-0001)…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-64 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
        />
        <input
          type="date"
          value={desde}
          onChange={e => { setDesde(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          title="Desde"
        />
        <input
          type="date"
          value={hasta}
          onChange={e => { setHasta(e.target.value); setPage(1); }}
          className="px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          title="Hasta"
        />
      </div>

      {/* Tabla */}
      {loading ? <TableSkeleton rows={8} /> : recibos.length === 0 ? (
        <EmptyState
          icon="📄"
          title="Sin Recibos de Caja"
          description="Los recibos se generan automáticamente al registrar el pago de gastos del trámite de una cotización."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Número', 'Cliente', 'Cotización', 'Monto', 'Emisión', 'Email', 'Acciones'].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recibos.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 pl-5">
                      <span className="font-mono text-sm font-semibold text-slate-900">{r.numero}</span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="text-slate-700">{r.cliente?.nombre ?? '—'}</p>
                      {r.cliente?.nit && <p className="text-xs text-slate-400">NIT {r.cliente.nit}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {r.cotizacion ? (
                        <button
                          onClick={() => router.push(`/admin/contabilidad/cotizaciones/${r.cotizacion!.id}`)}
                          className="text-[#0F172A] hover:underline font-mono text-xs"
                        >
                          {r.cotizacion.numero}
                        </button>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-slate-900">{Q(r.monto)}</td>
                    <td className="py-3 px-4 text-sm text-slate-500">
                      {new Date(r.fecha_emision).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' })}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {r.email_enviado_at ? (
                        <span className="text-emerald-700">✓ Enviado</span>
                      ) : r.email_error ? (
                        <span className="text-amber-700" title={r.email_error}>⚠ Falló</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 pr-5 text-xs">
                      <div className="flex items-center gap-3">
                        <a
                          href={`/api/admin/contabilidad/recibos-caja/${r.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0F172A] hover:underline font-medium"
                        >
                          PDF
                        </a>
                        <button
                          onClick={() => setReciboModal(r)}
                          disabled={!r.pdf_url}
                          className="text-[#0F172A] hover:underline font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                          title={
                            !r.pdf_url
                              ? 'El recibo no tiene PDF'
                              : r.email_enviado_at
                                ? 'Reenviar por email (con CC opcional)'
                                : 'Enviar por email (con CC opcional)'
                          }
                        >
                          {r.email_enviado_at ? 'Reenviar' : 'Enviar email'}
                        </button>
                        <button
                          onClick={() => router.push(`/admin/contabilidad/recibos-caja/${r.id}/editar`)}
                          className="text-[#0F172A] hover:underline font-medium"
                          title="Editar recibo"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setReciboEliminar(r)}
                          className="text-red-600 hover:underline font-medium"
                          title="Eliminar recibo"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">Página {page} de {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {reciboModal && (
        <EnviarReciboEmailModal
          recibo={reciboModal}
          onClose={() => setReciboModal(null)}
          onSuccess={() => { setReciboModal(null); refetch(); }}
        />
      )}

      {reciboEliminar && (
        <ConfirmarEliminarModal
          recibo={reciboEliminar}
          onClose={() => setReciboEliminar(null)}
          onSuccess={() => { setReciboEliminar(null); refetch(); }}
        />
      )}
    </div>
  );
}

// ── Modal de confirmación de eliminación ────────────────────────────────────

function ConfirmarEliminarModal({
  recibo,
  onClose,
  onSuccess,
}: {
  recibo: ReciboItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate } = useMutate();
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esAutomatico = recibo.origen === 'automatico' || recibo.pago_id !== null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !eliminando) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, eliminando]);

  const eliminar = async () => {
    setError(null);
    setEliminando(true);
    let ok = false;
    await mutate(`/api/admin/contabilidad/recibos-caja/${recibo.id}`, {
      method: 'DELETE',
      onSuccess: () => { ok = true; },
      onError: (err: unknown) => setError(typeof err === 'string' ? err : 'Error al eliminar'),
    });
    setEliminando(false);
    if (ok) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!eliminando) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Eliminar Recibo de Caja</h2>
        </div>

        <div className="px-6 py-5 space-y-3">
          <p className="text-sm text-slate-700">
            ¿Estás seguro de que deseas eliminar el recibo <strong className="font-mono">{recibo.numero}</strong>?
            Esta acción no se puede deshacer.
          </p>

          {recibo.email_enviado_at && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>Este recibo ya fue enviado al cliente</strong> el{' '}
              {new Date(recibo.email_enviado_at).toLocaleDateString('es-GT', {
                day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala',
              })}. ¿Deseas eliminarlo de todas formas?
            </div>
          )}

          {esAutomatico && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <strong>Este recibo proviene de un pago confirmado</strong> de gastos del trámite.
              Al eliminarlo, el pago vinculado <strong>seguirá registrado</strong> contra la
              cotización (la cotización seguirá marcada como pagada). Si querés revertir todo,
              hay que anular primero el pago en el módulo de Pagos.
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={eliminando}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
          >
            Cancelar
          </button>
          <button
            onClick={eliminar}
            disabled={eliminando}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {eliminando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
