// ============================================================================
// POST /api/admin/molly/threads/[id]/generar-respuesta
// Genera con IA un borrador de respuesta on-demand para un hilo. El resultado
// queda como email_drafts 'pendiente' (editable en el dashboard) — NUNCA se
// envía desde aquí. Idempotente: si el hilo ya tiene un borrador pendiente o
// programado, devuelve ese con existente: true.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createDraftForThread, MollyError } from '@/lib/services/molly.service';

// La generación con IA (Anthropic) tarda varios segundos; el default de
// Vercel no alcanza. Mismo límite que el resto de endpoints de IA.
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Id de hilo no válido' }, { status: 400 });
    }

    const { draft, existente } = await createDraftForThread(id);
    return NextResponse.json({ data: draft, existente });
  } catch (err) {
    const msg = err instanceof MollyError ? err.message
      : err instanceof Error ? err.message
      : 'Error generando la respuesta';
    const status = err instanceof MollyError
      ? (err.message.includes('no encontrado') ? 404 : 400)
      : 500;
    console.error('[threads/generar-respuesta] Error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
