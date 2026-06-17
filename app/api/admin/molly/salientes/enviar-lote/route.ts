// ============================================================================
// POST /api/admin/molly/salientes/enviar-lote
// Envía todos los pendientes de un lote, con delay entre cada uno. Un fallo
// individual no detiene el resto; devuelve enviados[] y fallidos[].
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { enviarLoteSaliente, SalienteError } from '@/lib/services/salientes.service';

// El envío en lote intercala un delay de ~2.5s entre correos para no saturar
// Graph, así que necesita más tiempo que el default serverless.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const lote = String(body?.lote ?? '').trim();
    if (!lote) {
      return NextResponse.json({ error: 'lote es requerido' }, { status: 400 });
    }
    const resultado = await enviarLoteSaliente(lote);
    return NextResponse.json({ data: resultado });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al enviar el lote';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
