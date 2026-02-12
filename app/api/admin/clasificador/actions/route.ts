// ============================================================================
// POST /api/admin/clasificador/actions
// Proxy seguro al Edge Function clasificar-documentos
// (El browser no tiene JWT de Supabase — usamos service role key)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, documento_ids, cliente_id, tipo } = body;

    // Validate required fields
    if (!action || !Array.isArray(documento_ids) || documento_ids.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere action y documento_ids[].' },
        { status: 400 }
      );
    }

    if (action === 'asignar' && !cliente_id) {
      return NextResponse.json(
        { error: 'Se requiere cliente_id para asignar.' },
        { status: 400 }
      );
    }

    if (action === 'cambiar_tipo' && !tipo) {
      return NextResponse.json(
        { error: 'Se requiere tipo para cambiar_tipo.' },
        { status: 400 }
      );
    }

    // Call Edge Function
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/clasificar-documentos`;
    const res = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action, documento_ids, cliente_id, tipo }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? `Edge Function error ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Clasificador Actions] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al procesar acción.' },
      { status: 500 }
    );
  }
}
