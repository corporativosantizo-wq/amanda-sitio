// ============================================================================
// middleware.ts
// Clerk authentication middleware
// SOLO protege /admin y /api/admin — todo lo demás es público
// ============================================================================

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Rutas que SÍ requieren autenticación con Clerk (whitelist)
const isProtectedRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
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
