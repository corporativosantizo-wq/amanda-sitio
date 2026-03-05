// ============================================================================
// app/api/admin/contabilidad/cotizaciones/route.ts
// GET  → Lista cotizaciones (con filtros y paginación)
// POST → Crear nueva cotización
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarCotizaciones,
  crearCotizacion,
  resumenCotizaciones,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';
import type { EstadoCotizacion, CotizacionInsert } from '@/lib/types';

// TODO: Agregar middleware de auth (Clerk) cuando se integre
// import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    // TODO: Verificar autenticación
    // const { userId } = await auth();
    // if (!userId) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(request.url);

    // Si piden resumen, devolver stats
    if (searchParams.get('resumen') === 'true') {
      const resumen = await resumenCotizaciones();
      return NextResponse.json(resumen);
    }

    // Parámetros de filtro
    const params = {
      estado: searchParams.get('estado') as EstadoCotizacion | undefined,
      cliente_id: searchParams.get('cliente_id') ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '20'),
      busqueda: searchParams.get('q') ?? undefined,
    };

    const resultado = await listarCotizaciones(params);

    return NextResponse.json(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // TODO: Verificar autenticación

    const body = await request.json() as CotizacionInsert;

    // Validaciones básicas
    if (!body.cliente_id) {
      return NextResponse.json(
        { error: 'cliente_id es requerido' },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un item en la cotización' },
        { status: 400 }
      );
    }

    for (const item of body.items) {
      if (!item.descripcion || item.cantidad < 1 || item.precio_unitario < 0) {
        return NextResponse.json(
          { error: 'Cada item requiere: descripcion, cantidad >= 1, precio_unitario >= 0' },
          { status: 400 }
        );
      }
    }

    const cotizacion = await crearCotizacion(body);

    return NextResponse.json(cotizacion, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}

// --- Error handler ---

function manejarError(error: unknown) {
  if (error instanceof CotizacionError) {
    const status = error.message.includes('no encontrada') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }

  console.error('Error inesperado en cotizaciones:', error);
  return NextResponse.json(
    { error: 'Error interno del servidor' },
    { status: 500 }
  );
}
