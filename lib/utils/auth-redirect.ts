// ============================================================================
// lib/utils/auth-redirect.ts
// Detección precisa de sesión expirada por Clerk
// Solo marca como "sesión expirada" cuando hay evidencia clara de auth failure
// ============================================================================

export const SESSION_EXPIRED_MSG =
  'Tu sesión expiró. Recarga la página para volver a iniciar sesión.';

/**
 * Detecta si un response indica que la sesión de Clerk expiró.
 *
 * Solo retorna true cuando hay evidencia clara:
 * - Status 401 explícito
 * - Redirect opaco (opaqueredirect) — Clerk interceptó y redirigió a sign-in
 * - Redirect (3xx) cuya Location apunta a una ruta de login de Clerk
 *
 * NO trata un 404 o un 3xx genérico como sesión expirada. Un 403 tampoco:
 * significa "autenticado pero sin permiso" (usuario desactivado o no
 * registrado en usuarios_admin) — ese caso debe mostrar el error del body,
 * no pedir re-login (incidente 25/27-jul-2026: ambos se pintaban igual).
 */
export function isSessionExpired(res: Response): boolean {
  if (res.status === 401) return true;

  // Opaque redirect = el browser no puede leer la URL, pero Clerk lo causó
  // via redirect: 'manual'. Esto solo pasa con middleware de Clerk.
  if (res.type === 'opaqueredirect') return true;

  // 3xx redirect — solo si apunta a sign-in / clerk
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location') ?? '';
    if (
      location.includes('/sign-in') ||
      location.includes('/login') ||
      location.includes('clerk.') ||
      location.includes('accounts.')
    ) {
      return true;
    }
    // Redirect genérico (ej. 301/302 a otra ruta) → NO es sesión expirada
    return false;
  }

  return false;
}

/**
 * Fuerza a clerk-js a emitir un token de sesión fresco. Al renovarlo,
 * clerk-js reescribe la cookie __session, así que el siguiente request
 * (fetch o navegación) llega autenticado al middleware.
 *
 * @returns true si se obtuvo token nuevo; false si Clerk no está disponible
 *          o la sesión realmente murió (ahí sí toca re-login).
 */
export async function refreshClerkToken(): Promise<boolean> {
  try {
    const clerk = (window as { Clerk?: { session?: { getToken(opts?: { skipCache?: boolean }): Promise<string | null> } } }).Clerk;
    if (!clerk?.session) return false;
    const token = await clerk.session.getToken({ skipCache: true });
    return token != null;
  } catch {
    return false;
  }
}

/**
 * fetch con UN reintento ante sesión expirada: si la respuesta es 401 (o un
 * redirect de Clerk a sign-in), renueva el token y repite el request una sola
 * vez. Nunca reintenta en bucle. Seguro incluso para POST: el 401 nace en el
 * middleware, antes de ejecutar el handler, así que el request rechazado no
 * tuvo efectos.
 */
export async function fetchWithAuthRetry(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const doFetch = () => fetch(input, { ...init, redirect: 'manual' });
  let res = await doFetch();
  if (isSessionExpired(res) && (await refreshClerkToken())) {
    res = await doFetch();
  }
  return res;
}
