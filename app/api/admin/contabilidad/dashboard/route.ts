// ============================================================================
// app/api/admin/contabilidad/dashboard/route.ts
// GET → Dashboard contable: resumen de cotizaciones, facturas, pagos, gastos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { resumenCotizaciones } from '@/lib/services/cotizaciones.service';
import { resumenFacturas } from '@/lib/services/facturas.service';
import { resumenPagos } from '@/lib/services/pagos.service';
import { resumenGastos } from '@/lib/services/gastos.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get('desde') ?? undefined;
    const hasta = searchParams.get('hasta') ?? undefined;

    const [cotizaciones, facturas, pagos, gastos] = await Promise.all([
      resumenCotizaciones(),
      resumenFacturas(),
      resumenPagos(),
      resumenGastos(desde, hasta),
    ]);

    // Flujo de efectivo del mes
    const ingresosNetos = pagos.cobrado_mes;
    const egresosNetos = gastos.total_gastos;
    const flujoNeto = ingresosNetos - egresosNetos;

    return NextResponse.json({
      cotizaciones,
      facturas,
      pagos,
      gastos,
      flujo_efectivo: {
        ingresos: ingresosNetos,
        egresos: egresosNetos,
        neto: flujoNeto,
        positivo: flujoNeto >= 0,
      },
      alertas: generarAlertas(cotizaciones, facturas, pagos, gastos),
    });
  } catch (error) {
    console.error('Error en dashboard contable:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

function generarAlertas(
  cotizaciones: any,
  facturas: any,
  pagos: any,
  gastos: any
): Array<{ tipo: 'warning' | 'danger' | 'info'; mensaje: string }> {
  const alertas: Array<{ tipo: 'warning' | 'danger' | 'info'; mensaje: string }> = [];

  if (facturas.vencidas_count > 0) {
    alertas.push({
      tipo: 'danger',
      mensaje: `${facturas.vencidas_count} factura${facturas.vencidas_count > 1 ? 's' : ''} vencida${facturas.vencidas_count > 1 ? 's' : ''} sin cobrar`,
    });
  }

  if (pagos.por_confirmar_count > 0) {
    alertas.push({
      tipo: 'warning',
      mensaje: `${pagos.por_confirmar_count} pago${pagos.por_confirmar_count > 1 ? 's' : ''} pendiente${pagos.por_confirmar_count > 1 ? 's' : ''} de confirmación (Q${pagos.por_confirmar_monto.toLocaleString()})`,
    });
  }

  if (cotizaciones.por_vencer > 0) {
    alertas.push({
      tipo: 'warning',
      mensaje: `${cotizaciones.por_vencer} cotización${cotizaciones.por_vencer > 1 ? 'es' : ''} por vencer esta semana`,
    });
  }

  if (gastos.sin_factura_count > 5) {
    alertas.push({
      tipo: 'info',
      mensaje: `${gastos.sin_factura_count} gastos sin factura este mes — no serán deducibles`,
    });
  }

  if (facturas.tasa_cobro < 60 && facturas.tasa_cobro > 0) {
    alertas.push({
      tipo: 'warning',
      mensaje: `Tasa de cobro del mes: ${facturas.tasa_cobro}% — por debajo del 60%`,
    });
  }

  return alertas;
}
