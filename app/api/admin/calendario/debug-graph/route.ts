// ============================================================================
// GET /api/admin/calendario/debug-graph
// Debug: prueba directa a Graph API con app token (client_credentials)
// para diagnosticar el 403 en Calendar
// ============================================================================

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function getAppTokenDirect() {
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const clientSecret = process.env.AZURE_CLIENT_SECRET!;

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    return { error: true, status: res.status, body: text };
  }
  return { error: false, ...JSON.parse(text) };
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function testGraphEndpoint(
  token: string,
  url: string
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.substring(0, 1000);
    }
    return { status: res.status, body };
  } catch (err: any) {
    return { status: 0, body: { fetch_error: err.message } };
  }
}

export async function GET() {
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // ── 1. Obtener app token ──────────────────────────────────────────────────
  console.log('[debug-graph] ── INICIO ──');

  const tokenResult = await getAppTokenDirect();
  if (tokenResult.error) {
    results.token = {
      status: 'ERROR',
      http_status: tokenResult.status,
      body: tokenResult.body,
    };
    console.error('[debug-graph] ERROR obteniendo token:', tokenResult.body);
    return NextResponse.json(results, { headers: { 'Cache-Control': 'no-store' } });
  }

  const appToken = tokenResult.access_token as string;
  console.log('[debug-graph] Token obtenido OK');

  // ── 2. Decodificar JWT para ver roles/scopes ──────────────────────────────
  const jwt = decodeJwtPayload(appToken);
  results.token_info = {
    status: 'OK',
    app_id: jwt?.appid ?? jwt?.azp ?? 'unknown',
    tenant: jwt?.tid ?? 'unknown',
    roles: jwt?.roles ?? [],
    scp: jwt?.scp ?? null,
    aud: jwt?.aud ?? 'unknown',
    iss: jwt?.iss ?? 'unknown',
    exp: jwt?.exp
      ? new Date((jwt.exp as number) * 1000).toISOString()
      : 'unknown',
  };
  console.log('[debug-graph] Token roles:', JSON.stringify(jwt?.roles ?? []));
  console.log('[debug-graph] Token scp:', jwt?.scp ?? 'null (esperado para client_credentials)');

  // ── 3. Test: GET /users/amanda@papeleo.legal ──────────────────────────────
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const users = ['amanda@papeleo.legal', 'asistente@papeleo.legal'];

  for (const upn of users) {
    console.log(`[debug-graph] ── Probando usuario: ${upn} ──`);

    // 3a. User profile
    const userUrl = `${GRAPH}/users/${upn}`;
    console.log(`[debug-graph] GET ${userUrl}`);
    const userResult = await testGraphEndpoint(appToken, userUrl);
    console.log(`[debug-graph] → status: ${userResult.status}`);
    console.log(`[debug-graph] → body: ${JSON.stringify(userResult.body).substring(0, 500)}`);
    results[`user_profile_${upn}`] = {
      url: userUrl,
      status: userResult.status,
      body: userResult.body,
    };

    // 3b. Calendar (solo si el perfil funcionó o incluso si no, para ver el error)
    const calendarUrl = `${GRAPH}/users/${upn}/calendar`;
    console.log(`[debug-graph] GET ${calendarUrl}`);
    const calResult = await testGraphEndpoint(appToken, calendarUrl);
    console.log(`[debug-graph] → status: ${calResult.status}`);
    console.log(`[debug-graph] → body: ${JSON.stringify(calResult.body).substring(0, 500)}`);
    results[`calendar_${upn}`] = {
      url: calendarUrl,
      status: calResult.status,
      body: calResult.body,
    };

    // 3c. Calendar events (última semana)
    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 7);
    const eventsUrl = `${GRAPH}/users/${upn}/calendarView?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}&$select=id,subject,start,end&$top=5`;
    console.log(`[debug-graph] GET ${eventsUrl}`);
    const evResult = await testGraphEndpoint(appToken, eventsUrl);
    console.log(`[debug-graph] → status: ${evResult.status}`);
    console.log(`[debug-graph] → body: ${JSON.stringify(evResult.body).substring(0, 500)}`);
    results[`calendarView_${upn}`] = {
      url: eventsUrl,
      status: evResult.status,
      body: evResult.body,
    };
  }

  // ── 4. También probar con delegated token (el actual) ─────────────────────
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const { decrypt } = await import('@/lib/crypto');
    const db = createAdminClient();

    const { data: config } = await db
      .from('configuracion')
      .select('outlook_access_token_encrypted, outlook_token_expires_at')
      .limit(1)
      .single();

    if (config?.outlook_access_token_encrypted) {
      const delegatedToken = decrypt(config.outlook_access_token_encrypted);
      const delegatedJwt = decodeJwtPayload(delegatedToken);

      results.delegated_token_info = {
        present: true,
        expires_at: config.outlook_token_expires_at,
        expired: config.outlook_token_expires_at
          ? new Date(config.outlook_token_expires_at) < new Date()
          : null,
        scp: delegatedJwt?.scp ?? null,
        roles: delegatedJwt?.roles ?? [],
        upn: delegatedJwt?.upn ?? delegatedJwt?.unique_name ?? 'unknown',
      };
      console.log('[debug-graph] Delegated token scopes:', delegatedJwt?.scp);
      console.log('[debug-graph] Delegated token upn:', delegatedJwt?.upn ?? delegatedJwt?.unique_name);
      console.log('[debug-graph] Delegated token expired:', config.outlook_token_expires_at ? new Date(config.outlook_token_expires_at) < new Date() : 'unknown');

      // Test /me con delegated token
      const meResult = await testGraphEndpoint(delegatedToken, `${GRAPH}/me`);
      results.delegated_me = {
        status: meResult.status,
        body: meResult.body,
      };
      console.log(`[debug-graph] Delegated /me status: ${meResult.status}`);

      // Test /me/calendar con delegated token
      const meCalResult = await testGraphEndpoint(delegatedToken, `${GRAPH}/me/calendar`);
      results.delegated_me_calendar = {
        status: meCalResult.status,
        body: meCalResult.body,
      };
      console.log(`[debug-graph] Delegated /me/calendar status: ${meCalResult.status}`);
    } else {
      results.delegated_token_info = { present: false };
    }
  } catch (err: any) {
    results.delegated_token_info = { error: err.message };
  }

  console.log('[debug-graph] ── FIN ──');

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
