// ============================================================================
// GET /api/cron/salientes-programados
// Cron job: envía los correos salientes programados cuya fecha ya venció.
// Vercel cron: cada 15 minutos.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarProgramadosVencidos } from '@/lib/services/salientes.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';

// El envío intercala un delay de ~2.5s entre correos; necesita más tiempo que
// el default serverless.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await enviarProgramadosVencidos();
    console.log('[Cron Salientes] Resultado:', result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[Cron Salientes] Error:', err);
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
