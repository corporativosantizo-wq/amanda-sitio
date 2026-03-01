// ============================================================================
// /api/admin/molly/drafts
// GET — listar borradores pendientes | PATCH — aprobar/rechazar
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  listPendingDrafts,
  listScheduledDrafts,
  approveDraft,
  rejectDraft,
  scheduleDraft,
  cancelScheduledDraft,
} from '@/lib/services/molly.service';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const [drafts, scheduled] = await Promise.all([
      listPendingDrafts(),
      listScheduledDrafts(),
    ]);
    return NextResponse.json({ data: drafts, scheduled });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { draftId, action, editedBody, custom_body, scheduled_at } = body;

    if (!draftId || !action) {
      return NextResponse.json(
        { error: 'draftId y action son requeridos' },
        { status: 400 },
      );
    }

    switch (action) {
      case 'approve':
        await approveDraft(draftId, 'dashboard', editedBody || custom_body || undefined);
        return NextResponse.json({ ok: true, message: 'Borrador aprobado y enviado' });
      case 'reject':
        await rejectDraft(draftId);
        return NextResponse.json({ ok: true, message: 'Borrador rechazado' });
      case 'schedule': {
        if (!scheduled_at) return NextResponse.json({ error: 'scheduled_at requerido' }, { status: 400 });
        await scheduleDraft(draftId, scheduled_at, editedBody || custom_body || undefined);
        return NextResponse.json({ ok: true, message: 'Borrador programado' });
      }
      case 'cancel_schedule':
        await cancelScheduledDraft(draftId);
        return NextResponse.json({ ok: true, message: 'Programación cancelada' });
      default:
        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}
