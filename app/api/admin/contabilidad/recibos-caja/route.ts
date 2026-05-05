// ============================================================================
// app/api/admin/contabilidad/recibos-caja/route.ts
// GET → Lista recibos de caja con filtros (cliente, fechas, búsqueda).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarRecibos, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params = {
      cliente_id:    searchParams.get('cliente_id') ?? undefined,
      cotizacion_id: searchParams.get('cotizacion_id') ?? undefined,
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
