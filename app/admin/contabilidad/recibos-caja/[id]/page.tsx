// ============================================================================
// app/admin/contabilidad/recibos-caja/[id]/page.tsx
// Detalle del Recibo de Caja: datos, cotización vinculada, PDF, envío con CC,
// historial de envíos.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Section, Q, Skeleton, EmptyState } from '@/components/admin/ui';

interface ReciboDetalle {
  id: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  concepto: string;
  origen: 'automatico' | 'manual';
  pdf_url: string | null;
  email_enviado_at: string | null;
  email_error: string | null;
  notas: string | null;
  cotizacion_id: string | null;
  pago_id: string | null;
  created_at: string;
  cliente: { id: string; codigo: string; nombre: string; nit: string | null; email: string | null; emails_cc_recibos?: string[] } | null;
  cotizacion: { id: string; numero: string } | null;
}

interface Envio {
  id: string;
  enviado_a: string;
  cc: string[];
  enviado_por: string | null;
  enviado_at: string;
  exito: boolean;
  error_mensaje: string | null;
  asunto: string | null;
}

interface CotizacionLite {
  id: string;
  numero: string;
  total: number;
  estado: string;
  fecha_emision: string;
}

export default function ReciboCajaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const { mutate } = useMutate();
  const { data: recibo, loading, refetch } = useFetch<ReciboDetalle>(
    id ? `/api/admin/contabilidad/recibos-caja/${id}` : null
  );
  const { data: enviosResult, refetch: refetchEnvios } = useFetch<{ data: Envio[] }>(
    id ? `/api/admin/contabilidad/recibos-caja/${id}/envios` : null
  );
  const envios = enviosResult?.data ?? [];

  const [showVincularModal, setShowVincularModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Toast inicial si vienen del flujo de creación
  useEffect(() => {
    if (searchParams.get('creado') === '1') {
      setToast({ type: 'success', message: '✓ Recibo de Caja creado' });
      router.replace(`/admin/contabilidad/recibos-caja/${id}`);
    }
  }, [searchParams, id, router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const regenerarPDF = useCallback(async () => {
    setRegenerando(true);
    await mutate(`/api/admin/contabilidad/recibos-caja/${id}/regenerar-pdf`, {
      body: {},
      onSuccess: () => { setToast({ type: 'success', message: '✓ PDF regenerado' }); refetch(); },
      onError: (err: any) => setToast({ type: 'error', message: `Error: ${err}` }),
    });
    setRegenerando(false);
  }, [id, mutate, refetch]);

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!recibo) {
    return (
      <EmptyState
        icon="❌"
        title="Recibo no encontrado"
        description="No se pudo cargar el recibo solicitado"
        action={{ label: 'Volver al listado', onClick: () => router.push('/admin/contabilidad/recibos-caja') }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/admin/contabilidad/recibos-caja')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block"
          >
            ← Recibos de Caja
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 font-mono">{recibo.numero}</h1>
            <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full border ${
              recibo.origen === 'manual'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-slate-600 bg-slate-50 border-slate-200'
            }`}>
              {recibo.origen}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Emitido el {new Date(recibo.fecha_emision).toLocaleDateString('es-GT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Guatemala' })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/admin/contabilidad/recibos-caja/${id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            📄 Descargar PDF
          </a>
          <button
            onClick={regenerarPDF}
            disabled={regenerando}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {regenerando ? 'Regenerando…' : '↻ Regenerar PDF'}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            disabled={!recibo.cliente?.email}
            title={recibo.cliente?.email ? '' : 'El cliente no tiene email registrado'}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#0F172A] to-[#22D3EE] rounded-lg hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ✉ Enviar por email
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          <Section title="Concepto y monto">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">Concepto</p>
                <p className="text-sm text-slate-800 whitespace-pre-line">{recibo.concepto}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">Monto</p>
                <p className="text-2xl font-bold text-slate-900">{Q(Number(recibo.monto))}</p>
              </div>
              {recibo.notas && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">Notas internas</p>
                  <p className="text-sm text-slate-600 whitespace-pre-line">{recibo.notas}</p>
                </div>
              )}
            </div>
          </Section>

          {/* Cotización vinculada */}
          <Section
            title="Cotización vinculada"
            action={{
              label: recibo.cotizacion ? 'Cambiar / desvincular' : 'Vincular',
              onClick: () => setShowVincularModal(true),
            }}
          >
            {recibo.cotizacion ? (
              <button
                onClick={() => router.push(`/admin/contabilidad/cotizaciones/${recibo.cotizacion!.id}`)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors"
              >
                <span className="font-mono text-sm font-medium text-slate-900">{recibo.cotizacion.numero}</span>
                <span className="text-xs text-slate-400">→</span>
              </button>
            ) : (
              <p className="text-sm text-slate-400">Sin cotización vinculada</p>
            )}
          </Section>

          {/* Historial de envíos */}
          <Section title={`Historial de envíos (${envios.length})`}>
            {envios.length === 0 ? (
              <p className="text-sm text-slate-400">Aún no se ha enviado este recibo por email</p>
            ) : (
              <div className="space-y-2">
                {envios.map(e => (
                  <div key={e.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-800 truncate">
                          <span className="text-slate-400">Para:</span> <span className="font-medium">{e.enviado_a}</span>
                        </p>
                        {e.cc.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            <span className="text-slate-400">CC:</span> {e.cc.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(e.enviado_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Guatemala' })}
                          {e.enviado_por && ` · por ${e.enviado_por}`}
                        </p>
                        {e.error_mensaje && (
                          <p className="text-xs text-red-600 mt-1">⚠ {e.error_mensaje}</p>
                        )}
                      </div>
                      <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full ${
                        e.exito ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'
                      }`}>
                        {e.exito ? 'Enviado' : 'Falló'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Section title="Cliente">
            {recibo.cliente ? (
              <div className="space-y-2">
                <button
                  onClick={() => router.push(`/admin/clientes/${recibo.cliente!.id}`)}
                  className="font-medium text-slate-900 hover:underline text-left"
                >
                  {recibo.cliente.nombre}
                </button>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-600"><span className="text-slate-400">Código:</span> {recibo.cliente.codigo}</p>
                  <p className="text-slate-600"><span className="text-slate-400">NIT:</span> {recibo.cliente.nit ?? 'CF'}</p>
                  <p className="text-slate-600 truncate"><span className="text-slate-400">Email:</span> {recibo.cliente.email ?? '—'}</p>
                </div>
                {recibo.cliente.emails_cc_recibos && recibo.cliente.emails_cc_recibos.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase mb-1">CC fijos</p>
                    <div className="flex flex-wrap gap-1">
                      {recibo.cliente.emails_cc_recibos.map(e => (
                        <span key={e} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">{e}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : <p className="text-sm text-slate-400">—</p>}
          </Section>

          <Section title="Estado de envío">
            {recibo.email_enviado_at ? (
              <p className="text-sm text-emerald-700">
                ✓ Último envío: {new Date(recibo.email_enviado_at).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Guatemala' })}
              </p>
            ) : recibo.email_error ? (
              <p className="text-sm text-amber-700">⚠ Falló: {recibo.email_error}</p>
            ) : (
              <p className="text-sm text-slate-400">Aún no enviado</p>
            )}
          </Section>
        </div>
      </div>

      {/* Modal vincular cotización */}
      {showVincularModal && recibo.cliente && (
        <VincularCotizacionModal
          reciboId={id}
          clienteId={recibo.cliente.id}
          actualCotizacionId={recibo.cotizacion_id}
          onClose={() => setShowVincularModal(false)}
          onSuccess={() => { setShowVincularModal(false); refetch(); setToast({ type: 'success', message: '✓ Cotización actualizada' }); }}
        />
      )}

      {/* Modal enviar por email */}
      {showEmailModal && recibo.cliente && (
        <EnviarEmailModal
          recibo={recibo}
          onClose={() => setShowEmailModal(false)}
          onSuccess={() => {
            setShowEmailModal(false);
            refetch();
            refetchEnvios();
            setToast({ type: 'success', message: '✓ Email enviado' });
          }}
          onError={(msg) => setToast({ type: 'error', message: `Error: ${msg}` })}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Modal: Vincular / desvincular cotización ────────────────────────────────

function VincularCotizacionModal({
  reciboId, clienteId, actualCotizacionId, onClose, onSuccess,
}: {
  reciboId: string;
  clienteId: string;
  actualCotizacionId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate, loading } = useMutate();
  const [seleccion, setSeleccion] = useState<string>(actualCotizacionId ?? '');
  const [error, setError] = useState<string | null>(null);

  const { data: cotizacionesResult } = useFetch<{ data: CotizacionLite[] }>(
    `/api/admin/contabilidad/cotizaciones?cliente_id=${clienteId}&limit=50`
  );
  const cotizaciones = cotizacionesResult?.data ?? [];

  const guardar = async () => {
    setError(null);
    await mutate(`/api/admin/contabilidad/recibos-caja/${reciboId}`, {
      method: 'PATCH',
      body: { cotizacion_id: seleccion || null },
      onSuccess: () => onSuccess(),
      onError: (err: any) => setError(String(err)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Vincular cotización</h3>

        <div className="space-y-3 mb-5">
          <select
            value={seleccion}
            onChange={e => setSeleccion(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
          >
            <option value="">— Sin cotización (desvincular) —</option>
            {cotizaciones.map(c => (
              <option key={c.id} value={c.id}>
                {c.numero} · Q{c.total.toLocaleString('es-GT')} · {c.estado}
              </option>
            ))}
          </select>
          {cotizaciones.length === 0 && (
            <p className="text-xs text-slate-500">Este cliente no tiene cotizaciones registradas.</p>
          )}
        </div>

        {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button
            onClick={guardar}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#0F172A] to-[#22D3EE] rounded-lg disabled:opacity-50"
          >
            {loading ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Enviar por email con CC ──────────────────────────────────────────

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function EnviarEmailModal({
  recibo, onClose, onSuccess, onError,
}: {
  recibo: ReciboDetalle;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
}) {
  const { mutate, loading } = useMutate();

  const cliente = recibo.cliente!;
  const ccFijos = useMemo<string[]>(() => cliente.emails_cc_recibos ?? [], [cliente.emails_cc_recibos]);

  const [to, setTo] = useState(cliente.email ?? '');
  const [ccChips, setCcChips] = useState<{ email: string; fijo: boolean }[]>(
    () => ccFijos.map(e => ({ email: e, fijo: true }))
  );
  const [ccInput, setCcInput] = useState('');
  const [asunto, setAsunto] = useState(`Recibo de Caja ${recibo.numero} — Despacho Jurídico Boutique Amanda Santizo`);
  const [cuerpoHtml, setCuerpoHtml] = useState(buildCuerpoDefault(recibo));
  const [error, setError] = useState<string | null>(null);

  const agregarCc = () => {
    const v = ccInput.trim();
    if (!v) return;
    if (!EMAIL_RX.test(v)) { setError(`Email inválido: ${v}`); return; }
    if (ccChips.some(c => c.email.toLowerCase() === v.toLowerCase())) {
      setCcInput('');
      return;
    }
    setCcChips(prev => [...prev, { email: v, fijo: false }]);
    setCcInput('');
    setError(null);
  };

  const quitarCc = (email: string) => {
    setCcChips(prev => prev.filter(c => c.email !== email));
  };

  const handleCcKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      agregarCc();
    } else if (e.key === 'Backspace' && !ccInput && ccChips.length > 0) {
      // borrar último chip al hacer backspace en input vacío
      setCcChips(prev => prev.slice(0, -1));
    }
  };

  const enviar = async () => {
    setError(null);
    if (!to.trim() || !EMAIL_RX.test(to.trim())) {
      setError('Email destinatario inválido');
      return;
    }
    if (!asunto.trim()) {
      setError('El asunto es obligatorio');
      return;
    }

    await mutate(`/api/admin/contabilidad/recibos-caja/${recibo.id}/enviar`, {
      body: {
        to: to.trim(),
        cc: ccChips.map(c => c.email),
        asunto: asunto.trim(),
        cuerpo_html: cuerpoHtml,
      },
      onSuccess: () => onSuccess(),
      onError: (err: any) => { setError(String(err)); onError(String(err)); },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto py-8" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl mx-4 my-auto" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">Enviar Recibo de Caja por email</h3>
        <p className="text-xs text-slate-500 mb-4">Se adjunta el PDF y se registra en el historial de envíos.</p>

        <div className="space-y-4">
          {/* To */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Para</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
            />
          </div>

          {/* CC chips */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              CC <span className="text-slate-400 font-normal">(copia visible)</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-[#22D3EE]/30 focus-within:border-[#22D3EE]">
              {ccChips.map(chip => (
                <span
                  key={chip.email}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${
                    chip.fijo
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                  }`}
                  title={chip.fijo ? 'CC fijo del cliente' : 'CC puntual para este envío'}
                >
                  {chip.fijo && <span aria-hidden>🔒</span>}
                  {chip.email}
                  <button
                    type="button"
                    onClick={() => quitarCc(chip.email)}
                    className="text-slate-400 hover:text-red-500 leading-none"
                    aria-label={`Quitar ${chip.email}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                value={ccInput}
                onChange={e => setCcInput(e.target.value)}
                onKeyDown={handleCcKey}
                onBlur={agregarCc}
                placeholder={ccChips.length === 0 ? 'Agregar email y presionar Enter' : ''}
                className="flex-1 min-w-32 px-1 py-0.5 text-sm bg-transparent focus:outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Los chips con 🔒 son CC fijos del cliente. Puedes quitarlos solo para este envío.
            </p>
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Mensaje <span className="text-slate-400 font-normal">(HTML; se envía con el wrapper de marca)</span>
            </label>
            <textarea
              value={cuerpoHtml}
              onChange={e => setCuerpoHtml(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
            />
          </div>

          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button
            onClick={enviar}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#0F172A] to-[#22D3EE] rounded-lg disabled:opacity-50"
          >
            {loading ? 'Enviando…' : '✉ Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildCuerpoDefault(recibo: ReciboDetalle): string {
  const monto = `Q ${Number(recibo.monto).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const nombre = recibo.cliente?.nombre ?? 'estimado/a cliente';
  const concepto = recibo.concepto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<h2 style="margin:0 0 16px;color:#0F172A;font-size:20px;">Recibo de Caja ${recibo.numero}</h2>
<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
  Estimado/a <strong>${nombre}</strong>,
</p>
<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6;">
  Adjunto encontrará el Recibo de Caja correspondiente:
</p>
<table cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;width:100%;">
  <tr>
    <td style="padding:12px 16px;background:#F8FAFC;border-left:3px solid #22D3EE;border-radius:6px;">
      <p style="margin:0 0 6px;color:#64748B;font-size:12px;letter-spacing:0.5px;">CONCEPTO</p>
      <p style="margin:0 0 12px;color:#0F172A;font-size:14px;font-weight:600;">${concepto}</p>
      <p style="margin:0 0 6px;color:#64748B;font-size:12px;letter-spacing:0.5px;">MONTO</p>
      <p style="margin:0;color:#0F172A;font-size:18px;font-weight:700;">${monto}</p>
    </td>
  </tr>
</table>
<p style="margin:16px 0;color:#64748B;font-size:12px;line-height:1.6;">
  Recordatorio: este Recibo de Caja es un comprobante NO fiscal y no sustituye
  a la factura fiscal de honorarios profesionales.
</p>`;
}
