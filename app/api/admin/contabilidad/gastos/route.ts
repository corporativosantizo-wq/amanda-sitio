// ============================================================================
// app/api/admin/contabilidad/gastos/route.ts
// GET  → Lista gastos, resumen mensual, reporte anual, categorías
// POST → Crear gasto
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarGastos,
  crearGasto,
  listarCategorias,
  resumenGastos,
  reporteAnualGastos,
  GastoError,
} from '@/lib/services/gastos.service';
import type { GastoInsert } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Categorías
    if (searchParams.get('categorias') === 'true') {
      return NextResponse.json(await listarCategorias());
    }

    // Resumen mensual
    if (searchParams.get('resumen') === 'true') {
      const mes = searchParams.get('mes') ?? undefined; // '2026-01'
      return NextResponse.json(await resumenGastos(mes ? `${mes}-01` : undefined));
    }

    // Reporte anual
    if (searchParams.get('reporte_anual') === 'true') {
      const anio = searchParams.get('anio')
        ? parseInt(searchParams.get('anio')!)
        : undefined;
      return NextResponse.json(await reporteAnualGastos(anio));
    }

    // Lista con filtros
    const params = {
      categoria_id: searchParams.get('categoria_id') ?? undefined,
      expediente_id: searchParams.get('expediente_id') ?? undefined,
      desde: searchParams.get('desde') ?? undefined,
      hasta: searchParams.get('hasta') ?? undefined,
      deducibles: searchParams.has('deducibles')
        ? searchParams.get('deducibles') === 'true'
        : undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
      busqueda: searchParams.get('q') ?? undefined,
    };

    const resultado = await listarGastos(params);
    return NextResponse.json(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GastoInsert;

    if (!body.categoria_id) {
      return NextResponse.json({ error: 'categoria_id es requerido' }, { status: 400 });
    }
    if (!body.descripcion) {
      return NextResponse.json({ error: 'descripcion es requerida' }, { status: 400 });
    }
    if (!body.monto || body.monto <= 0) {
      return NextResponse.json({ error: 'monto debe ser mayor a 0' }, { status: 400 });
    }

    const gasto = await crearGasto(body);
    return NextResponse.json(gasto, { status: 201 });
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
  console.error('Error en gastos:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
