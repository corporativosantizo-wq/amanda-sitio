// ============================================================================
// GET /api/admin/posts/[id]/social-image?format=feed|story
// Genera una tarjeta PNG para Instagram (feed 1080x1080 o stories 1080x1920)
// y la devuelve como descarga. Protegido por middleware (Clerk + rol admin).
// ============================================================================

import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { socialCard, CARD_SIZES, CARD_STATIC_TEXT, type CardVariant } from '@/lib/og/social-card';
import { loadCardFonts } from '@/lib/og/fonts';
import { qrDataUrl } from '@/lib/og/qr';
import { SITE_URL, postUrl } from '@/lib/site';

export const runtime = 'nodejs';

function getAdminPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const formatParam = req.nextUrl.searchParams.get('format');
  const variant: CardVariant = formatParam === 'story' ? 'story' : 'feed';

  const db = getAdminPublicClient();
  const { data: post, error } = await db
    .from('posts')
    .select('title, slug, excerpt')
    .eq('id', id)
    .single();

  if (error || !post) {
    return new Response('Post no encontrado', { status: 404 });
  }

  const qr = await qrDataUrl(postUrl(post.slug));
  const fonts = await loadCardFonts(`${post.title}${post.excerpt ?? ''}${CARD_STATIC_TEXT}`);
  const { width, height } = CARD_SIZES[variant];

  return new ImageResponse(
    socialCard({
      variant,
      title: post.title,
      excerpt: post.excerpt,
      qrDataUrl: qr,
      siteUrl: SITE_URL,
    }),
    {
      width,
      height,
      fonts,
      headers: {
        'Content-Disposition': `attachment; filename="${post.slug}-${variant}.png"`,
        'Cache-Control': 'no-store',
      },
    }
  );
}
