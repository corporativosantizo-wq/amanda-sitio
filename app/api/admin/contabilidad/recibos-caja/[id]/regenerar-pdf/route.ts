// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/regenerar-pdf/route.ts
// POST → Regenera el PDF del recibo (útil tras cambios de branding/datos emisor).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { regenerarPDF, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const result = await regenerarPDF(id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      const status = error.message.includes('no encontrad') ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    return handleApiError(error, 'recibos-caja/[id]/regenerar-pdf');
  }
}
