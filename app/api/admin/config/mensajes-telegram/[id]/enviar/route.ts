// ============================================================================
// POST /api/admin/config/mensajes-telegram/[id]/enviar
// "Enviar ahora" — dispara el mensaje al destino configurado de inmediato.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  enviarAhora,
  MensajeTelegramError,
} from '@/lib/services/mensajes-telegram.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    const result = await enviarAhora(id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'config/mensajes-telegram/[id]/enviar');
  }
}
