// ============================================================================
// app/api/admin/laboral/route.ts
// GET: Listar trámites laborales · POST: Crear trámite laboral
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarTramitesLaborales, crearTramiteLaboral, LaboralError,
} from '@/lib/services/laboral.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarTramitesLaborales({
      busqueda: s.get('q') ?? undefined,
      categoria: s.get('categoria') ?? undefined,
      estado: s.get('estado') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      fecha_fin_desde: s.get('fecha_fin_desde') ?? undefined,
      fecha_fin_hasta: s.get('fecha_fin_hasta') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
      orderBy: s.get('orderBy') ?? undefined,
      orderDir: (s.get('orderDir') as 'asc' | 'desc') ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.cliente_id) {
      return NextResponse.json({ error: 'cliente_id es obligatorio' }, { status: 400 });
    }
    if (!body.categoria) {
      return NextResponse.json({ error: 'categoria es obligatoria' }, { status: 400 });
    }

    const tramite = await crearTramiteLaboral(body);
    return NextResponse.json({ tramite }, { status: 201 });
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error al crear trámite';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
