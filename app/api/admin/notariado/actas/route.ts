// ============================================================================
// GET /api/admin/notariado/actas
// Lista documentos notariales desde legal.documentos
// (tipo = 'acta_notarial' | 'escritura_publica')
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

const TIPOS_NOTARIALES = ['acta_notarial', 'escritura_publica'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo');
    const busqueda = searchParams.get('q');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '30');
    const offset = (page - 1) * limit;

    let query = db()
      .from('documentos')
      .select(`
        id, codigo_documento, titulo, tipo, estado,
        nombre_archivo, archivo_url, archivo_tamano,
        fecha_documento, numero_documento, descripcion,
        cliente_id, partes, notas,
        created_at, updated_at,
        cliente:clientes!cliente_id(id, codigo, nombre)
      `, { count: 'exact' })
      .in('tipo', tipo ? [tipo] : TIPOS_NOTARIALES)
      .order('fecha_documento', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (busqueda) {
      query = query.or(
        `titulo.ilike.%${busqueda}%,numero_documento.ilike.%${busqueda}%,nombre_archivo.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`
      );
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      data: data ?? [],
      total: count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((count ?? 0) / limit),
    });
  } catch (err: any) {
    console.error('[Notariado/Actas] Error:', err);
    return NextResponse.json({ error: 'Error al listar documentos notariales' }, { status: 500 });
  }
}
