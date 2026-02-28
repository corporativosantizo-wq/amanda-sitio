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

  // Avoid combining $filter + $orderby + $expand — can cause InefficientFilter
  // or silent empty results on some mailboxes. Sort in JS instead.
  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=${select}` +
    `&$top=25` +
    `&$expand=attachments($select=name,contentType,size)`;

  console.log(`[graph-mail] GET ${account} since=${since} url_length=${url.length}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-mail] ERROR ${res.status} for ${account}:`, errText.substring(0, 500));
    throw new Error(`Graph API error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const messages: GraphMailMessage[] = data.value ?? [];

  // Sort chronologically (ascending) since we omit $orderby
  messages.sort((a: any, b: any) =>
    (a.receivedDateTime ?? '').localeCompare(b.receivedDateTime ?? '')
  );

  console.log(`[graph-mail] ${account}: ${messages.length} mensajes desde ${since}`);
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

  // Graph API does NOT support $search + $filter together.
  // Strategy: if query is provided, use $search with KQL date range;
  // if no meaningful query (just "*" or empty), use $filter only.
  const isWildcard = !query.trim() || query.trim() === '*';
  let url: string;

  if (isWildcard) {
    // No search term — just filter by date
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    url =
      `https://graph.microsoft.com/v1.0/users/${account}/messages` +
      `?$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}` +
      `&$select=${select}` +
      `&$orderby=receivedDateTime desc` +
      `&$top=15`;
  } else {
    // Build KQL search with date range embedded
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0]; // YYYY-MM-DD
    const kql = `${query} received>=${sinceDate}`;
    url =
      `https://graph.microsoft.com/v1.0/users/${account}/messages` +
      `?$search="${encodeURIComponent(kql)}"` +
      `&$select=${select}` +
      `&$top=15`;
  }

  console.log(`[graph-mail] SEARCH ${account} q="${query}" days=${days} wildcard=${isWildcard}`);

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

  // Graph API throws InefficientFilter when combining $filter on conversationId
  // with $orderby — so we omit $orderby and sort in JS after fetching.
  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=${select}` +
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

  // Sort chronologically (ascending) since we can't use $orderby with conversationId filter
  messages.sort((a: any, b: any) =>
    (a.receivedDateTime ?? '').localeCompare(b.receivedDateTime ?? '')
  );

  console.log(`[graph-mail] THREAD: ${messages.length} mensajes en hilo`);
  return messages;
}
