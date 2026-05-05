// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/route.ts
// GET   → Detalle del recibo (con cliente, cotización, emails_cc del cliente)
// PATCH → Vincular/desvincular cotización (body: { cotizacion_id: string|null })
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerRecibo,
  vincularCotizacion,
  ReciboCajaError,
} from '@/lib/services/recibos-caja.service';
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json();

    if ('cotizacion_id' in body) {
      const cotId = body.cotizacion_id;
      if (cotId !== null && typeof cotId !== 'string') {
        return NextResponse.json({ error: 'cotizacion_id debe ser string o null' }, { status: 400 });
      }
      const recibo = await vincularCotizacion(id, cotId);
      return NextResponse.json(recibo);
    }

    return NextResponse.json({ error: 'No hay cambios reconocidos en el body' }, { status: 400 });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return handleApiError(error, 'recibos-caja/[id]/PATCH');
  }
}
