// ============================================================================
// app/api/admin/contabilidad/facturas/route.ts
// GET  → Lista facturas (filtros, paginación, resumen)
// POST → Crear factura (directa o desde cotización)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarFacturas,
  crearFactura,
  crearFacturaDesdeCotizacion,
  resumenFacturas,
  FacturaError,
} from '@/lib/services/facturas.service';
import type { EstadoFactura, FacturaInsert } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('resumen') === 'true') {
      return NextResponse.json(await resumenFacturas());
    }

    const params = {
      estado: searchParams.get('estado') as EstadoFactura | undefined,
      cliente_id: searchParams.get('cliente_id') ?? undefined,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      vencidas: searchParams.get('vencidas') === 'true',
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
      busqueda: searchParams.get('q') ?? undefined,
    };

    const resultado = await listarFacturas(params);
    return NextResponse.json(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Crear desde cotización
    if (body.desde_cotizacion && body.cotizacion_id) {
      const factura = await crearFacturaDesdeCotizacion(body.cotizacion_id);
      return NextResponse.json(factura, { status: 201 });
    }

    // Crear directa
    const input = body as FacturaInsert;

    if (!input.cliente_id) {
      return NextResponse.json({ error: 'cliente_id es requerido' }, { status: 400 });
    }
    if (!input.razon_social) {
      return NextResponse.json({ error: 'razon_social es requerido' }, { status: 400 });
    }
    if (!input.nit) {
      return NextResponse.json({ error: 'nit es requerido (usar "CF" para consumidor final)' }, { status: 400 });
    }
    if (!input.items || input.items.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un item' }, { status: 400 });
    }

    const factura = await crearFactura(input);
    return NextResponse.json(factura, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof FacturaError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
  console.error('Error en facturas:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
