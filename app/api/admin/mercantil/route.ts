// ============================================================================
// app/api/admin/mercantil/route.ts
// GET: Listar trámites mercantiles · POST: Crear trámite mercantil
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarTramitesMercantiles, crearTramiteMercantil, MercantilError,
} from '@/lib/services/mercantil.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarTramitesMercantiles({
      busqueda: s.get('q') ?? undefined,
      categoria: s.get('categoria') ?? undefined,
      estado: s.get('estado') ?? undefined,
      cliente_id: s.get('cliente_id') ?? undefined,
      vencimiento_desde: s.get('vencimiento_desde') ?? undefined,
      vencimiento_hasta: s.get('vencimiento_hasta') ?? undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '25'),
      orderBy: s.get('orderBy') ?? undefined,
      orderDir: (s.get('orderDir') as 'asc' | 'desc') ?? undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error interno';
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
    if (!body.fecha_tramite) {
      return NextResponse.json({ error: 'fecha_tramite es obligatoria' }, { status: 400 });
    }

    const tramite = await crearTramiteMercantil(body);
    return NextResponse.json({ tramite }, { status: 201 });
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error al crear trámite';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
