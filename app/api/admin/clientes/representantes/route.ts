// ============================================================================
// app/api/admin/clientes/representantes/route.ts
// GET: Buscar representantes legales por nombre (autocomplete)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { buscarRepresentantes, RepresentanteError } from '@/lib/services/representantes.service';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const q = s.get('q') ?? '';

    if (!q.trim() || q.trim().length < 2) {
      return NextResponse.json({ representantes: [] });
    }

    const representantes = await buscarRepresentantes(q);
    return NextResponse.json({ representantes });
  } catch (err) {
    const msg = err instanceof RepresentanteError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
