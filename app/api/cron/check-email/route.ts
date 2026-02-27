// ============================================================================
// GET /api/cron/check-email
// Cron job: revisa emails nuevos, clasifica con IA, genera borradores
// Vercel cron: cada 2 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { checkAndProcessEmails } from '@/lib/services/molly.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await checkAndProcessEmails();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron check-email] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
