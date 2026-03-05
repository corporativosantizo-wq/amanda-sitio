// ============================================================================
// app/portal/consulta/page.tsx
// Solicitar consulta extra (Q500) + historial de consultas
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { usePortal } from '../layout';

interface Consulta {
  id: string;
  asunto: string;
  descripcion: string | null;
  estado: string;
  monto: number;
  fecha_solicitada: string;
  fecha_programada: string | null;
}

const ASUNTOS = [
  'Consulta legal general',
  'Revisión de contrato',
  'Asesoría empresarial',
  'Trámite notarial',
  'Litigio o demanda',
  'Propiedad intelectual',
  'Derecho internacional',
  'Otro',
];

const ESTADO_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pendiente: { bg: '#fef9c3', color: '#ca8a04', label: 'Pendiente' },
  programada: { bg: '#dbeafe', color: '#2563eb', label: 'Programada' },
  completada: { bg: '#dcfce7', color: '#16a34a', label: 'Completada' },
  cancelada: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelada' },
};

export default function PortalConsulta() {
  const { accessToken, clienteId } = usePortal();
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [loading, setLoading] = useState(true);
  const [asunto, setAsunto] = useState('');
  const [otroAsunto, setOtroAsunto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaPreferida, setFechaPreferida] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !clienteId) return;
    setLoading(true);
    fetch('/api/portal/consulta', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Cliente-Id': clienteId,
      },
    })
      .then((r: any) => r.json())
      .then((d: any) => setConsultas(d.consultas ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, clienteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    const finalAsunto = asunto === 'Otro' ? `Otro: ${otroAsunto.trim()}` : asunto;
    if (!finalAsunto || (asunto === 'Otro' && !otroAsunto.trim())) {
      setError('Seleccione un asunto.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/portal/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'X-Cliente-Id': clienteId,
        },
        body: JSON.stringify({
          asunto: finalAsunto,
          descripcion: descripcion.trim(),
          fecha_preferida: fechaPreferida || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Error al enviar la solicitud.');
        return;
      }

      setSuccess(true);
      setAsunto('');
      setOtroAsunto('');
      setDescripcion('');
      setFechaPreferida('');

      // Agregar al historial
      if (data.consulta) {
        setConsultas((prev: Consulta[]) => [data.consulta, ...prev]);
      }
    } catch {
      setError('Error de conexión.');
    } finally {
      setSubmitting(false);
    }
  };

  // Calcular fecha mínima (mañana)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto' }}>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px',
        }}
      >
        Solicitar Consulta
      </h1>
      <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 28px' }}>
        Agende una consulta personalizada con la Licda. Amanda Santizo.
      </p>

      {/* Form */}
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          marginBottom: '32px',
        }}
      >
        {/* Price badge */}
        <div
          style={{
            display: 'inline-block',
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #f0fdfa, #ecfeff)',
            borderRadius: '10px',
            border: '1px solid #99f6e4',
            marginBottom: '24px',
          }}
        >
          <span style={{ fontSize: '14px', color: '#0f766e', fontWeight: '600' }}>
            Precio: Q500.00
          </span>
        </div>

        {success && (
          <div
            style={{
              padding: '14px 18px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#166534',
            }}
          >
            Su solicitud ha sido recibida. Nos comunicaremos para confirmar la
            cita.
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '14px 18px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#991b1b',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Asunto */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Asunto *
            </label>
            <select
              value={asunto}
              onChange={(e: any) => setAsunto(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                background: 'white',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
              onFocus={(e: any) => (e.target.style.borderColor = '#0d9488')}
              onBlur={(e: any) => (e.target.style.borderColor = '#e5e7eb')}
            >
              <option value="">Seleccione un asunto...</option>
              {ASUNTOS.map((a: string) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Otro asunto */}
          {asunto === 'Otro' && (
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  marginBottom: '6px',
                }}
              >
                Especifique el asunto *
              </label>
              <input
                type="text"
                value={otroAsunto}
                onChange={(e: any) => setOtroAsunto(e.target.value)}
                maxLength={200}
                placeholder="Describa brevemente el asunto"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '10px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e: any) => (e.target.style.borderColor = '#0d9488')}
                onBlur={(e: any) => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          )}

          {/* Descripción */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Descripción detallada
            </label>
            <textarea
              value={descripcion}
              onChange={(e: any) => setDescripcion(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Describa su consulta con el mayor detalle posible..."
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5',
                boxSizing: 'border-box',
              }}
              onFocus={(e: any) => (e.target.style.borderColor = '#0d9488')}
              onBlur={(e: any) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {/* Fecha preferida */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '6px',
              }}
            >
              Fecha preferida
            </label>
            <input
              type="date"
              value={fechaPreferida}
              onChange={(e: any) => setFechaPreferida(e.target.value)}
              min={minDate}
              style={{
                padding: '10px 14px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '14px',
                outline: 'none',
              }}
              onFocus={(e: any) => (e.target.style.borderColor = '#0d9488')}
              onBlur={(e: any) => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !asunto}
            style={{
              padding: '14px 28px',
              fontSize: '15px',
              fontWeight: '600',
              color: 'white',
              background:
                submitting || !asunto
                  ? '#9ca3af'
                  : 'linear-gradient(135deg, #0d9488, #0891b2)',
              border: 'none',
              borderRadius: '12px',
              cursor: submitting || !asunto ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {submitting ? 'Enviando...' : 'Solicitar Consulta — Q500'}
          </button>
        </form>
      </div>

      {/* Historial */}
      <h2
        style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 16px',
        }}
      >
        Consultas anteriores
      </h2>

      {loading ? (
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '30px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#6b7280' }}>Cargando...</p>
        </div>
      ) : consultas.length === 0 ? (
        <div
          style={{
            background: 'white',
            borderRadius: '14px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <p style={{ color: '#6b7280' }}>
            No tiene consultas previas.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {consultas.map((c: Consulta) => {
            const est = ESTADO_STYLES[c.estado] ?? ESTADO_STYLES.pendiente;
            return (
              <div
                key={c.id}
                style={{
                  background: 'white',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#111827',
                    }}
                  >
                    {c.asunto}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '500',
                      background: est.bg,
                      color: est.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {est.label}
                  </span>
                </div>
                {c.descripcion && (
                  <p
                    style={{
                      fontSize: '13px',
                      color: '#6b7280',
                      margin: '0 0 8px',
                      lineHeight: '1.5',
                    }}
                  >
                    {c.descripcion}
                  </p>
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '12px',
                    color: '#9ca3af',
                  }}
                >
                  <span>
                    Solicitada:{' '}
                    {new Date(c.fecha_solicitada).toLocaleDateString('es-GT')}
                  </span>
                  {c.fecha_programada && (
                    <span>
                      Programada:{' '}
                      {new Date(c.fecha_programada).toLocaleDateString(
                        'es-GT'
                      )}
                    </span>
                  )}
                  <span style={{ fontWeight: '500', color: '#0f766e' }}>
                    Q{Number(c.monto).toFixed(2)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
