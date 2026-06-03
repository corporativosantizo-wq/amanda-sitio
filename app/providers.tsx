// ============================================================================
// app/providers.tsx
// Providers wrapper (Clerk + otros providers futuros)
// ============================================================================

'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';

// La publishable key se inyecta en build (NEXT_PUBLIC_*). Si falta (p.ej. un
// build sin variables de entorno), NO instanciamos ClerkProvider: así el
// prerender de las páginas públicas y de /_not-found no revienta con
// "Missing publishableKey" y el build no se rompe. En producción la key SIEMPRE
// está presente, por lo que el comportamiento de auth no cambia.
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function Providers({ children }: { children: React.ReactNode }) {
  if (!PUBLISHABLE_KEY) {
    return <>{children}</>;
  }
  return (
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      localization={esES}
      appearance={{
        variables: {
          colorPrimary: '#1E40AF',
          colorTextOnPrimaryBackground: '#ffffff',
          borderRadius: '0.75rem',
        },
        elements: {
          formButtonPrimary: 'bg-[#1E40AF] hover:bg-[#1e3a8a]',
          card: 'shadow-xl',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
