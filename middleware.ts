// ============================================================================
// middleware.ts
// Clerk authentication middleware
// Protege /admin y /api/admin, permite rutas públicas
// ============================================================================

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rutas que NO requieren autenticación
const isPublicRoute = createRouteMatcher([
  '/',
  '/blog(.*)',
  '/servicios(.*)',
  '/api/webhooks(.*)',    // Webhooks de Clerk, Megaprint, etc.
  '/portal/(.*)',         // Portal de clientes usa su propia auth
  '/sign-in(.*)',
  '/sign-up(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Aplica a todo excepto archivos estáticos y Next.js internals
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Siempre aplica a API routes
    '/(api|trpc)(.*)',
  ],
};
