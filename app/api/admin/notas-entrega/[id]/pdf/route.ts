// ============================================================================
// GET /api/admin/notas-entrega/[id]/pdf
// Redirige a una URL firmada del PDF de la nota de entrega (genera on-demand).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { urlFirmadaPDFNota, NotaEntregaError } from '@/lib/services/notas-entrega.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;
  try {
    const { id } = await ctx.params;
    const url = await urlFirmadaPDFNota(id);
    return NextResponse.redirect(url);
  } catch (err) {
    if (err instanceof NotaEntregaError) return NextResponse.json({ error: err.message }, { status: 404 });
    return handleApiError(err, 'notas-entrega/[id]/pdf/GET');
  }
}
