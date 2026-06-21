// ============================================================================
// /api/admin/audiencias/registro/[id]
// GET: detalle de una audiencia del registro (legal.audiencias).
// Separado del lector de Outlook. Auth: middleware Clerk del matcher.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerAudiencia, AudienciaError } from '@/lib/services/audiencias.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audiencia = await obtenerAudiencia(id);
    return NextResponse.json({ audiencia });
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return handleApiError(err, 'audiencias/registro/[id]/GET');
  }
}
