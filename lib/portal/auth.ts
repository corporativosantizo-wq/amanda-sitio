// ============================================================================
// lib/portal/auth.ts
// Funciones de autenticación del portal de clientes
// ============================================================================
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export interface PortalSession {
  userId: string;
  email: string;
  clienteId: string;
  portalUserId: string;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/**
 * Verifica el token JWT de Supabase Auth y retorna datos del portal
 * Usa service_role para verificar — solo llamar desde API routes
 */
export async function getPortalSession(
  authHeader: string | null
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

  // Buscar portal_usuarios existente
  const { data: portalUser } = await db
    .from('portal_usuarios')
    .select('id, cliente_id')
    .eq('auth_user_id', user.id)
    .eq('activo', true)
    .single();

  if (portalUser) {
    // Actualizar ultimo_acceso (fire-and-forget)
    db.from('portal_usuarios')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', portalUser.id)
      .then(
        () => {},
        () => {}
      );

    return {
      userId: user.id,
      email: user.email!,
      clienteId: portalUser.cliente_id,
      portalUserId: portalUser.id,
    };
  }

  // Auto-crear vinculación si el email existe en clientes
  if (user.email) {
    const { data: cliente } = await db
      .from('clientes')
      .select('id')
      .eq('email', user.email)
      .eq('estado', 'activo')
      .single();

    if (cliente) {
      const { data: created } = await db
        .from('portal_usuarios')
        .insert({
          cliente_id: cliente.id,
          auth_user_id: user.id,
          email: user.email,
        })
        .select('id, cliente_id')
        .single();

      if (created) {
        return {
          userId: user.id,
          email: user.email,
          clienteId: created.cliente_id,
          portalUserId: created.id,
        };
      }
    }
  }

  return null;
}
