// ============================================================================
// GET /api/cron/enviar-correos
// Cron job: envía correos programados cuya fecha ya pasó
// Vercel cron: cada 15 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarCorreosProgramados } from '@/lib/services/comunicaciones.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await enviarCorreosProgramados();
    console.log('[Cron Correos] Resultado:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron Correos] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
