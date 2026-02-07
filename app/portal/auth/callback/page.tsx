// ============================================================================
// app/portal/auth/callback/page.tsx
// Callback del magic link — establece sesión y redirige al portal
// ============================================================================
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortalClient } from '@/lib/supabase/portal';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createPortalClient();

    async function handleCallback() {
      try {
        // Caso 1: code en query params (PKCE flow)
        const code = searchParams.get('code');
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setError(
              'Error al verificar el enlace. Solicite uno nuevo.'
            );
            return;
          }
          router.replace('/portal');
          return;
        }

        // Caso 2: token_hash (email OTP)
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        if (tokenHash && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (verifyError) {
            setError(
              'El enlace ha expirado o no es válido. Solicite uno nuevo.'
            );
            return;
          }
          router.replace('/portal');
          return;
        }

        // Caso 3: tokens en el hash (implicit flow) — Supabase los detecta automáticamente
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace('/portal');
          return;
        }

        // Esperar a que el auth state change detecte los tokens del hash
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(
          (event: string, session: any) => {
            if (session) {
              router.replace('/portal');
              subscription.unsubscribe();
            }
          }
        );

        // Timeout después de 5 segundos
        setTimeout(() => {
          setError(
            'No se pudo verificar el enlace. Solicite uno nuevo.'
          );
        }, 5000);
      } catch {
        setError('Error al procesar el enlace de acceso.');
      }
    }

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f9fafb',
          padding: '20px',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            maxWidth: '400px',
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg
              width="24"
              height="24"
              fill="none"
              stroke="#dc2626"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 8px',
            }}
          >
            Error de acceso
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 20px',
            }}
          >
            {error}
          </p>
          <a
            href="/portal/login"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'linear-gradient(135deg, #0d9488, #0891b2)',
              color: 'white',
              borderRadius: '10px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            Volver al login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #0d9488',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <p style={{ color: '#6b7280', fontSize: '14px' }}>
          Verificando acceso...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9fafb',
          }}
        >
          <p style={{ color: '#6b7280' }}>Cargando...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
