// ============================================================================
// app/api/admin/contabilidad/tramites/[id]/fusionar/route.ts
// POST → fusiona el trámite [id] dentro de body.target_id (mismo cotización).
//        Mueve items y avances; elimina el trámite [id].
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { fusionarTramites, TramiteError } from '@/lib/services/tramites.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const targetId = typeof body.target_id === 'string' ? body.target_id : '';
    if (!targetId) {
      return NextResponse.json({ error: 'target_id es obligatorio' }, { status: 400 });
    }
    await fusionarTramites(id, targetId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TramiteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleApiError(error, 'tramites/[id]/fusionar POST');
  }
}
