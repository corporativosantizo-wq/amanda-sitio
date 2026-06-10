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

// {reporte_astrologico} genera el reporte con la API de Anthropic (web_search +
// thinking adaptativo), que puede tardar. La generación tiene un deadline interno
// de 70s; dejamos 90s de función para que un timeout produzca fallback, no 504.
export const maxDuration = 90;

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
