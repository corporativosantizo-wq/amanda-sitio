// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/route.ts
// GET → Detalle del recibo (con cliente y cotización)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerRecibo, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const recibo = await obtenerRecibo(id);
    return NextResponse.json(recibo);
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error, 'recibos-caja/[id]');
  }
}
