// ============================================================================
// lib/auth/api-auth.ts
// Helper para validar autenticación en API routes
// ============================================================================

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emailPrimarioDeClerk } from '@/lib/auth/clerk-email';
import type { AdminUser } from '@/lib/rbac/permissions';

/**
 * Verifica que el request viene de un usuario autenticado.
 * Retorna el userId + correo PRIMARIO de Clerk, o una respuesta de error.
 *
 * Códigos:
 * - 401 "No autenticado" — sin sesión de Clerk (el único caso que el cliente
 *   trata como "sesión expirada").
 * - 500 — usuario autenticado pero sin correo primario resoluble (estado
 *   anómalo de la cuenta Clerk; fallo explícito, nunca caer a emailAddresses[0]).
 *
 * Uso en API routes:
 * ```ts
 * export async function GET(req: NextRequest) {
 *   const session = await requireAuth();
 *   if (session instanceof NextResponse) return session;
 *   // session.userId está disponible
 * }
 * ```
 */
export async function requireAuth(): Promise<
  { userId: string; email: string } | NextResponse
> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: 'No autenticado' },
      { status: 401 }
    );
  }

  const user = await currentUser();
  const email = emailPrimarioDeClerk(user);

  if (!email) {
    // Cuenta sin correo primario definido: error de configuración, no de
    // permisos. El detalle queda en el log del servidor.
    console.error('[auth] Usuario Clerk sin correo primario resoluble | userId:', userId);
    return NextResponse.json(
      { error: 'No se pudo resolver la identidad del usuario' },
      { status: 500 }
    );
  }

  return { userId, email };
}

// ── Autorización admin (núcleo testeable, separado del transporte HTTP) ─────

export type ResultadoAutorizacion =
  | { ok: true; adminUser: AdminUser }
  | { ok: false; status: 403 | 500; error: string };

/**
 * Busca el correo en legal.usuarios_admin y decide la autorización.
 * Distingue explícitamente:
 * - fallo de la consulta a Supabase → 500 (infraestructura, NO permisos)
 * - sin fila → 403 "Usuario sin acceso admin"
 * - fila con activo=false → 403 "Usuario desactivado"
 * El detalle técnico de un fallo de consulta va SOLO al log del servidor.
 */
export async function autorizarAdminPorEmail(
  email: string,
  supabase = createAdminClient(),
): Promise<ResultadoAutorizacion> {
  const { data, error } = await supabase
    .from('usuarios_admin')
    .select('id, email, nombre, rol, modulos_permitidos, activo')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('[auth] Error consultando usuarios_admin:', error.message ?? error);
    return { ok: false, status: 500, error: 'Error interno de autenticación' };
  }

  if (!data) {
    return { ok: false, status: 403, error: 'Usuario sin acceso admin' };
  }

  if (!data.activo) {
    return { ok: false, status: 403, error: 'Usuario desactivado' };
  }

  return { ok: true, adminUser: data as AdminUser };
}

/**
 * Verifica autenticación + que el usuario sea admin activo en usuarios_admin.
 * Retorna { userId, email, adminUser } o la respuesta de error (401/403/500).
 */
export async function requireAdmin(): Promise<
  { userId: string; email: string; adminUser: AdminUser } | NextResponse
> {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const resultado = await autorizarAdminPorEmail(session.email);
  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error },
      { status: resultado.status }
    );
  }

  return { userId: session.userId, email: session.email, adminUser: resultado.adminUser };
}
