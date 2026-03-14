// ============================================================================
// POST /api/admin/jurisprudencia/procesar
// Proxy seguro al Edge Function procesar-tomo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';

export const maxDuration = 300; // 5 min — Vercel Pro

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const { tomo_id } = body;

    if (!tomo_id) {
      return NextResponse.json(
        { error: 'Se requiere tomo_id.' },
        { status: 400 }
      );
    }

    console.log('[Procesar Tomo] Invocando Edge Function para tomo_id:', tomo_id);

    const edgeUrl = `${SUPABASE_URL}/functions/v1/procesar-tomo`;
    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ tomo_id }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('[Procesar Tomo] Edge Function error:', {
        status: res.status,
        tomo_id,
        error: data.error,
        url: edgeUrl,
      });
      // Return 502 (bad gateway) instead of forwarding the Edge Function status,
      // so the client can distinguish Vercel errors from upstream errors.
      return NextResponse.json(
        { error: data.error ?? `Error del procesador (${res.status})`, source: 'edge_function', upstream_status: res.status },
        { status: 502 }
      );
    }

    console.log('[Procesar Tomo] OK:', { tomo_id, pages: data.pages, fragmentos: data.fragmentos });
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Procesar Tomo] Error:', error);
    return NextResponse.json(
      { error: error.message ?? 'Error al procesar tomo.', source: 'api_route' },
      { status: 500 }
    );
  }
}
