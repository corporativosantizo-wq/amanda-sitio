// ============================================================================
// app/api/admin/fiscalias/route.ts
// GET: Buscar fiscalías del Ministerio Público (legal.fiscalias_mp)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const q = s.get('q')?.trim() ?? '';
    const departamento = s.get('departamento') ?? '';
    const tipo = s.get('tipo') ?? '';
    const limit = Math.min(parseInt(s.get('limit') ?? '10'), 30);

    if (q.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const db = createAdminClient();
    let query = db
      .from('fiscalias_mp')
      .select('id, nombre, tipo, departamento, municipio, telefono_extension')
      .ilike('nombre', `%${q}%`)
      .limit(limit);

    if (departamento) {
      query = query.eq('departamento', departamento);
    }

    if (tipo) {
      query = query.eq('tipo', tipo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error buscando fiscalías:', error);
      return NextResponse.json({ error: 'Error al buscar fiscalías' }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error('Error en /api/admin/fiscalias:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
