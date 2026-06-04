// ============================================================================
// GET /api/admin/jurisprudencia/procesar-token
// Returns the Edge Function URL + the ANON key for direct invocation from the
// browser (bypassing Vercel's timeout). The Edge Function `procesar-tomo` runs
// on Supabase with its OWN service_role env to do privileged work, so the
// caller only needs a valid JWT (the public anon key) — we NEVER ship the
// service_role key to the browser.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Anon key (público por diseño) para invocar la Edge Function; jamás el service_role.
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
