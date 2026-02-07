// ============================================================================
// app/api/admin/notariado/testimonios/[id]/route.ts
// GET → Obtener testimonio con datos de escritura
// PUT → Actualizar testimonio (texto, hojas, timbres, notas)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerTestimonio,
  actualizarTestimonio,
  TestimonioError,
} from '@/lib/services/testimonios.service';
import type { TestimonioUpdate } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const testimonio = await obtenerTestimonio(id);
    return NextResponse.json(testimonio);
  } catch (error) {
    return manejarError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as TestimonioUpdate;
    const testimonio = await actualizarTestimonio(id, body);
    return NextResponse.json(testimonio);
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof TestimonioError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
  console.error('Error en testimonio:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
