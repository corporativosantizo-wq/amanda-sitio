// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/route.ts
// GET    → Obtener cotización con items y cliente
// PUT    → Actualizar cotización (solo borrador)
// DELETE → Eliminar cotización (solo borrador)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCotizacion,
  actualizarCotizacion,
  eliminarCotizacion,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';
import type { CotizacionUpdate } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cotizacion = await obtenerCotizacion(id);
    return NextResponse.json(cotizacion);
  } catch (error) {
    return manejarError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as CotizacionUpdate;
    const cotizacion = await actualizarCotizacion(id, body);
    return NextResponse.json(cotizacion);
  } catch (error) {
    return manejarError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await eliminarCotizacion(id);
    return NextResponse.json({ success: true, message: 'Cotización eliminada' });
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof CotizacionError) {
    const status = error.message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }

  console.error('Error inesperado en cotización:', error);
  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}
