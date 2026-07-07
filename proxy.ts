// ============================================================================
// proxy.ts (Next.js 16 middleware convention)
// Clerk authentication + admin role verification para /api/admin/*
// ============================================================================

import { clerkClient, clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Rutas que SÍ requieren autenticación con Clerk.
// /api/pagos/checkout (pago de cita con Stripe): hoy ningún flujo de cliente
// lo usa — estaba desplegado sin auth y cualquiera con la URL podía crear
// sesiones de pago reales (además cobra en USD, BUG-003). Sesión Clerk
// obligatoria + rol admin en el route handler, hasta que la Fase 5 defina el
// flujo de pago real para clientes. NO incluir /api/pagos/webhook (Stripe
// necesita alcanzarlo sin sesión; valida su propia firma) ni
// /api/pagos/checkout-producto (tienda pública, precio server-side).
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
  '/api/pagos/checkout',
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

// Headers anti-caché para respuestas de auth generadas en el middleware.
// El edge de Vercel llegó a cachear el rewrite-404 de auth.protect() para
// método+ruta (incidente 4-jul-2026): un solo request sin sesión dejaba el
// endpoint respondiendo 404 a TODOS hasta el siguiente deploy.
const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

export default clerkMiddleware(async (auth, req) => {
  // No proteger rutas públicas ni cron endpoints
  if (!isProtectedRoute(req) || isCronEndpoint(req)) return;

  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');

  // Autenticación Clerk obligatoria.
  // - Rutas /api/*: 401 JSON explícito y no cacheable. NO usar auth.protect()
  //   aquí — su rewrite-404 es cacheable por el edge (ver NO_STORE_HEADERS) y
  //   además el 404 confundía el diagnóstico (BUG-001).
  // - Páginas: se mantiene auth.protect() → redirige al sign-in como siempre.
  const { userId } = await auth();
  if (!userId) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: 'No autorizado: sesión inválida o expirada' },
        { status: 401, headers: NO_STORE_HEADERS },
      );
    }
    await auth.protect();
    return;
  }

  // Verificación de rol admin:
  // - /api/admin/* (excepto auth-only) → 403 JSON si no es admin
  // - /admin/* (páginas) → redirige a home si no es admin
  const isApiAdmin = pathname.startsWith('/api/admin/') && !isAuthOnlyEndpoint(req);
  const isPageAdmin = pathname.startsWith('/admin');

  if (isApiAdmin || isPageAdmin) {
    if (!(await checkIsAdmin(userId))) {
      if (isApiAdmin) {
        return NextResponse.json(
          { error: 'Se requiere rol de administrador' },
          { status: 403, headers: NO_STORE_HEADERS },
        );
      }
      return NextResponse.redirect(new URL('/', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
