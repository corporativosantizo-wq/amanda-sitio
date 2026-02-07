// ============================================================================
// app/portal/login/page.tsx
// Login del portal — magic link via Supabase Auth
// ============================================================================
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'sent' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();

    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setStatus('error');
      setErrorMsg('Ingrese un email válido.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/portal/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error ?? 'Error al enviar el enlace.');
        return;
      }

      setStatus('sent');
    } catch {
      setStatus('error');
      setErrorMsg('Error de conexión. Intente de nuevo.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f0fdfa 0%, #ecfeff 50%, #f0f9ff 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: 'white',
          borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '48px 40px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #0d9488, #0891b2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'white',
              fontWeight: '700',
              fontSize: '24px',
            }}
          >
            AS
          </div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 4px',
            }}
          >
            Amanda Santizo & Asociados
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
            Portal de Clientes
          </p>
        </div>

        {status === 'sent' ? (
          /* Confirmación de envío */
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#f0fdf4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '28px',
              }}
            >
              <svg
                width="28"
                height="28"
                fill="none"
                stroke="#16a34a"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
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
              Enlace enviado
            </h2>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.6',
                margin: '0 0 24px',
              }}
            >
              Hemos enviado un enlace de acceso a{' '}
              <strong style={{ color: '#111827' }}>{email}</strong>. Revise
              su bandeja de entrada y haga click en el enlace para ingresar.
            </p>
            <button
              onClick={() => {
                setStatus('idle');
                setEmail('');
              }}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                color: '#0d9488',
                background: '#f0fdfa',
                border: '1px solid #99f6e4',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
            >
              Enviar otro enlace
            </button>
          </div>
        ) : (
          /* Formulario de login */
          <form onSubmit={handleSubmit}>
            <p
              style={{
                fontSize: '14px',
                color: '#6b7280',
                textAlign: 'center',
                lineHeight: '1.6',
                margin: '0 0 24px',
              }}
            >
              Ingrese su email registrado. Le enviaremos un enlace seguro
              para acceder a su portal.
            </p>

            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e: any) => {
                setEmail(e.target.value);
                if (status === 'error') setStatus('idle');
              }}
              placeholder="su@email.com"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: '15px',
                border: `2px solid ${status === 'error' ? '#fca5a5' : '#e5e7eb'}`,
                borderRadius: '12px',
                outline: 'none',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={(e: any) => {
                if (status !== 'error')
                  e.target.style.borderColor = '#0d9488';
              }}
              onBlur={(e: any) => {
                if (status !== 'error')
                  e.target.style.borderColor = '#e5e7eb';
              }}
            />

            {status === 'error' && (
              <p
                style={{
                  fontSize: '13px',
                  color: '#dc2626',
                  margin: '8px 0 0',
                }}
              >
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '20px',
                fontSize: '15px',
                fontWeight: '600',
                color: 'white',
                background:
                  status === 'loading'
                    ? '#9ca3af'
                    : 'linear-gradient(135deg, #0d9488, #0891b2)',
                border: 'none',
                borderRadius: '12px',
                cursor:
                  status === 'loading' ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.15s',
              }}
            >
              {status === 'loading'
                ? 'Enviando...'
                : 'Enviar enlace de acceso'}
            </button>
          </form>
        )}

        {/* Footer */}
        <div
          style={{
            marginTop: '32px',
            paddingTop: '20px',
            borderTop: '1px solid #f3f4f6',
            textAlign: 'center',
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: '13px',
              color: '#6b7280',
              textDecoration: 'none',
            }}
          >
            &larr; Volver al sitio
          </Link>
        </div>
      </div>
    </div>
  );
}
