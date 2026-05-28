// ============================================================================
// app/blog/[slug]/opengraph-image.tsx
// og:image (1200x630) generado por post. Next lo cablea automáticamente a las
// metaetiquetas og:image y twitter:image. Público (lectura RLS de published).
// ============================================================================

import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { socialCard, CARD_STATIC_TEXT } from '@/lib/og/social-card';
import { loadCardFonts } from '@/lib/og/fonts';
import { qrDataUrl } from '@/lib/og/qr';
import { SITE_URL, SITE_NAME, postUrl } from '@/lib/site';

export const runtime = 'nodejs';
export const alt = `${SITE_NAME} — Blog`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from('posts')
    .select('title, slug, excerpt')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  const title = post?.title ?? 'Blog Legal';
  const excerpt = post?.excerpt ?? null;

  const qr = await qrDataUrl(post ? postUrl(post.slug) : `${SITE_URL}/blog`);
  const fonts = await loadCardFonts(`${title}${excerpt ?? ''}${CARD_STATIC_TEXT}`);

  return new ImageResponse(
    socialCard({ variant: 'og', title, excerpt, qrDataUrl: qr, siteUrl: SITE_URL }),
    { ...size, fonts }
  );
}
