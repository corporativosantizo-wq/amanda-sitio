// ============================================================================
// GET /api/admin/calendario/diagnostico
// Diagnóstico de conexión Outlook — tokens, Graph API, calendarios, eventos
// ============================================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { decrypt } from '@/lib/crypto';

export async function GET() {
  const diag: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {},
    tokens: {},
    decrypt: {},
    graph_me: {},
    calendars: {},
    events: {},
  };

  // 0. Env vars
  diag.env = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'NOT SET',
    VERCEL_URL: process.env.VERCEL_URL ?? 'NOT SET',
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID ? process.env.AZURE_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET',
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID ? process.env.AZURE_TENANT_ID.substring(0, 8) + '...' : 'NOT SET',
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET ? 'SET (' + process.env.AZURE_CLIENT_SECRET.length + ' chars)' : 'NOT SET',
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ? 'SET (' + process.env.ENCRYPTION_KEY.length + ' chars)' : 'NOT SET',
  };

  // 1. Read tokens from DB
  try {
    const db = createAdminClient();
    const { data: config, error } = await db
      .from('configuracion')
      .select('id, outlook_access_token_encrypted, outlook_refresh_token_encrypted, outlook_token_expires_at')
      .limit(1)
      .single();

    if (error) {
      diag.tokens = { error: error.message, code: error.code };
      return NextResponse.json(diag);
    }

    diag.tokens = {
      row_id: config?.id ?? 'NULL',
      access_token_encrypted: config?.outlook_access_token_encrypted
        ? config.outlook_access_token_encrypted.substring(0, 10) + '... (' + config.outlook_access_token_encrypted.length + ' chars)'
        : 'NULL',
      refresh_token_encrypted: config?.outlook_refresh_token_encrypted
        ? config.outlook_refresh_token_encrypted.substring(0, 10) + '... (' + config.outlook_refresh_token_encrypted.length + ' chars)'
        : 'NULL',
      expires_at: config?.outlook_token_expires_at ?? 'NULL',
      expired: config?.outlook_token_expires_at
        ? new Date(config.outlook_token_expires_at) < new Date()
        : null,
    };

    if (!config?.outlook_access_token_encrypted) {
      diag.decrypt = { status: 'SKIP — no access_token in DB' };
      diag.graph_me = { status: 'SKIP' };
      diag.calendars = { status: 'SKIP' };
      diag.events = { status: 'SKIP' };
      return NextResponse.json(diag);
    }

    // 2. Decrypt
    let accessToken: string;
    try {
      accessToken = decrypt(config.outlook_access_token_encrypted);
      diag.decrypt = {
        status: 'OK',
        token_preview: accessToken.substring(0, 10) + '... (' + accessToken.length + ' chars)',
        looks_like_jwt: accessToken.startsWith('eyJ'),
      };
    } catch (err: any) {
      diag.decrypt = { status: 'ERROR', message: err.message };
      diag.graph_me = { status: 'SKIP — decrypt failed' };
      diag.calendars = { status: 'SKIP' };
      diag.events = { status: 'SKIP' };
      return NextResponse.json(diag);
    }

    const headers = { Authorization: `Bearer ${accessToken}` };

    // 3. GET /me
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me', { headers });
      const body = await res.text();
      if (res.ok) {
        const me = JSON.parse(body);
        diag.graph_me = {
          status: res.status,
          displayName: me.displayName,
          mail: me.mail,
          userPrincipalName: me.userPrincipalName,
        };
      } else {
        diag.graph_me = { status: res.status, error: body.substring(0, 500) };
      }
    } catch (err: any) {
      diag.graph_me = { status: 'FETCH_ERROR', message: err.message };
    }

    // 4. GET /me/calendars
    try {
      const res = await fetch('https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,color&$top=50', { headers });
      const body = await res.text();
      if (res.ok) {
        const data = JSON.parse(body);
        const cals = data.value ?? [];
        diag.calendars = {
          status: res.status,
          count: cals.length,
          list: cals.map((c: any) => ({ name: c.name, color: c.color, id_preview: c.id.substring(0, 20) + '...' })),
        };
      } else {
        diag.calendars = { status: res.status, error: body.substring(0, 500) };
      }
    } catch (err: any) {
      diag.calendars = { status: 'FETCH_ERROR', message: err.message };
    }

    // 5. GET /me/calendarView
    try {
      const start = '2026-02-09T00:00:00';
      const end = '2026-02-15T23:59:59';
      const url = `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${start}&endDateTime=${end}&$select=id,subject,start,end,isAllDay&$orderby=start/dateTime&$top=20`;
      const res = await fetch(url, {
        headers: {
          ...headers,
          Prefer: 'outlook.timezone="America/Guatemala"',
        },
      });
      const body = await res.text();
      if (res.ok) {
        const data = JSON.parse(body);
        const evts = data.value ?? [];
        diag.events = {
          status: res.status,
          range: `${start} → ${end}`,
          count: evts.length,
          first_3: evts.slice(0, 3).map((e: any) => ({
            subject: e.subject,
            start: e.start?.dateTime,
            end: e.end?.dateTime,
            isAllDay: e.isAllDay,
          })),
        };
      } else {
        diag.events = { status: res.status, error: body.substring(0, 500) };
      }
    } catch (err: any) {
      diag.events = { status: 'FETCH_ERROR', message: err.message };
    }
  } catch (err: any) {
    diag.tokens = { status: 'DB_ERROR', message: err.message };
  }

  return NextResponse.json(diag, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
