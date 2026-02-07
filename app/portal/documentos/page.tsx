// ============================================================================
// app/portal/documentos/page.tsx
// Documentos descargables del cliente (escrituras y testimonios)
// ============================================================================
'use client';

import { useState, useEffect } from 'react';
import { usePortal } from '../layout';

interface Escritura {
  id: string;
  numero: number;
  fecha: string;
  tipo: string;
  descripcion: string | null;
  tiene_pdf: boolean;
}

interface TestimonioDoc {
  id: string;
  escritura_id: string;
  escritura_numero: number;
  tipo: string;
  estado: string;
  fecha_emision: string | null;
  pdf_url: string;
}

const TIPO_LABELS: Record<string, string> = {
  primer_testimonio: 'Primer Testimonio',
  testimonio_especial: 'Testimonio Especial',
  duplicado: 'Duplicado',
  segundo_testimonio: 'Segundo Testimonio',
};

export default function PortalDocumentos() {
  const { accessToken } = usePortal();
  const [escrituras, setEscrituras] = useState<Escritura[]>([]);
  const [testimonios, setTestimonios] = useState<TestimonioDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/portal/documentos', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r: any) => r.json())
      .then((d: any) => {
        setEscrituras(d.escrituras ?? []);
        setTestimonios(d.testimonios ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleDownload = async (tipo: string, id: string) => {
    if (!accessToken || downloading) return;
    setDownloading(id);
    try {
      const res = await fetch(
        `/api/portal/documentos?action=download&tipo=${tipo}&id=${id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (res.ok) {
        const data = await res.json();
        // Abrir URL firmada en nueva pestaña
        window.open(data.url, '_blank');
      }
    } catch {
      // silenciar
    }
    setDownloading(null);
  };

  const totalDocs = escrituras.length + testimonios.length;

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
        Documentos
      </h1>

      {loading ? (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#6b7280' }}>Cargando documentos...</p>
        </div>
      ) : totalDocs === 0 ? (
        <div
          style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          }}
        >
          <svg
            width="48"
            height="48"
            fill="none"
            stroke="#d1d5db"
            viewBox="0 0 24 24"
            style={{ margin: '0 auto 12px', display: 'block' }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p style={{ color: '#6b7280' }}>
            No tiene documentos disponibles para descarga.
          </p>
        </div>
      ) : (
        <>
          {/* Escrituras */}
          {escrituras.length > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '0 0 12px',
                }}
              >
                Escrituras
              </h2>
              <div
                style={{
                  display: 'grid',
                  gap: '12px',
                }}
              >
                {escrituras.map((esc: Escritura) => (
                  <div
                    key={esc.id}
                    style={{
                      background: 'white',
                      borderRadius: '14px',
                      padding: '20px 24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        Escritura #{esc.numero}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          marginTop: '2px',
                        }}
                      >
                        {esc.tipo}
                        {esc.descripcion ? ` — ${esc.descripcion}` : ''}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#9ca3af',
                          marginTop: '2px',
                        }}
                      >
                        {new Date(esc.fecha).toLocaleDateString('es-GT')}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload('escritura', esc.id)}
                      disabled={downloading === esc.id}
                      style={{
                        padding: '10px 18px',
                        background: downloading === esc.id ? '#e5e7eb' : 'linear-gradient(135deg, #0d9488, #0891b2)',
                        color: downloading === esc.id ? '#6b7280' : 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: downloading === esc.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {downloading === esc.id ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Testimonios */}
          {testimonios.length > 0 && (
            <div>
              <h2
                style={{
                  fontSize: '17px',
                  fontWeight: '600',
                  color: '#374151',
                  margin: '0 0 12px',
                }}
              >
                Testimonios
              </h2>
              <div style={{ display: 'grid', gap: '12px' }}>
                {testimonios.map((test: TestimonioDoc) => (
                  <div
                    key={test.id}
                    style={{
                      background: 'white',
                      borderRadius: '14px',
                      padding: '20px 24px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: '600',
                          color: '#111827',
                        }}
                      >
                        {TIPO_LABELS[test.tipo] ?? test.tipo}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#6b7280',
                          marginTop: '2px',
                        }}
                      >
                        Escritura #{test.escritura_numero}
                      </div>
                      {test.fecha_emision && (
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#9ca3af',
                            marginTop: '2px',
                          }}
                        >
                          Emitido:{' '}
                          {new Date(test.fecha_emision).toLocaleDateString(
                            'es-GT'
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownload('testimonio', test.id)}
                      disabled={downloading === test.id}
                      style={{
                        padding: '10px 18px',
                        background: downloading === test.id ? '#e5e7eb' : 'linear-gradient(135deg, #0d9488, #0891b2)',
                        color: downloading === test.id ? '#6b7280' : 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: downloading === test.id ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      {downloading === test.id ? 'Descargando...' : 'Descargar'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
