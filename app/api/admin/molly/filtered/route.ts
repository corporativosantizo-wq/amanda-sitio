// ============================================================================
// /api/admin/molly/filtered
// GET — listar emails filtrados | POST — restaurar un email filtrado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getFilteredEmails, restoreFilteredEmail } from '@/lib/services/molly.service';

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const data = await getFilteredEmails();
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { threadId } = await req.json();
    if (!threadId) {
      return NextResponse.json({ error: 'threadId requerido' }, { status: 400 });
    }
    await restoreFilteredEmail(threadId);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
