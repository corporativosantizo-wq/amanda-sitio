// ============================================================================
// app/admin/contabilidad/cotizaciones/[id]/page.tsx
// Detalle de cotización con acciones, timeline y conversión a factura
// ============================================================================

'use client';

import { useCallback, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, Section, KPICard,
  EmptyState, Skeleton, Q,
} from '@/components/admin/ui';

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
  impuestos: number;
  total: number;
  condiciones: string;
  notas: string | null;
  envio_programado: boolean;
  envio_programado_fecha: string | null;
  items: Array<{
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
    orden: number;
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
  const descargarPdf = useCallback(async () => {
    setDescargando(true);
    try {
      const res = await fetch(`/api/admin/contabilidad/cotizaciones/${id}/pdf`);
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

  // Pagos summary
  const pagosConfirmados = (cot.pagos ?? []).filter(p => p.estado === 'confirmado');
  const totalPagado = pagosConfirmados.reduce((s, p) => s + p.monto, 0);
  const porcentajePagado = cot.total > 0 ? Math.min(100, Math.round((totalPagado / cot.total) * 100)) : 0;
  const estadoPago = totalPagado === 0
    ? 'pendiente'
    : totalPagado >= cot.total
      ? 'completo'
      : 'parcial';

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
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-amber-600 text-sm">🕐</span>
              <span className="text-sm font-medium text-amber-800">
                Envío programado:{' '}
                {new Date(cot.envio_programado_fecha).toLocaleDateString('es-GT', {
                  day: 'numeric', month: 'short', year: 'numeric',
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
                  className="px-3 py-2 text-sm font-medium border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  🕐 Cancelar envío programado
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
                      <td className="py-3 px-4 text-sm text-slate-800">{item.descripcion}</td>
                      <td className="py-3 px-4 text-sm text-center text-slate-600">{item.cantidad}</td>
                      <td className="py-3 px-4 text-sm text-right text-slate-600">{Q(item.precio_unitario)}</td>
                      <td className="py-3 px-5 text-sm text-right font-medium text-slate-900">{Q(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50/20 border-t border-slate-200">
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal (sin IVA)</span>
                    <span>{Q(cot.total / 1.12)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">IVA (12%)</span>
                    <span>{Q(cot.impuestos)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t-2 border-[#1E40AF] pt-2 mt-1">
                    <span className="text-[#1E40AF]">TOTAL</span>
                    <span className="text-[#1E40AF]">{Q(cot.total)}</span>
                  </div>
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-700">Anticipo 60%</span>
                      <span className="font-medium text-blue-800">{Q(anticipo)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-700">Saldo 40%</span>
                      <span className="font-medium text-blue-800">{Q(saldo)}</span>
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
          {cot.notas && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">📌 Notas internas</h3>
              <p className="text-sm text-amber-700">{cot.notas}</p>
            </div>
          )}

          {/* Pagos asociados */}
          <Section title="Pagos asociados">
            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-medium ${
                  estadoPago === 'completo' ? 'text-emerald-700' :
                  estadoPago === 'parcial' ? 'text-blue-700' : 'text-slate-500'
                }`}>
                  {estadoPago === 'completo' ? '✅ Pagado en su totalidad' :
                   estadoPago === 'parcial' ? `Anticipo recibido (${Q(totalPagado)} de ${Q(cot.total)})` :
                   'Pendiente de pago'}
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
                <span>{Q(cot.total)} total</span>
              </div>
            </div>

            {/* Pagos list */}
            {cot.pagos && cot.pagos.length > 0 ? (
              <div className="space-y-2 mb-4">
                {cot.pagos.map(p => (
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

            {/* Registrar pago button */}
            {estadoPago !== 'completo' && (
              <button
                onClick={() => router.push(`/admin/contabilidad/pagos/nuevo?cotizacion_id=${id}`)}
                className="w-full px-4 py-2.5 text-sm font-medium text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                + Registrar pago
              </button>
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

      {/* Modal programar envío */}
      {showProgramarModal && (
        <ProgramarEnvioModal
          cotizacionId={id}
          onClose={() => setShowProgramarModal(false)}
          onSuccess={() => { setShowProgramarModal(false); refetch(); }}
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
