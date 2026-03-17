// ============================================================================
// POST /api/admin/documentos/vincular-expediente
// Vincula múltiples documentos a un expediente en batch
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { documento_ids, expediente_id } = await req.json() as {
      documento_ids: string[];
      expediente_id: string;
    };

    if (!Array.isArray(documento_ids) || documento_ids.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un documento' }, { status: 400 });
    }

    if (!expediente_id) {
      return NextResponse.json({ error: 'Se requiere expediente_id' }, { status: 400 });
    }

    const db = createAdminClient();

    // Verify expediente exists
    const { data: exp, error: expErr } = await db
      .from('expedientes')
      .select('id, numero_expediente')
      .eq('id', expediente_id)
      .single();

    if (expErr || !exp) {
      return NextResponse.json({ error: 'Expediente no encontrado' }, { status: 404 });
    }

    // Update all documents in batch
    const { error: updateErr, count } = await db
      .from('documentos')
      .update({
        expediente_id,
        updated_at: new Date().toISOString(),
      })
      .in('id', documento_ids);

    if (updateErr) {
      console.error('[vincular-expediente] Error:', updateErr);
      return NextResponse.json({ error: 'Error al vincular documentos' }, { status: 500 });
    }

    console.log(`[vincular-expediente] ${count ?? documento_ids.length} documentos vinculados al expediente ${exp.numero_expediente}`);

    return NextResponse.json({
      ok: true,
      vinculados: count ?? documento_ids.length,
      expediente: exp.numero_expediente,
    });
  } catch (err: any) {
    console.error('[vincular-expediente] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
