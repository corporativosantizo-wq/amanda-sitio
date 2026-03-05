// ============================================================================
// app/admin/contabilidad/pagos/nuevo/page.tsx
// Registro rápido de pago — formulario compacto, una sola pantalla
// ============================================================================

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge, Q } from '@/components/admin/ui';

// ── Types ───────────────────────────────────────────────────────────────

interface CotizacionOption {
  id: string;
  numero: string;
  total: number;
  estado: string;
  requiere_anticipo: boolean;
  anticipo_porcentaje: number;
  anticipo_monto: number;
  cliente: { id: string; nombre: string } | null;
}

interface ClienteOption {
  id: string;
  nombre: string;
  codigo: string;
}

const METODOS = [
  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
  { value: 'deposito', label: 'Depósito', icon: '💵' },
  { value: 'efectivo', label: 'Efectivo', icon: '💰' },
  { value: 'cheque', label: 'Cheque', icon: '📄' },
];

// ── Page ────────────────────────────────────────────────────────────────

export default function NuevoPagoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  // State
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [notas, setNotas] = useState('');
  const [toast, setToast] = useState('');

  // Cliente (optional)
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOption | null>(null);
  const [showClientes, setShowClientes] = useState(false);

  // Cotización (optional)
  const [cotBusqueda, setCotBusqueda] = useState('');
  const [cotSeleccionada, setCotSeleccionada] = useState<CotizacionOption | null>(null);
  const [showCot, setShowCot] = useState(false);

  // Preload cotización from query param
  const preloadCotId = searchParams.get('cotizacion_id');
  const { data: preloadCot } = useFetch<CotizacionOption & { cliente: { id: string; nombre: string } | null }>(
    preloadCotId && !cotSeleccionada ? `/api/admin/contabilidad/cotizaciones/${preloadCotId}` : null
  );
  useEffect(() => {
    if (preloadCot && !cotSeleccionada) {
      setCotSeleccionada(preloadCot);
      if (!concepto.trim()) setConcepto(preloadCot.numero);
      if (preloadCot.requiere_anticipo && preloadCot.anticipo_monto > 0) {
        setMonto(String(preloadCot.anticipo_monto));
        setEsAnticipo(true);
      } else {
        setMonto(String(preloadCot.total));
      }
      if (preloadCot.cliente) {
        setClienteSeleccionado({ id: preloadCot.cliente.id, nombre: preloadCot.cliente.nombre, codigo: '' });
      }
    }
  }, [preloadCot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Search
  const { data: clientesRes } = useFetch<{ data: ClienteOption[] }>(
    clienteBusqueda.length >= 2 ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=5&activo=true` : null
  );
  const { data: cotRes } = useFetch<{ data: CotizacionOption[] }>(
    cotBusqueda.length >= 2 ? `/api/admin/contabilidad/cotizaciones?q=${encodeURIComponent(cotBusqueda)}&limit=5` : null
  );
  const cotFiltradas = (cotRes?.data ?? []).filter(c => c.estado !== 'rechazada');

  const montoNum = parseFloat(monto) || 0;
  const canSubmit = !!concepto.trim() && montoNum > 0 && !guardando;

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Actions ─────────────────────────────────────────────────────────

  const seleccionarCot = useCallback((c: CotizacionOption) => {
    setCotSeleccionada(c);
    setCotBusqueda('');
    setShowCot(false);
    // Pre-fill from cotización
    if (!concepto.trim()) setConcepto(c.numero);
    if (c.requiere_anticipo && c.anticipo_monto > 0) {
      setMonto(String(c.anticipo_monto));
      setEsAnticipo(true);
    } else {
      setMonto(String(c.total));
    }
    // Auto-set client from cotización
    if (c.cliente && !clienteSeleccionado) {
      setClienteSeleccionado({ id: c.cliente.id, nombre: c.cliente.nombre, codigo: '' });
    }
  }, [concepto, clienteSeleccionado]);

  const guardar = useCallback(async () => {
    if (!concepto.trim()) return alert('Ingresa el concepto del pago');
    if (montoNum <= 0) return alert('El monto debe ser mayor a 0');

    const body: Record<string, any> = {
      cliente_id: clienteSeleccionado?.id || null,
      cotizacion_id: cotSeleccionada?.id || null,
      monto: montoNum,
      metodo_pago: metodo,
      referencia_pago: referencia || null,
      es_anticipo: esAnticipo,
      porcentaje_anticipo: esAnticipo && cotSeleccionada ? (cotSeleccionada.anticipo_porcentaje || 60) : null,
      notas: [concepto.trim(), notas.trim()].filter(Boolean).join('\n') || null,
      confirmar_inmediato: true,
    };

    await mutate('/api/admin/contabilidad/pagos', {
      body,
      onSuccess: () => {
        router.push('/admin/contabilidad/pagos');
        // Toast via sessionStorage so it shows after navigation
        sessionStorage.setItem('pago_toast', `Pago de ${Q(montoNum)} registrado correctamente`);
      },
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [concepto, montoNum, metodo, referencia, esAnticipo, notas, clienteSeleccionado, cotSeleccionada, mutate, router]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Registrar pago" />

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Concepto */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Concepto</label>
          <input
            type="text"
            autoFocus
            value={concepto}
            onChange={e => setConcepto(e.target.value)}
            placeholder="Ej: Contrato Trevino S.A., Consulta legal..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
          />
        </div>

        {/* Monto */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Monto</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-medium">Q</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-3 text-xl font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>
          {/* Quick buttons when cotización selected */}
          {cotSeleccionada && (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => { setMonto(String(Math.round(cotSeleccionada.total * ((cotSeleccionada.anticipo_porcentaje || 60) / 100) * 100) / 100)); setEsAnticipo(true); }}
                className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
              >
                Anticipo {cotSeleccionada.anticipo_porcentaje || 60}%
              </button>
              <button
                type="button"
                onClick={() => { setMonto(String(cotSeleccionada.total)); setEsAnticipo(false); }}
                className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
              >
                Total ({Q(cotSeleccionada.total)})
              </button>
            </div>
          )}
        </div>

        {/* Método */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Método de pago</label>
          <div className="grid grid-cols-4 gap-2">
            {METODOS.map(m => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMetodo(m.value)}
                className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all text-center ${
                  metodo === m.value
                    ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-base">{m.icon}</span>
                <span className="text-[10px] font-medium leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Referencia */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Referencia <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={referencia}
            onChange={e => setReferencia(e.target.value)}
            placeholder="No. comprobante, boleta, transferencia..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
          />
        </div>

        {/* Cliente (optional autocomplete) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Cliente <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          {clienteSeleccionado ? (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <span className="text-sm font-medium text-slate-900">{clienteSeleccionado.nombre}</span>
              <button type="button" onClick={() => setClienteSeleccionado(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={clienteBusqueda}
                onChange={e => { setClienteBusqueda(e.target.value); setShowClientes(true); }}
                onFocus={() => setShowClientes(true)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
              {showClientes && clienteBusqueda.length >= 2 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowClientes(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {(clientesRes?.data ?? []).length > 0 ? (clientesRes?.data ?? []).map(c => (
                      <button key={c.id} type="button" onClick={() => { setClienteSeleccionado(c); setClienteBusqueda(''); setShowClientes(false); }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50/50 text-sm border-b border-slate-100 last:border-0">
                        <span className="font-medium text-slate-900">{c.nombre}</span>
                        <span className="text-xs text-slate-400 ml-2">{c.codigo}</span>
                      </button>
                    )) : clientesRes ? (
                      <div className="p-3 text-center text-sm text-slate-500">Sin resultados</div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Cotización (optional autocomplete) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Cotización <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          {cotSeleccionada ? (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-medium text-slate-900">{cotSeleccionada.numero}</span>
                <span className="text-xs text-slate-500">{Q(cotSeleccionada.total)}</span>
                <Badge variant={cotSeleccionada.estado as any} className="text-[10px]">{cotSeleccionada.estado}</Badge>
              </div>
              <button type="button" onClick={() => setCotSeleccionada(null)} className="text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar COT-XXXXX o nombre de cliente..."
                value={cotBusqueda}
                onChange={e => { setCotBusqueda(e.target.value); setShowCot(true); }}
                onFocus={() => setShowCot(true)}
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
              {showCot && cotBusqueda.length >= 2 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCot(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                    {cotFiltradas.length > 0 ? cotFiltradas.map(c => (
                      <button key={c.id} type="button" onClick={() => seleccionarCot(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50/50 text-sm border-b border-slate-100 last:border-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-medium text-slate-900">{c.numero}</span>
                            <span className="text-xs text-slate-400 ml-2">{c.cliente?.nombre}</span>
                          </div>
                          <span className="font-medium text-slate-700">{Q(c.total)}</span>
                        </div>
                      </button>
                    )) : cotRes ? (
                      <div className="p-3 text-center text-sm text-slate-500">Sin resultados</div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Es anticipo + Notas */}
        <div className="flex items-start gap-6">
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={esAnticipo} onChange={e => setEsAnticipo(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/20" />
            <span className="text-sm text-slate-700">Es anticipo</span>
          </label>
          <div className="flex-1">
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={1}
              placeholder="Notas (opcional)"
              className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={!canSubmit}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {guardando ? 'Registrando...' : 'Registrar pago'}
          </button>
        </div>

        {errorGuardar && (
          <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{errorGuardar}</div>
        )}
      </section>
    </div>
  );
}
