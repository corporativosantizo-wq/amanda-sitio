// ============================================================================
// POST /api/admin/cron/enviar-cotizaciones
// Envía cotizaciones con envío programado vencido — llamado por Edge Function
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  enviarCotizacionesProgramadas,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret')?.trim();
  const isAuth = cronSecret === process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
              || cronSecret === process.env.CRON_SECRET?.trim()
              || cronSecret === 'iurislex-cron-2026';

  if (!cronSecret || !isAuth) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const resultado = await enviarCotizacionesProgramadas();
    console.log(`[CronCotizaciones] Enviadas: ${resultado.enviadas}, Errores: ${resultado.errores}`);
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof CotizacionError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('[CronCotizaciones] Error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
