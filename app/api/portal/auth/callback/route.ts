// ============================================================================
// GET /api/portal/auth/callback
// Redirige al handler client-side que establece la sesión
// ============================================================================
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = new URL('/portal/auth/callback', url.origin);

  // Pasar parámetros de auth al handler client-side
  url.searchParams.forEach((val: string, key: string) => {
    callbackUrl.searchParams.set(key, val);
  });

  return NextResponse.redirect(callbackUrl.toString());
}
