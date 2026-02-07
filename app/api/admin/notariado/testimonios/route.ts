// ============================================================================
// app/api/admin/notariado/testimonios/route.ts
// GET → Lista global de testimonios (pendientes, por tipo, etc.)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarTestimonios,
  resumenTestimonios,
  TestimonioError,
} from '@/lib/services/testimonios.service';
import type { TipoTestimonio, EstadoTestimonio } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Resumen para dashboard
    if (searchParams.get('resumen') === 'true') {
      const resumen = await resumenTestimonios();
      return NextResponse.json(resumen);
    }

    const params = {
      escritura_id: searchParams.get('escritura_id') ?? undefined,
      tipo: searchParams.get('tipo') as TipoTestimonio | undefined,
      estado: searchParams.get('estado') as EstadoTestimonio | undefined,
      pendientes_solo: searchParams.get('pendientes') === 'true',
      page: parseInt(searchParams.get('page') ?? '1'),
      limit: parseInt(searchParams.get('limit') ?? '30'),
    };

    const resultado = await listarTestimonios(params);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof TestimonioError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en testimonios:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
