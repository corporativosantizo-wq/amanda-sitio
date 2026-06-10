// ============================================================================
// GET /api/cron/mensajes-telegram
// Cron job dinámico: procesa legal.mensajes_programados_telegram y envía
// los mensajes cuya hora de envío coincide con la hora actual GT (±7 min).
// Vercel cron: */15 * * * *  (cada 15 min)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { processScheduledMessages } from '@/lib/services/mensajes-telegram.service';

// El reporte astrológico ({reporte_astrologico}) usa la API de Anthropic con
// web_search + thinking adaptativo, lo cual puede tardar bastante. La generación
// tiene un deadline interno de 70s; dejamos 90s de función de holgura.
export const maxDuration = 90;

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await processScheduledMessages();
    console.log(
      `[mensajes-telegram] activos=${result.total} evaluados=${result.evaluados} ` +
      `enviados=${result.enviados} errores=${result.errores.length}`,
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[mensajes-telegram] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    );
  }
}
