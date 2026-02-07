// ============================================================================
// GET /api/portal/auth/session
// Verifica sesión y retorna datos del cliente
// ============================================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`session:${ip}`, 60, 60_000);
  if (!allowed) {
    return Response.json(
      { error: 'Demasiadas solicitudes.' },
      { status: 429, headers: SECURITY_HEADERS }
    );
  }

  const session = await getPortalSession(req.headers.get('authorization'));
  if (!session) {
    return Response.json(
      { error: 'No autorizado' },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  const db = createAdminClient();
  const { data: cliente } = await db
    .from('clientes')
    .select('id, nombre, email, codigo, tipo')
    .eq('id', session.clienteId)
    .single();

  if (!cliente) {
    return Response.json(
      { error: 'Cliente no encontrado' },
      { status: 404, headers: SECURITY_HEADERS }
    );
  }

  return Response.json({ cliente }, { headers: SECURITY_HEADERS });
}
