// ============================================================================
// POST /api/admin/audiencias/registro/[id]/sincronizar
// Sincroniza la audiencia con el calendario de Outlook de Amanda (botón del
// detalle). Idempotente: crea el evento si no existe, o lo actualiza si ya está.
// Auth: middleware Clerk del matcher /api/admin(.*).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerAudiencia, AudienciaError } from '@/lib/services/audiencias.service';
import { sincronizarEventoOutlookAudiencia } from '@/lib/services/audiencias-outlook.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const audiencia = await obtenerAudiencia(id);
    const result = await sincronizarEventoOutlookAudiencia(audiencia);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AudienciaError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return handleApiError(err, 'audiencias/registro/[id]/sincronizar/POST');
  }
}
