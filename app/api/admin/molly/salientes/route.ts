// ============================================================================
// /api/admin/molly/salientes
// GET  — listar borradores salientes (filtrable por lote y status)
// POST — crear uno o varios borradores salientes (carga masiva)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  crearBorradoresSalientes,
  listarSalientes,
  SalienteError,
  type SalienteInput,
} from '@/lib/services/salientes.service';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const sp = req.nextUrl.searchParams;
    const data = await listarSalientes({
      lote: sp.get('lote') ?? undefined,
      status: sp.get('status') ?? undefined,
    });
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al listar borradores salientes';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    // Acepta un objeto único o un array (carga masiva).
    const items: SalienteInput[] = Array.isArray(body) ? body : Array.isArray(body?.items) ? body.items : [body];
    const data = await crearBorradoresSalientes(items);
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al crear borradores salientes';
    const status = err instanceof SalienteError ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
