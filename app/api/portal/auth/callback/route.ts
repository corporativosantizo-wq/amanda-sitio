// ============================================================================
// GET /api/portal/auth/callback
// Redirige al handler client-side que establece la sesión
// ============================================================================
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const callbackUrl = new URL('/portal/auth/callback', url.origin);

  // Pasar solo parámetros de auth permitidos al handler client-side
  const allowedParams = [
    'access_token', 'refresh_token', 'token_type', 'expires_in', 'expires_at',
    'type', 'error', 'error_code', 'error_description',
  ];
  url.searchParams.forEach((val: string, key: string) => {
    if (allowedParams.includes(key)) {
      callbackUrl.searchParams.set(key, val);
    }
  });

  return NextResponse.redirect(callbackUrl.toString());
}
