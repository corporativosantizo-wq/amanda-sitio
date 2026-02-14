// ============================================================================
// POST /api/admin/jurisprudencia/procesar
// Proxy seguro al Edge Function procesar-tomo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 min — Vercel Pro

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tomo_id } = body;

    if (!tomo_id) {
      return NextResponse.json(
        { error: 'Se requiere tomo_id.' },
        { status: 400 }
      );
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/procesar-tomo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ tomo_id }),
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
    console.error('[Procesar Tomo] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al procesar tomo.' },
      { status: 500 }
    );
  }
}
