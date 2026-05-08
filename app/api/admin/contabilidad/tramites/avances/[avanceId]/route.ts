// ============================================================================
// app/api/admin/contabilidad/tramites/avances/[avanceId]/route.ts
// DELETE → elimina un avance (best-effort cleanup del adjunto en storage)
// GET    → URL firmada del adjunto (descarga)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  eliminarAvance,
  urlFirmadaAdjunto,
  TramiteError,
} from '@/lib/services/tramites.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ avanceId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { avanceId } = await params;
    const { data, error } = await createAdminClient()
      .from('tramite_avances')
      .select('documento_url')
      .eq('id', avanceId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: 'Avance no encontrado' }, { status: 404 });
    }
    if (!data.documento_url) {
      return NextResponse.json({ error: 'El avance no tiene adjunto' }, { status: 404 });
    }
    const url = await urlFirmadaAdjunto(data.documento_url);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/avances/[avanceId] GET');
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { avanceId } = await params;
    await eliminarAvance(avanceId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/avances/[avanceId] DELETE');
  }
}
