// ============================================================================
// components/admin/informar-avance-modal.tsx
// Modal para enviar el reporte de avances de una cotización al cliente.
// Pre-llena Para/Asunto/Mensaje desde el endpoint GET /informar-avance.
// Al enviar, marca los avances incluidos como notificados.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';

interface BorradorInforme {
  asunto: string;
  cuerpo: string;
  hayAvancesPendientes: boolean;
  totalAvances: number;
  cliente: { id: string; nombre: string; email: string | null } | null;
  numero: string;
}

export function InformarAvanceModal({
  cotizacionId,
  onClose,
  onSuccess,
}: {
  cotizacionId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { data: borrador, loading } = useFetch<BorradorInforme>(
    `/api/admin/contabilidad/cotizaciones/${cotizacionId}/informar-avance`,
  );

  if (loading || !borrador) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 text-sm text-slate-500">
          Preparando borrador…
        </div>
      </div>
    );
  }

  return <FormInforme borrador={borrador} cotizacionId={cotizacionId} onClose={onClose} onSuccess={onSuccess} />;
}

function FormInforme({
  borrador,
  cotizacionId,
  onClose,
  onSuccess,
}: {
  borrador: BorradorInforme;
  cotizacionId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate } = useMutate();
  const [to, setTo] = useState(borrador.cliente?.email ?? '');
  const [cc, setCc] = useState('');
  const [asunto, setAsunto] = useState(borrador.asunto);
  const [mensaje, setMensaje] = useState(borrador.cuerpo);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviando) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, enviando]);

  const enviar = async () => {
    setError(null);
    setEnviando(true);
    let ok = false;
    await mutate(`/api/admin/contabilidad/cotizaciones/${cotizacionId}/informar-avance`, {
      body: { to: to.trim(), cc: cc.trim(), asunto: asunto.trim(), mensaje },
      onSuccess: () => { ok = true; },
      onError: (err: unknown) => setError(typeof err === 'string' ? err : 'Error al enviar el email'),
    });
    setEnviando(false);
    if (ok) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!enviando) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Informar avance al cliente</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Cotización {borrador.numero} · {borrador.totalAvances} avance{borrador.totalAvances === 1 ? '' : 's'} pendiente{borrador.totalAvances === 1 ? '' : 's'} de notificar
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30"
            aria-label="Cerrar"
          >×</button>
        </div>

        {!borrador.hayAvancesPendientes ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-slate-500">No hay avances pendientes de notificar para esta cotización.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >Cerrar</button>
          </div>
        ) : (
          <>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Para</label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  placeholder="cliente@dominio.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  CC <span className="text-slate-400 font-normal">(opcional, separar con coma)</span>
                </label>
                <input
                  type="text"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  placeholder="copia1@dominio.com, copia2@dominio.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
                <input
                  type="text"
                  value={asunto}
                  onChange={e => setAsunto(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Mensaje</label>
                <textarea
                  value={mensaje}
                  onChange={e => setMensaje(e.target.value)}
                  rows={16}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE] font-mono"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Al enviar, los {borrador.totalAvances} avance{borrador.totalAvances === 1 ? '' : 's'} pendiente{borrador.totalAvances === 1 ? '' : 's'} se marcarán como notificados.
                </p>
              </div>
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
              <button
                onClick={onClose}
                disabled={enviando}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
              >Cancelar</button>
              <button
                onClick={enviar}
                disabled={enviando || !to.trim() || !asunto.trim() || !mensaje.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {enviando ? 'Enviando…' : 'Enviar al cliente'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
