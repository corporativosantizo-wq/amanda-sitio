// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/route.ts
// GET    → Detalle del recibo (con cliente y cotización)
// PATCH  → Actualizar campos editables; regenera PDF y mantiene mismo path
// DELETE → Hard delete + cleanup best-effort del PDF en storage
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerRecibo,
  actualizarRecibo,
  eliminarRecibo,
  ReciboCajaError,
} from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';
import type { ActualizarReciboInput } from '@/lib/types';

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
    const body = await request.json().catch(() => ({}));

    const input: ActualizarReciboInput = {};
    if (typeof body.concepto === 'string')      input.concepto = body.concepto;
    if (typeof body.fecha_emision === 'string') input.fecha_emision = body.fecha_emision;
    if (body.notas === null || typeof body.notas === 'string') input.notas = body.notas;
    if (typeof body.cliente_id === 'string')    input.cliente_id = body.cliente_id;
    if (body.cotizacion_id === null || typeof body.cotizacion_id === 'string') {
      input.cotizacion_id = body.cotizacion_id;
    }
    if (typeof body.monto === 'number')         input.monto = body.monto;

    const actualizado = await actualizarRecibo(id, input);
    return NextResponse.json(actualizado);
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja/[id] PATCH');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await eliminarRecibo(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja/[id] DELETE');
  }
}
