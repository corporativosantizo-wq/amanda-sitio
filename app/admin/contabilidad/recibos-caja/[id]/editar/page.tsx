// ============================================================================
// app/admin/contabilidad/recibos-caja/[id]/editar/page.tsx
// Editar Recibo de Caja existente. Para automáticos (con pago vinculado),
// cliente / cotización / monto quedan bloqueados — solo concepto, fecha y
// notas son editables. Tras guardar, el PDF se regenera al mismo path.
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q } from '@/components/admin/ui';

interface ReciboDetalle {
  id: string;
  numero: string;
  origen: 'manual' | 'automatico';
  pago_id: string | null;
  cliente_id: string;
  cotizacion_id: string | null;
  monto: number;
  fecha_emision: string;
  concepto: string;
  notas: string | null;
  email_enviado_at: string | null;
  cliente: { id: string; codigo: string; nombre: string; nit: string | null; email: string | null };
  cotizacion: { id: string; numero: string } | null;
}

interface ClienteBusqueda {
  id: string;
  codigo: string;
  nombre: string;
  nit: string | null;
  email: string | null;
}

interface CotizacionBusqueda {
  id: string;
  numero: string;
  total: number;
  estado: string;
  fecha_emision: string;
}

export default function EditarReciboCajaPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const { data: recibo, loading: cargando, error: errorRecibo } = useFetch<ReciboDetalle>(
    id ? `/api/admin/contabilidad/recibos-caja/${id}` : null
  );

  if (cargando) {
    return <div className="p-8 text-sm text-slate-500">Cargando recibo…</div>;
  }
  if (errorRecibo || !recibo) {
    return (
      <div className="p-8 text-sm text-red-600">
        Error al cargar el recibo: {errorRecibo ?? 'no encontrado'}
      </div>
    );
  }

  // El form se monta una sola vez con el recibo ya cargado; el `key` garantiza
  // remontaje si cambia el id (ej: navegación entre recibos sin volver al list).
  return <FormEditar key={recibo.id} recibo={recibo} />;
}

// ── Form interno (estado inicial derivado del recibo en useState) ───────────

function FormEditar({ recibo }: { recibo: ReciboDetalle }) {
  const router = useRouter();
  const { mutate, loading: guardando } = useMutate();

  const esAutomatico = recibo.origen === 'automatico' || recibo.pago_id !== null;
  const camposBloqueados = esAutomatico;

  const [clienteId, setClienteId] = useState(recibo.cliente_id);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>({
    id: recibo.cliente.id,
    codigo: recibo.cliente.codigo,
    nombre: recibo.cliente.nombre,
    nit: recibo.cliente.nit,
    email: recibo.cliente.email,
  });
  const [clienteBusqueda, setClienteBusqueda] = useState(recibo.cliente.nombre);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  const [cotizacionId, setCotizacionId] = useState<string>(recibo.cotizacion_id ?? '');
  const [concepto, setConcepto] = useState(recibo.concepto);
  const [monto, setMonto] = useState(String(recibo.monto));
  // recibo.fecha_emision viene como ISO; el input requiere YYYY-MM-DD
  // interpretado en zona GT para no perder un día por el shift de UTC.
  const [fechaEmision, setFechaEmision] = useState(
    new Date(recibo.fecha_emision).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' })
  );
  const [notas, setNotas] = useState(recibo.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  // Búsqueda de cliente (sólo manuales)
  const clienteUrl = !camposBloqueados && clienteBusqueda.length >= 2 && (!clienteSeleccionado || clienteSeleccionado.nombre !== clienteBusqueda)
    ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=5`
    : null;
  const { data: clientesResult } = useFetch<{ data: ClienteBusqueda[] }>(clienteUrl);
  const clientesEncontrados = clientesResult?.data ?? [];

  // Cotizaciones del cliente (sólo manuales)
  const cotizacionesUrl = !camposBloqueados && clienteId
    ? `/api/admin/contabilidad/cotizaciones?cliente_id=${clienteId}&limit=20`
    : null;
  const { data: cotizacionesResult } = useFetch<{ data: CotizacionBusqueda[] }>(cotizacionesUrl);
  const cotizacionesCliente = cotizacionesResult?.data ?? [];

  const seleccionarCliente = useCallback((c: ClienteBusqueda) => {
    setClienteId(prev => {
      if (c.id !== prev) setCotizacionId('');
      return c.id;
    });
    setClienteSeleccionado(c);
    setClienteBusqueda(c.nombre);
    setShowClienteDropdown(false);
  }, []);

  const cambiarCliente = useCallback(() => {
    setClienteSeleccionado(null);
    setClienteBusqueda('');
    setShowClienteDropdown(true);
  }, []);

  const guardar = useCallback(async () => {
    setError(null);

    const body: Record<string, unknown> = {
      concepto: concepto.trim(),
      fecha_emision: fechaEmision,
      notas: notas.trim() || null,
    };

    if (!camposBloqueados) {
      const montoNum = parseFloat(monto);
      if (!clienteId) return setError('Selecciona un cliente');
      if (!montoNum || montoNum <= 0) return setError('El monto debe ser mayor a 0');
      body.cliente_id = clienteId;
      body.cotizacion_id = cotizacionId || null;
      body.monto = montoNum;
    }

    if (!body.concepto || (body.concepto as string).trim() === '') {
      return setError('El concepto es obligatorio');
    }
    if (!fechaEmision) return setError('La fecha de emisión es obligatoria');

    await mutate(`/api/admin/contabilidad/recibos-caja/${recibo.id}`, {
      method: 'PATCH',
      body,
      onSuccess: () => router.push('/admin/contabilidad/recibos-caja'),
      onError: (err: unknown) => setError(typeof err === 'string' ? err : 'Error al guardar'),
    });
  }, [recibo.id, concepto, fechaEmision, notas, monto, clienteId, cotizacionId, camposBloqueados, mutate, router]);

  const montoNum = parseFloat(monto) || 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title={`Editar ${recibo.numero}`}
        description={esAutomatico
          ? 'Recibo automático · vinculado a un pago confirmado'
          : 'Recibo manual'}
      />

      {recibo.email_enviado_at && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Este recibo ya fue enviado por email.</strong> Si lo editas,
            considera reenviar la versión actualizada al cliente desde el listado.
          </p>
        </div>
      )}

      {camposBloqueados && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-sm text-slate-600">
            Este recibo proviene de un pago confirmado de gastos del trámite.
            Solo se pueden editar <strong>concepto</strong>, <strong>fecha</strong> y
            <strong> notas</strong>. Para cambiar monto, cliente o cotización,
            primero hay que modificar el pago vinculado.
          </p>
        </div>
      )}

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Número (siempre bloqueado) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Número</label>
          <input
            type="text"
            value={recibo.numero}
            disabled
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500 font-mono"
          />
        </div>

        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cliente {!camposBloqueados && <span className="text-red-500">*</span>}
          </label>
          {clienteSeleccionado && (!showClienteDropdown || camposBloqueados) ? (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">{clienteSeleccionado.nombre}</p>
                <p className="text-xs text-slate-500">
                  {clienteSeleccionado.codigo}
                  {clienteSeleccionado.nit && ` · NIT ${clienteSeleccionado.nit}`}
                  {clienteSeleccionado.email && ` · ${clienteSeleccionado.email}`}
                </p>
              </div>
              {!camposBloqueados && (
                <button
                  type="button"
                  onClick={cambiarCliente}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={clienteBusqueda}
                onChange={e => { setClienteBusqueda(e.target.value); setShowClienteDropdown(true); }}
                onFocus={() => setShowClienteDropdown(true)}
                placeholder="Buscar cliente por nombre, NIT o código…"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
              />
              {showClienteDropdown && clientesEncontrados.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {clientesEncontrados.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => seleccionarCliente(c)}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-cyan-50/50 transition-colors border-b border-slate-100 last:border-b-0"
                    >
                      <p className="font-medium text-slate-900">{c.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {c.codigo}{c.nit && ` · NIT ${c.nit}`}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cotización (opcional) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Vincular cotización <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          {camposBloqueados ? (
            <input
              type="text"
              value={recibo.cotizacion?.numero ?? '— Sin cotización —'}
              disabled
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg bg-slate-50 text-slate-500"
            />
          ) : clienteId ? (
            <select
              value={cotizacionId}
              onChange={e => setCotizacionId(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
            >
              <option value="">— Sin cotización —</option>
              {cotizacionesCliente.map(c => (
                <option key={c.id} value={c.id}>
                  {c.numero} · {Q(c.total)} · {c.estado}
                </option>
              ))}
              {cotizacionId && !cotizacionesCliente.find(c => c.id === cotizacionId) && recibo.cotizacion && (
                <option value={cotizacionId}>{recibo.cotizacion.numero} (actual)</option>
              )}
            </select>
          ) : (
            <p className="text-xs text-slate-400 italic">Selecciona un cliente primero</p>
          )}
        </div>

        {/* Concepto */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Concepto <span className="text-red-500">*</span>
          </label>
          <textarea
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          />
          <p className="mt-1 text-xs text-slate-400">Aparece tal cual en el PDF.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monto {!camposBloqueados && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Q</span>
              <input
                type="number" min="0" step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                disabled={camposBloqueados}
                className="w-full pl-7 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE] disabled:bg-slate-50 disabled:text-slate-500"
              />
            </div>
            {montoNum > 0 && <p className="mt-1 text-xs text-slate-500">{Q(montoNum)}</p>}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fecha de emisión <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={fechaEmision}
              onChange={e => setFechaEmision(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
            />
          </div>
        </div>

        {/* Notas internas */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notas internas <span className="text-xs text-slate-400 font-normal">(no aparecen en el PDF)</span>
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={2}
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-slate-500">
            El PDF se regenera automáticamente al guardar.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#059669] to-[#10B981] rounded-lg hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando…' : '✓ Guardar cambios'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
