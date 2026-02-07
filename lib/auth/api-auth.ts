// ============================================================================
// lib/auth/api-auth.ts
// Helper para validar autenticación en API routes
// ============================================================================

import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

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
 * Verifica autenticación + que el usuario sea admin.
 * Durante los primeros 4 meses (Amanda sola), solo verifica auth.
 * Cuando se agregue el equipo, descomentar la validación de rol.
 */
export async function requireAdmin(): Promise<
  { userId: string; email: string } | NextResponse
> {
  const session = await requireAuth();
  if (session instanceof NextResponse) return session;

  // TODO: Cuando se agreguen más usuarios, activar validación de rol:
  // const { sessionClaims } = await auth();
  // const role = sessionClaims?.metadata?.role;
  // if (role !== 'admin' && role !== 'abogado') {
  //   return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  // }

  return session;
}
