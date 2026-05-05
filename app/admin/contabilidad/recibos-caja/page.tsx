// ============================================================================
// app/admin/contabilidad/recibos-caja/page.tsx
// Listado de Recibos de Caja (gastos del trámite, comprobante NO fiscal)
// ============================================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

interface ReciboItem {
  id: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  concepto: string;
  origen: 'automatico' | 'manual';
  email_enviado_at: string | null;
  email_error: string | null;
  pdf_url: string | null;
  cliente: { id: string; nombre: string; nit: string | null; email: string | null } | null;
  cotizacion: { id: string; numero: string } | null;
}

export default function RecibosCajaListPage() {
  const router = useRouter();
  const { mutate } = useMutate();
  const [search, setSearch] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(1);
  const [reenviando, setReenviando] = useState<string | null>(null);

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

  const reenviarEmail = async (id: string) => {
    setReenviando(id);
    await mutate(`/api/admin/contabilidad/recibos-caja/${id}/reenviar`, {
      body: {},
      onSuccess: () => { refetch(); alert('Email reenviado'); },
      onError: (err: any) => alert(`Error: ${err}`),
    });
    setReenviando(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Recibos de Caja"
        description={`${data?.total ?? 0} recibos · comprobante NO fiscal`}
        action={{
          label: 'Nuevo Recibo de Caja',
          icon: '+',
          variant: 'success',
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
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/admin/contabilidad/recibos-caja/${r.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 pl-5">
                      <span className="font-mono text-sm font-semibold text-slate-900">{r.numero}</span>
                      {r.origen === 'manual' && (
                        <span className="ml-2 text-[9px] font-semibold tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">manual</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <p className="text-slate-700">{r.cliente?.nombre ?? '—'}</p>
                      {r.cliente?.nit && <p className="text-xs text-slate-400">NIT {r.cliente.nit}</p>}
                    </td>
                    <td className="py-3 px-4 text-sm" onClick={e => e.stopPropagation()}>
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
                    <td className="py-3 px-4 pr-5 text-xs" onClick={e => e.stopPropagation()}>
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
                          onClick={() => reenviarEmail(r.id)}
                          disabled={reenviando === r.id || !r.cliente?.email}
                          className="text-[#0F172A] hover:underline font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                          title={r.cliente?.email ? 'Reenviar email al cliente' : 'El cliente no tiene email'}
                        >
                          {reenviando === r.id ? 'Enviando…' : 'Reenviar'}
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
    </div>
  );
}
