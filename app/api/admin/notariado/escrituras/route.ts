// ============================================================================
// app/api/admin/notariado/escrituras/route.ts
// GET  → Lista escrituras (con filtros y paginación)
// POST → Crear nueva escritura
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarEscrituras,
  crearEscritura,
  siguienteNumero,
  EscrituraError,
} from '@/lib/services/escrituras.service';
import type { EstadoEscritura, TipoInstrumento, EscrituraInsert } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Endpoint especial: siguiente número disponible
    if (searchParams.get('siguiente_numero') === 'true') {
      const anio = searchParams.get('anio')
        ? parseInt(searchParams.get('anio')!)
        : undefined;
      const siguiente = await siguienteNumero(anio);
      return NextResponse.json(siguiente);
    }

    const params = {
      anio: searchParams.get('anio')
        ? parseInt(searchParams.get('anio')!)
        : undefined,
      estado: searchParams.get('estado') as EstadoEscritura | undefined,
      tipo_instrumento: searchParams.get('tipo') as TipoInstrumento | undefined,
      cliente_id: searchParams.get('cliente_id') ?? undefined,
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '30'),
      busqueda: searchParams.get('q') ?? undefined,
    };

    const resultado = await listarEscrituras(params);
    return NextResponse.json(resultado);
  } catch (error) {
    return manejarError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EscrituraInsert;

    // Validaciones básicas
    if (!body.fecha_autorizacion) {
      return NextResponse.json(
        { error: 'fecha_autorizacion es requerida' },
        { status: 400 }
      );
    }
    if (!body.lugar_autorizacion) {
      return NextResponse.json(
        { error: 'lugar_autorizacion es requerido' },
        { status: 400 }
      );
    }
    if (!body.departamento) {
      return NextResponse.json(
        { error: 'departamento es requerido' },
        { status: 400 }
      );
    }
    if (!body.tipo_instrumento) {
      return NextResponse.json(
        { error: 'tipo_instrumento es requerido' },
        { status: 400 }
      );
    }
    if (!body.tipo_instrumento_texto) {
      return NextResponse.json(
        { error: 'tipo_instrumento_texto es requerido (ej: "compraventa de bien inmueble")' },
        { status: 400 }
      );
    }
    if (!body.comparecientes || body.comparecientes.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un compareciente' },
        { status: 400 }
      );
    }

    // Validar cada compareciente
    for (const comp of body.comparecientes) {
      if (!comp.nombre || !comp.calidad) {
        return NextResponse.json(
          { error: 'Cada compareciente requiere al menos: nombre, calidad' },
          { status: 400 }
        );
      }
    }

    const escritura = await crearEscritura(body);
    return NextResponse.json(escritura, { status: 201 });
  } catch (error) {
    return manejarError(error);
  }
}

function manejarError(error: unknown) {
  if (error instanceof EscrituraError) {
    const status = error.message.includes('no encontrad') ? 404 : 400;
    return NextResponse.json(
      { error: error.message, details: error.details },
      { status }
    );
  }
  console.error('Error inesperado en escrituras:', error);
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
}
