// ============================================================================
// lib/services/outlook.service.ts
// Microsoft Graph API: OAuth, Calendar CRUD, Teams links, sendMail
// ============================================================================

import { Client } from '@microsoft/microsoft-graph-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto';

const db = () => createAdminClient();

// ── Error ───────────────────────────────────────────────────────────────────

export class OutlookError extends Error {
  details?: unknown;
  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'OutlookError';
    this.details = details;
  }
}

// ── Config ──────────────────────────────────────────────────────────────────

const SCOPES = [
  'Calendars.ReadWrite',
  'User.Read',
  'Mail.Send',
  'OnlineMeetings.ReadWrite',
  'offline_access',
];

// ── Calendar user (application permissions → /users/{upn}/...) ──────────────
const CALENDAR_USER = 'amanda@papeleo.legal';

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'http://localhost:3000';
  return `${base}/api/admin/calendario/callback`;
}

// ── OAuth Flow ──────────────────────────────────────────────────────────────

export function getOutlookAuthUrl(): string {
  const clientId = process.env.AZURE_CLIENT_ID;
  const tenantId = process.env.AZURE_TENANT_ID;
  if (!clientId || !tenantId) {
    throw new OutlookError('Faltan variables AZURE_CLIENT_ID o AZURE_TENANT_ID');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(' '),
    response_mode: 'query',
  });

  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const redirectUri = getRedirectUri();
  console.log('[Outlook] ── exchangeCodeForTokens ──');
  console.log('[Outlook] Code recibido: [REDACTED]');
  console.log('[Outlook] Redirect URI:', redirectUri);

  // Exchange code for tokens via direct token endpoint
  // (NOT using MSAL acquireTokenByCode — it consumes the single-use code
  // and doesn't expose the refresh_token)
  const tenantId = process.env.AZURE_TENANT_ID!;
  const clientId = process.env.AZURE_CLIENT_ID!;
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  console.log('[Outlook] Token endpoint:', tokenUrl);
  console.log('[Outlook] Client ID:', clientId.substring(0, 8) + '...');

  const tokenResponse = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: SCOPES.join(' '),
    }),
  });

  const responseText = await tokenResponse.text();
  console.log('[Outlook] Token response status:', tokenResponse.status);

  if (!tokenResponse.ok) {
    // Parse error safely — don't log full response which may contain tokens/secrets
    let errorDesc = 'unknown';
    try { errorDesc = JSON.parse(responseText).error_description ?? JSON.parse(responseText).error ?? 'unknown'; } catch {}
    console.error('[Outlook] ERROR token exchange:', errorDesc);
    throw new OutlookError('Error al intercambiar code por tokens', errorDesc);
  }

  const tokens = JSON.parse(responseText);
  console.log('[Outlook] access_token recibido:', tokens.access_token ? `[REDACTED] (${tokens.access_token.length} chars)` : 'NULL');
  console.log('[Outlook] refresh_token recibido:', tokens.refresh_token ? `[REDACTED] (${tokens.refresh_token.length} chars)` : 'NULL');
  console.log('[Outlook] expires_in:', tokens.expires_in);

  if (!tokens.access_token) {
    throw new OutlookError('Token response no contiene access_token', tokens);
  }

  // Encrypt tokens
  const encryptedAccess = encrypt(tokens.access_token);
  const encryptedRefresh = tokens.refresh_token ? encrypt(tokens.refresh_token) : null;
  console.log('[Outlook] Encrypted access_token:', encryptedAccess ? `${encryptedAccess.substring(0, 30)}... (${encryptedAccess.length} chars)` : 'NULL');
  console.log('[Outlook] Encrypted refresh_token:', encryptedRefresh ? `${encryptedRefresh.substring(0, 30)}... (${encryptedRefresh.length} chars)` : 'NULL');

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  // Save to DB
  const updatePayload = {
    outlook_access_token_encrypted: encryptedAccess,
    outlook_refresh_token_encrypted: encryptedRefresh,
    outlook_token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  console.log('[Outlook] Guardando en configuracion...');

  const { data: updateData, error, count } = await db()
    .from('configuracion')
    .update(updatePayload)
    .not('id', 'is', null)
    .select('id, outlook_access_token_encrypted, outlook_refresh_token_encrypted, outlook_token_expires_at');

  if (error) {
    console.error('[Outlook] ERROR al guardar en BD:', JSON.stringify(error));
    throw new OutlookError('Error al guardar tokens', error);
  }

  console.log('[Outlook] Update result rows:', updateData?.length ?? 0);
  if (updateData && updateData.length > 0) {
    const saved = updateData[0];
    console.log('[Outlook] Verificación BD — access_token guardado:', saved.outlook_access_token_encrypted ? 'SÍ' : 'NULL');
    console.log('[Outlook] Verificación BD — refresh_token guardado:', saved.outlook_refresh_token_encrypted ? 'SÍ' : 'NULL');
    console.log('[Outlook] Verificación BD — expires_at:', saved.outlook_token_expires_at);
  } else {
    console.error('[Outlook] ADVERTENCIA: update no afectó ninguna fila. ¿Existe la tabla configuracion con datos?');
  }

  console.log('[Outlook] ── Tokens guardados OK, expiran:', expiresAt, '──');
}

// ── Token Management ────────────────────────────────────────────────────────

let refreshPromise: Promise<string> | null = null;

export async function getValidAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  const { data: config } = await db()
    .from('configuracion')
    .select('outlook_access_token_encrypted, outlook_refresh_token_encrypted, outlook_token_expires_at')
    .limit(1)
    .single();

  if (!config?.outlook_access_token_encrypted) {
    throw new OutlookError('Outlook no está conectado. Conecta desde /admin/calendario.');
  }

  const expiresAt = config.outlook_token_expires_at ? new Date(config.outlook_token_expires_at) : new Date(0);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 min buffer

  if (expiresAt.getTime() - now.getTime() > bufferMs) {
    const minLeft = Math.round((expiresAt.getTime() - now.getTime()) / 60000);
    console.log('[Outlook] Token válido, expira en', minLeft, 'min');
    return decrypt(config.outlook_access_token_encrypted);
  }

  console.log('[Outlook] Token expirado o por expirar (expires:', expiresAt.toISOString() + ', now:', now.toISOString() + '), refrescando...');

  // Token expired or about to expire — refresh
  if (!config.outlook_refresh_token_encrypted) {
    throw new OutlookError('Token expirado y no hay refresh token. Reconecta Outlook.');
  }

  refreshPromise = refreshAccessToken(decrypt(config.outlook_refresh_token_encrypted));
  try {
    const token = await refreshPromise;
    return token;
  } finally {
    refreshPromise = null;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const tenantId = process.env.AZURE_TENANT_ID!;

  const response = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: SCOPES.join(' '),
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    throw new OutlookError('Error al refrescar token. Reconecta Outlook.', errBody);
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  await db()
    .from('configuracion')
    .update({
      outlook_access_token_encrypted: encrypt(tokens.access_token),
      outlook_refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      outlook_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .not('id', 'is', null);

  console.log('[Outlook] Token refrescado, expira:', expiresAt);
  return tokens.access_token;
}

export async function isOutlookConnected(): Promise<boolean> {
  // With app-level permissions (client_credentials), we only need the Azure env vars
  const ok = !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET && process.env.AZURE_TENANT_ID);
  console.log(`[isOutlookConnected] App credentials configured: ${ok}`);
  return ok;
}

// ── Graph Client ────────────────────────────────────────────────────────────

async function getGraphClient(): Promise<Client> {
  const accessToken = await getValidAccessToken();
  return Client.init({
    authProvider: (done) => done(null, accessToken),
  });
}

// ── Calendar Events ─────────────────────────────────────────────────────────

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  isOnlineMeeting: boolean;
  onlineMeeting?: { joinUrl: string } | null;
  categories: string[];
  bodyPreview?: string;
}

export interface CreateEventParams {
  subject: string;
  startDateTime: string;
  endDateTime: string;
  attendees: string[];
  isOnlineMeeting: boolean;
  categories: string[];
  body: string;
}

export async function getCalendarEvents(startDate: string, endDate: string): Promise<OutlookEvent[]> {
  const appToken = await getAppToken();
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const SELECT_FIELDS = 'id,subject,start,end,isAllDay,isOnlineMeeting,onlineMeeting,categories,bodyPreview';
  const userBase = `${GRAPH}/users/${CALENDAR_USER}`;

  const authHeaders = { Authorization: `Bearer ${appToken}` };
  const calViewHeaders = {
    Authorization: `Bearer ${appToken}`,
    Prefer: 'outlook.timezone="America/Guatemala"',
  };

  console.log(`[Outlook] ── getCalendarEvents (app token) ──`);
  console.log(`[Outlook] Usuario: ${CALENDAR_USER}`);
  console.log(`[Outlook] Rango: ${startDate} → ${endDate}`);

  // 1. List ALL calendars
  let calendars: { id: string; name: string }[] = [];
  try {
    const calRes = await fetch(`${userBase}/calendars?$select=id,name&$top=50`, {
      headers: authHeaders,
    });

    if (!calRes.ok) {
      const errText = await calRes.text();
      console.error('[Outlook] ERROR listando calendarios:', calRes.status, errText.substring(0, 300));
    } else {
      const calData = await calRes.json();
      calendars = (calData.value ?? []).map((c: any) => ({ id: c.id, name: c.name }));
    }

    console.log('[Outlook] Calendarios encontrados:', calendars.length);
    calendars.forEach((c: { id: string; name: string }, i: number) => {
      console.log('[Outlook]  ', i + 1 + '.', '"' + c.name + '"');
    });
  } catch (err: any) {
    console.error('[Outlook] ERROR al listar calendarios:', err.message ?? err);
  }

  // 2. Fetch calendarView from EACH calendar (or default if listing failed)
  const allEvents: OutlookEvent[] = [];
  const seenIds = new Set<string>();

  const calendarTargets = calendars.length > 0
    ? calendars
    : [{ id: '__default__', name: 'Principal (fallback)' }];

  const queryParams = new URLSearchParams({
    startDateTime: startDate,
    endDateTime: endDate,
    $select: SELECT_FIELDS,
    $orderby: 'start/dateTime',
    $top: '100',
  });

  for (const cal of calendarTargets) {
    try {
      const basePath = cal.id === '__default__'
        ? `${userBase}/calendarView`
        : `${userBase}/calendars/${encodeURIComponent(cal.id)}/calendarView`;

      const url = `${basePath}?${queryParams}`;
      const res = await fetch(url, { headers: calViewHeaders });

      if (!res.ok) {
        const errText = await res.text();
        console.error('[Outlook] ERROR en calendario "' + cal.name + '":', res.status, errText.substring(0, 300));
        continue;
      }

      const data = await res.json();
      const events: any[] = data.value ?? [];
      let newCount = 0;

      for (const ev of events) {
        if (!seenIds.has(ev.id)) {
          seenIds.add(ev.id);
          allEvents.push(ev);
          newCount++;
        }
      }

      console.log('[Outlook] Calendario "' + cal.name + '":', events.length, 'eventos (' + newCount, 'nuevos,', events.length - newCount, 'duplicados)');
      if (events.length > 0) {
        const first = events[0];
        console.log('[Outlook]   Timezone retornado:', first.start?.timeZone);
        events.forEach((ev: any) => {
          const allDay = ev.isAllDay ? ' [TODO EL DÍA]' : '';
          const startDT = ev.start?.dateTime ?? '?';
          console.log('[Outlook]     *', '"' + ev.subject + '"', 'start=' + startDT.substring(0, 19), 'tz=' + ev.start?.timeZone + allDay);
        });
      }
    } catch (err: any) {
      console.error('[Outlook] ERROR en calendario "' + cal.name + '":', err.message ?? err);
    }
  }

  console.log('[Outlook] ── Total:', allEvents.length, 'eventos únicos de', calendarTargets.length, 'calendarios ──');
  return allEvents;
}

export async function createCalendarEvent(params: CreateEventParams): Promise<{ eventId: string; teamsLink: string | null }> {
  const appToken = await getAppToken();
  const url = `https://graph.microsoft.com/v1.0/users/${CALENDAR_USER}/events`;

  const event: any = {
    subject: params.subject,
    start: { dateTime: params.startDateTime, timeZone: 'America/Guatemala' },
    end: { dateTime: params.endDateTime, timeZone: 'America/Guatemala' },
    body: { contentType: 'HTML', content: params.body },
    categories: params.categories,
    attendees: params.attendees.map((email: string) => ({
      emailAddress: { address: email },
      type: 'required',
    })),
  };

  if (params.isOnlineMeeting) {
    event.isOnlineMeeting = true;
    event.onlineMeetingProvider = 'teamsForBusiness';
  }

  console.log(`[Outlook] createCalendarEvent (app token): subject="${event.subject}", user=${CALENDAR_USER}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[Outlook] ERROR createCalendarEvent: ${res.status} ${errBody.substring(0, 500)}`);
    throw new OutlookError(`Error al crear evento: ${res.status}`, errBody);
  }

  const created = await res.json();

  console.log(`[Outlook] Evento creado: id=${created.id}`);
  console.log(`[Outlook] isOnlineMeeting response: ${created.isOnlineMeeting}`);
  console.log(`[Outlook] onlineMeeting object: ${JSON.stringify(created.onlineMeeting ?? null)}`);

  const teamsLink = created.onlineMeeting?.joinUrl
    ?? created.onlineMeetingUrl
    ?? null;

  console.log('[Outlook] Teams link final:', teamsLink ? teamsLink.substring(0, 60) + '...' : 'NULL');
  return { eventId: created.id, teamsLink };
}

export async function updateCalendarEvent(eventId: string, updates: Partial<CreateEventParams>): Promise<void> {
  const appToken = await getAppToken();
  const url = `https://graph.microsoft.com/v1.0/users/${CALENDAR_USER}/events/${eventId}`;

  const patch: any = {};
  if (updates.subject) patch.subject = updates.subject;
  if (updates.startDateTime) patch.start = { dateTime: updates.startDateTime, timeZone: 'America/Guatemala' };
  if (updates.endDateTime) patch.end = { dateTime: updates.endDateTime, timeZone: 'America/Guatemala' };
  if (updates.body) patch.body = { contentType: 'HTML', content: updates.body };
  if (updates.categories) patch.categories = updates.categories;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[Outlook] ERROR updateCalendarEvent: ${res.status} ${errBody.substring(0, 500)}`);
    throw new OutlookError(`Error al actualizar evento: ${res.status}`, errBody);
  }

  console.log(`[Outlook] Evento actualizado: ${eventId}`);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const appToken = await getAppToken();
  const url = `https://graph.microsoft.com/v1.0/users/${CALENDAR_USER}/events/${eventId}`;

  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${appToken}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[Outlook] ERROR deleteCalendarEvent: ${res.status} ${errBody.substring(0, 500)}`);
    throw new OutlookError(`Error al eliminar evento: ${res.status}`, errBody);
  }

  console.log(`[Outlook] Evento eliminado: ${eventId}`);
}

// ── Free/Busy ───────────────────────────────────────────────────────────────

export interface BusySlot {
  start: string;
  end: string;
}

export async function getFreeBusy(startDate: string, endDate: string): Promise<BusySlot[]> {
  const appToken = await getAppToken();
  const url = `https://graph.microsoft.com/v1.0/users/${CALENDAR_USER}/calendar/getSchedule`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      schedules: [CALENDAR_USER],
      startTime: { dateTime: startDate, timeZone: 'America/Guatemala' },
      endTime: { dateTime: endDate, timeZone: 'America/Guatemala' },
      availabilityViewInterval: 15,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[Outlook] ERROR getFreeBusy: ${res.status} ${errBody.substring(0, 500)}`);
    throw new OutlookError(`Error al obtener disponibilidad: ${res.status}`, errBody);
  }

  const result = await res.json();
  const schedule = result.value?.[0];
  if (!schedule?.scheduleItems) return [];

  return schedule.scheduleItems
    .filter((item: any) => item.status !== 'free')
    .map((item: any) => ({
      start: item.start.dateTime,
      end: item.end.dateTime,
    }));
}

// ── App Token (client_credentials) — used for Mail.Send ─────────────────────

let appTokenCache: { token: string; expiresAt: number } | null = null;

export async function getAppToken(): Promise<string> {
  // Return cached token if still valid (with 5-min buffer)
  if (appTokenCache && appTokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    console.log('[getAppToken] Usando token cacheado, expira en', Math.round((appTokenCache.expiresAt - Date.now()) / 60000), 'min');
    return appTokenCache.token;
  }

  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new OutlookError('Faltan variables AZURE_TENANT_ID, AZURE_CLIENT_ID o AZURE_CLIENT_SECRET');
  }

  console.log(`[getAppToken] Solicitando nuevo token de aplicación...`);

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
    console.error('[getAppToken] ERROR', res.status + ':', text.substring(0, 500));
    throw new OutlookError(`Error al obtener app token: ${res.status}`, text);
  }

  const data = JSON.parse(text);
  const expiresIn = data.expires_in ?? 3600;

  appTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  console.log('[getAppToken] Token obtenido OK, expira en', expiresIn + 's');
  return data.access_token;
}

/** Force invalidation of cached app token (e.g., after permission changes or 403) */
export function invalidateAppToken(): void {
  appTokenCache = null;
  console.log('[getAppToken] Cache invalidado manualmente');
}

// ── Send Email (app permissions — client_credentials) ───────────────────────

export type MailboxAlias = 'asistente@papeleo.legal' | 'contador@papeleo.legal' | 'amanda@papeleo.legal';

export async function sendMail(params: {
  from: MailboxAlias;
  to: string;
  subject: string;
  htmlBody: string;
  cc?: string | string[];
  attachments?: Array<{ name: string; contentType: string; contentBytes: string }>;
}): Promise<void> {
  const toMask = params.to.replace(/(.{2}).+(@.+)/, '$1***$2');
  console.log(`[sendMail] ── INICIO ──`);
  console.log('[sendMail] from:', params.from);
  console.log('[sendMail] to:', toMask);
  console.log('[sendMail] subject:', params.subject);
  console.log('[sendMail] htmlBody length:', params.htmlBody.length, 'chars');

  // Use app token (client_credentials) — NOT the delegated user token
  const appToken = await getAppToken();
  console.log(`[sendMail] App token obtenido OK`);

  const url = `https://graph.microsoft.com/v1.0/users/${params.from}/sendMail`;
  console.log('[sendMail] POST', url);

  const message: any = {
    subject: params.subject,
    body: { contentType: 'HTML', content: params.htmlBody },
    toRecipients: [{ emailAddress: { address: params.to } }],
  };

  if (params.cc) {
    const ccList = Array.isArray(params.cc) ? params.cc : [params.cc];
    message.ccRecipients = ccList.map((addr) => ({ emailAddress: { address: addr } }));
  }

  if (params.attachments?.length) {
    message.attachments = params.attachments.map((att) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }));
    console.log('[sendMail]', params.attachments.length, 'adjunto(s):', params.attachments.map((a) => a.name).join(', '));
  }

  const payload = { message, saveToSentItems: true };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${appToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(`[sendMail] ── ERROR ──`);
    console.error('[sendMail] status:', res.status);
    console.error('[sendMail] body:', errBody.substring(0, 500));
    throw new OutlookError(`Error al enviar email: ${res.status}`, errBody);
  }

  console.log('[sendMail] ── ÉXITO — email enviado (' + res.status + ') ──');
}

/** @deprecated Use sendMail() with explicit `from` parameter instead */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  return sendMail({ from: 'asistente@papeleo.legal', to, subject, htmlBody });
}
