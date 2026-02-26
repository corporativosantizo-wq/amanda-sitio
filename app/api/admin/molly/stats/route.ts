// ============================================================================
// GET /api/admin/molly/stats
// Dashboard stats para Molly Mail
// ============================================================================

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getStats } from '@/lib/services/molly.service';

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const stats = await getStats();
    return NextResponse.json(stats);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
