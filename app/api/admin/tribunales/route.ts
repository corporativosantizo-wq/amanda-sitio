// ============================================================================
// app/api/admin/tribunales/route.ts
// GET: Buscar tribunales del Organismo Judicial (legal.tribunales_oj)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const INSTANCIA_TO_TIPO: Record<string, string> = {
  juzgado_paz: 'juzgado_paz',
  juzgado_primera_instancia: 'juzgado_primera_instancia',
  sala_apelaciones: 'sala_apelaciones',
  tribunal_sentencia: 'tribunal_sentencia',
};

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const q = s.get('q')?.trim() ?? '';
    const instancia = s.get('instancia') ?? '';
    const departamento = s.get('departamento') ?? '';
    const limit = Math.min(parseInt(s.get('limit') ?? '10'), 30);

    if (q.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const db = createAdminClient();
    let query = db
      .from('tribunales_oj')
      .select('id, nombre, tipo, ramo, departamento, municipio, telefono')
      .ilike('nombre', `%${q}%`)
      .limit(limit);

    const tipoFiltro = INSTANCIA_TO_TIPO[instancia];
    if (tipoFiltro) {
      query = query.eq('tipo', tipoFiltro);
    }

    if (departamento) {
      query = query.eq('departamento', departamento);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error buscando tribunales:', error);
      return NextResponse.json({ error: 'Error al buscar tribunales' }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error('Error en /api/admin/tribunales:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
