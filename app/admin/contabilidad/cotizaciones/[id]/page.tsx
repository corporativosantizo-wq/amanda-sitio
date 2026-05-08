// ============================================================================
// app/admin/contabilidad/cotizaciones/[id]/page.tsx
// Detalle de cotización con acciones, timeline y conversión a factura
// ============================================================================

'use client';

import { useCallback, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { adminFetch } from '@/lib/utils/admin-fetch';
import {
  PageHeader, Badge, Section, KPICard,
  EmptyState, Skeleton, Q,
} from '@/components/admin/ui';
import { EnviarReciboEmailModal } from '@/components/admin/enviar-recibo-email-modal';

// ── Types ───────────────────────────────────────────────────────────────

interface PagoAsociado {
  id: string;
  numero: string;
  monto: number;
  estado: string;
  tipo: string;
  metodo: string;
  fecha_pago: string;
  es_anticipo: boolean;
  confirmado_at: string | null;
  factura_solicitada: boolean;
}

interface CotizacionDetalle {
  id: string;
  numero: string;
  estado: string;
  created_at: string;
  fecha_envio: string | null;
  fecha_respuesta: string | null;
  vigencia_dias: number;
  subtotal: number;
  iva_monto: number;
  total: number;
  monto_gastos: number;
  condiciones: string;
  notas_internas: string | null;
  notas_cliente: string | null;
  cc_emails: string | null;
  envio_programado: boolean;
  envio_programado_fecha: string | null;
  items: Array<{
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
    orden: number;
    aplica_iva?: boolean;
  }>;
  cliente: {
    id: string;
    nombre: string;
    nit: string;
    email: string;
    telefono: string;
  } | null;
  pdf_url: string | null;
  factura_generada: boolean;
  pagos: PagoAsociado[];
}

// ── Status config ───────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, {
  label: string; color: string; icon: string; description: string;
}> = {
  borrador: { label: 'Borrador', color: 'slate', icon: '📝', description: 'Pendiente de envío al cliente' },
  enviada: { label: 'Enviada', color: 'blue', icon: '📤', description: 'Esperando respuesta del cliente' },
  aceptada: { label: 'Aceptada', color: 'emerald', icon: '✅', description: 'Cliente aceptó — lista para facturar' },
  rechazada: { label: 'Rechazada', color: 'red', icon: '❌', description: 'Cliente declinó la cotización' },
  vencida: { label: 'Vencida', color: 'orange', icon: '⏰', description: 'Pasó la fecha de vigencia' },
};

// ── Page ────────────────────────────────────────────────────────────────

export default function CotizacionDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: cot, loading, error, refetch } = useFetch<CotizacionDetalle>(
    `/api/admin/contabilidad/cotizaciones/${id}`
  );
  const { mutate, loading: actuando } = useMutate();

  // ── Actions ─────────────────────────────────────────────────────────

  const ejecutarAccion = useCallback(async (accion: string) => {
    if (accion === 'rechazar' && !confirm('¿Confirmas rechazar esta cotización?')) return;
    if (accion === 'cancelar' && !confirm('¿Confirmas cancelar? Esta acción no se puede deshacer.')) return;

    await mutate(`/api/admin/contabilidad/cotizaciones/${id}/acciones`, {
      body: { accion },
      onSuccess: () => refetch(),
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [id, mutate, refetch]);

  const crearFactura = useCallback(async () => {
    if (!confirm('¿Generar factura a partir de esta cotización?')) return;
    const result = await mutate('/api/admin/contabilidad/facturas', {
      body: { desde_cotizacion: true, cotizacion_id: id },
      onSuccess: (data: any) => {
        router.push(`/admin/contabilidad/facturas/${data.id}`);
      },
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [id, mutate, router]);

  const duplicar = useCallback(async () => {
    await mutate(`/api/admin/contabilidad/cotizaciones/${id}/acciones`, {
      body: { accion: 'duplicar' },
      onSuccess: (data: any) => {
        router.push(`/admin/contabilidad/cotizaciones/${data.id}`);
      },
    });
  }, [id, mutate, router]);

  const [showProgramarModal, setShowProgramarModal] = useState(false);

  const cancelarEnvioProgramado = useCallback(async () => {
    if (!confirm('¿Cancelar el envío programado?')) return;
    await mutate(`/api/admin/contabilidad/cotizaciones/${id}/acciones`, {
      body: { accion: 'cancelar_envio' },
      onSuccess: () => refetch(),
      onError: (err: any) => alert(`Error: ${err}`),
    });
  }, [id, mutate, refetch]);

  const [descargando, setDescargando] = useState(false);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [enviandoFactura, setEnviandoFactura] = useState(false);

  // Recibo de Caja (gastos del trámite) — fetch separate
  const { data: recibosResult, refetch: refetchRecibo } = useFetch<{ data: Array<any> }>(
    id ? `/api/admin/contabilidad/recibos-caja?cotizacion_id=${id}&limit=1` : null
  );
  const recibo = recibosResult?.data?.[0] ?? null;

  // Pagar gastos modal
  const [showGastosModal, setShowGastosModal] = useState(false);
  const [gastosMetodo, setGastosMetodo] = useState('transferencia');
  const [gastosRef, setGastosRef] = useState('');
  const [gastosFecha, setGastosFecha] = useState(new Date().toISOString().split('T')[0]);
  const [gastosNotas, setGastosNotas] = useState('');
  const [gastosEnviando, setGastosEnviando] = useState(false);

  const registrarPagoGastosCot = useCallback(async () => {
    setGastosEnviando(true);
    await mutate(`/api/admin/contabilidad/cotizaciones/${id}/pagar-gastos`, {
      body: {
        monto: Number(cot?.monto_gastos ?? 0),
        metodo: gastosMetodo,
        referencia_bancaria: gastosRef.trim() || null,
        fecha_pago: gastosFecha,
        notas: gastosNotas.trim() || null,
      },
      onSuccess: () => {
        setShowGastosModal(false);
        setGastosRef('');
        setGastosNotas('');
        refetch();
        refetchRecibo();
      },
      onError: (err: any) => alert(`Error: ${err}`),
    });
    setGastosEnviando(false);
  }, [id, cot?.monto_gastos, gastosMetodo, gastosRef, gastosFecha, gastosNotas, mutate, refetch, refetchRecibo]);

  const [showReciboEmailModal, setShowReciboEmailModal] = useState(false);
  const descargarPdf = useCallback(async () => {
    setDescargando(true);
    try {
      const res = await adminFetch(`/api/admin/contabilidad/cotizaciones/${id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al generar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cotizacion-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDescargando(false);
    }
  }, [id]);

  // ── Loading / Error ─────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-4 max-w-4xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );

  if (error || !cot) return (
    <EmptyState
      icon="❌"
      title="Cotización no encontrada"
      description={error ?? 'No se pudo cargar la cotización'}
      action={{ label: 'Volver a cotizaciones', onClick: () => router.push('/admin/contabilidad/cotizaciones') }}
    />
  );

  const estado = ESTADO_CONFIG[cot.estado] ?? ESTADO_CONFIG.borrador;
  const anticipo = Math.round(cot.total * 0.6 * 100) / 100;
  const saldo = Math.round(cot.total * 0.4 * 100) / 100;
  const montoGastos = Number(cot.monto_gastos ?? 0);
  const totalGeneral = Number(cot.total) + montoGastos;

  // Separar pagos por tipo: honorarios (todos los demás) vs gastos del trámite
  const pagosTodos = cot.pagos ?? [];
  const pagosHonorarios = pagosTodos.filter(p => p.tipo !== 'gastos_tramite');
  const pagoGastos = pagosTodos.find(p => p.tipo === 'gastos_tramite');

  const pagosConfirmados = pagosHonorarios.filter(p => p.estado === 'confirmado');
  const totalPagado = pagosConfirmados.reduce((s, p) => s + p.monto, 0);
  const porcentajePagado = cot.total > 0 ? Math.min(100, Math.round((totalPagado / cot.total) * 100)) : 0;
  const estadoPago = totalPagado === 0
    ? 'pendiente'
    : totalPagado >= cot.total
      ? 'completo'
      : 'parcial';

  const gastosPagados = !!pagoGastos && pagoGastos.estado === 'confirmado';

  // Find last confirmed non-anticipo pago for factura request
  const pagoParaFactura = pagosConfirmados.find(p => !p.es_anticipo && !p.factura_solicitada);
  const facturaYaSolicitada = pagosConfirmados.some(p => p.factura_solicitada);

  const solicitarFacturaCot = async () => {
    if (!pagoParaFactura) return;
    setEnviandoFactura(true);
    await mutate('/api/admin/contabilidad/solicitar-factura', {
      body: { pago_id: pagoParaFactura.id },
      onSuccess: () => {
        setShowFacturaModal(false);
        refetch();
      },
      onError: (err: any) => alert(`Error: ${err}`),
    });
    setEnviandoFactura(false);
  };

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/admin/contabilidad/cotizaciones')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block"
          >
            ← Cotizaciones
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{cot.numero}</h1>
            <Badge variant={cot.estado as any}>{estado.label}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">{estado.icon} {estado.description}</p>
          {cot.envio_programado && cot.envio_programado_fecha && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 border border-violet-200 rounded-lg">
              <span className="text-violet-600 text-sm">📅</span>
              <span className="text-sm font-medium text-violet-800">
                Envío programado:{' '}
                {new Date(cot.envio_programado_fecha).toLocaleDateString('es-GT', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {cot.estado === 'borrador' && (
            <>
              <button
                onClick={() => router.push(`/admin/contabilidad/cotizaciones/${id}/editar`)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                ✏️ Editar
              </button>
              {cot.envio_programado ? (
                <button
                  onClick={cancelarEnvioProgramado}
                  disabled={actuando}
                  className="px-3 py-2 text-sm font-medium border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-50"
                >
                  📅 Cancelar envío programado
                </button>
              ) : (
                <button
                  onClick={() => setShowProgramarModal(true)}
                  disabled={actuando}
                  className="px-3 py-2 text-sm font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  🕐 Programar envío
                </button>
              )}
              <button
                onClick={() => ejecutarAccion('enviar')}
                disabled={actuando}
                className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
              >
                📤 Enviar al cliente
              </button>
            </>
          )}
          {cot.estado === 'enviada' && (
            <>
              <button
                onClick={() => ejecutarAccion('aceptar')}
                disabled={actuando}
                className="px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                ✅ Marcar aceptada
              </button>
              <button
                onClick={() => ejecutarAccion('rechazar')}
                disabled={actuando}
                className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                ❌ Rechazar
              </button>
            </>
          )}
          {cot.estado === 'aceptada' && (
            <button
              onClick={() => router.push(`/admin/contabilidad/cotizaciones/${id}/tramites`)}
              className="px-4 py-2 text-sm font-medium border border-[#1E40AF] text-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/5 transition-all"
            >
              📋 Trámites y avances
            </button>
          )}
          {cot.estado === 'aceptada' && !cot.factura_generada && (
            <button
              onClick={crearFactura}
              disabled={actuando}
              className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              🧾 Generar factura
            </button>
          )}
          <button
            onClick={duplicar}
            disabled={actuando}
            className="px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            📋 Duplicar
          </button>
          <button
            onClick={descargarPdf}
            disabled={descargando}
            className="px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {descargando ? '⏳ Descargando...' : '📄 Descargar PDF'}
          </button>
        </div>
      </div>

      {/* Envío programado banner */}
      {cot.envio_programado && cot.envio_programado_fecha && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 border-l-4 border-l-violet-500">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <span className="text-lg shrink-0">📅</span>
              <div>
                <h3 className="text-sm font-bold text-violet-900 mb-0.5">Envío programado</h3>
                <p className="text-sm text-violet-700">
                  {new Date(cot.envio_programado_fecha).toLocaleDateString('es-GT', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala',
                  })}
                </p>
              </div>
            </div>
            <button
              onClick={cancelarEnvioProgramado}
              disabled={actuando}
              className="px-3 py-1.5 text-sm font-medium border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-100 transition-colors disabled:opacity-50"
            >
              Cancelar programacion
            </button>
          </div>
        </div>
      )}

      {/* Nota importante banner */}
      {cot.notas_cliente && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <span className="text-lg shrink-0">⚠️</span>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-1">Nota importante</h3>
              <p className="text-sm text-amber-800 whitespace-pre-line">{cot.notas_cliente}</p>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Items + Conditions (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Items table */}
          <Section title="Detalle de servicios" noPadding>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-5" style={{ width: '5%' }}>#</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Descripción</th>
                    <th className="text-center text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4" style={{ width: '10%' }}>Cant.</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4" style={{ width: '18%' }}>P. Unitario</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-5" style={{ width: '18%' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cot.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5 text-sm text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 text-sm text-slate-800">
                        {item.descripcion}
                        {item.aplica_iva === false && (
                          <span className="ml-2 text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium">Exento IVA</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-center text-slate-600">{item.cantidad}</td>
                      <td className="py-3 px-4 text-sm text-right text-slate-600">{Q(item.precio_unitario)}</td>
                      <td className="py-3 px-5 text-sm text-right font-medium text-slate-900">{Q(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50/20 border-t border-slate-200">
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5">
                  {(() => {
                    const baseGravable = cot.items
                      .filter((i: any) => i.aplica_iva !== false)
                      .reduce((s: number, i: any) => s + i.total, 0);
                    const hasExentos = baseGravable < cot.subtotal;
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Subtotal (sin IVA)</span>
                          <span>{Q(cot.subtotal)}</span>
                        </div>
                        {hasExentos && (
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Base gravable</span>
                            <span>{Q(baseGravable)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">IVA (12%)</span>
                          <span>{Q(cot.iva_monto)}</span>
                        </div>
                      </>
                    );
                  })()}
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200">
                    <span className="text-slate-700">Total honorarios</span>
                    <span className="text-slate-900">{Q(cot.total)}</span>
                  </div>

                  <div className="pt-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                    Gastos del trámite (Recibo de Caja)
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Monto gastos</span>
                    <span className="text-slate-700">{Q(montoGastos)}</span>
                  </div>

                  <div className="flex justify-between text-lg font-bold border-t-2 border-[#0F172A] pt-2 mt-2">
                    <span className="text-[#0F172A]">TOTAL GENERAL</span>
                    <span className="text-[#0F172A]">{Q(totalGeneral)}</span>
                  </div>
                  <div className="mt-2 bg-cyan-50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Anticipo 60% (honorarios)</span>
                      <span className="font-medium text-slate-800">{Q(anticipo)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Saldo 40% (honorarios)</span>
                      <span className="font-medium text-slate-800">{Q(saldo)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* Conditions */}
          <Section title="Términos y condiciones">
            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {cot.condiciones || '—'}
            </div>
          </Section>

          {/* Internal notes */}
          {cot.notas_internas && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📌 Notas internas</h3>
              <p className="text-sm text-amber-700">{cot.notas_internas}</p>
            </div>
          )}

          {/* Pagos de honorarios */}
          <Section title="Pagos de honorarios (factura)">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${
                  estadoPago === 'completo' ? 'text-emerald-700' :
                  estadoPago === 'parcial' ? 'text-blue-700' : 'text-slate-500'
                }`}>
                  {estadoPago === 'completo' ? '✅ Honorarios pagados en su totalidad' :
                   estadoPago === 'parcial' ? `Anticipo recibido (${Q(totalPagado)} de ${Q(cot.total)})` :
                   'Pendiente de pago de honorarios'}
                </span>
                <span className="text-sm font-bold text-slate-900">{porcentajePagado}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    estadoPago === 'completo' ? 'bg-emerald-500' :
                    estadoPago === 'parcial' ? 'bg-blue-500' : 'bg-slate-200'
                  }`}
                  style={{ width: `${porcentajePagado}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>{Q(totalPagado)} pagado</span>
                <span>{Q(cot.total)} total honorarios</span>
              </div>
            </div>

            {/* Pagos list (solo honorarios) */}
            {pagosHonorarios.length > 0 ? (
              <div className="space-y-2 mb-4">
                {pagosHonorarios.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{p.es_anticipo ? '🔹' : '💰'}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {Q(p.monto)}
                          {p.es_anticipo && <span className="ml-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Anticipo</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.numero} · {p.metodo} · {new Date(p.fecha_pago).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', timeZone: 'America/Guatemala' })}
                        </p>
                      </div>
                    </div>
                    <Badge variant={p.estado as any}>{p.estado}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mb-4">No hay pagos registrados</p>
            )}

            {/* Registrar pago de honorarios */}
            {estadoPago !== 'completo' && (
              <button
                onClick={() => router.push(`/admin/contabilidad/pagos/nuevo?cotizacion_id=${id}`)}
                className="w-full px-4 py-2.5 text-sm font-medium text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                + Registrar pago de honorarios
              </button>
            )}

            {/* Solicitar factura button */}
            {estadoPago === 'completo' && pagoParaFactura && !facturaYaSolicitada && (
              <button
                onClick={() => setShowFacturaModal(true)}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1e3a8a] transition-colors"
              >
                📄 Solicitar factura a RE
              </button>
            )}
            {facturaYaSolicitada && (
              <div className="w-full px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                ✅ Factura solicitada
              </div>
            )}
          </Section>

          {/* Gastos del trámite — Recibo de Caja */}
          <Section title="Gastos del trámite (Recibo de Caja)">
            {montoGastos <= 0 ? (
              <p className="text-sm text-slate-400">
                Esta cotización no contempla gastos del trámite (Q0). Si aplica,
                edítala para agregar el monto antes de registrar el pago.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Monto</p>
                    <p className="text-lg font-bold text-slate-900">{Q(montoGastos)}</p>
                  </div>
                  <div className="text-right">
                    {gastosPagados ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full border border-emerald-200">
                        ✅ Pagado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-600 text-xs font-medium rounded-full border border-slate-200">
                        Pendiente
                      </span>
                    )}
                  </div>
                </div>

                {recibo && (
                  <div className="space-y-2 mb-4 p-3 rounded-lg border border-cyan-200 bg-cyan-50/40">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">{recibo.numero}</p>
                      <a
                        href={`/api/admin/contabilidad/recibos-caja/${recibo.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0F172A] hover:underline"
                      >
                        Descargar PDF →
                      </a>
                    </div>
                    <p className="text-xs text-slate-500">
                      Emitido el {new Date(recibo.fecha_emision).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' })}
                    </p>
                    {recibo.email_enviado_at ? (
                      <p className="text-xs text-emerald-700">
                        ✓ Email enviado el {new Date(recibo.email_enviado_at).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', timeZone: 'America/Guatemala' })}
                      </p>
                    ) : recibo.email_error ? (
                      <p className="text-xs text-amber-700">⚠ Email no enviado: {recibo.email_error}</p>
                    ) : null}
                    {(recibo.email_error || !recibo.email_enviado_at) && (
                      <button
                        onClick={() => setShowReciboEmailModal(true)}
                        className="mt-1 text-xs font-medium text-[#0F172A] hover:underline"
                      >
                        Reintentar envío de email
                      </button>
                    )}
                  </div>
                )}

                {!gastosPagados && !recibo && (
                  <button
                    onClick={() => setShowGastosModal(true)}
                    className="w-full px-4 py-2.5 text-sm font-medium text-[#0F172A] bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors"
                  >
                    + Registrar pago de gastos
                  </button>
                )}
              </>
            )}
          </Section>
        </div>

        {/* Right sidebar (1/3) */}
        <div className="space-y-6">
          {/* Client card */}
          <Section title="Cliente">
            {cot.cliente ? (
              <div className="space-y-3">
                <p className="font-medium text-slate-900">{cot.cliente.nombre}</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className="text-slate-400">NIT:</span>
                    <span>{cot.cliente.nit || 'CF'}</span>
                  </div>
                  {cot.cliente.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-slate-400">Email:</span>
                      <a href={`mailto:${cot.cliente.email}`} className="text-[#0891B2] hover:underline">
                        {cot.cliente.email}
                      </a>
                    </div>
                  )}
                  {cot.cc_emails && (
                    <div className="flex items-start gap-2 text-slate-600">
                      <span className="text-slate-400">CC:</span>
                      <span className="text-slate-600">{cot.cc_emails}</span>
                    </div>
                  )}
                  {cot.cliente.telefono && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-slate-400">Tel:</span>
                      <span>{cot.cliente.telefono}</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/admin/clientes/${cot.cliente!.id}`)}
                  className="text-sm text-[#0891B2] hover:text-[#1E40AF] font-medium"
                >
                  Ver expediente →
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin cliente asignado</p>
            )}
          </Section>

          {/* Timeline */}
          <Section title="Historial">
            <div className="space-y-4">
              <TimelineItem
                icon="📝"
                label="Creada"
                date={cot.created_at}
                active
              />
              {cot.fecha_envio && (
                <TimelineItem
                  icon="📤"
                  label="Enviada al cliente"
                  date={cot.fecha_envio}
                  active
                />
              )}
              {cot.fecha_respuesta && (
                <TimelineItem
                  icon={cot.estado === 'aceptada' ? '✅' : '❌'}
                  label={cot.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'}
                  date={cot.fecha_respuesta}
                  active
                />
              )}
              {cot.factura_generada && (
                <TimelineItem
                  icon="🧾"
                  label="Factura generada"
                  date={null}
                  active
                />
              )}
              {cot.envio_programado && cot.envio_programado_fecha && (
                <TimelineItem
                  icon="🕐"
                  label="Envío programado"
                  date={cot.envio_programado_fecha}
                  active
                />
              )}
              {!cot.fecha_envio && cot.estado === 'borrador' && !cot.envio_programado && (
                <TimelineItem
                  icon="📤"
                  label="Pendiente de envío"
                  date={null}
                  active={false}
                />
              )}
            </div>
          </Section>

          {/* Quick info */}
          <Section title="Información">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Vigencia</span>
                <span className="text-slate-900">{cot.vigencia_dias} días</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Items</span>
                <span className="text-slate-900">{cot.items.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Factura</span>
                <span className="text-slate-900">{cot.factura_generada ? 'Sí' : 'No'}</span>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Modal solicitar factura */}
      {showFacturaModal && cot.cliente && pagoParaFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFacturaModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">📄 Solicitar factura a RE Contadores</h3>
            <p className="text-xs text-slate-500 mb-4">Se enviará email desde contador@papeleo.legal</p>

            <div className="space-y-2.5 mb-5 bg-slate-50 rounded-lg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Cliente</span>
                <span className="font-medium text-slate-900">{cot.cliente.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">NIT</span>
                <span className="font-medium text-slate-900">{cot.cliente.nit || 'CF'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Monto</span>
                <span className="font-bold text-[#1E40AF]">{Q(pagoParaFactura.monto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Concepto</span>
                <span className="font-medium text-slate-900">{cot.numero}</span>
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-4 space-y-0.5">
              <p><b>Para:</b> contabilidad@re.com.gt, veronica.zoriano@re.com.gt, joaquin.sandoval@re.com.gt</p>
              <p><b>Desde:</b> contador@papeleo.legal</p>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowFacturaModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                ❌ Cancelar
              </button>
              <button onClick={solicitarFacturaCot} disabled={enviandoFactura}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50">
                {enviandoFactura ? 'Enviando...' : '✅ Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal programar envío */}
      {showProgramarModal && (
        <ProgramarEnvioModal
          cotizacionId={id}
          onClose={() => setShowProgramarModal(false)}
          onSuccess={() => { setShowProgramarModal(false); refetch(); }}
        />
      )}

      {/* Modal registrar pago de gastos */}
      {showGastosModal && cot.cliente && montoGastos > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowGastosModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">💵 Registrar pago de gastos</h3>
            <p className="text-xs text-slate-500 mb-4">
              Se generará un Recibo de Caja y se enviará por email a <b>{cot.cliente.email ?? '(cliente sin email)'}</b>.
            </p>

            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-xs uppercase tracking-wider text-slate-500">Monto a pagar</span>
                <span className="text-xl font-bold text-[#0F172A]">{Q(montoGastos)}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Coincide con los gastos registrados en la cotización</p>
            </div>

            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Método</label>
                <select
                  value={gastosMetodo}
                  onChange={e => setGastosMetodo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                >
                  <option value="transferencia">Transferencia</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="cheque">Cheque</option>
                  <option value="deposito">Depósito</option>
                  <option value="tarjeta">Tarjeta</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de pago</label>
                <input
                  type="date"
                  value={gastosFecha}
                  onChange={e => setGastosFecha(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Referencia bancaria <span className="text-slate-400 font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={gastosRef}
                  onChange={e => setGastosRef(e.target.value)}
                  placeholder="No. de transferencia, boleta, etc."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea
                  value={gastosNotas}
                  onChange={e => setGastosNotas(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowGastosModal(false)}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={registrarPagoGastosCot} disabled={gastosEnviando}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#0F172A] to-[#22D3EE] rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
                {gastosEnviando ? 'Procesando…' : '✅ Registrar pago + emitir recibo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReciboEmailModal && recibo && (
        <EnviarReciboEmailModal
          recibo={recibo}
          onClose={() => setShowReciboEmailModal(false)}
          onSuccess={() => { setShowReciboEmailModal(false); refetchRecibo(); }}
        />
      )}
    </div>
  );
}

// ── ProgramarEnvioModal ─────────────────────────────────────────────────

function ProgramarEnvioModal({ cotizacionId, onClose, onSuccess }: {
  cotizacionId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, loading } = useMutate();
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('08:00');
  const [error, setError] = useState<string | null>(null);

  const handleProgramar = async () => {
    setError(null);
    if (!fecha || !hora) { setError('Selecciona fecha y hora'); return; }
    const fechaProgramada = new Date(`${fecha}T${hora}:00`);
    if (fechaProgramada <= new Date()) { setError('La fecha debe ser futura'); return; }

    await mutate(`/api/admin/contabilidad/cotizaciones/${cotizacionId}/acciones`, {
      body: { accion: 'programar_envio', fecha: fechaProgramada.toISOString() },
      onSuccess: () => onSuccess(),
      onError: (err: any) => setError(String(err)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Programar envío</h3>
        <p className="text-sm text-slate-500 mb-4">
          La cotización se enviará automáticamente en la fecha y hora seleccionadas.
        </p>

        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
            <input
              type="date"
              value={fecha}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setFecha(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs font-medium text-slate-600 mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={e => setHora(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleProgramar}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Programando...' : '🕐 Programar envío'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Timeline Item ───────────────────────────────────────────────────────

function TimelineItem({ icon, label, date, active }: {
  icon: string; label: string; date: string | null; active: boolean;
}) {
  return (
    <div className={`flex items-start gap-3 ${active ? '' : 'opacity-40'}`}>
      <div className="flex flex-col items-center">
        <span className="text-base">{icon}</span>
        <div className="w-px h-4 bg-slate-200 mt-1" />
      </div>
      <div className="min-w-0">
        <p className={`text-sm ${active ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{label}</p>
        {date && (
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(date).toLocaleDateString('es-GT', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Guatemala',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
