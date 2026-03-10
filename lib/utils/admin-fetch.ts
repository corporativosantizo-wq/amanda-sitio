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

  // Detectar sesión expirada (Clerk redirect, 401, 405)
  if (
    res.type === 'opaqueredirect' ||
    res.status === 401 ||
    res.status === 405 ||
    (res.status >= 300 && res.status < 400)
  ) {
    throw new Error('SESSION_EXPIRED');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = `Error ${res.status}`;
    try {
      message = JSON.parse(text).error || message;
    } catch {}
    throw new Error(message);
  }

  return res;
}
