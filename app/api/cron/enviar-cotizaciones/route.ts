// ============================================================================
// GET /api/cron/enviar-cotizaciones
// Cron job: envía cotizaciones con envío programado cuya fecha ya pasó
// Vercel cron: cada 15 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarCotizacionesProgramadas } from '@/lib/services/cotizaciones.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await enviarCotizacionesProgramadas();
    console.log('[Cron Cotizaciones] Resultado:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[Cron Cotizaciones] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
