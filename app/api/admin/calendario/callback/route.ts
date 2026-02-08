// ============================================================================
// GET /api/admin/calendario/callback
// Recibe el code de Microsoft OAuth, intercambia por tokens
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, OutlookError } from '@/lib/services/outlook.service';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  if (error) {
    console.error('[Outlook Callback] Error de OAuth:', error);
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=oauth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=no_code`);
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(`${baseUrl}/admin/calendario?connected=true`);
  } catch (err) {
    console.error('[Outlook Callback] Error:', err instanceof OutlookError ? err.details : err);
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=token_exchange`);
  }
}
