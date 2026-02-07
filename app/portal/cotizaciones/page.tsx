// ============================================================================
// app/portal/cotizaciones/page.tsx
// Lista de cotizaciones del cliente
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { usePortal } from '../layout';

interface Cotizacion {
  id: string;
  numero: string;
  fecha_emision: string;
  total: number;
  estado: string;
  condiciones: string | null;
}

interface CotDetalle {
  cotizacion: any;
  items: any[];
}

function Q(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ESTADO_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  borrador: { bg: '#f3f4f6', color: '#6b7280', label: 'Borrador' },
  enviada: { bg: '#dbeafe', color: '#2563eb', label: 'Enviada' },
  aceptada: { bg: '#dcfce7', color: '#16a34a', label: 'Aceptada' },
  rechazada: { bg: '#fef2f2', color: '#dc2626', label: 'Rechazada' },
  vencida: { bg: '#fef9c3', color: '#ca8a04', label: 'Vencida' },
};

export default function PortalCotizaciones() {
  const { accessToken } = usePortal();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [detalle, setDetalle] = useState<CotDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/portal/datos?tipo=cotizaciones', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r: any) => r.json())
      .then((d: any) => setCotizaciones(d.cotizaciones ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const verDetalle = async (id: string) => {
    if (!accessToken) return;
    setDetalleLoading(true);
    try {
      const res = await fetch(
        `/api/portal/datos?tipo=cotizacion_detalle&id=${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDetalle(data);
      }
    } catch {
      // silenciar
    }
    setDetalleLoading(false);
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 24px',
        }}
      >
        Cotizaciones
      </h1>

      {/* Detalle modal */}
      {detalle && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
            padding: '20px',
          }}
          onClick={() => setDetalle(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
            onClick={(e: any) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
              }}
            >
              <h2
                style={{ fontSize: '20px', fontWeight: '700', color: '#111827' }}
              >
                Cotización #{detalle.cotizacion.numero}
              </h2>
              <button
                onClick={() => setDetalle(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6b7280',
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '16px' }}>
              <div>
                Fecha:{' '}
                {new Date(detalle.cotizacion.fecha_emision).toLocaleDateString(
                  'es-GT'
                )}
              </div>
              {detalle.cotizacion.fecha_vencimiento && (
                <div>
                  Vence:{' '}
                  {new Date(
                    detalle.cotizacion.fecha_vencimiento
                  ).toLocaleDateString('es-GT')}
                </div>
              )}
            </div>

            {/* Items */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '10px 8px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    Servicio
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '10px 8px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    Cant.
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '10px 8px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    P. Unit.
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '10px 8px',
                      color: '#6b7280',
                      fontWeight: '500',
                    }}
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {detalle.items.map((item: any, i: number) => (
                  <tr
                    key={i}
                    style={{ borderBottom: '1px solid #f3f4f6' }}
                  >
                    <td style={{ padding: '10px 8px', color: '#111827' }}>
                      {item.descripcion}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        color: '#6b7280',
                      }}
                    >
                      {item.cantidad}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        color: '#6b7280',
                      }}
                    >
                      {Q(item.precio_unitario)}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px',
                        textAlign: 'right',
                        fontWeight: '600',
                        color: '#111827',
                      }}
                    >
                      {Q(item.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div
              style={{
                borderTop: '2px solid #e5e7eb',
                paddingTop: '12px',
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                Subtotal: {Q(detalle.cotizacion.subtotal)}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                IVA (12%): {Q(detalle.cotizacion.iva_monto)}
              </div>
              <div
                style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#111827',
                  marginTop: '4px',
                }}
              >
                Total: {Q(detalle.cotizacion.total)}
              </div>
            </div>

            {detalle.cotizacion.condiciones && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 16px',
                  background: '#f9fafb',
                  borderRadius: '10px',
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.5',
                }}
              >
                <strong>Condiciones:</strong> {detalle.cotizacion.condiciones}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280' }}>Cargando cotizaciones...</p>
          </div>
        ) : cotizaciones.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280' }}>No tiene cotizaciones registradas.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '14px',
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Número', 'Fecha', 'Monto', 'Estado', ''].map(
                    (h: string) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: '14px 16px',
                          color: '#6b7280',
                          fontWeight: '500',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {cotizaciones.map((cot: Cotizacion) => {
                  const est = ESTADO_STYLES[cot.estado] ?? ESTADO_STYLES.borrador;
                  return (
                    <tr
                      key={cot.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e: any) =>
                        (e.currentTarget.style.background = '#f9fafb')
                      }
                      onMouseLeave={(e: any) =>
                        (e.currentTarget.style.background = 'white')
                      }
                      onClick={() => verDetalle(cot.id)}
                    >
                      <td
                        style={{
                          padding: '14px 16px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        #{cot.numero}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                        {new Date(cot.fecha_emision).toLocaleDateString(
                          'es-GT'
                        )}
                      </td>
                      <td
                        style={{
                          padding: '14px 16px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        {Q(cot.total)}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '500',
                            background: est.bg,
                            color: est.color,
                          }}
                        >
                          {est.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '14px 16px',
                          color: '#0d9488',
                          fontSize: '13px',
                        }}
                      >
                        Ver detalle &rarr;
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detalleLoading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 60,
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '24px 32px',
              borderRadius: '12px',
              color: '#6b7280',
            }}
          >
            Cargando detalle...
          </div>
        </div>
      )}
    </div>
  );
}
