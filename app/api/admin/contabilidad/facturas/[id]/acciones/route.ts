// ============================================================================
// app/api/admin/contabilidad/facturas/[id]/acciones/route.ts
// POST → anular | emitir_fel | enviar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  anularFactura,
  emitirFEL,
  enviarFactura,
  FacturaError,
} from '@/lib/services/facturas.service';

type RouteParams = { params: Promise<{ id: string }> };

type Accion = 'anular' | 'emitir_fel' | 'enviar';
const ACCIONES_VALIDAS: Accion[] = ['anular', 'emitir_fel', 'enviar'];

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
      case 'anular':
        resultado = await anularFactura(id, body.motivo);
        break;
      case 'emitir_fel':
        resultado = await emitirFEL(id);
        break;
      case 'enviar':
        resultado = await enviarFactura(id);
        break;
    }

    return NextResponse.json({ success: true, accion, data: resultado });
  } catch (error) {
    if (error instanceof FacturaError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en acción de factura:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
