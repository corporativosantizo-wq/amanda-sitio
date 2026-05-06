// ============================================================================
// app/admin/contabilidad/recibos-caja/nuevo/page.tsx
// Crear Recibo de Caja manual (sin pago previo, sin email automático).
// ============================================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q } from '@/components/admin/ui';

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

export default function NuevoReciboCajaPage() {
  const router = useRouter();
  const { mutate, loading: guardando } = useMutate();

  // Cliente
  const [clienteId, setClienteId] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>(null);
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  // Cotización (opcional)
  const [cotizacionId, setCotizacionId] = useState<string>('');

  // Form
  const [concepto, setConcepto] = useState('Gastos de trámite — ');
  const [monto, setMonto] = useState('');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Búsqueda de cliente (mismo patrón que cotizaciones/nueva)
  const clienteUrl = clienteBusqueda.length >= 2 && !clienteSeleccionado
    ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=5`
    : null;
  const { data: clientesResult } = useFetch<{ data: ClienteBusqueda[] }>(clienteUrl);
  const clientesEncontrados = clientesResult?.data ?? [];

  // Cotizaciones del cliente seleccionado
  const cotizacionesUrl = clienteId
    ? `/api/admin/contabilidad/cotizaciones?cliente_id=${clienteId}&limit=20`
    : null;
  const { data: cotizacionesResult } = useFetch<{ data: CotizacionBusqueda[] }>(cotizacionesUrl);
  const cotizacionesCliente = cotizacionesResult?.data ?? [];

  // Resetear cotización al cambiar cliente
  useEffect(() => { setCotizacionId(''); }, [clienteId]);

  const seleccionarCliente = useCallback((c: ClienteBusqueda) => {
    setClienteId(c.id);
    setClienteSeleccionado(c);
    setClienteBusqueda(c.nombre);
    setShowClienteDropdown(false);
  }, []);

  const limpiarCliente = useCallback(() => {
    setClienteId('');
    setClienteSeleccionado(null);
    setClienteBusqueda('');
    setShowClienteDropdown(false);
  }, []);

  const guardar = useCallback(async () => {
    setError(null);
    const montoNum = parseFloat(monto);

    if (!clienteId) return setError('Selecciona un cliente');
    if (!concepto.trim() || concepto.trim() === 'Gastos de trámite —') {
      return setError('El concepto es obligatorio');
    }
    if (!montoNum || montoNum <= 0) return setError('El monto debe ser mayor a 0');
    if (!fechaEmision) return setError('La fecha de emisión es obligatoria');

    await mutate('/api/admin/contabilidad/recibos-caja', {
      body: {
        cliente_id:    clienteId,
        cotizacion_id: cotizacionId || null,
        monto:         montoNum,
        concepto:      concepto.trim(),
        fecha_emision: fechaEmision,
        notas:         notas.trim() || null,
      },
      onSuccess: (data: any) => {
        const numero = data?.numero ?? 'creado';
        router.push(`/admin/contabilidad/recibos-caja?creado=${encodeURIComponent(numero)}`);
      },
      onError: (err: any) => setError(String(err)),
    });
  }, [clienteId, cotizacionId, monto, concepto, fechaEmision, notas, mutate, router]);

  const montoNum = parseFloat(monto) || 0;

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="Nuevo Recibo de Caja"
        description="Comprobante NO fiscal · numeración correlativa propia"
      />

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Cliente */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Cliente <span className="text-red-500">*</span>
          </label>
          {clienteSeleccionado ? (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">{clienteSeleccionado.nombre}</p>
                <p className="text-xs text-slate-500">
                  {clienteSeleccionado.codigo}
                  {clienteSeleccionado.nit && ` · NIT ${clienteSeleccionado.nit}`}
                  {clienteSeleccionado.email && ` · ${clienteSeleccionado.email}`}
                </p>
              </div>
              <button
                type="button"
                onClick={limpiarCliente}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Cambiar
              </button>
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
                        {c.codigo}
                        {c.nit && ` · NIT ${c.nit}`}
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
          {clienteId ? (
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
            placeholder="Ej: Gastos de trámite — Inscripción de mandato"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          />
          <p className="mt-1 text-xs text-slate-400">Aparece tal cual en el PDF.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Monto <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">Q</span>
              <input
                type="number" min="0" step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
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
            placeholder="Detalles para uso interno…"
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
            El email <strong>NO</strong> se envía al guardar. El recibo queda creado y disponible en el listado.
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
              disabled={guardando || !clienteId || montoNum <= 0}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#059669] to-[#10B981] rounded-lg hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardando ? 'Creando…' : '✓ Crear Recibo de Caja'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
