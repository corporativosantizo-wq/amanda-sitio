// ============================================================================
// app/providers.tsx
// Providers wrapper (Clerk + otros providers futuros)
// ============================================================================

'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
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
