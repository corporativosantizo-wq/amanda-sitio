// ============================================================================
// GET /api/admin/jurisprudencia/stats
// Estadísticas de tomos procesados y fragmentos indexados
// ============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const [tomosRes, fragmentosRes] = await Promise.all([
      supabase
        .from('jurisprudencia_tomos')
        .select('*', { count: 'exact', head: true })
        .eq('procesado', true),
      supabase
        .from('jurisprudencia_fragmentos')
        .select('*', { count: 'exact', head: true }),
    ]);

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
