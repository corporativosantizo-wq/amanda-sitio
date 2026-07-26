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
 * - Status 401 explícito (sin sesión)
 * - Redirect opaco (opaqueredirect) — Clerk interceptó y redirigió a sign-in
 * - Redirect (3xx) cuya Location apunta a una ruta de login de Clerk
 *
 * NO trata un 403 como sesión expirada: 403 = autenticado pero sin permisos
 * (usuario sin acceso admin / desactivado) — re-loguearse no lo arregla, y
 * mostrarlo como "sesión expiró" ocultaba el problema real (incidente
 * 25-jul-2026). El cliente muestra el `error` del body en esos casos.
 * Tampoco trata un 404, 500 o 3xx genérico como sesión expirada.
 */
export function isSessionExpired(res: Response): boolean {
  // 401 = sin sesión: el único status que amerita "vuelve a iniciar sesión"
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
