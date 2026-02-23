// ============================================================================
// lib/portal/auth.ts
// Funciones de autenticación del portal de clientes
// Soporta multi-empresa: un auth_user puede tener múltiples clientes
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PortalSession {
  userId: string;
  email: string;
  clienteId: string;
  clienteIds: string[];
  portalUserId: string;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Verifica el token JWT y retorna datos del portal.
 * Si requestedClienteId se proporciona, valida que el usuario tenga acceso
 * a ese cliente. Si no, usa el primer cliente vinculado.
 */
export async function getPortalSession(
  authHeader: string | null,
  requestedClienteId?: string | null
): Promise<PortalSession | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;

  const db = createAdminClient();

  // Obtener TODOS los portal_usuarios activos para este auth_user
  let { data: portalUsers } = await db
    .from('portal_usuarios')
    .select('id, cliente_id')
    .eq('auth_user_id', user.id)
    .eq('activo', true);

  // Auto-crear vinculaciones si no existen (con protección contra race conditions)
  if ((!portalUsers || portalUsers.length === 0) && user.email) {
    const { data: clientes } = await db
      .from('clientes')
      .select('id')
      .eq('email', user.email)
      .eq('activo', true);

    if (clientes && clientes.length > 0) {
      const inserts = clientes.map((c: any) => ({
        cliente_id: c.id,
        auth_user_id: user.id,
        email: user.email!,
      }));
      // upsert para evitar duplicados por race condition
      const { data: created } = await db
        .from('portal_usuarios')
        .upsert(inserts, { onConflict: 'auth_user_id,cliente_id', ignoreDuplicates: true })
        .select('id, cliente_id');
      // Si upsert no retornó datos (ignoreDuplicates), re-query
      if (!created || created.length === 0) {
        const { data: refetched } = await db
          .from('portal_usuarios')
          .select('id, cliente_id')
          .eq('auth_user_id', user.id)
          .eq('activo', true);
        portalUsers = refetched;
      } else {
        portalUsers = created;
      }
    }
  }

  if (!portalUsers || portalUsers.length === 0) return null;

  const clienteIds = portalUsers.map((p: any) => p.cliente_id as string);

  // Seleccionar cliente: validar el solicitado o usar el primero
  let selectedId: string;
  if (requestedClienteId && clienteIds.includes(requestedClienteId)) {
    selectedId = requestedClienteId;
  } else {
    selectedId = clienteIds[0];
  }

  const selectedPortalUser = portalUsers.find(
    (p: any) => p.cliente_id === selectedId
  );

  // Actualizar ultimo_acceso (fire-and-forget)
  if (selectedPortalUser) {
    db.from('portal_usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', selectedPortalUser.id)
      .then(
        () => {},
        () => {}
      );
  }

  return {
    userId: user.id,
    email: user.email!,
    clienteId: selectedId,
    clienteIds,
    portalUserId: selectedPortalUser?.id ?? portalUsers[0].id,
  };
}
