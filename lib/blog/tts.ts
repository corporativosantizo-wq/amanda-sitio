// ============================================================================
// lib/blog/tts.ts
// Text-to-Speech para artículos del blog vía OpenAI (modelo tts-1, voz "nova").
// - Extrae texto legible del HTML del post (strip tags + pausas naturales).
// - Trocea el texto (la API de OpenAI limita ~4096 chars por petición) y
//   concatena los MP3 resultantes (los frames MP3 se reproducen en secuencia).
// ============================================================================

import crypto from 'crypto';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';
const TTS_MODEL = 'tts-1';
const TTS_VOICE = 'nova';
// Margen de seguridad bajo el límite de 4096 chars de la API.
const MAX_CHUNK = 3800;

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&hellip;': '…',
  '&aacute;': 'á',
  '&eacute;': 'é',
  '&iacute;': 'í',
  '&oacute;': 'ó',
  '&uacute;': 'ú',
  '&ntilde;': 'ñ',
  '&Aacute;': 'Á',
  '&Eacute;': 'É',
  '&Iacute;': 'Í',
  '&Oacute;': 'Ó',
  '&Uacute;': 'Ú',
  '&Ntilde;': 'Ñ',
  '&uuml;': 'ü',
  '&Uuml;': 'Ü',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+\d*;/gi, (m) => HTML_ENTITIES[m] ?? HTML_ENTITIES[m.toLowerCase()] ?? ' ');
}

/** Convierte el HTML (o texto plano) del post en texto natural para narrar. */
export function htmlToSpeechText(html: string | null | undefined): string {
  const raw = (html ?? '').trim();
  if (!raw) return '';

  return decodeEntities(
    raw
      // Cierre de bloques → punto + salto para dar pausas naturales.
      .replace(/<\/(h[1-6]|p|li|blockquote|div)>/gi, '. ')
      .replace(/<\/(ul|ol|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '. ')
      // Elimina el resto de etiquetas.
      .replace(/<[^>]+>/g, ' ')
  )
    // Normaliza espacios y puntuación duplicada.
    .replace(/\s+/g, ' ')
    .replace(/\s*\.\s*(?=\.)/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

/** Hash corto y estable del texto, para nombrar el archivo cacheado. */
export function textHash(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex').slice(0, 16);
}

/** Trocea el texto en bloques <= MAX_CHUNK respetando límites de oración. */
export function chunkText(text: string, maxLen = MAX_CHUNK): string[] {
  if (text.length <= maxLen) return text ? [text] : [];

  const chunks: string[] = [];
  // Divide por oraciones manteniendo el signo de puntuación.
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  let current = '';

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      // Oración gigante: pártela por palabras.
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      const words = sentence.split(/\s+/);
      let piece = '';
      for (const w of words) {
        if ((piece + ' ' + w).length > maxLen) {
          if (piece) chunks.push(piece.trim());
          piece = w;
        } else {
          piece = piece ? `${piece} ${w}` : w;
        }
      }
      if (piece) current = piece;
      continue;
    }

    if ((current + sentence).length > maxLen) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

async function synthesizeChunk(input: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`OpenAI TTS error ${res.status}: ${detail.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

/** Genera el MP3 completo del texto (troceado + concatenado). */
export async function synthesizeSpeech(text: string, apiKey: string): Promise<Buffer> {
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error('No hay texto para sintetizar.');

  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(chunk, apiKey));
  }
  return Buffer.concat(buffers);
}
