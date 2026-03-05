// ============================================================================
// lib/auth/api-auth.ts
// Helper para validar autenticación en API routes
// ============================================================================

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AdminUser } from '@/lib/rbac/permissions';

/**
 * Verifica que el request viene de un usuario autenticado.
 * Retorna el userId o una respuesta 401.
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

  // Obtener email del usuario
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress ?? '';

  return { userId, email };
}

/**
 * Verifica autenticación + que el usuario sea admin activo en usuarios_admin.
 * Retorna { userId, email, adminUser } o 403.
 */
export async function requireAdmin(): Promise<
  { userId: string; email: string; adminUser: AdminUser } | NextResponse
> {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('usuarios_admin')
    .select('id, email, nombre, rol, modulos_permitidos, activo')
    .eq('email', session.email)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'Usuario no registrado como admin' },
      { status: 403 }
    );
  }

  if (!data.activo) {
    return NextResponse.json(
      { error: 'Usuario desactivado' },
      { status: 403 }
    );
  }

  return { userId: session.userId, email: session.email, adminUser: data };
}
