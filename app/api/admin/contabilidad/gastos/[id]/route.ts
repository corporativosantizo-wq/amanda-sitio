// ============================================================================
// app/api/admin/contabilidad/gastos/[id]/route.ts
// GET    → Obtener gasto
// PUT    → Actualizar gasto
// DELETE → Eliminar gasto
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerGasto,
  actualizarGasto,
  eliminarGasto,
  GastoError,
} from '@/lib/services/gastos.service';
import type { GastoInsert } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const gasto = await obtenerGasto(id);
    return NextResponse.json(gasto);
  } catch (error) {
    return manejarError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<GastoInsert>;
    const gasto = await actualizarGasto(id, body);
    return NextResponse.json(gasto);
  } catch (error) {
    return manejarError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await eliminarGasto(id);
    return NextResponse.json({ success: true, message: 'Gasto eliminado' });
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof GastoError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
  console.error('Error en gasto:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
