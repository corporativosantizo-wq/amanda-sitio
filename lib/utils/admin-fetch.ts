import { fetchWithAuthRetry, isSessionExpired } from './auth-redirect';

/**
 * Wrapper global de fetch para toda la app admin.
 * Ante sesión expirada renueva el token de Clerk y reintenta una sola vez;
 * solo lanza SESSION_EXPIRED si el reintento también falló.
 */
export async function adminFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetchWithAuthRetry(url, options);

  if (isSessionExpired(res)) {
    throw new Error('SESSION_EXPIRED');
  }

  return res;
}

/**
 * Lee el body de una respuesta como JSON de forma segura.
 *
 * Si el servidor devuelve HTML (típicamente la página 404/500 de Next cuando
 * la ruta no existe o el deploy está desactualizado), `res.json()` reventaría
 * con el críptico "Unexpected token '<', "<!DOCTYPE "...". Aquí lo convertimos
 * en un Error con mensaje legible y, si la respuesta no es ok, propagamos el
 * `error` del cuerpo JSON cuando exista.
 */
export async function parseJsonResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new Error(
        `El servidor respondió ${res.status}${res.statusText ? ` (${res.statusText})` : ''}. ` +
        `La ruta puede no existir o el despliegue estar desactualizado.`,
      );
    }
    throw new Error('Respuesta inesperada del servidor (no es JSON).');
  }
  if (!res.ok) {
    throw new Error(data?.error ?? `Error ${res.status}`);
  }
  return data as T;
}
