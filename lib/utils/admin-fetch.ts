import { isSessionExpired } from './auth-redirect';

/**
 * Wrapper global de fetch para toda la app admin.
 * Detecta sesión expirada de Clerk y lanza error específico.
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    redirect: 'manual',
  });

  if (isSessionExpired(res)) {
    throw new Error('SESSION_EXPIRED');
  }

  return res;
}
