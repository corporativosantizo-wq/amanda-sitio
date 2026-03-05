// ============================================================================
// app/sign-in/[[...sign-in]]/page.tsx
// ============================================================================

import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#1E40AF]">IURISLEX</h1>
          <p className="text-sm text-slate-500 mt-1">Sistema de Gestión Legal</p>
        </div>
        <SignIn
          afterSignInUrl="/admin"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
            },
          }}
        />
      </div>
    </div>
  );
}
