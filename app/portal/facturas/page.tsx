// ============================================================================
// app/portal/facturas/page.tsx
// Lista de facturas del cliente
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { usePortal } from '../layout';

interface Factura {
  id: string;
  numero: string;
  fecha_emision: string;
  total: number;
  estado: string;
  fel_numero_dte: string | null;
  fel_serie: string | null;
}

function Q(n: number): string {
  return `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const ESTADO_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pendiente: { bg: '#fef9c3', color: '#ca8a04', label: 'Pendiente' },
  pagada: { bg: '#dcfce7', color: '#16a34a', label: 'Pagada' },
  parcial: { bg: '#dbeafe', color: '#2563eb', label: 'Pago parcial' },
  anulada: { bg: '#f3f4f6', color: '#6b7280', label: 'Anulada' },
  vencida: { bg: '#fef2f2', color: '#dc2626', label: 'Vencida' },
};

export default function PortalFacturas() {
  const { accessToken, clienteId } = usePortal();
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken || !clienteId) return;
    setLoading(true);
    fetch('/api/portal/datos?tipo=facturas', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Cliente-Id': clienteId,
      },
    })
      .then((r: any) => r.json())
      .then((d: any) => setFacturas(d.facturas ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, clienteId]);

  const pendientes = facturas.filter(
    (f: Factura) => f.estado === 'pendiente' || f.estado === 'parcial' || f.estado === 'vencida'
  );
  const totalPendiente = pendientes.reduce(
    (s: number, f: Factura) => s + f.total,
    0
  );

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
        Facturas
      </h1>

      {/* Summary banner */}
      {!loading && pendientes.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fef2f2, #fff7ed)',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: '1px solid #fecaca',
          }}
        >
          <div>
            <div
              style={{ fontSize: '14px', color: '#dc2626', fontWeight: '500' }}
            >
              Facturas pendientes de pago
            </div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
              {pendientes.length} factura{pendientes.length > 1 ? 's' : ''} por
              un total de{' '}
              <strong style={{ color: '#dc2626' }}>{Q(totalPendiente)}</strong>
            </div>
          </div>
          <div
            style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#dc2626',
            }}
          >
            {Q(totalPendiente)}
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
            <p style={{ color: '#6b7280' }}>Cargando facturas...</p>
          </div>
        ) : facturas.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ color: '#6b7280' }}>No tiene facturas registradas.</p>
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
                  {['Número', 'Fecha', 'DTE', 'Monto', 'Estado'].map(
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
                {facturas.map((fac: Factura) => {
                  const est = ESTADO_STYLES[fac.estado] ?? ESTADO_STYLES.pendiente;
                  return (
                    <tr
                      key={fac.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                      }}
                    >
                      <td
                        style={{
                          padding: '14px 16px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        #{fac.numero}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280' }}>
                        {new Date(fac.fecha_emision).toLocaleDateString(
                          'es-GT'
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#6b7280', fontSize: '13px' }}>
                        {fac.fel_serie && fac.fel_numero_dte
                          ? `${fac.fel_serie}-${fac.fel_numero_dte}`
                          : '-'}
                      </td>
                      <td
                        style={{
                          padding: '14px 16px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        {Q(fac.total)}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
