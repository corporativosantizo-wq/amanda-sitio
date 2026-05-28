// ============================================================================
// GET /api/blog/[slug]/audio
// "Escuchar artículo": narra el post con OpenAI TTS (tts-1, voz "nova").
// - Extrae el texto del HTML, lo sintetiza y cachea el MP3 en Supabase Storage
//   (bucket público "blog-audio"). Si ya existe en cache, lo sirve directo.
// - El nombre del archivo incluye un hash del texto: si el post cambia, se
//   regenera automáticamente; mientras no cambie, nunca se vuelve a llamar a
//   OpenAI.
// Query params:
//   ?download=1  → fuerza descarga (Content-Disposition: attachment)
//   ?prewarm=1   → solo asegura el cache y responde JSON (usado por el admin)
// Ruta pública (no pasa por la verificación de admin del middleware).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isValidSlug } from '@/lib/utils/slug';
import { htmlToSpeechText, textHash, synthesizeSpeech } from '@/lib/blog/tts';

export const runtime = 'nodejs';
export const maxDuration = 300; // la síntesis de artículos largos puede tardar

const BUCKET = 'blog-audio';

function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// Sirve el MP3 desde nuestro propio dominio (mismo origen → sin CORS/CSP).
// Soporta peticiones Range (206) para que el reproductor permita avanzar/retroceder.
function serveAudio(req: NextRequest, buffer: Buffer, slug: string, download: boolean) {
  const total = buffer.length;
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${slug}.mp3"`,
  };

  const range = req.headers.get('range');
  if (range && !download) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : total - 1;

      if (Number.isNaN(start) || start >= total) {
        return new NextResponse(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' },
        });
      }

      const safeEnd = Math.min(end, total - 1);
      const slice = buffer.subarray(start, safeEnd + 1);
      return new NextResponse(new Uint8Array(slice), {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes ${start}-${safeEnd}/${total}`,
          'Content-Length': String(slice.length),
        },
      });
    }
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { ...baseHeaders, 'Content-Length': String(total) },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: 'Slug inválido.' }, { status: 400 });
  }

  const download = req.nextUrl.searchParams.get('download') === '1';
  const prewarm = req.nextUrl.searchParams.get('prewarm') === '1';

  const db = getPublicClient();

  // 1. Cargar el post publicado.
  const { data: post, error } = await db
    .from('posts')
    .select('title, content, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Artículo no encontrado.' }, { status: 404 });
  }

  // 2. Construir el texto a narrar (título + cuerpo).
  const bodyText = htmlToSpeechText(post.content);
  if (!bodyText) {
    return NextResponse.json({ error: 'El artículo no tiene contenido para narrar.' }, { status: 422 });
  }
  const speechText = `${post.title}. ${bodyText}`;
  const hash = textHash(speechText);
  const path = `${slug}-${hash}.mp3`;

  // 3. ¿Existe ya en cache?
  const { data: cached } = await db.storage.from(BUCKET).download(path);
  if (cached) {
    const buffer = Buffer.from(await cached.arrayBuffer());
    if (prewarm) {
      const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
      return NextResponse.json({ ok: true, generated: false, url: pub.publicUrl });
    }
    return serveAudio(req, buffer, slug, download);
  }

  // 4. No está en cache → generar con OpenAI.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'El servicio de audio no está configurado (falta OPENAI_API_KEY).' },
      { status: 503 }
    );
  }

  let buffer: Buffer;
  try {
    buffer = await synthesizeSpeech(speechText, apiKey);
  } catch (err: any) {
    console.error('[blog/audio] TTS error for', slug + ':', err?.message);
    return NextResponse.json({ error: 'No se pudo generar el audio del artículo.' }, { status: 502 });
  }

  // 5. Cachear en Storage (no bloqueante para la respuesta si falla la subida).
  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'audio/mpeg',
    upsert: true,
  });
  if (upErr) {
    console.error('[blog/audio] Storage upload error for', slug + ':', upErr.message);
  }

  if (prewarm) {
    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ ok: true, generated: true, url: pub.publicUrl });
  }

  return serveAudio(req, buffer, slug, download);
}
