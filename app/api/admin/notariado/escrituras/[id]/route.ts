// ============================================================================
// app/api/admin/notariado/escrituras/[id]/route.ts
// GET → Obtener escritura con testimonios y cliente
// PUT → Actualizar escritura
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerEscritura,
  actualizarEscritura,
  EscrituraError,
} from '@/lib/services/escrituras.service';
import type { EscrituraUpdate } from '@/lib/types';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const escritura = await obtenerEscritura(id);
    return NextResponse.json(escritura);
  } catch (error) {
    return manejarError(error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json() as EscrituraUpdate;
    const escritura = await actualizarEscritura(id, body);
    return NextResponse.json(escritura);
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof EscrituraError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message },
      { status }
    );
  }
  console.error('Error inesperado en escritura:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
