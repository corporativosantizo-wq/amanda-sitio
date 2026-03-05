// ============================================================================
// lib/molly/graph-drive.ts
// Lectura de archivos de OneDrive via Microsoft Graph API (client_credentials)
// ============================================================================

import { getAppToken, invalidateAppToken } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';

// ── Types ─────────────────────────────────────────────────────────────────

export interface DriveItem {
  id: string;
  name: string;
  webUrl: string;
  lastModified: string;
  size: number;
  mimeType: string | null;
  path: string;
  type: 'file' | 'folder';
}

export interface DriveFileContent {
  name: string;
  content: string | null;
  webUrl: string;
  size: number;
  mimeType: string | null;
}

// ── Max sizes ─────────────────────────────────────────────────────────────

const MAX_DOWNLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CONTENT_CHARS = 10_000;

// Text-readable extensions (download and return as text)
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.json', '.md', '.xml', '.html', '.htm', '.log']);

// ── Search files in OneDrive ──────────────────────────────────────────────

export async function searchDriveFiles(
  account: MailboxAlias,
  query: string,
  fileType?: string,
): Promise<DriveItem[]> {
  const token = await getAppToken();

  const select = 'id,name,webUrl,lastModifiedDateTime,size,file,folder,parentReference';
  const url =
    `https://graph.microsoft.com/v1.0/users/${account}/drive/root/search(q='${encodeURIComponent(query)}')` +
    `?$select=${select}` +
    `&$top=15`;

  console.log(`[graph-drive] SEARCH ${account} q="${query}" fileType=${fileType ?? 'all'}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // Fallback: if search returns 403 (needs Sites.Read.All), scan children instead
  if (res.status === 403) {
    console.warn(`[graph-drive] Search 403, usando fallback children scan`);
    invalidateAppToken();
    return searchViaChildrenScan(account, query, fileType);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-drive] SEARCH ERROR ${res.status} for ${account}:`, errText);
    throw new Error(`Graph Drive search error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  let items: DriveItem[] = ((data.value ?? []) as any[]).map((item: any) => ({
    id: item.id,
    name: item.name ?? '',
    webUrl: item.webUrl ?? '',
    lastModified: item.lastModifiedDateTime ?? '',
    size: item.size ?? 0,
    mimeType: item.file?.mimeType ?? null,
    path: item.parentReference?.path?.replace('/drive/root:', '') ?? '/',
    type: item.folder ? 'folder' : 'file',
  }));

  // Client-side filter by file extension if requested
  if (fileType) {
    const ext = fileType.startsWith('.') ? fileType.toLowerCase() : `.${fileType.toLowerCase()}`;
    items = items.filter((i: DriveItem) => i.name.toLowerCase().endsWith(ext));
  }

  // Limit to 10 results
  items = items.slice(0, 10);

  console.log(`[graph-drive] SEARCH: ${items.length} resultados para "${query}" en ${account}`);
  return items;
}

// ── Fallback: recursive children scan (max 2 levels deep) ───────────────

async function searchViaChildrenScan(
  account: MailboxAlias,
  query: string,
  fileType?: string,
): Promise<DriveItem[]> {
  const token = await getAppToken();
  const GRAPH = `https://graph.microsoft.com/v1.0/users/${account}`;
  const select = 'id,name,webUrl,lastModifiedDateTime,size,file,folder';
  const headers = { Authorization: `Bearer ${token}` };
  const queryLower = query.toLowerCase();
  const results: DriveItem[] = [];

  async function scanFolder(folderId: string | null, parentPath: string, depth: number): Promise<void> {
    if (depth > 2 || results.length >= 10) return;

    const url = folderId
      ? `${GRAPH}/drive/items/${folderId}/children?$select=${select}&$top=50`
      : `${GRAPH}/drive/root/children?$select=${select}&$top=50`;

    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[graph-drive] FALLBACK list error ${res.status} at depth=${depth} path=${parentPath}`);
      return;
    }

    const data = await res.json();
    const items: any[] = data.value ?? [];

    for (const item of items) {
      if (results.length >= 10) break;
      const name: string = item.name ?? '';
      const nameLower = name.toLowerCase();
      const isFolder = !!item.folder;
      const itemPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

      // Match by name containing query
      if (nameLower.includes(queryLower)) {
        // Apply file type filter
        if (fileType) {
          const ext = fileType.startsWith('.') ? fileType.toLowerCase() : `.${fileType.toLowerCase()}`;
          if (!isFolder && !nameLower.endsWith(ext)) continue;
          if (isFolder) continue; // skip folders when filtering by type
        }

        results.push({
          id: item.id,
          name,
          webUrl: item.webUrl ?? '',
          lastModified: item.lastModifiedDateTime ?? '',
          size: item.size ?? 0,
          mimeType: item.file?.mimeType ?? null,
          path: parentPath,
          type: isFolder ? 'folder' : 'file',
        });
      }

      // Recurse into folders
      if (isFolder && depth < 2) {
        await scanFolder(item.id, itemPath, depth + 1);
      }
    }
  }

  await scanFolder(null, '/', 0);
  console.log(`[graph-drive] FALLBACK: ${results.length} resultados para "${query}" en ${account}`);
  return results;
}

// ── Get file content ──────────────────────────────────────────────────────

export async function getFileContent(
  account: MailboxAlias,
  itemId: string,
): Promise<DriveFileContent> {
  const token = await getAppToken();

  // 1. Get metadata first
  const metaUrl =
    `https://graph.microsoft.com/v1.0/users/${account}/drive/items/${itemId}` +
    `?$select=id,name,size,file,webUrl`;

  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    console.error(`[graph-drive] META ERROR ${metaRes.status} for ${account}:`, errText);
    throw new Error(`Graph Drive metadata error ${metaRes.status}: ${errText.substring(0, 200)}`);
  }

  const meta = await metaRes.json();
  const name: string = meta.name ?? '';
  const size: number = meta.size ?? 0;
  const mimeType: string | null = meta.file?.mimeType ?? null;
  const webUrl: string = meta.webUrl ?? '';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';

  console.log(`[graph-drive] FILE ${name} size=${size} mime=${mimeType} ext=${ext}`);

  // 2. Only download text-readable files under size limit
  const isTextFile = TEXT_EXTENSIONS.has(ext);

  if (!isTextFile || size > MAX_DOWNLOAD_SIZE) {
    const reason = size > MAX_DOWNLOAD_SIZE
      ? `Archivo demasiado grande (${(size / 1024 / 1024).toFixed(1)} MB, máx 5 MB)`
      : `Tipo de archivo no legible como texto (${ext || mimeType})`;

    console.log(`[graph-drive] SKIP content: ${reason}`);
    return { name, content: null, webUrl, size, mimeType };
  }

  // 3. Download content
  const contentUrl = `https://graph.microsoft.com/v1.0/users/${account}/drive/items/${itemId}/content`;
  const contentRes = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'follow',
  });

  if (!contentRes.ok) {
    console.error(`[graph-drive] CONTENT ERROR ${contentRes.status}`);
    return { name, content: null, webUrl, size, mimeType };
  }

  let content = await contentRes.text();

  // Truncate to limit
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.substring(0, MAX_CONTENT_CHARS) + `\n\n... [truncado a ${MAX_CONTENT_CHARS} caracteres, archivo completo: ${webUrl}]`;
  }

  console.log(`[graph-drive] CONTENT OK: ${content.length} chars`);
  return { name, content, webUrl, size, mimeType };
}

// ── List folder contents ──────────────────────────────────────────────────

export async function listFolderContents(
  account: MailboxAlias,
  folderPath?: string,
): Promise<DriveItem[]> {
  const token = await getAppToken();

  const select = 'id,name,webUrl,lastModifiedDateTime,size,file,folder';
  let url: string;

  if (folderPath && folderPath !== '/' && folderPath !== '') {
    // Normalize: remove leading/trailing slashes
    const cleanPath = folderPath.replace(/^\/+|\/+$/g, '');
    url =
      `https://graph.microsoft.com/v1.0/users/${account}/drive/root:/${encodeURIComponent(cleanPath)}:/children` +
      `?$select=${select}` +
      `&$top=30` +
      `&$orderby=lastModifiedDateTime desc`;
  } else {
    url =
      `https://graph.microsoft.com/v1.0/users/${account}/drive/root/children` +
      `?$select=${select}` +
      `&$top=30` +
      `&$orderby=lastModifiedDateTime desc`;
  }

  console.log(`[graph-drive] LIST ${account} path=${folderPath ?? '/'}`);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[graph-drive] LIST ERROR ${res.status} for ${account}:`, errText);
    if (res.status === 403) { invalidateAppToken(); console.warn('[graph-drive] Token cache invalidado por 403'); }
    throw new Error(`Graph Drive list error ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const items: DriveItem[] = ((data.value ?? []) as any[]).map((item: any) => ({
    id: item.id,
    name: item.name ?? '',
    webUrl: item.webUrl ?? '',
    lastModified: item.lastModifiedDateTime ?? '',
    size: item.size ?? 0,
    mimeType: item.file?.mimeType ?? null,
    path: '/',
    type: item.folder ? 'folder' : 'file',
  }));

  console.log(`[graph-drive] LIST: ${items.length} items en ${folderPath ?? '/'}`);
  return items;
}

// ── Diagnostic: test drive access at each level ─────────────────────────

export async function testDriveAccess(account: MailboxAlias) {
  invalidateAppToken(); // force fresh token
  const token = await getAppToken();
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const headers = { Authorization: `Bearer ${token}` };

  const endpoints = [
    { label: 'GET /users/{account}/drive', url: `${GRAPH}/users/${account}/drive` },
    { label: 'GET /users/{account}/drive/root', url: `${GRAPH}/users/${account}/drive/root` },
    { label: 'GET /users/{account}/drive/root/children?$top=3', url: `${GRAPH}/users/${account}/drive/root/children?$top=3` },
    { label: "GET /users/{account}/drive/root/search(q='test')", url: `${GRAPH}/users/${account}/drive/root/search(q='test')?$top=3` },
  ];

  const results: { label: string; status: number; ok: boolean; body: any }[] = [];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, { headers });
      const text = await res.text();
      let body: any;
      try { body = JSON.parse(text); } catch { body = text.substring(0, 500); }
      results.push({ label: ep.label, status: res.status, ok: res.ok, body: res.ok ? summarize(body) : body });
    } catch (err: any) {
      results.push({ label: ep.label, status: 0, ok: false, body: err.message });
    }
  }

  return results;
}

function summarize(body: any): any {
  if (body?.value) return { count: body.value.length, items: body.value.slice(0, 3).map((i: any) => i.name ?? i.id) };
  if (body?.id) return { id: body.id, name: body.name, driveType: body.driveType, quota: body.quota ? 'present' : 'none' };
  return body;
}
