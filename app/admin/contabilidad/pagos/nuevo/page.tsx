// ============================================================================
// app/admin/contabilidad/pagos/nuevo/page.tsx
// Registro rápido de pago — contra cotización
// Flujo: Cotización → Pago → Factura (posterior)
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

const METODOS_PAGO = [
  { value: 'transferencia', label: 'Transferencia bancaria', icon: '🏦' },
  { value: 'deposito', label: 'Depósito', icon: '💵' },
  { value: 'efectivo', label: 'Efectivo', icon: '💰' },
  { value: 'cheque', label: 'Cheque', icon: '📄' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
  { value: 'otro', label: 'Otro', icon: '📋' },
];

// ── Page ────────────────────────────────────────────────────────────────

export default function NuevoPagoPage() {
  const router = useRouter();

  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  // Form state
  const [cotizacionBusqueda, setCotizacionBusqueda] = useState('');
  const [cotizacionSeleccionada, setCotizacionSeleccionada] = useState<CotizacionOption | null>(null);
  const [showResultados, setShowResultados] = useState(false);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [confirmarInmediato, setConfirmarInmediato] = useState(true);
  const [notas, setNotas] = useState('');

  // Search cotizaciones
  const cotizacionUrl = cotizacionBusqueda.length >= 2
    ? `/api/admin/contabilidad/cotizaciones?q=${encodeURIComponent(cotizacionBusqueda)}&limit=5`
    : null;
  const { data: cotizacionesResult } = useFetch<{ data: CotizacionOption[] }>(cotizacionUrl);

  // Filter out rechazadas from results
  const cotizacionesFiltradas = (cotizacionesResult?.data ?? []).filter(
    c => c.estado !== 'rechazada'
  );

  // ── Calculations ────────────────────────────────────────────────────

  const montoNum = parseFloat(monto) || 0;

  // ── Actions ─────────────────────────────────────────────────────────

  const seleccionarCotizacion = useCallback((c: CotizacionOption) => {
    setCotizacionSeleccionada(c);
    setCotizacionBusqueda('');
    setShowResultados(false);
    // Pre-fill monto: anticipo if required, otherwise total
    if (c.requiere_anticipo && c.anticipo_monto > 0) {
      setMonto(String(c.anticipo_monto));
      setEsAnticipo(true);
    } else {
      setMonto(String(c.total));
      setEsAnticipo(false);
    }
  }, []);

  const setMontoAnticipo = useCallback(() => {
    if (!cotizacionSeleccionada) return;
    const pct = cotizacionSeleccionada.anticipo_porcentaje || 60;
    const anticipo = Math.round(cotizacionSeleccionada.total * (pct / 100) * 100) / 100;
    setMonto(String(anticipo));
    setEsAnticipo(true);
  }, [cotizacionSeleccionada]);

  const setMontoTotal = useCallback(() => {
    if (!cotizacionSeleccionada) return;
    setMonto(String(cotizacionSeleccionada.total));
    setEsAnticipo(false);
  }, [cotizacionSeleccionada]);

  const guardar = useCallback(async () => {
    if (!cotizacionSeleccionada) return alert('Selecciona una cotización');
    if (montoNum <= 0) return alert('El monto debe ser mayor a 0');

    const body = {
      cotizacion_id: cotizacionSeleccionada.id,
      cliente_id: cotizacionSeleccionada.cliente?.id,
      monto: montoNum,
      metodo_pago: metodoPago,
      referencia_pago: referencia || null,
      es_anticipo: esAnticipo,
      porcentaje_anticipo: esAnticipo ? (cotizacionSeleccionada.anticipo_porcentaje || 60) : null,
      notas: notas || null,
      confirmar_inmediato: confirmarInmediato,
    };

    await mutate('/api/admin/contabilidad/pagos', {
      body,
      onSuccess: (data: any) => {
        router.push(`/admin/contabilidad/pagos/${data.id}`);
      },
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [cotizacionSeleccionada, montoNum, metodoPago, referencia, esAnticipo, notas, confirmarInmediato, mutate, router]);

  const anticipoPct = cotizacionSeleccionada?.anticipo_porcentaje || 60;

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="Registrar pago"
        description="Registra un pago recibido contra una cotización"
      />

      {/* ══════════ 1. COTIZACIÓN ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">1. Cotización</h3>

        {cotizacionSeleccionada ? (
          <div className="space-y-4">
            {/* Cotización card */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg p-4 border border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-900">{cotizacionSeleccionada.numero}</span>
                    <Badge variant={cotizacionSeleccionada.estado as any}>{cotizacionSeleccionada.estado}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{cotizacionSeleccionada.cliente?.nombre ?? '—'}</p>
                </div>
                <button
                  onClick={() => { setCotizacionSeleccionada(null); setMonto(''); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-md hover:bg-red-50"
                >
                  Cambiar
                </button>
              </div>

              {/* Total and anticipo info */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <p className="text-xs text-slate-500">Total cotización</p>
                  <p className="text-lg font-bold text-slate-900">{Q(cotizacionSeleccionada.total)}</p>
                </div>
                {cotizacionSeleccionada.requiere_anticipo && (
                  <div className="bg-white rounded-lg p-3 text-center border border-blue-200 bg-blue-50/50">
                    <p className="text-xs text-blue-700">Anticipo {anticipoPct}%</p>
                    <p className="text-lg font-bold text-blue-700">{Q(cotizacionSeleccionada.anticipo_monto)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Buscar por número de cotización o nombre de cliente..."
              value={cotizacionBusqueda}
              onChange={e => { setCotizacionBusqueda(e.target.value); setShowResultados(true); }}
              onFocus={() => setShowResultados(true)}
              className="w-full px-4 py-3 pl-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>

            {showResultados && cotizacionBusqueda.length >= 2 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowResultados(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {cotizacionesFiltradas.length > 0 ? (
                    cotizacionesFiltradas.map(c => (
                      <button
                        key={c.id}
                        onClick={() => seleccionarCotizacion(c)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-medium text-slate-900">{c.numero}</span>
                            <span className="text-slate-400 text-xs ml-2">{c.cliente?.nombre}</span>
                            <Badge variant={c.estado as any} className="ml-2 text-[10px]">{c.estado}</Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-slate-900">{Q(c.total)}</span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : cotizacionesResult ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No se encontraron cotizaciones
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ══════════ 2. MONTO Y MÉTODO ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">2. Pago</h3>

        <div className="space-y-5">
          {/* Monto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Monto recibido</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-medium">Q</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monto}
                onChange={e => setMonto(e.target.value)}
                placeholder="0.00"
                className="w-full pl-10 pr-4 py-4 text-2xl font-bold border rounded-xl focus:outline-none focus:ring-2 transition-all border-slate-200 text-slate-900 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
            </div>

            {/* Quick amount buttons */}
            {cotizacionSeleccionada && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={setMontoAnticipo}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Anticipo {anticipoPct}% ({Q(Math.round(cotizacionSeleccionada.total * (anticipoPct / 100) * 100) / 100)})
                </button>
                <button
                  onClick={setMontoTotal}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Pago total ({Q(cotizacionSeleccionada.total)})
                </button>
              </div>
            )}
          </div>

          {/* Método de pago */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Método de pago</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {METODOS_PAGO.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMetodoPago(m.value)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                    metodoPago === m.value
                      ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg">{m.icon}</span>
                  <span className="text-[10px] font-medium leading-tight text-center">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Referencia / No. comprobante
              <span className="text-xs text-slate-400 font-normal ml-1">(opcional)</span>
            </label>
            <input
              type="text"
              value={referencia}
              onChange={e => setReferencia(e.target.value)}
              placeholder="Ej: Transferencia #12345, Boleta #678..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          {/* Options */}
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esAnticipo}
                onChange={e => setEsAnticipo(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/20"
              />
              <span className="text-sm text-slate-700">Es anticipo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmarInmediato}
                onChange={e => setConfirmarInmediato(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/20"
              />
              <span className="text-sm text-slate-700">Confirmar inmediatamente</span>
              <span className="text-xs text-slate-400">(ya verifiqué en banco)</span>
            </label>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Notas
              <span className="text-xs text-slate-400 font-normal ml-1">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Observaciones del pago..."
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>
        </div>
      </section>

      {/* ══════════ ACTIONS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Summary */}
          <div>
            {cotizacionSeleccionada && montoNum > 0 && (
              <div className="text-sm text-slate-600">
                <span className="font-bold text-xl text-[#1E40AF]">{Q(montoNum)}</span>
                <span className="mx-2">→</span>
                <span>{cotizacionSeleccionada.numero}</span>
                <span className="mx-1 text-slate-400">·</span>
                <span>{cotizacionSeleccionada.cliente?.nombre}</span>
                {esAnticipo && <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Anticipo</span>}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !cotizacionSeleccionada || montoNum <= 0}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardando ? 'Registrando...' : confirmarInmediato ? '✅ Registrar y confirmar' : '💾 Registrar pago'}
            </button>
          </div>
        </div>

        {errorGuardar && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {errorGuardar}
          </div>
        )}
      </section>
    </div>
  );
}
