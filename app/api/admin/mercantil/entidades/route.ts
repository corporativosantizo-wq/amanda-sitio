// ============================================================================
// GET: Listar/buscar entidades mercantiles · POST: Crear entidad
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarEntidades,
  crearEntidad,
  buscarEntidades,
  contarDocumentosPorEntidad,
  EntidadError,
} from '@/lib/services/entidades-mercantiles.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;

    // Quick search mode (for combobox)
    if (s.has('quick')) {
      const results = await buscarEntidades(s.get('q') ?? '', 10);
      return NextResponse.json(results);
    }

    const result = await listarEntidades({
      busqueda: s.get('q') ?? undefined,
      activa: s.has('activa') ? s.get('activa') === 'true' : undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
    });

    // Enrich with document counts
    const ids = result.data.map((e: any) => e.id);
    const counts = await contarDocumentosPorEntidad(ids);
    const enriched = result.data.map((e: any) => ({
      ...e,
      documentos_count: counts[e.id] ?? 0,
    }));

    return NextResponse.json({ ...result, data: enriched });
  } catch (err) {
    const msg = err instanceof EntidadError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const entidad = await crearEntidad(body);
    return NextResponse.json(entidad, { status: 201 });
  } catch (err) {
    console.error('ERROR CREAR ENTIDAD:', err);
    const msg = err instanceof EntidadError ? err.message : 'Error al crear entidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
