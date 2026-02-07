// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/acciones/route.ts
// POST → Ejecutar acciones sobre una cotización
//   body: { accion: 'enviar' | 'aceptar' | 'rechazar' | 'duplicar' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  enviarCotizacion,
  aceptarCotizacion,
  rechazarCotizacion,
  duplicarCotizacion,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';

type RouteParams = { params: Promise<{ id: string }> };

type Accion = 'enviar' | 'aceptar' | 'rechazar' | 'duplicar';

const ACCIONES_VALIDAS: Accion[] = ['enviar', 'aceptar', 'rechazar', 'duplicar'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const accion = body.accion as Accion;

    if (!accion || !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json(
        {
          error: `Acción inválida. Usar: ${ACCIONES_VALIDAS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    let resultado;

    switch (accion) {
      case 'enviar':
        resultado = await enviarCotizacion(id);
        break;

      case 'aceptar':
        resultado = await aceptarCotizacion(id);
        break;

      case 'rechazar':
        resultado = await rechazarCotizacion(id);
        break;

      case 'duplicar':
        resultado = await duplicarCotizacion(id, body.nuevo_cliente_id);
        break;
    }

    return NextResponse.json({
      success: true,
      accion,
      data: resultado,
    });
  } catch (error) {
    if (error instanceof CotizacionError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    console.error('Error en acción de cotización:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
