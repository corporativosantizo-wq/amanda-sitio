// ============================================================================
// app/cotizacion/respuesta/page.tsx
// Página pública para aceptar cotización o enviar dudas
// ============================================================================

'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface CotizacionData {
  numero: string;
  estado: string;
  total: number;
  subtotal: number;
  iva_monto: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  respondida_at: string | null;
  clienteNombre: string;
  items: { descripcion: string; total: number }[];
}

// ── Main Component ─────────────────────────────────────────────────────────

function RespuestaContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const accion = searchParams.get('accion');

  const [cotizacion, setCotizacion] = useState<CotizacionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  const fmtQ = (n: number) =>
    `Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Cargar datos de la cotización
  useEffect(() => {
    if (!token) {
      setError('Enlace inválido. No se encontró el token de respuesta.');
      setLoading(false);
      return;
    }
    fetch(`/api/cotizacion/respuesta?token=${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setError('Este enlace ya no es válido o la cotización no fue encontrada.');
          return;
        }
        const data = await res.json();
        setCotizacion(data);
      })
      .catch(() => setError('Error al cargar la cotización. Intente de nuevo.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Enviar acción
  const handleSubmit = async () => {
    if (accion === 'dudas' && !mensaje.trim()) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/cotizacion/respuesta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, accion, mensaje: mensaje.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al procesar su respuesta.');
        return;
      }
      setEnviado(true);
      setMensajeExito(data.mensaje);
    } catch {
      setError('Error de conexión. Intente de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#1a2744] text-white py-6 px-4">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="text-xl font-bold tracking-wide">Amanda Santizo</h1>
          <p className="text-sm text-slate-300 mt-1">Despacho Jurídico</p>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-4 py-8">
        <div className="w-full max-w-lg">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="inline-block w-8 h-8 border-3 border-slate-200 border-t-[#2d6bcf] rounded-full animate-spin" />
              <p className="text-sm text-slate-500 mt-4">Cargando cotización...</p>
            </div>
          ) : error && !cotizacion ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Enlace no válido</h2>
              <p className="text-sm text-slate-500 mb-6">{error}</p>
              <p className="text-sm text-slate-400">
                Por favor contacte a{' '}
                <a href="mailto:info@amandasantizo.com" className="text-[#2d6bcf] underline">
                  info@amandasantizo.com
                </a>
              </p>
            </div>
          ) : enviado ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
              <div className="text-5xl mb-4">{accion === 'aceptar' ? '✅' : '📩'}</div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                {accion === 'aceptar' ? '¡Cotización Aceptada!' : '¡Consulta Enviada!'}
              </h2>
              <p className="text-sm text-slate-600 mb-6">{mensajeExito}</p>
              {accion === 'aceptar' && (
                <p className="text-sm text-slate-500">
                  Nos pondremos en contacto para coordinar los siguientes pasos.
                </p>
              )}
              {accion === 'dudas' && (
                <p className="text-sm text-slate-500">
                  Le responderemos a la brevedad.
                </p>
              )}
            </div>
          ) : cotizacion ? (
            <>
              {/* Estado no válido */}
              {cotizacion.estado !== 'enviada' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                  <div className="text-4xl mb-4">
                    {cotizacion.estado === 'aceptada' ? '✅' : '📋'}
                  </div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">
                    {cotizacion.estado === 'aceptada'
                      ? 'Esta cotización ya fue aceptada'
                      : `Esta cotización está en estado "${cotizacion.estado}"`}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Si tiene alguna consulta, contacte a{' '}
                    <a href="mailto:info@amandasantizo.com" className="text-[#2d6bcf] underline">
                      info@amandasantizo.com
                    </a>
                  </p>
                </div>
              ) : accion === 'aceptar' ? (
                /* Confirmar aceptación */
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-[#1a2744] text-white px-6 py-4">
                    <p className="text-sm text-slate-300">Cotización</p>
                    <p className="text-lg font-bold">{cotizacion.numero}</p>
                  </div>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">
                      Confirmar Aceptación
                    </h2>
                    <p className="text-sm text-slate-600 mb-4">
                      Estimado/a {cotizacion.clienteNombre}, por favor revise el resumen y confirme:
                    </p>

                    {/* Items */}
                    <div className="bg-slate-50 rounded-lg p-4 mb-4">
                      {cotizacion.items.map((item: any, i: number) => (
                        <div key={i} className="flex justify-between py-2 text-sm border-b border-slate-200 last:border-0">
                          <span className="text-slate-700 flex-1 pr-4">{item.descripcion}</span>
                          <span className="text-slate-900 font-medium whitespace-nowrap">{fmtQ(item.total)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="space-y-1 mb-6">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>{fmtQ(cotizacion.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>IVA (12%)</span>
                        <span>{fmtQ(cotizacion.iva_monto)}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-slate-900">
                        <span>Total</span>
                        <span>{fmtQ(cotizacion.total)}</span>
                      </div>
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={enviando}
                      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm"
                    >
                      {enviando ? 'Procesando...' : '✓ Confirmo que acepto esta cotización'}
                    </button>

                    <p className="text-xs text-slate-400 text-center mt-3">
                      Al aceptar, confirma que está de acuerdo con los servicios y condiciones cotizadas.
                    </p>
                  </div>
                </div>
              ) : accion === 'dudas' ? (
                /* Formulario de dudas */
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-[#1a2744] text-white px-6 py-4">
                    <p className="text-sm text-slate-300">Cotización</p>
                    <p className="text-lg font-bold">{cotizacion.numero}</p>
                  </div>
                  <div className="p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">
                      ¿Tiene alguna duda?
                    </h2>
                    <p className="text-sm text-slate-600 mb-6">
                      Escríbanos su consulta y le responderemos a la brevedad.
                    </p>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Su consulta o comentario
                      </label>
                      <textarea
                        value={mensaje}
                        onChange={(e) => setMensaje(e.target.value)}
                        rows={5}
                        placeholder="Escriba aquí sus dudas sobre la cotización..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2d6bcf]/30 focus:border-[#2d6bcf] resize-none"
                      />
                    </div>

                    {error && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={enviando || !mensaje.trim()}
                      className="w-full bg-[#2d6bcf] hover:bg-[#2558a8] disabled:bg-slate-300 text-white font-bold py-3 px-6 rounded-lg transition-colors text-sm"
                    >
                      {enviando ? 'Enviando...' : 'Enviar consulta'}
                    </button>
                  </div>
                </div>
              ) : (
                /* accion inválida */
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                  <div className="text-4xl mb-4">⚠️</div>
                  <h2 className="text-lg font-semibold text-slate-900 mb-2">Enlace no válido</h2>
                  <p className="text-sm text-slate-500">
                    Contacte a{' '}
                    <a href="mailto:info@amandasantizo.com" className="text-[#2d6bcf] underline">
                      info@amandasantizo.com
                    </a>
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center">
        <p className="text-xs text-slate-400">
          Santizo &amp; Asociados — <a href="mailto:info@amandasantizo.com" className="underline">info@amandasantizo.com</a>
        </p>
      </footer>
    </div>
  );
}

// ── Page Export with Suspense ──────────────────────────────────────────────

export default function RespuestaCotizacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-sm text-slate-500">Cargando...</div>
        </div>
      }
    >
      <RespuestaContent />
    </Suspense>
  );
}
