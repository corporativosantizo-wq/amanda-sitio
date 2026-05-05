// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/pagar-gastos/route.ts
// POST → Registra el pago de los gastos del trámite y emite Recibo de Caja
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { registrarPagoGastos, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id: cotizacionId } = await params;
    const body = await request.json();

    const recibo = await registrarPagoGastos({
      cotizacion_id: cotizacionId,
      monto: Number(body.monto),
      fecha_pago: body.fecha_pago,
      metodo: body.metodo,
      referencia_bancaria: body.referencia_bancaria ?? null,
      notas: body.notas ?? null,
    });

    return NextResponse.json(recibo, { status: 201 });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status }
      );
    }
    return handleApiError(error, 'cotizaciones/pagar-gastos');
  }
}
