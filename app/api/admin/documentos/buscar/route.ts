// ============================================================================
// GET /api/admin/documentos/buscar
// Búsqueda global de documentos usando la función RPC buscar_documentos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;

    const limite = parseInt(s.get('limite') ?? '50');
    const offset = parseInt(s.get('offset') ?? '0');

    const params: Record<string, unknown> = {
      p_query: s.get('q') || '',
      p_tipo: s.get('tipo') || null,
      p_cliente_id: s.get('cliente_id') || null,
      p_fecha_desde: s.get('fecha_desde') || null,
      p_fecha_hasta: s.get('fecha_hasta') || null,
      p_limite: limite,
      p_offset: offset,
    };

    const { data, error } = await createAdminClient().rpc('buscar_documentos', params);

    if (error) {
      console.error('Error en buscar_documentos RPC:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results = data ?? [];
    const page = Math.floor(offset / limite) + 1;

    // Si devuelve exactamente `limite` resultados, puede haber más páginas
    const hasMore = results.length === limite;

    return NextResponse.json({
      data: results,
      page,
      limit: limite,
      hasMore,
      total: hasMore ? offset + limite + 1 : offset + results.length,
    });
  } catch (err: any) {
    console.error('Error en búsqueda de documentos:', err);
    return NextResponse.json({ error: 'Error interno en búsqueda' }, { status: 500 });
  }
}
