// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/reenviar/route.ts
// POST → Reintenta el envío del email del recibo (descarga PDF de storage).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { reenviarEmailRecibo, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    await reenviarEmailRecibo(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'recibos-caja/[id]/reenviar');
  }
}
