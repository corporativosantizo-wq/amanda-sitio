// ============================================================================
// lib/services/outlook.service.ts
// Microsoft Graph API: OAuth, Calendar CRUD, Teams links, sendMail
// ============================================================================

import { ConfidentialClientApplication } from '@azure/msal-node';
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

// ── MSAL Config ─────────────────────────────────────────────────────────────

const SCOPES = [
  'Calendars.ReadWrite',
  'User.Read',
  'Mail.Send',
  'OnlineMeetings.ReadWrite',
  'offline_access',
];

function getMsalApp(): ConfidentialClientApplication {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new OutlookError('Faltan variables de entorno de Azure (AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)');
  }

  return new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });
}

function getRedirectUri(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
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
  const msalApp = getMsalApp();

  const result = await msalApp.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri: getRedirectUri(),
  });

  if (!result || !result.accessToken) {
    throw new OutlookError('No se pudo obtener token de acceso');
  }

  // MSAL doesn't directly expose refresh token via acquireTokenByCode in some versions.
  // We'll do a manual token exchange to get both tokens.
  const tenantId = process.env.AZURE_TENANT_ID!;
  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.AZURE_CLIENT_ID!,
        client_secret: process.env.AZURE_CLIENT_SECRET!,
        code,
        redirect_uri: getRedirectUri(),
        grant_type: 'authorization_code',
        scope: SCOPES.join(' '),
      }),
    }
  );

  if (!tokenResponse.ok) {
    const errBody = await tokenResponse.text();
    throw new OutlookError('Error al intercambiar code por tokens', errBody);
  }

  const tokens = await tokenResponse.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

  const { error } = await db()
    .from('configuracion')
    .update({
      outlook_access_token_encrypted: encrypt(tokens.access_token),
      outlook_refresh_token_encrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      outlook_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .not('id', 'is', null);

  if (error) throw new OutlookError('Error al guardar tokens', error);
  console.log('[Outlook] Tokens guardados OK, expiran:', expiresAt);
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
    return decrypt(config.outlook_access_token_encrypted);
  }

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
  const { data: config } = await db()
    .from('configuracion')
    .select('outlook_access_token_encrypted')
    .limit(1)
    .single();

  return !!config?.outlook_access_token_encrypted;
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
  const client = await getGraphClient();

  const result = await client
    .api('/me/calendarView')
    .header('Prefer', 'outlook.timezone="America/Guatemala"')
    .query({
      startDateTime: startDate,
      endDateTime: endDate,
    })
    .select('id,subject,start,end,isOnlineMeeting,onlineMeeting,categories,bodyPreview')
    .orderby('start/dateTime')
    .top(100)
    .get();

  return result.value ?? [];
}

export async function createCalendarEvent(params: CreateEventParams): Promise<{ eventId: string; teamsLink: string | null }> {
  const client = await getGraphClient();

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

  const created = await client.api('/me/events').post(event);
  const teamsLink = created.onlineMeeting?.joinUrl ?? null;

  console.log(`[Outlook] Evento creado: ${created.id}, Teams: ${teamsLink ? 'sí' : 'no'}`);
  return { eventId: created.id, teamsLink };
}

export async function updateCalendarEvent(eventId: string, updates: Partial<CreateEventParams>): Promise<void> {
  const client = await getGraphClient();

  const patch: any = {};
  if (updates.subject) patch.subject = updates.subject;
  if (updates.startDateTime) patch.start = { dateTime: updates.startDateTime, timeZone: 'America/Guatemala' };
  if (updates.endDateTime) patch.end = { dateTime: updates.endDateTime, timeZone: 'America/Guatemala' };
  if (updates.body) patch.body = { contentType: 'HTML', content: updates.body };
  if (updates.categories) patch.categories = updates.categories;

  await client.api(`/me/events/${eventId}`).patch(patch);
  console.log(`[Outlook] Evento actualizado: ${eventId}`);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const client = await getGraphClient();
  await client.api(`/me/events/${eventId}`).delete();
  console.log(`[Outlook] Evento eliminado: ${eventId}`);
}

// ── Free/Busy ───────────────────────────────────────────────────────────────

export interface BusySlot {
  start: string;
  end: string;
}

export async function getFreeBusy(startDate: string, endDate: string): Promise<BusySlot[]> {
  const client = await getGraphClient();

  const result = await client.api('/me/calendar/getSchedule').post({
    schedules: ['me'],
    startTime: { dateTime: startDate, timeZone: 'America/Guatemala' },
    endTime: { dateTime: endDate, timeZone: 'America/Guatemala' },
    availabilityViewInterval: 15,
  });

  const schedule = result.value?.[0];
  if (!schedule?.scheduleItems) return [];

  return schedule.scheduleItems
    .filter((item: any) => item.status !== 'free')
    .map((item: any) => ({
      start: item.start.dateTime,
      end: item.end.dateTime,
    }));
}

// ── Send Email ──────────────────────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  const client = await getGraphClient();

  await client.api('/me/sendMail').post({
    message: {
      subject,
      body: { contentType: 'HTML', content: htmlBody },
      toRecipients: [{ emailAddress: { address: to } }],
    },
    saveToSentItems: true,
  });

  console.log(`[Outlook] Email enviado a: ${to}, asunto: ${subject}`);
}
