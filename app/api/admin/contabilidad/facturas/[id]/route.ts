// ============================================================================
// app/api/admin/contabilidad/facturas/[id]/route.ts
// GET → Obtener factura con items, cliente y pagos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerFactura, FacturaError } from '@/lib/services/facturas.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const factura = await obtenerFactura(id);
    return NextResponse.json(factura);
  } catch (error) {
    if (error instanceof FacturaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status }
      );
    }
    return handleApiError(error, 'contabilidad/facturas/[id]');
  }
}
