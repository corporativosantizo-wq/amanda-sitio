// ============================================================================
// middleware.ts (proxy.ts — Next.js lo reconoce como middleware)
// Clerk authentication + admin role verification para /api/admin/*
// ============================================================================

import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Rutas que SÍ requieren autenticación con Clerk
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

// Endpoints machine-to-machine con su propia auth (x-cron-secret)
const isCronEndpoint = createRouteMatcher([
  '/api/admin/email/send',
  '/api/admin/email/resumen-semanal',
  '/api/admin/cron/enviar-cotizaciones',
]);

// Endpoints que requieren auth Clerk pero NO verificación de admin role
const isAuthOnlyEndpoint = createRouteMatcher([
  '/api/admin/me',
  '/api/admin/calendario/callback',
]);

// ── Cache de admin status por userId (TTL 60s, por instancia serverless) ────

const adminCache = new Map<string, { isAdmin: boolean; ts: number }>();
const CACHE_TTL = 60_000;

async function checkIsAdmin(userId: string): Promise<boolean> {
  const cached = adminCache.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.isAdmin;

  try {
    // 1. Obtener email del usuario via Clerk
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      adminCache.set(userId, { isAdmin: false, ts: Date.now() });
      return false;
    }

    // 2. Verificar en tabla usuarios_admin (schema: legal)
    // Permite cualquier rol activo — el RBAC granular (modulos_permitidos) se aplica después
    const url = new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/usuarios_admin`);
    url.searchParams.set('email', `eq.${email}`);
    url.searchParams.set('activo', 'eq.true');
    url.searchParams.set('select', 'id');

    const resp = await fetch(url.toString(), {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
        'Accept-Profile': 'legal',
      },
    });

    const data = resp.ok ? await resp.json() : [];
    const isAdmin = Array.isArray(data) && data.length > 0;

    adminCache.set(userId, { isAdmin, ts: Date.now() });
    return isAdmin;
  } catch {
    // Si hay error de red, denegar acceso por seguridad
    return false;
  }
}

export default clerkMiddleware(async (auth, req) => {
  // No proteger rutas públicas ni cron endpoints
  if (!isProtectedRoute(req) || isCronEndpoint(req)) return;

  // Autenticación Clerk obligatoria
  await auth.protect();

  // Para rutas /api/admin/* (excepto auth-only), verificar rol admin
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/admin/') && !isAuthOnlyEndpoint(req)) {
    const { userId } = await auth();
    if (!userId || !(await checkIsAdmin(userId))) {
      return NextResponse.json(
        { error: 'Se requiere rol de administrador' },
        { status: 403 },
      );
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
