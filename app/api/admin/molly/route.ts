// ============================================================================
// /api/admin/molly
// GET — listar threads | POST — trigger manual de check
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { listThreads, checkAndProcessEmails } from '@/lib/services/molly.service';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const url = new URL(req.url);
    const result = await listThreads({
      status: url.searchParams.get('status') || undefined,
      clasificacion: url.searchParams.get('clasificacion') || undefined,
      page: Number(url.searchParams.get('page')) || 1,
      limit: Number(url.searchParams.get('limit')) || 20,
      busqueda: url.searchParams.get('q') || undefined,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const result = await checkAndProcessEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
