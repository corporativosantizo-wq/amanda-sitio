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

  const [descargando, setDescargando] = useState(false);
  const descargarPdf = useCallback(async () => {
    setDescargando(true);
    try {
      const res = await fetch(`/api/admin/contabilidad/cotizaciones/${id}/pdf`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al obtener PDF');
      window.open(data.url, '_blank');
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
          {cot.pdf_url && (
            <button
              onClick={descargarPdf}
              disabled={descargando}
              className="px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {descargando ? '⏳ Descargando...' : '📄 Descargar PDF'}
            </button>
          )}
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
              {!cot.fecha_envio && cot.estado === 'borrador' && (
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
