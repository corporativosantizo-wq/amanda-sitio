// ============================================================================
// GET /api/admin/jurisprudencia/stats
// Estadísticas de tomos procesados y fragmentos indexados
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminClient();
    const fuente = req.nextUrl.searchParams.get('fuente');

    let tomosQuery = supabase
      .from('jurisprudencia_tomos')
      .select('*', { count: 'exact', head: true })
      .eq('procesado', true);
    if (fuente) tomosQuery = tomosQuery.eq('fuente', fuente);

    // For fragments, join through tomos to filter by fuente
    let fragmentosQuery = supabase
      .from('jurisprudencia_fragmentos')
      .select('*, tomo:jurisprudencia_tomos!tomo_id(fuente)', { count: 'exact', head: true });
    if (fuente) {
      // Use inner join filter: only count fragments whose tomo has matching fuente
      fragmentosQuery = supabase
        .from('jurisprudencia_fragmentos')
        .select('*, tomo:jurisprudencia_tomos!inner(fuente)', { count: 'exact', head: true })
        .eq('tomo.fuente', fuente);
    }

    const [tomosRes, fragmentosRes] = await Promise.all([tomosQuery, fragmentosQuery]);

    return NextResponse.json({
      tomos_procesados: tomosRes.count ?? 0,
      fragmentos_indexados: fragmentosRes.count ?? 0,
    });
  } catch (error: any) {
    console.error('[Jurisprudencia Stats] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al obtener estadísticas.' },
      { status: 500 }
    );
  }
}
