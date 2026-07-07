// ============================================================================
// lib/services/configuracion.service.ts
// Lectura compartida de legal.configuracion (fila única del despacho).
//
// Pensado para los puntos de envío de correo: NUNCA lanza — si la lectura
// falla devuelve null y el correo sale igual (sin recuadro Mercury, con los
// fallbacks hardcodeados de siempre). Cache por instancia serverless (60s),
// mismo patrón que el adminCache de proxy.ts.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

let cache: { data: Record<string, any> | null; ts: number } | null = null;
const CACHE_TTL = 60_000;

export async function obtenerConfiguracionDespacho(): Promise<Record<string, any> | null> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('configuracion')
      .select('*')
      .limit(1)
      .single();

    if (error) throw error;
    cache = { data: data ?? null, ts: Date.now() };
    return cache.data;
  } catch (err: any) {
    console.error('[Configuracion] Error al leer legal.configuracion:', err?.message ?? err);
    // No cachear el fallo: el próximo envío reintenta.
    return null;
  }
}

// Solo para tests/preview: fuerza relectura en el próximo acceso.
export function invalidarCacheConfiguracion(): void {
  cache = null;
}
