// ============================================================================
// GET /api/cron/recordatorios
// Cron job: envía recordatorios 24h/1h, auto-completa citas pasadas
// Vercel cron: cada 30 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarRecordatorios } from '@/lib/services/citas.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await enviarRecordatorios();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron Recordatorios] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
