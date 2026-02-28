// ============================================================================
// lib/molly/graph-mail.ts
// Lectura de emails via Microsoft Graph API (client_credentials)
// ============================================================================

import { getAppToken } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import type { GraphMailMessage } from '@/lib/types/molly';

// ── Fetch new emails since a given datetime ────────────────────────────────

export async function fetchNewEmails(
  account: MailboxAlias,
  since: string,
): Promise<GraphMailMessage[]> {
  const token = await getAppToken();

  const filter = `receivedDateTime ge ${since}`;
  const select = [
    'id',
    'conversationId',
    'subject',
    'bodyPreview',
    'body',
    'from',
    'toRecipients',
    'ccRecipients',
    'receivedDateTime',
    'hasAttachments',
  ].join(',');

  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=${select}` +
    `&$orderby=receivedDateTime asc` +
    `&$top=25` +
    `&$expand=attachments($select=name,contentType,size)`;

  console.log(`[graph-mail] GET ${account} since=${since}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-mail] ERROR ${res.status}:`, errText.substring(0, 500));
    throw new Error(`Graph API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const messages: GraphMailMessage[] = data.value ?? [];
  console.log(`[graph-mail] ${messages.length} mensajes obtenidos para ${account}`);
  return messages;
}

// ── Strip HTML to plain text (for Claude input) ────────────────────────────

export function stripHtmlToText(html: string): string {
  return html
    // Remove style and script blocks
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    // Replace <br> and block-level tags with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, '\t')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Search emails with KQL query ──────────────────────────────────────────

export async function searchEmails(
  account: MailboxAlias,
  query: string,
  days: number = 7,
): Promise<GraphMailMessage[]> {
  const token = await getAppToken();

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const filter = `receivedDateTime ge ${since}`;
  const select = [
    'id',
    'conversationId',
    'subject',
    'bodyPreview',
    'from',
    'toRecipients',
    'receivedDateTime',
    'hasAttachments',
  ].join(',');

  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/messages` +
    `?$search="${encodeURIComponent(query)}"` +
    `&$filter=${encodeURIComponent(filter)}` +
    `&$select=${select}` +
    `&$orderby=receivedDateTime desc` +
    `&$top=15`;

  console.log(`[graph-mail] SEARCH ${account} q="${query}" days=${days}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.body.contentType="text"',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-mail] SEARCH ERROR ${res.status}:`, errText.substring(0, 500));
    throw new Error(`Graph API search error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const messages: GraphMailMessage[] = data.value ?? [];
  console.log(`[graph-mail] SEARCH: ${messages.length} resultados para "${query}" en ${account}`);
  return messages;
}

// ── Get full conversation thread by conversationId ────────────────────────

export async function getConversationThread(
  account: MailboxAlias,
  conversationId: string,
): Promise<GraphMailMessage[]> {
  const token = await getAppToken();

  const filter = `conversationId eq '${conversationId}'`;
  const select = [
    'id',
    'conversationId',
    'subject',
    'body',
    'bodyPreview',
    'from',
    'toRecipients',
    'ccRecipients',
    'receivedDateTime',
    'hasAttachments',
  ].join(',');

  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=${select}` +
    `&$orderby=receivedDateTime asc` +
    `&$top=25`;

  console.log(`[graph-mail] THREAD ${account} convId=${conversationId.substring(0, 30)}...`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-mail] THREAD ERROR ${res.status}:`, errText.substring(0, 500));
    throw new Error(`Graph API thread error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const messages: GraphMailMessage[] = data.value ?? [];
  console.log(`[graph-mail] THREAD: ${messages.length} mensajes en hilo`);
  return messages;
}
