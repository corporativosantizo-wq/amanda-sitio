export const dynamic = 'force-dynamic';
// ============================================================================
// app/admin/contabilidad/reportes/page.tsx
// Reportes contables - resumen mensual y anual
// ============================================================================

'use client';

import { useState } from 'react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { PageHeader, Section, KPICard, Q, Skeleton } from '@/components/admin/ui';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

interface ReporteMensual {
  ingresos: number;
  gastos: number;
  utilidad_bruta: number;
  facturas_emitidas: number;
  facturas_pagadas: number;
  facturas_pendientes: number;
  monto_por_cobrar: number;
  cotizaciones_enviadas: number;
  cotizaciones_aceptadas: number;
  tasa_conversion: number;
  gastos_por_categoria: Array<{ nombre: string; total: number }>;
  top_clientes: Array<{ nombre: string; total_pagado: number }>;
}

export default function ReportesPage() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const { data: reporte, loading } = useFetch<ReporteMensual>(
    `/api/admin/contabilidad/reportes?mes=${mes}&anio=${anio}`
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description={`Resumen financiero de ${MESES[mes - 1]} ${anio}`} />

      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 overflow-x-auto bg-white rounded-lg border border-slate-200 p-1">
          {MESES.map((m, i) => (
            <button key={m} onClick={() => setMes(i + 1)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                mes === i + 1 ? 'bg-[#1E40AF] text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}>{m.slice(0, 3)}</button>
          ))}
        </div>
        <select value={anio} onChange={e => setAnio(+e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
          {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : reporte ? (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard label="Ingresos" value={Q(reporte.ingresos)} accent icon="💰"
              sub={`${reporte.facturas_pagadas} facturas pagadas`} />
            <KPICard label="Gastos" value={Q(reporte.gastos)} icon="💸"
              sub="Total del mes" />
            <KPICard label="Utilidad bruta" value={Q(reporte.utilidad_bruta)} icon="📊"
              sub={reporte.utilidad_bruta >= 0 ? 'Positiva' : 'Negativa'}
               />
            <KPICard label="Por cobrar" value={Q(reporte.monto_por_cobrar)} icon="⏳"
              sub={`${reporte.facturas_pendientes} facturas`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Flujo */}
            <Section title="Flujo del mes">
              <div className="space-y-4">
                <FlowBar label="Ingresos" amount={reporte.ingresos} max={Math.max(reporte.ingresos, reporte.gastos)} color="emerald" />
                <FlowBar label="Gastos" amount={reporte.gastos} max={Math.max(reporte.ingresos, reporte.gastos)} color="red" />
                <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-700">Utilidad neta</span>
                  <span className={`text-lg font-bold ${reporte.utilidad_bruta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {reporte.utilidad_bruta >= 0 ? '+' : ''}{Q(reporte.utilidad_bruta)}
                  </span>
                </div>
              </div>
            </Section>

            {/* Conversión */}
            <Section title="Embudo de ventas">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Cotizaciones enviadas</span>
                  <span className="font-medium text-slate-900">{reporte.cotizaciones_enviadas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Aceptadas</span>
                  <span className="font-medium text-emerald-600">{reporte.cotizaciones_aceptadas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Facturas emitidas</span>
                  <span className="font-medium text-slate-900">{reporte.facturas_emitidas}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Cobradas</span>
                  <span className="font-medium text-emerald-600">{reporte.facturas_pagadas}</span>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-700">Tasa de conversión</span>
                    <span className="text-xl font-bold text-[#1E40AF]">{reporte.tasa_conversion}%</span>
                  </div>
                  <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-full transition-all"
                      style={{ width: `${Math.min(100, reporte.tasa_conversion)}%` }} />
                  </div>
                </div>
              </div>
            </Section>

            {/* Gastos por categoría */}
            <Section title="Gastos por categoría">
              {(reporte.gastos_por_categoria ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Sin gastos este mes</p>
              ) : (
                <div className="space-y-3">
                  {reporte.gastos_por_categoria.map((cat, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-700 truncate">{cat.nombre}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full"
                            style={{ width: `${(cat.total / reporte.gastos) * 100}%` }} />
                        </div>
                        <span className="text-sm font-medium text-red-600 w-20 text-right">{Q(cat.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Top clientes */}
            <Section title="Top clientes">
              {(reporte.top_clientes ?? []).length === 0 ? (
                <p className="text-sm text-slate-400">Sin pagos este mes</p>
              ) : (
                <div className="space-y-3">
                  {reporte.top_clientes.map((cli, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-4">{i + 1}.</span>
                        <span className="text-sm text-slate-700">{cli.nombre}</span>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{Q(cli.total_pagado)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </>
      ) : null}
    </div>
  );
}

function FlowBar({ label, amount, max, color }: {
  label: string; amount: number; max: number; color: 'emerald' | 'red';
}) {
  const pct = max > 0 ? (amount / max) * 100 : 0;
  const bg = color === 'emerald' ? 'bg-emerald-500' : 'bg-red-400';
  const text = color === 'emerald' ? 'text-emerald-600' : 'text-red-600';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className={`font-medium ${text}`}>{Q(amount)}</span>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
