// ============================================================================
// lib/services/adjuntos.service.ts
// Descarga masiva de adjuntos por remitente vía Microsoft Graph.
// Busca correos recibidos en una cuenta del despacho desde un remitente dado,
// lista/empaqueta sus adjuntos de archivo (fileAttachment) en un ZIP.
// Reutiliza getAppToken() (client_credentials) de outlook.service.
// ============================================================================

import JSZip from 'jszip';
import { getAppToken, type MailboxAlias } from './outlook.service';

const GRAPH = 'https://graph.microsoft.com/v1.0';

const CUENTAS_VALIDAS: MailboxAlias[] = [
  'amanda@papeleo.legal',
  'asistente@papeleo.legal',
  'contador@papeleo.legal',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AdjuntoError extends Error {
  constructor(message: string, public code?: 'permiso' | 'graph' | 'validacion') {
    super(message);
    this.name = 'AdjuntoError';
  }
}

export interface AdjuntoMeta {
  id: string;
  name: string;
  size: number;
  contentType: string | null;
  isInline: boolean;
}

// Forma cruda de un adjunto tal como lo devuelve Microsoft Graph.
interface GraphAttachment {
  id: string;
  name?: string;
  size?: number;
  contentType?: string;
  isInline?: boolean;
  '@odata.type'?: string;
}

export interface CorreoConAdjuntos {
  id: string;
  subject: string;
  receivedDateTime: string;
  attachments: AdjuntoMeta[];
}

export interface BuscarParams {
  account: string;
  remitente: string;
  desde?: string | null; // YYYY-MM-DD (hora GT)
  hasta?: string | null; // YYYY-MM-DD (hora GT)
  incluirInline?: boolean;
}

// ── Validación ───────────────────────────────────────────────────────────────

function validar(params: BuscarParams): { account: MailboxAlias; remitente: string } {
  const account = String(params.account ?? '').trim().toLowerCase();
  if (!CUENTAS_VALIDAS.includes(account as MailboxAlias)) {
    throw new AdjuntoError(`Cuenta inválida: ${account || '(vacía)'}`, 'validacion');
  }
  const remitente = String(params.remitente ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(remitente)) {
    throw new AdjuntoError(`Remitente inválido: ${remitente || '(vacío)'}`, 'validacion');
  }
  return { account: account as MailboxAlias, remitente };
}

// Escapa comillas simples para un literal de cadena OData ('' = una comilla).
function odataStr(s: string): string {
  return s.replace(/'/g, "''");
}

// Construye el $filter de Graph a partir del remitente y el rango de fechas.
// Las fechas vienen en hora GT (UTC-6); se convierten a instantes UTC.
function construirFiltro(remitente: string, desde?: string | null, hasta?: string | null): string {
  const partes = [
    `from/emailAddress/address eq '${odataStr(remitente)}'`,
    `hasAttachments eq true`,
  ];
  if (desde) partes.push(`receivedDateTime ge ${new Date(`${desde}T00:00:00-06:00`).toISOString()}`);
  if (hasta) partes.push(`receivedDateTime le ${new Date(`${hasta}T23:59:59-06:00`).toISOString()}`);
  return partes.join(' and ');
}

// Traduce un error de Graph a un AdjuntoError con mensaje claro (en especial el
// caso de permisos sobre amanda@: requiere Mail.Read a nivel de aplicación, y
// que ninguna Application Access Policy de Exchange excluya esa cuenta).
async function lanzarErrorGraph(res: Response, account: string): Promise<never> {
  const body = await res.text();
  if (res.status === 403 || /ErrorAccessDenied|Access is denied|ApplicationAccessPolicy/i.test(body)) {
    throw new AdjuntoError(
      `Sin permiso para leer la cuenta ${account}. Verifica que la app de Azure tenga ` +
      `Mail.Read a nivel de APLICACIÓN (con consentimiento de admin) y que ninguna ` +
      `Application Access Policy de Exchange excluya a ${account}.`,
      'permiso',
    );
  }
  throw new AdjuntoError(`Error de Microsoft Graph (${res.status}): ${body.substring(0, 200)}`, 'graph');
}

// ── Búsqueda (solo metadatos) ─────────────────────────────────────────────────

export async function buscarCorreosConAdjuntos(params: BuscarParams): Promise<{
  account: string;
  remitente: string;
  correos: CorreoConAdjuntos[];
  totalCorreos: number;
  totalAdjuntos: number;
  tamanoTotal: number;
}> {
  const { account, remitente } = validar(params);
  const incluirInline = params.incluirInline === true;
  const token = await getAppToken();
  const headers = { Authorization: `Bearer ${token}` };

  const filtro = construirFiltro(remitente, params.desde, params.hasta);
  let url =
    `${GRAPH}/users/${encodeURIComponent(account)}/messages` +
    `?$filter=${encodeURIComponent(filtro)}` +
    `&$select=id,subject,receivedDateTime,hasAttachments` +
    `&$top=50`;

  // 1. Recolectar todos los mensajes (paginando @odata.nextLink, con tope).
  const mensajes: Array<{ id: string; subject: string; receivedDateTime: string }> = [];
  let paginas = 0;
  const MAX_PAGINAS = 40; // hasta ~2000 correos
  while (url && paginas < MAX_PAGINAS) {
    const res = await fetch(url, { headers });
    if (!res.ok) await lanzarErrorGraph(res, account);
    const data = await res.json();
    for (const m of data.value ?? []) {
      mensajes.push({ id: m.id, subject: m.subject ?? '(sin asunto)', receivedDateTime: m.receivedDateTime });
    }
    url = data['@odata.nextLink'] ?? '';
    paginas++;
  }

  // 2. Para cada mensaje, obtener la metadata de sus adjuntos.
  const correos: CorreoConAdjuntos[] = [];
  let totalAdjuntos = 0;
  let tamanoTotal = 0;

  for (const m of mensajes) {
    const attUrl =
      `${GRAPH}/users/${encodeURIComponent(account)}/messages/${m.id}/attachments` +
      `?$select=id,name,size,contentType,isInline`;
    const res = await fetch(attUrl, { headers });
    if (!res.ok) await lanzarErrorGraph(res, account);
    const data = await res.json();

    const attachments: AdjuntoMeta[] = ((data.value ?? []) as GraphAttachment[])
      .filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
      .filter((a) => incluirInline || a.isInline !== true)
      .map((a) => ({
        id: a.id,
        name: a.name ?? 'adjunto',
        size: a.size ?? 0,
        contentType: a.contentType ?? null,
        isInline: a.isInline === true,
      }));

    if (attachments.length === 0) continue; // p.ej. solo tenía imágenes inline de la firma
    totalAdjuntos += attachments.length;
    tamanoTotal += attachments.reduce((s, a) => s + a.size, 0);
    correos.push({ id: m.id, subject: m.subject, receivedDateTime: m.receivedDateTime, attachments });
  }

  // Ordenar por fecha descendente (más recientes primero).
  correos.sort((a, b) => (b.receivedDateTime ?? '').localeCompare(a.receivedDateTime ?? ''));

  return {
    account,
    remitente,
    correos,
    totalCorreos: correos.length,
    totalAdjuntos,
    tamanoTotal,
  };
}

// ── Descarga + ZIP ─────────────────────────────────────────────────────────

// YYYY-MM-DD de un ISO (en UTC; suficiente para prefijar nombres y desambiguar).
function fechaPrefijo(iso: string): string {
  return (iso ?? '').substring(0, 10) || 'sin-fecha';
}

export interface ResultadoZip {
  buffer: Buffer;
  totalAdjuntos: number;
  incluidos: number;
  fallidos: Array<{ correo: string; archivo: string; error: string }>;
}

// Re-busca server-side (no confía en una lista del cliente) y empaqueta el
// contenido real de cada adjunto en un ZIP en memoria. Si un adjunto falla,
// continúa con los demás y reporta cuáles fallaron.
export async function descargarAdjuntosZip(params: BuscarParams): Promise<ResultadoZip> {
  const { account } = validar(params);
  const { correos, totalAdjuntos } = await buscarCorreosConAdjuntos(params);

  const token = await getAppToken();
  const headers = { Authorization: `Bearer ${token}` };

  const zip = new JSZip();
  const usados = new Set<string>();
  const fallidos: ResultadoZip['fallidos'] = [];
  let incluidos = 0;

  // Garantiza un nombre único dentro del ZIP (prefija con la fecha del correo y,
  // si aún colisiona, agrega un contador antes de la extensión).
  const nombreUnico = (fecha: string, name: string): string => {
    const base = `${fecha}_${name}`;
    if (!usados.has(base)) { usados.add(base); return base; }
    const dot = base.lastIndexOf('.');
    const stem = dot > 0 ? base.slice(0, dot) : base;
    const ext = dot > 0 ? base.slice(dot) : '';
    let i = 2;
    let candidato = `${stem}_${i}${ext}`;
    while (usados.has(candidato)) { i++; candidato = `${stem}_${i}${ext}`; }
    usados.add(candidato);
    return candidato;
  };

  for (const correo of correos) {
    const fecha = fechaPrefijo(correo.receivedDateTime);
    for (const att of correo.attachments) {
      try {
        const valUrl = `${GRAPH}/users/${encodeURIComponent(account)}/messages/${correo.id}/attachments/${att.id}/$value`;
        const res = await fetch(valUrl, { headers });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Graph ${res.status}: ${txt.substring(0, 120)}`);
        }
        const bytes = Buffer.from(await res.arrayBuffer());
        zip.file(nombreUnico(fecha, att.name), bytes);
        incluidos++;
      } catch (e) {
        fallidos.push({
          correo: correo.subject,
          archivo: att.name,
          error: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }
  }

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return { buffer, totalAdjuntos, incluidos, fallidos };
}
