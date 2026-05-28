// ============================================================================
// lib/og/social-card.tsx
// Tarjeta para redes sociales renderizada con Satori (next/og ImageResponse).
// Variantes: feed (1080x1080), story (1080x1920), og (1200x630).
// Reglas Satori: estilos inline, display:flex explícito en contenedores.
// ============================================================================

import { SITE_NAME, SITE_TAGLINE } from '@/lib/site';

export type CardVariant = 'feed' | 'story' | 'og';

export const CARD_SIZES: Record<CardVariant, { width: number; height: number }> = {
  feed: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  og: { width: 1200, height: 630 },
};

interface CardOptions {
  variant: CardVariant;
  title: string;
  excerpt?: string | null;
  qrDataUrl: string;
  siteUrl: string; // dominio mostrado, ej. amandasantizo.com
}

function truncate(s: string, n: number): string {
  const clean = s.trim().replace(/\s+/g, ' ');
  return clean.length > n ? clean.slice(0, n - 1).trimEnd() + '…' : clean;
}

function titleFontSize(variant: CardVariant, len: number): number {
  const base = variant === 'story' ? 86 : variant === 'og' ? 58 : 72;
  if (len > 90) return Math.round(base * 0.62);
  if (len > 60) return Math.round(base * 0.74);
  if (len > 36) return Math.round(base * 0.88);
  return base;
}

// Texto necesario para subsetear las fuentes (logo + tagline + chrome fijo).
export const CARD_STATIC_TEXT =
  `${SITE_NAME}${SITE_TAGLINE}Escanea para leer el artículo completoamandasantizo.com…`;

export function socialCard(opts: CardOptions) {
  const { variant, qrDataUrl, siteUrl } = opts;
  const isStory = variant === 'story';
  const isOg = variant === 'og';

  const pad = isStory ? 110 : isOg ? 60 : 92;
  const title = truncate(opts.title, isOg ? 110 : 140);
  const excerpt = opts.excerpt ? truncate(opts.excerpt, isOg ? 110 : 170) : '';
  const showExcerpt = Boolean(excerpt) && !isOg;

  const logoName = isStory ? 46 : isOg ? 34 : 42;
  const tagline = isStory ? 24 : isOg ? 17 : 22;
  const titleSize = titleFontSize(variant, title.length);
  const excerptSize = isStory ? 38 : 32;
  const urlSize = isStory ? 34 : isOg ? 26 : 30;
  const qrSize = isStory ? 210 : isOg ? 150 : 196;

  const display = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: pad,
        justifyContent: 'space-between',
        backgroundColor: '#0F172A',
        backgroundImage:
          'linear-gradient(135deg, #0F172A 0%, #13315C 48%, #0E7490 100%)',
        fontFamily: 'Plus Jakarta Sans',
        position: 'relative',
      }}
    >
      {/* Glow decorativo */}
      <div
        style={{
          display: 'flex',
          position: 'absolute',
          top: -160,
          right: -160,
          width: 520,
          height: 520,
          borderRadius: 520,
          backgroundColor: 'rgba(34, 211, 238, 0.18)',
        }}
      />

      {/* Header: logo */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            width: isOg ? 64 : 90,
            height: isOg ? 6 : 8,
            borderRadius: 8,
            backgroundColor: '#22D3EE',
            marginBottom: isOg ? 18 : 28,
          }}
        />
        <div
          style={{
            display: 'flex',
            color: '#FFFFFF',
            fontSize: logoName,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            display: 'flex',
            color: '#67E8F9',
            fontSize: tagline,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginTop: 6,
          }}
        >
          {SITE_TAGLINE}
        </div>
      </div>

      {/* Body: título + extracto */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: isOg ? 16 : 40,
          paddingBottom: isOg ? 16 : 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            color: '#FFFFFF',
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.12,
            letterSpacing: -0.5,
          }}
        >
          {title}
        </div>
        {showExcerpt && (
          <div
            style={{
              display: 'flex',
              color: 'rgba(226, 232, 240, 0.88)',
              fontSize: excerptSize,
              fontWeight: 600,
              lineHeight: 1.4,
              marginTop: 32,
            }}
          >
            {excerpt}
          </div>
        )}
      </div>

      {/* Footer: URL + QR */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              color: '#67E8F9',
              fontSize: urlSize,
              fontWeight: 800,
            }}
          >
            {display}
          </div>
          {!isOg && (
            <div
              style={{
                display: 'flex',
                color: 'rgba(226, 232, 240, 0.7)',
                fontSize: isStory ? 24 : 22,
                fontWeight: 600,
                marginTop: 8,
              }}
            >
              Escanea para leer el artículo completo
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            padding: 14,
            borderRadius: 20,
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} width={qrSize} height={qrSize} alt="QR" />
        </div>
      </div>
    </div>
  );
}
