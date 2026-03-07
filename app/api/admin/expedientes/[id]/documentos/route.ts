// ============================================================================
// GET /api/admin/expedientes/[id]/documentos — List documents linked to expediente
// POST — Link existing document to expediente
// DELETE — Unlink document from expediente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type RouteParams = { params: Promise<{ id: string }> };

const db = () => createAdminClient();

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { data, error } = await db()
      .from('documentos')
      .select('id, titulo, tipo, nombre_archivo, nombre_original, fecha_documento, numero_documento, archivo_url, estado, archivo_tamano, created_at')
      .eq('expediente_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (body.accion === 'vincular' && body.documento_id) {
      const { error } = await db()
        .from('documentos')
        .update({ expediente_id: id, updated_at: new Date().toISOString() })
        .eq('id', body.documento_id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (body.accion === 'desvincular' && body.documento_id) {
      const { error } = await db()
        .from('documentos')
        .update({ expediente_id: null, updated_at: new Date().toISOString() })
        .eq('id', body.documento_id)
        .eq('expediente_id', id);

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
