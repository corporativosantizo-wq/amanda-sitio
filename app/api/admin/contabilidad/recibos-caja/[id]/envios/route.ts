// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/envios/route.ts
// GET → Historial de envíos del recibo (más reciente primero).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarEnvios, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const envios = await listarEnvios(id);
    return NextResponse.json({ data: envios });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja/[id]/envios');
  }
}
