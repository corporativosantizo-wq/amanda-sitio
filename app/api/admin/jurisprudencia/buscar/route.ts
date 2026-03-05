// ============================================================================
// POST /api/admin/jurisprudencia/buscar
// Proxy seguro al Edge Function buscar-jurisprudencia
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, threshold, limit } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Se requiere una consulta de búsqueda.' },
        { status: 400 }
      );
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/buscar-jurisprudencia`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        query: query.trim(),
        ...(threshold !== undefined && { threshold }),
        ...(limit !== undefined && { limit }),
      }),
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
    console.error('[Buscar Jurisprudencia] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al buscar jurisprudencia.' },
      { status: 500 }
    );
  }
}
