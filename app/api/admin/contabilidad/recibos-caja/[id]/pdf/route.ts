// ============================================================================
// app/api/admin/contabilidad/recibos-caja/[id]/pdf/route.ts
// GET → Redirige a una URL firmada (1h) del PDF en storage.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { urlFirmadaPDF, ReciboCajaError } from '@/lib/services/recibos-caja.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const url = await urlFirmadaPDF(id);
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    if (error instanceof ReciboCajaError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleApiError(error, 'recibos-caja/[id]/pdf');
  }
}
