// ============================================================================
// GET /api/admin/jurisprudencia/procesar-token
// Returns Edge Function URL + service role key for direct invocation.
// This lightweight route returns instantly — the actual processing happens
// client → Edge Function directly, bypassing Vercel's timeout.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json(
      { error: 'Configuración del servidor incompleta.' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    edge_url: `${url}/functions/v1/procesar-tomo`,
    token: key,
  });
}
