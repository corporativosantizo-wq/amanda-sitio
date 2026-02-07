// ============================================================================
// app/admin/contabilidad/pagos/nuevo/page.tsx
// Registro rápido de pago
// ============================================================================

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Badge, Q } from '@/components/admin/ui';

// ── Types ───────────────────────────────────────────────────────────────

interface FacturaPendiente {
  id: string;
  numero: string;
  total: number;
  monto_pagado: number;
  monto_pendiente: number;
  estado: string;
  fecha_vencimiento: string;
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
  const searchParams = useSearchParams();
  const facturaIdParam = searchParams.get('factura_id');

  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  // Form state
  const [facturaId, setFacturaId] = useState(facturaIdParam ?? '');
  const [facturaBusqueda, setFacturaBusqueda] = useState('');
  const [facturaSeleccionada, setFacturaSeleccionada] = useState<FacturaPendiente | null>(null);
  const [showFacturas, setShowFacturas] = useState(false);
  const [monto, setMonto] = useState('');
  const [metodoPago, setMetodoPago] = useState('transferencia');
  const [referencia, setReferencia] = useState('');
  const [esAnticipo, setEsAnticipo] = useState(false);
  const [confirmarInmediato, setConfirmarInmediato] = useState(true);
  const [notas, setNotas] = useState('');

  // Search invoices
  const facturaUrl = facturaBusqueda.length >= 2
    ? `/api/admin/contabilidad/facturas?q=${encodeURIComponent(facturaBusqueda)}&estado=pendiente,parcial&limit=5`
    : null;
  const { data: facturasResult } = useFetch<{ data: FacturaPendiente[] }>(facturaUrl);

  // Auto-load if factura_id in URL
  const { data: facturaPreloaded } = useFetch<FacturaPendiente>(
    facturaIdParam && !facturaSeleccionada
      ? `/api/admin/contabilidad/facturas/${facturaIdParam}`
      : null
  );
  if (facturaPreloaded && !facturaSeleccionada) {
    setFacturaSeleccionada(facturaPreloaded);
    setFacturaId(facturaPreloaded.id);
  }

  // ── Calculations ────────────────────────────────────────────────────

  const montoNum = parseFloat(monto) || 0;
  const esPagoTotal = facturaSeleccionada
    ? Math.abs(montoNum - facturaSeleccionada.monto_pendiente) < 0.01
    : false;
  const esPagoParcial = facturaSeleccionada
    ? montoNum > 0 && montoNum < facturaSeleccionada.monto_pendiente
    : false;
  const excedeDeuda = facturaSeleccionada
    ? montoNum > facturaSeleccionada.monto_pendiente + 0.01
    : false;

  // ── Actions ─────────────────────────────────────────────────────────

  const seleccionarFactura = useCallback((f: FacturaPendiente) => {
    setFacturaId(f.id);
    setFacturaSeleccionada(f);
    setFacturaBusqueda('');
    setShowFacturas(false);
    // Auto-set monto al pendiente
    setMonto(String(f.monto_pendiente));
  }, []);

  const setMonto60 = useCallback(() => {
    if (!facturaSeleccionada) return;
    const anticipo = Math.round(facturaSeleccionada.total * 0.6 * 100) / 100;
    setMonto(String(anticipo));
    setEsAnticipo(true);
  }, [facturaSeleccionada]);

  const setMonto40 = useCallback(() => {
    if (!facturaSeleccionada) return;
    setMonto(String(facturaSeleccionada.monto_pendiente));
    setEsAnticipo(false);
  }, [facturaSeleccionada]);

  const guardar = useCallback(async () => {
    if (!facturaId) return alert('Selecciona una factura');
    if (montoNum <= 0) return alert('El monto debe ser mayor a 0');
    if (excedeDeuda) return alert('El monto excede la deuda pendiente');

    const body = {
      factura_id: facturaId,
      monto: montoNum,
      metodo_pago: metodoPago,
      referencia_pago: referencia || null,
      es_anticipo: esAnticipo,
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
  }, [facturaId, montoNum, metodoPago, referencia, esAnticipo, notas, confirmarInmediato, excedeDeuda, mutate, router]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHeader
        title="Registrar pago"
        description="Registra un pago recibido contra una factura"
      />

      {/* ══════════ 1. FACTURA ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">1. Factura</h3>

        {facturaSeleccionada ? (
          <div className="space-y-4">
            {/* Factura card */}
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg p-4 border border-slate-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-slate-900">{facturaSeleccionada.numero}</span>
                    <Badge variant={facturaSeleccionada.estado as any}>{facturaSeleccionada.estado}</Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{facturaSeleccionada.cliente?.nombre ?? '—'}</p>
                </div>
                <button
                  onClick={() => { setFacturaSeleccionada(null); setFacturaId(''); setMonto(''); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-md hover:bg-red-50"
                >
                  Cambiar
                </button>
              </div>

              {/* Balance breakdown */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <p className="text-xs text-slate-500">Total factura</p>
                  <p className="text-lg font-bold text-slate-900">{Q(facturaSeleccionada.total)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-slate-200">
                  <p className="text-xs text-slate-500">Ya pagado</p>
                  <p className="text-lg font-bold text-emerald-600">{Q(facturaSeleccionada.monto_pagado)}</p>
                </div>
                <div className="bg-white rounded-lg p-3 text-center border border-amber-200 bg-amber-50/50">
                  <p className="text-xs text-amber-700">Pendiente</p>
                  <p className="text-lg font-bold text-amber-700">{Q(facturaSeleccionada.monto_pendiente)}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Buscar por número de factura o nombre de cliente..."
              value={facturaBusqueda}
              onChange={e => { setFacturaBusqueda(e.target.value); setShowFacturas(true); }}
              onFocus={() => setShowFacturas(true)}
              className="w-full px-4 py-3 pl-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>

            {showFacturas && facturaBusqueda.length >= 2 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFacturas(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden">
                  {facturasResult && facturasResult.data.length > 0 ? (
                    facturasResult.data.map(f => (
                      <button
                        key={f.id}
                        onClick={() => seleccionarFactura(f)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono font-medium text-slate-900">{f.numero}</span>
                            <span className="text-slate-400 text-xs ml-2">{f.cliente?.nombre}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-medium text-amber-700">{Q(f.monto_pendiente)}</span>
                            <span className="text-xs text-slate-400 ml-1">pendiente</span>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : facturasResult ? (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No se encontraron facturas pendientes
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
                className={`w-full pl-10 pr-4 py-4 text-2xl font-bold border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  excedeDeuda
                    ? 'border-red-300 text-red-600 focus:ring-red-200 focus:border-red-400'
                    : esPagoTotal
                    ? 'border-emerald-300 text-emerald-700 focus:ring-emerald-200 focus:border-emerald-400'
                    : 'border-slate-200 text-slate-900 focus:ring-[#0891B2]/20 focus:border-[#0891B2]'
                }`}
              />
            </div>

            {/* Quick amount buttons */}
            {facturaSeleccionada && (
              <div className="flex gap-2 mt-2">
                <button
                  onClick={setMonto60}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  Anticipo 60% ({Q(Math.round(facturaSeleccionada.total * 0.6 * 100) / 100)})
                </button>
                <button
                  onClick={setMonto40}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  Pago total ({Q(facturaSeleccionada.monto_pendiente)})
                </button>
              </div>
            )}

            {/* Status indicator */}
            {facturaSeleccionada && montoNum > 0 && (
              <div className={`mt-2 text-sm font-medium ${
                excedeDeuda ? 'text-red-600' : esPagoTotal ? 'text-emerald-600' : 'text-amber-600'
              }`}>
                {excedeDeuda && '⚠️ El monto excede la deuda pendiente'}
                {esPagoTotal && '✅ Pago total — factura quedará como pagada'}
                {esPagoParcial && `ℹ️ Pago parcial — quedarán ${Q(facturaSeleccionada.monto_pendiente - montoNum)} pendientes`}
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
            {facturaSeleccionada && montoNum > 0 && (
              <div className="text-sm text-slate-600">
                <span className="font-bold text-xl text-[#1E40AF]">{Q(montoNum)}</span>
                <span className="mx-2">→</span>
                <span>{facturaSeleccionada.numero}</span>
                <span className="mx-1 text-slate-400">·</span>
                <span>{facturaSeleccionada.cliente?.nombre}</span>
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
              disabled={guardando || !facturaId || montoNum <= 0 || excedeDeuda}
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
