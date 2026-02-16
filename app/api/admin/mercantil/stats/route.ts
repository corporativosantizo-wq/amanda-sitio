// ============================================================================
// app/api/admin/mercantil/stats/route.ts
// GET: Estadísticas para dashboard mercantil
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  estadisticasMercantiles, tramitesMercantilesPorVencer,
  tramitesMercantilesVencidos, MercantilError,
} from '@/lib/services/mercantil.service';

export async function GET(req: NextRequest) {
  try {
    const dias = parseInt(req.nextUrl.searchParams.get('dias') ?? '30');

    const [stats, porVencer, vencidos] = await Promise.all([
      estadisticasMercantiles(),
      tramitesMercantilesPorVencer(dias),
      tramitesMercantilesVencidos(),
    ]);

    return NextResponse.json({ stats, por_vencer: porVencer, vencidos });
  } catch (err) {
    const msg = err instanceof MercantilError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
