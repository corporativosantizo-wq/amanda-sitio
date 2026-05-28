// ============================================================================
// lib/og/fonts.ts
// Carga fuentes para Satori/ImageResponse desde Google Fonts.
// Usa el parámetro `text=` (método documentado por Next.js): Google devuelve
// un subset en formato truetype que Satori puede parsear.
// ============================================================================

type FontWeight = 400 | 500 | 600 | 700 | 800;

const cache = new Map<string, ArrayBuffer>();

async function fetchGoogleFont(
  family: string,
  weight: FontWeight,
  text: string
): Promise<ArrayBuffer> {
  const key = `${family}:${weight}:${text}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const url =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}` +
    `&text=${encodeURIComponent(text)}`;

  const css = await (await fetch(url)).text();
  const match = css.match(/src: url\((.+?)\) format\('(truetype|opentype)'\)/);
  if (!match) throw new Error(`No se encontró la URL de la fuente ${family} ${weight}`);

  const data = await (await fetch(match[1])).arrayBuffer();
  cache.set(key, data);
  return data;
}

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
}

/**
 * Carga los pesos de Plus Jakarta Sans necesarios para renderizar `text`.
 * Devuelve el array `fonts` que espera ImageResponse.
 */
export async function loadCardFonts(text: string): Promise<OgFont[]> {
  const family = 'Plus Jakarta Sans';
  const [extrabold, semibold] = await Promise.all([
    fetchGoogleFont(family, 800, text),
    fetchGoogleFont(family, 600, text),
  ]);

  return [
    { name: family, data: extrabold, weight: 800, style: 'normal' },
    { name: family, data: semibold, weight: 600, style: 'normal' },
  ];
}
