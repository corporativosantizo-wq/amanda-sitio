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

import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function POST(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

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
