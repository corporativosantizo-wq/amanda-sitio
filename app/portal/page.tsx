// ============================================================================
// app/portal/page.tsx
// Dashboard del portal — resumen del cliente
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePortal } from './layout';

interface Resumen {
  cotizaciones_activas: number;
  cotizaciones_monto: number;
  facturas_pendientes: number;
  facturas_monto: number;
  documentos_disponibles: number;
}

function Q(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PortalDashboard() {
  const { cliente, accessToken } = usePortal();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/portal/datos?tipo=resumen', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r: any) => r.json())
      .then((d: any) => setResumen(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const cards = [
    {
      title: 'Cotizaciones activas',
      value: resumen ? String(resumen.cotizaciones_activas) : '-',
      subtitle: resumen ? Q(resumen.cotizaciones_monto) : '',
      href: '/portal/cotizaciones',
      color: '#0d9488',
      bg: '#f0fdfa',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
    {
      title: 'Facturas pendientes',
      value: resumen ? String(resumen.facturas_pendientes) : '-',
      subtitle: resumen ? Q(resumen.facturas_monto) : '',
      href: '/portal/facturas',
      color: '#dc2626',
      bg: '#fef2f2',
      icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
    },
    {
      title: 'Documentos disponibles',
      value: resumen ? String(resumen.documentos_disponibles) : '-',
      subtitle: 'Escrituras y testimonios',
      href: '/portal/documentos',
      color: '#7c3aed',
      bg: '#f5f3ff',
      icon: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
  ];

  const quickLinks = [
    {
      title: 'Asistente',
      desc: 'Consulte con Astrid sobre sus trámites',
      href: '/portal/chat',
      color: '#0891b2',
    },
    {
      title: 'Solicitar Consulta',
      desc: 'Agende una consulta personalizada (Q500)',
      href: '/portal/consulta',
      color: '#0d9488',
    },
  ];

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontSize: '26px',
            fontWeight: '700',
            color: '#111827',
            margin: '0 0 4px',
          }}
        >
          Bienvenido, {cliente?.nombre ?? 'Cliente'}
        </h1>
        <p style={{ fontSize: '15px', color: '#6b7280', margin: 0 }}>
          Aquí puede consultar el estado de sus trámites legales.
        </p>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {cards.map((card: any) => (
          <Link
            key={card.title}
            href={card.href}
            style={{
              display: 'block',
              textDecoration: 'none',
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              border: '1px solid #f3f4f6',
              transition: 'box-shadow 0.15s, transform 0.15s',
            }}
            onMouseEnter={(e: any) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e: any) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: card.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  stroke={card.color}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d={card.icon}
                  />
                </svg>
              </div>
              <span
                style={{ fontSize: '14px', color: '#6b7280', fontWeight: '500' }}
              >
                {card.title}
              </span>
            </div>
            <div
              style={{
                fontSize: loading ? '24px' : '32px',
                fontWeight: '700',
                color: card.color,
                lineHeight: '1',
              }}
            >
              {loading ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: '60px',
                    height: '32px',
                    background: '#f3f4f6',
                    borderRadius: '8px',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ) : (
                card.value
              )}
            </div>
            {card.subtitle && !loading && (
              <div
                style={{
                  fontSize: '13px',
                  color: '#9ca3af',
                  marginTop: '6px',
                }}
              >
                {card.subtitle}
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <h2
        style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 16px',
        }}
      >
        Accesos rápidos
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {quickLinks.map((link: any) => (
          <Link
            key={link.title}
            href={link.href}
            style={{
              display: 'block',
              textDecoration: 'none',
              background: 'white',
              borderRadius: '14px',
              padding: '20px 24px',
              border: '1px solid #f3f4f6',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e: any) =>
              (e.currentTarget.style.borderColor = link.color)
            }
            onMouseLeave={(e: any) =>
              (e.currentTarget.style.borderColor = '#f3f4f6')
            }
          >
            <div
              style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}
            >
              {link.title}
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              {link.desc}
            </div>
          </Link>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </div>
  );
}
