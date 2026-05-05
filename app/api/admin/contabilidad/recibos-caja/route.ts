// ============================================================================
// app/api/admin/contabilidad/recibos-caja/route.ts
// GET  → Lista recibos de caja con filtros (cliente, fechas, búsqueda, origen)
// POST → Crear recibo manual (sin cotización opcional, sin pago previo)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarRecibos, crearReciboManual, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const origenRaw = searchParams.get('origen');
    const origen: 'manual' | 'automatico' | undefined =
      origenRaw === 'manual' || origenRaw === 'automatico' ? origenRaw : undefined;

    const params = {
      cliente_id:    searchParams.get('cliente_id') ?? undefined,
      cotizacion_id: searchParams.get('cotizacion_id') ?? undefined,
      origen,
      desde:         searchParams.get('desde') ?? undefined,
      hasta:         searchParams.get('hasta') ?? undefined,
      busqueda:      searchParams.get('q') ?? undefined,
      page:          parseInt(searchParams.get('page')  ?? '1'),
      limit:         parseInt(searchParams.get('limit') ?? '20'),
    };

    const resultado = await listarRecibos(params);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message, details: error.details }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja');
  }
}

export async function POST(request: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();

    const recibo = await crearReciboManual({
      cliente_id:    body.cliente_id,
      cotizacion_id: body.cotizacion_id ?? null,
      monto:         Number(body.monto),
      concepto:      String(body.concepto ?? ''),
      fecha_emision: body.fecha_emision ?? undefined,
      notas:         body.notas ?? null,
    });

    return NextResponse.json(recibo, { status: 201 });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json({ error: error.message, details: error.details }, { status });
    }
    console.error('[recibos-caja/POST] Error inesperado', error);
    return handleApiError(error, 'recibos-caja/POST');
  }
}
