// ============================================================================
// POST /api/admin/molly/salientes/programar-lote
// Programa (o desprograma) todos los pendientes de un lote para la misma
// fecha/hora. body: { lote, programado_para } (programado_para=null desprograma).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { programarLoteSaliente, SalienteError } from '@/lib/services/salientes.service';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const lote = String(body?.lote ?? '').trim();
    if (!lote) {
      return NextResponse.json({ error: 'lote es requerido' }, { status: 400 });
    }
    const data = await programarLoteSaliente(lote, body?.programado_para ?? null);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al programar el lote';
    const status = err instanceof SalienteError ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
