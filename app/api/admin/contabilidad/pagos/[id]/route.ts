// ============================================================================
// app/api/admin/contabilidad/pagos/[id]/route.ts
// GET  → Obtener pago con relaciones
// POST → Acciones: confirmar | rechazar | subir_comprobante
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerPago,
  confirmarPago,
  rechazarPago,
  subirComprobante,
  PagoError,
} from '@/lib/services/pagos.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const pago = await obtenerPago(id);
    return NextResponse.json(pago);
  } catch (error) {
    return manejarError(error);
  }
}

type Accion = 'confirmar' | 'rechazar' | 'subir_comprobante';
const ACCIONES_VALIDAS: Accion[] = ['confirmar', 'rechazar', 'subir_comprobante'];

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
      case 'confirmar':
        resultado = await confirmarPago(id);
        break;
      case 'rechazar':
        resultado = await rechazarPago(id, body.motivo);
        break;
      case 'subir_comprobante':
        if (!body.url || !body.nombre) {
          return NextResponse.json(
            { error: 'Se requiere url y nombre del comprobante' },
            { status: 400 }
          );
        }
        resultado = await subirComprobante(id, {
          url: body.url,
          nombre: body.nombre,
        });
        break;
    }

    return NextResponse.json({ success: true, accion, data: resultado });
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof PagoError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
  console.error('Error en pago:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
