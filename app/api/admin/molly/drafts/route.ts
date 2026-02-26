// ============================================================================
// /api/admin/molly/drafts
// GET — listar borradores pendientes | PATCH — aprobar/rechazar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { listPendingDrafts, approveDraft, rejectDraft } from '@/lib/services/molly.service';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const drafts = await listPendingDrafts();
    return NextResponse.json({ data: drafts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { draftId, action } = body;

    if (!draftId || !action) {
      return NextResponse.json(
        { error: 'draftId y action son requeridos' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'approve':
        await approveDraft(draftId, 'dashboard');
        return NextResponse.json({ ok: true, message: 'Borrador aprobado y enviado' });
      case 'reject':
        await rejectDraft(draftId);
        return NextResponse.json({ ok: true, message: 'Borrador rechazado' });
      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
