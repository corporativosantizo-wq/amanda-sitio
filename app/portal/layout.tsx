// ============================================================================
// app/portal/layout.tsx
// Layout del portal de clientes — sidebar, header, auth check
// ============================================================================
'use client';

import {
  useState,
  useEffect,
  createContext,
  useContext,
  useCallback,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createPortalClient } from '@/lib/supabase/portal';

// ── Context ─────────────────────────────────────────────────────────────────
interface ClienteData {
  id: string;
  nombre: string;
  email: string;
  codigo: string;
  tipo: string;
}

interface PortalContextType {
  cliente: ClienteData | null;
  clientes: ClienteData[];
  clienteId: string;
  accessToken: string | null;
  loading: boolean;
  logout: () => void;
  switchCliente: (id: string) => void;
}

const PortalContext = createContext<PortalContextType>({
  cliente: null,
  clientes: [],
  clienteId: '',
  accessToken: null,
  loading: true,
  logout: () => {},
  switchCliente: () => {},
});

export const usePortal = () => useContext(PortalContext);

// ── Rutas públicas ──────────────────────────────────────────────────────────
const PUBLIC_PATHS = ['/portal/login', '/portal/auth'];

// ── Navigation items ────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    name: 'Inicio',
    href: '/portal',
    icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  },
  {
    name: 'Cotizaciones',
    href: '/portal/cotizaciones',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    name: 'Facturas',
    href: '/portal/facturas',
    icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  },
  {
    name: 'Documentos',
    href: '/portal/documentos',
    icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    name: 'Asistente',
    href: '/portal/chat',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  },
  {
    name: 'Solicitar Consulta',
    href: '/portal/consulta',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  },
];

// ── Layout ──────────────────────────────────────────────────────────────────
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cliente, setCliente] = useState<ClienteData | null>(null);
  const [clientes, setClientes] = useState<ClienteData[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const isPublicPath = PUBLIC_PATHS.some((p: string) =>
    pathname.startsWith(p)
  );

  const logout = useCallback(async () => {
    const supabase = createPortalClient();
    await supabase.auth.signOut();
    setCliente(null);
    setClientes([]);
    setClienteId('');
    setAccessToken(null);
    router.replace('/portal/login');
  }, [router]);

  const switchCliente = useCallback(
    (id: string) => {
      const found = clientes.find((c: ClienteData) => c.id === id);
      if (found) {
        setCliente(found);
        setClienteId(found.id);
      }
    },
    [clientes]
  );

  useEffect(() => {
    const supabase = createPortalClient();

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          setAccessToken(session.access_token);
          const res = await fetch('/api/portal/auth/session', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setCliente(data.cliente);
            setClientes(data.clientes ?? [data.cliente]);
            setClienteId(data.cliente.id);
          } else {
            await supabase.auth.signOut();
          }
        }
      } catch {
        // silenciar errores de red
      }
      setLoading(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        setAccessToken(session.access_token);
        try {
          const res = await fetch('/api/portal/auth/session', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (res.ok) {
            const data = await res.json();
            setCliente(data.cliente);
            setClientes(data.clientes ?? [data.cliente]);
            setClienteId(data.cliente.id);
          }
        } catch {
          // silenciar
        }
      } else if (event === 'SIGNED_OUT') {
        setCliente(null);
        setClientes([]);
        setClienteId('');
        setAccessToken(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirigir si no autenticado en rutas protegidas
  useEffect(() => {
    if (!loading && !cliente && !isPublicPath) {
      router.replace('/portal/login');
    }
  }, [loading, cliente, isPublicPath, router]);

  // Cerrar sidebar móvil al navegar
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ── Rutas públicas ──
  if (isPublicPath) {
    return (
      <PortalContext.Provider
        value={{ cliente, clientes, clienteId, accessToken, loading, logout, switchCliente }}
      >
        {children}
      </PortalContext.Provider>
    );
  }

  // ── Loading ──
  if (loading) {
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
            Cargando portal...
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── No autenticado ──
  if (!cliente) return null;

  const isActive = (href: string) => {
    if (href === '/portal') return pathname === '/portal';
    return pathname.startsWith(href);
  };

  // ── Layout autenticado ──
  return (
    <PortalContext.Provider value={{ cliente, clientes, clienteId, accessToken, loading, logout, switchCliente }}>
      <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
        {/* Header */}
        <header
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '64px',
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
              }}
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="#374151"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0d9488, #0891b2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '700',
                fontSize: '14px',
              }}
            >
              AS
            </div>
            <div>
              <div
                style={{
                  fontWeight: '600',
                  fontSize: '15px',
                  color: '#111827',
                  lineHeight: '1.2',
                }}
              >
                Amanda Santizo & Asociados
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>
                Portal de Clientes
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {clientes.length > 1 ? (
              <select
                value={clienteId}
                onChange={(e: any) => switchCliente(e.target.value)}
                style={{
                  fontSize: '14px',
                  color: '#374151',
                  background: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  outline: 'none',
                  maxWidth: '220px',
                }}
              >
                {clientes.map((c: ClienteData) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '14px', color: '#374151' }}>
                {cliente.nombre}
              </span>
            )}
            <button
              onClick={logout}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                color: '#6b7280',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e: any) =>
                (e.target.style.background = '#e5e7eb')
              }
              onMouseLeave={(e: any) =>
                (e.target.style.background = '#f3f4f6')
              }
            >
              Cerrar sesión
            </button>
          </div>
        </header>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="lg:hidden"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 45,
            }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={mobileOpen ? '' : 'hidden lg:block'}
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            bottom: 0,
            width: '256px',
            background: 'linear-gradient(180deg, #0f766e, #0e7490)',
            zIndex: 50,
            overflowY: 'auto',
          }}
        >
          <nav style={{ padding: '16px 12px' }}>
            {NAV_ITEMS.map((item: any) => (
              <Link
                key={item.name}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  marginBottom: '4px',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: isActive(item.href) ? '600' : '400',
                  color: isActive(item.href)
                    ? '#0f766e'
                    : 'rgba(255,255,255,0.85)',
                  background: isActive(item.href)
                    ? 'white'
                    : 'transparent',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e: any) => {
                  if (!isActive(item.href)) {
                    e.currentTarget.style.background =
                      'rgba(255,255,255,0.1)';
                  }
                }}
                onMouseLeave={(e: any) => {
                  if (!isActive(item.href)) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={item.icon}
                  />
                </svg>
                <span>{item.name}</span>
              </Link>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <Link
              href="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '13px',
                textDecoration: 'none',
                borderRadius: '8px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e: any) =>
                (e.currentTarget.style.color = 'white')
              }
              onMouseLeave={(e: any) =>
                (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')
              }
            >
              <svg
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Volver al sitio
            </Link>
          </div>
        </aside>

        {/* Main content */}
        <main
          className="lg:ml-64"
          style={{ paddingTop: '64px', minHeight: '100vh' }}
        >
          {children}
        </main>
      </div>
    </PortalContext.Provider>
  );
}
