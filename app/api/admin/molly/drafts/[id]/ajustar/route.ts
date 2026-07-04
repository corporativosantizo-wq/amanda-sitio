// ============================================================================
// POST /api/admin/molly/drafts/[id]/ajustar
// Regenera un borrador de respuesta pendiente con IA siguiendo una instrucción
// del despacho (contexto: correo original + hilo). El resultado queda como
// borrador 'pendiente' editable — NUNCA se envía desde aquí.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { regenerateDraft, MollyError } from '@/lib/services/molly.service';
import { esCuentaValida } from '@/lib/config/cuentas-correo';
import type { MailboxAlias } from '@/lib/services/outlook.service';

// La regeneración con IA (Anthropic) tarda varios segundos; el default de
// Vercel (~10-15s) no alcanza. Mismo límite que el resto de endpoints de IA.
export const maxDuration = 120;

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await req.json();

    const instruccion = String(body?.instruccion ?? '').trim();
    if (!instruccion) {
      return NextResponse.json({ error: 'Falta la instrucción para la IA.' }, { status: 400 });
    }

    const account = body?.account ? String(body.account) : undefined;
    if (account && !esCuentaValida(account)) {
      return NextResponse.json({ error: 'Cuenta emisora no válida.' }, { status: 400 });
    }

    const currentBody =
      typeof body?.currentBody === 'string' && body.currentBody.trim()
        ? body.currentBody
        : undefined;

    const draft = await regenerateDraft(id, instruccion, currentBody, account as MailboxAlias | undefined);
    return NextResponse.json({ data: draft });
  } catch (err) {
    const msg = err instanceof MollyError ? err.message
      : err instanceof Error ? err.message
      : 'Error al ajustar el borrador con IA';
    const status = err instanceof MollyError ? 400 : 500;
    console.error('[drafts/ajustar] Error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
