// ============================================================================
// GET /api/admin/molly/threads/[id]
// Detalle de un hilo de Molly Mail: hilo + mensajes completos (body_html
// sanitizado server-side) + borradores del hilo con su status.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { getThreadDetail, MollyError } from '@/lib/services/molly.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Id de hilo no válido' }, { status: 400 });
    }

    const data = await getThreadDetail(id);
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof MollyError ? err.message
      : err instanceof Error ? err.message
      : 'Error consultando el hilo';
    const status = err instanceof MollyError ? 404 : 500;
    console.error('[threads/detalle] Error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
