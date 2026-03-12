// ============================================================================
// app/api/admin/expedientes/stats/route.ts
// GET: Estadísticas para dashboard y reportes
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  estadisticasExpedientes, plazosProximos, plazosVencidos, ExpedienteError,
} from '@/lib/services/expedientes.service';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const dias = parseInt(req.nextUrl.searchParams.get('dias') ?? '7');

    const [stats, proximos, vencidos] = await Promise.all([
      estadisticasExpedientes(),
      plazosProximos(dias),
      plazosVencidos(),
    ]);

    return NextResponse.json({ stats, plazos_proximos: proximos, plazos_vencidos: vencidos });
  } catch (err) {
    if (err instanceof ExpedienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'expedientes/stats');
  }
}
