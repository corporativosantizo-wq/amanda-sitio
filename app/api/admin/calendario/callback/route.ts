// ============================================================================
// GET /api/admin/calendario/callback
// Recibe el code de Microsoft OAuth, intercambia por tokens
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, OutlookError } from '@/lib/services/outlook.service';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const errorDesc = req.nextUrl.searchParams.get('error_description');

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  console.log('[Outlook Callback] ── Request recibido ──');
  console.log('[Outlook Callback] URL completa:', req.nextUrl.pathname + '?' + req.nextUrl.searchParams.toString().substring(0, 200));
  console.log('[Outlook Callback] Code presente:', !!code);
  console.log('[Outlook Callback] Error presente:', !!error, error ?? '');
  console.log('[Outlook Callback] NEXT_PUBLIC_SITE_URL:', baseUrl);

  if (error) {
    console.error('[Outlook Callback] OAuth error:', error, errorDesc);
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=oauth_denied`);
  }

  if (!code) {
    console.error('[Outlook Callback] No code en los query params');
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=no_code`);
  }

  try {
    console.log('[Outlook Callback] Iniciando intercambio de tokens...');
    await exchangeCodeForTokens(code);
    console.log('[Outlook Callback] ── Éxito, redirigiendo a /admin/calendario?connected=true ──');
    return NextResponse.redirect(`${baseUrl}/admin/calendario?connected=true`);
  } catch (err) {
    if (err instanceof OutlookError) {
      console.error('[Outlook Callback] OutlookError:', err.message);
      console.error('[Outlook Callback] Detalles:', err.details);
    } else {
      console.error('[Outlook Callback] Error inesperado:', err);
    }
    return NextResponse.redirect(`${baseUrl}/admin/calendario?error=token_exchange`);
  }
}
