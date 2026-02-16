// ============================================================================
// app/api/admin/laboral/stats/route.ts
// GET: Estadísticas para dashboard laboral
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  estadisticasLaborales, tramitesLaboralesPorVencer,
  tramitesLaboralesVencidos, LaboralError,
} from '@/lib/services/laboral.service';

export async function GET(req: NextRequest) {
  try {
    const dias = parseInt(req.nextUrl.searchParams.get('dias') ?? '30');

    const [stats, porVencer, vencidos] = await Promise.all([
      estadisticasLaborales(),
      tramitesLaboralesPorVencer(dias),
      tramitesLaboralesVencidos(),
    ]);

    return NextResponse.json({ stats, por_vencer: porVencer, vencidos });
  } catch (err) {
    const msg = err instanceof LaboralError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
