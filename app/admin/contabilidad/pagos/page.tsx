// ============================================================================
// app/admin/contabilidad/pagos/page.tsx
// Lista de pagos con filtros y acción rápida de confirmar
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Q, EmptyState, TableSkeleton,
} from '@/components/admin/ui';

const TABS = [
  { key: '', label: 'Todos' },
  { key: 'registrado', label: 'Por confirmar' },
  { key: 'confirmado', label: 'Confirmados' },
  { key: 'anulado', label: 'Anulados' },
];

const METODO_ICON: Record<string, string> = {
  transferencia: '🏦', deposito: '💵', efectivo: '💰',
  cheque: '📄', tarjeta: '💳', otro: '📋',
};

interface Pago {
  id: string;
  cotizacion_id: string | null;
  monto: number;
  metodo: string;
  referencia_bancaria: string | null;
  estado: string;
  es_anticipo: boolean;
  fecha_pago: string;
  notas: string | null;
  factura_solicitada: boolean;
  factura: { numero: string } | null;
  cotizacion: { id: string; numero: string } | null;
  cliente: { nombre: string; nit: string | null } | null;
}

export default function PagosListPage() {
  const router = useRouter();
  const { mutate } = useMutate();
  const [tab, setTab] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState('');
  const [facturaModal, setFacturaModal] = useState<Pago | null>(null);
  const [enviandoFactura, setEnviandoFactura] = useState(false);

  // Check for toast from nuevo page
  useEffect(() => {
    const msg = sessionStorage.getItem('pago_toast');
    if (msg) {
      setToast(msg);
      sessionStorage.removeItem('pago_toast');
      setTimeout(() => setToast(''), 4000);
    }
  }, []);

  const params = new URLSearchParams();
  if (tab) params.set('estado', tab);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: Pago[]; total: number; totalPages: number;
  }>(`/api/admin/contabilidad/pagos?${params}`);

  const pagos = data?.data ?? [];

  const confirmarPago = async (pagoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Confirmar este pago? Se generará factura FEL automáticamente.')) return;
    await mutate(`/api/admin/contabilidad/pagos/${pagoId}/acciones`, {
      body: { accion: 'confirmar' },
      onSuccess: () => refetch(),
    });
  };

  const solicitarFactura = async () => {
    if (!facturaModal) return;
    setEnviandoFactura(true);
    await mutate('/api/admin/contabilidad/solicitar-factura', {
      body: { pago_id: facturaModal.id },
      onSuccess: () => {
        setFacturaModal(null);
        setToast('✅ Solicitud de factura enviada a RE');
        setTimeout(() => setToast(''), 4000);
        refetch();
      },
      onError: (err) => {
        alert(`Error: ${err}`);
      },
    });
    setEnviandoFactura(false);
  };

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-top-2">
          {toast}
        </div>
      )}

      <PageHeader
        title="Pagos"
        description={`${data?.total ?? 0} pagos`}
        action={{
          label: '+ Registrar pago',
          onClick: () => router.push('/admin/contabilidad/pagos/nuevo'),
        }}
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* Search */}
      <input type="text" placeholder="Buscar por factura, cliente o referencia..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
        className="w-full max-w-sm px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />

      {/* Table */}
      {loading ? <TableSkeleton rows={8} /> : pagos.length === 0 ? (
        <EmptyState icon="💰" title="Sin pagos" description={tab === 'registrado' ? 'No hay pagos por confirmar' : 'Aún no se han registrado pagos'} />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {['Fecha', 'Documento', 'Cliente', 'Monto', 'Método', 'Referencia', 'Estado', ''].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map(p => (
                  <tr key={p.id} onClick={() => router.push(`/admin/contabilidad/pagos/${p.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm text-slate-600">
                      {new Date(p.fecha_pago).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-slate-900" onClick={e => {
                      if (p.cotizacion) { e.stopPropagation(); router.push(`/admin/contabilidad/cotizaciones/${p.cotizacion.id}`); }
                    }}>
                      {p.cotizacion ? (
                        <span className="text-[#0891B2] hover:underline cursor-pointer">{p.cotizacion.numero}</span>
                      ) : p.factura ? (
                        <span>{p.factura.numero}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-700">{p.cliente?.nombre ?? '—'}</td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-bold text-[#1E40AF]">{Q(p.monto)}</span>
                      {p.es_anticipo && <span className="ml-1 text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">60%</span>}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <span>{METODO_ICON[p.metodo] ?? '📋'}</span>
                      <span className="ml-1 text-slate-600 capitalize">{p.metodo}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-500 font-mono">{p.referencia_bancaria ?? '—'}</td>
                    <td className="py-3 px-4"><Badge variant={p.estado as any}>{p.estado}</Badge></td>
                    <td className="py-3 px-4 pr-5">
                      <div className="flex items-center gap-1.5">
                        {p.estado === 'registrado' && (
                          <button onClick={(e) => confirmarPago(p.id, e)}
                            className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors">
                            ✓ Confirmar
                          </button>
                        )}
                        {p.estado === 'confirmado' && !p.es_anticipo && !p.factura_solicitada && (
                          <button onClick={(e) => { e.stopPropagation(); setFacturaModal(p); }}
                            className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors">
                            📄 Solicitar factura
                          </button>
                        )}
                        {p.factura_solicitada && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-md">
                            ✅ Factura solicitada
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
              <p className="text-sm text-slate-500">Página {page} de {data.totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= data.totalPages}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Modal solicitar factura */}
      {facturaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setFacturaModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">📄 Solicitar factura a RE Contadores</h3>
            <p className="text-xs text-slate-500 mb-4">Se enviará email desde contador@papeleo.legal</p>

            <div className="space-y-2.5 mb-5 bg-slate-50 rounded-lg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium text-slate-900">{facturaModal.cliente?.nombre ?? 'Sin cliente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIT</span>
                <span className="font-medium text-slate-900">{facturaModal.cliente?.nit || 'CF'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto</span>
                <span className="font-bold text-[#1E40AF]">{Q(facturaModal.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto</span>
                <span className="font-medium text-slate-900">{facturaModal.cotizacion?.numero ?? facturaModal.notas ?? 'Servicios legales'}</span>
              </div>
              {facturaModal.referencia_bancaria && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Referencia</span>
                  <span className="font-mono text-slate-700">{facturaModal.referencia_bancaria}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-400 mb-4 space-y-0.5">
              <p><b>Para:</b> contabilidad@re.com.gt, veronica.zoriano@re.com.gt, joaquin.sandoval@re.com.gt</p>
              <p><b>Desde:</b> contador@papeleo.legal</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setFacturaModal(null)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                ❌ Cancelar
              </button>
              <button onClick={solicitarFactura} disabled={enviandoFactura}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50">
                {enviandoFactura ? 'Enviando...' : '✅ Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
