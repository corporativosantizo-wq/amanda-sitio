// ============================================================================
// app/api/admin/contabilidad/pagos/route.ts
// GET  → Lista pagos (filtros, resumen, estado de cuenta)
// POST → Registrar nuevo pago
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarPagos,
  registrarPago,
  registrarYConfirmar,
  estadoCuentaCliente,
  resumenPagos,
  PagoError,
} from '@/lib/services/pagos.service';
import type { EstadoPago, TipoPago, PagoInsert } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Resumen dashboard
    if (searchParams.get('resumen') === 'true') {
      return NextResponse.json(await resumenPagos());
    }

    // Estado de cuenta de un cliente
    if (searchParams.get('estado_cuenta') === 'true' && searchParams.get('cliente_id')) {
      const cuenta = await estadoCuentaCliente(searchParams.get('cliente_id')!);
      return NextResponse.json(cuenta);
    }

    const params = {
      cliente_id: searchParams.get('cliente_id') ?? undefined,
      factura_id: searchParams.get('factura_id') ?? undefined,
      estado: searchParams.get('estado') as EstadoPago | undefined,
      tipo: searchParams.get('tipo') as TipoPago | undefined,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
    };

    const resultado = await listarPagos(params);
    return NextResponse.json(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = body as PagoInsert & { confirmar_inmediato?: boolean };

    if (!input.cliente_id) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 });
    }
    if (!input.monto || input.monto <= 0) {
      return NextResponse.json({ error: 'monto debe ser mayor a 0' }, { status: 400 });
    }

    // Atajo: registrar y confirmar en un paso
    const pago = input.confirmar_inmediato
      ? await registrarYConfirmar(input)
      : await registrarPago(input);

    return NextResponse.json(pago, { status: 201 });
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
  console.error('Error en pagos:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
