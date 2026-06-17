// ============================================================================
// POST /api/admin/molly/salientes/[id]/enviar
// Envía un correo saliente vía Microsoft Graph desde la cuenta indicada.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { enviarSaliente, SalienteError } from '@/lib/services/salientes.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const data = await enviarSaliente(id);
    return NextResponse.json({ data, ok: true });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message : 'Error al enviar el correo';
    const status = err instanceof SalienteError ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
