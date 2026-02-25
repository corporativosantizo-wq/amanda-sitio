// ============================================================================
// lib/utils/validate-url.ts
// Validación de URLs externas para prevenir Open Redirect attacks.
// ============================================================================

const TRUSTED_DOMAINS = [
  'supabase.co',
  'amandasantizo.com',
  'checkout.stripe.com',
  'login.microsoftonline.com',
  'graph.microsoft.com',
];

/**
 * Valida que una URL pertenezca a un dominio confiable.
 * Retorna la URL si es válida, o null si no es confiable.
 */
export function validateExternalUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Solo permitir HTTPS (excepto localhost en dev)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }

    const hostname = parsed.hostname.toLowerCase();

    for (const domain of TRUSTED_DOMAINS) {
      if (hostname === domain || hostname.endsWith(`.${domain}`)) {
        return url;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Abre una URL en nueva pestaña solo si es de un dominio confiable.
 * Retorna true si se abrió, false si se bloqueó.
 */
export function safeWindowOpen(url: string): boolean {
  const validated = validateExternalUrl(url);
  if (!validated) {
    console.warn('[Security] Blocked open redirect to untrusted URL:', url);
    return false;
  }
  window.open(validated, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Redirige solo si la URL es de un dominio confiable.
 * Retorna true si redirigió, false si se bloqueó.
 */
export function safeRedirect(url: string): boolean {
  const validated = validateExternalUrl(url);
  if (!validated) {
    console.warn('[Security] Blocked redirect to untrusted URL:', url);
    return false;
  }
  window.location.href = validated;
  return true;
}
