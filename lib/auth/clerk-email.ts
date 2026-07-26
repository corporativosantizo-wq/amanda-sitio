// ============================================================================
// lib/auth/clerk-email.ts
// Resolución del correo PRIMARIO de un usuario de Clerk.
//
// Clerk NO garantiza el orden de emailAddresses: usar [0] puede devolver un
// correo secundario y hacer que el lookup contra legal.usuarios_admin caiga en
// la fila equivocada (incidente 25-jul-2026: resolvió a una fila con
// activo=false y todo el panel respondía 403 "sesión expirada"). Siempre
// resolver por primaryEmailAddressId; si no hay primario definido, devolver
// null y que el caller falle explícito — NUNCA caer de vuelta al [0].
// ============================================================================

interface ClerkEmailAddressLike {
  id: string;
  emailAddress: string;
}

interface ClerkUserLike {
  primaryEmailAddressId?: string | null;
  emailAddresses?: ClerkEmailAddressLike[] | null;
}

export function emailPrimarioDeClerk(user: ClerkUserLike | null | undefined): string | null {
  if (!user?.primaryEmailAddressId || !user.emailAddresses?.length) return null;
  const primario = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId);
  return primario?.emailAddress ?? null;
}
