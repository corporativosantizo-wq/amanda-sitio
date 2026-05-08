// ============================================================================
// components/admin/enviar-recibo-email-modal.tsx
// Modal para enviar un Recibo de Caja por email con campos editables:
// Para (pre-llenado con email del cliente), CC (separado por coma),
// Asunto (pre-llenado), Mensaje (textarea con plantilla).
// El PDF del recibo se adjunta automáticamente en el backend.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useMutate } from '@/lib/hooks/use-fetch';

export interface ReciboParaEmail {
  id: string;
  numero: string;
  monto: number;
  concepto: string;
  cliente: { nombre: string; email: string | null } | null;
}

export function EnviarReciboEmailModal({
  recibo,
  onClose,
  onSuccess,
}: {
  recibo: ReciboParaEmail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate } = useMutate();
  const clienteNombre = recibo.cliente?.nombre ?? 'Cliente';
  const montoStr = `Q ${Number(recibo.monto).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const [to, setTo] = useState(recibo.cliente?.email ?? '');
  const [cc, setCc] = useState('');
  const [asunto, setAsunto] = useState(`Recibo de Caja ${recibo.numero} — Gastos de trámite`);
  const [mensaje, setMensaje] = useState(
    `Estimado/a ${clienteNombre},\n\n` +
    `Adjunto encontrará el Recibo de Caja ${recibo.numero} por ${montoStr} correspondiente a ${recibo.concepto}.\n\n` +
    `Quedamos a su disposición.\n\n` +
    `Atentamente,\nAmanda Santizo — Despacho Jurídico`
  );
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
    await mutate(`/api/admin/contabilidad/recibos-caja/${recibo.id}/reenviar`, {
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
            <h2 className="text-lg font-semibold text-slate-900">Enviar Recibo de Caja por email</h2>
            <p className="text-xs text-slate-500 mt-0.5">{recibo.numero} · {montoStr} · PDF se adjunta automáticamente</p>
          </div>
          <button
            onClick={onClose}
            disabled={enviando}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30"
            aria-label="Cerrar"
          >×</button>
        </div>

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
              rows={10}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE] font-mono"
            />
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
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
