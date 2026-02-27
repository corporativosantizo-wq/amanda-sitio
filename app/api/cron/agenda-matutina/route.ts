// ============================================================================
// GET /api/cron/agenda-matutina
// Cron job: envía agenda del día por Telegram a las 7:30 AM Guatemala
// Vercel cron: 30 13 * * 1-5 (7:30 AM GT = 13:30 UTC, lun-vie)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { getAgenda } from '@/lib/services/molly.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const msg = await getAgenda('hoy');
    await sendTelegramMessage(
      `\u2615 <b>Buenos días, Amanda</b>\n\n${msg}`,
      { parse_mode: 'HTML' },
    );

    return NextResponse.json({ ok: true, sent: true });
  } catch (err: any) {
    console.error('[Cron agenda-matutina] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
