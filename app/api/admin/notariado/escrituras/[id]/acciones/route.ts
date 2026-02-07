// ============================================================================
// app/api/admin/notariado/escrituras/[id]/acciones/route.ts
// POST → autorizar | cancelar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  autorizarEscritura,
  cancelarEscritura,
  EscrituraError,
} from '@/lib/services/escrituras.service';

type RouteParams = { params: Promise<{ id: string }> };

type Accion = 'autorizar' | 'cancelar';
const ACCIONES_VALIDAS: Accion[] = ['autorizar', 'cancelar'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const accion = body.accion as Accion;

    if (!accion || !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json(
        { error: `Acción inválida. Usar: ${ACCIONES_VALIDAS.join(', ')}` },
        { status: 400 }
      );
    }

    let resultado;

    switch (accion) {
      case 'autorizar':
        resultado = await autorizarEscritura(id);
        break;
      case 'cancelar':
        resultado = await cancelarEscritura(id, body.motivo);
        break;
    }

    return NextResponse.json({ success: true, accion, data: resultado });
  } catch (error) {
    if (error instanceof EscrituraError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en acción de escritura:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
