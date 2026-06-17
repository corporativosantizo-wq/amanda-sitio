'use client';

// ============================================================================
// /admin/descargar-adjuntos
// Descarga masiva de adjuntos por remitente vía Microsoft Graph.
// Busca correos con adjuntos de un remitente en una cuenta del despacho y los
// empaqueta en un ZIP descargable.
// ============================================================================

import { useState } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface AdjuntoMeta {
  id: string;
  name: string;
  size: number;
  contentType: string | null;
  isInline: boolean;
}
interface CorreoConAdjuntos {
  id: string;
  subject: string;
  receivedDateTime: string;
  attachments: AdjuntoMeta[];
}
interface Resultado {
  account: string;
  remitente: string;
  correos: CorreoConAdjuntos[];
  totalCorreos: number;
  totalAdjuntos: number;
  tamanoTotal: number;
}

const CUENTAS = [
  { value: 'amanda@papeleo.legal', label: '⭐ amanda@papeleo.legal' },
  { value: 'asistente@papeleo.legal', label: '📧 asistente@papeleo.legal' },
  { value: 'contador@papeleo.legal', label: '💰 contador@papeleo.legal' },
];

function fmtTam(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtFecha(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-GT', {
    timeZone: 'America/Guatemala',
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export default function DescargarAdjuntosPage() {
  const [account, setAccount] = useState(CUENTAS[0].value);
  const [remitente, setRemitente] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [incluirInline, setIncluirInline] = useState(false);

  const [buscando, setBuscando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const params = () => ({ account, remitente: remitente.trim().toLowerCase(), desde: desde || null, hasta: hasta || null, incluirInline });

  const buscar = async () => {
    setError(null);
    setAviso(null);
    setResultado(null);
    if (!remitente.trim()) { setError('Ingresa el correo del remitente.'); return; }
    setBuscando(true);
    try {
      const res = await adminFetch('/api/admin/adjuntos/buscar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params()),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al buscar');
      setResultado(json.data);
      if (json.data.totalCorreos === 0) setAviso('No se encontraron correos con adjuntos de ese remitente en esa cuenta/rango.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar');
    } finally {
      setBuscando(false);
    }
  };

  const descargar = async () => {
    if (!resultado || resultado.totalAdjuntos === 0) return;
    setError(null);
    setAviso(null);
    setDescargando(true);
    try {
      const res = await adminFetch('/api/admin/adjuntos/descargar-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params()),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Error al generar el ZIP');
      }
      // Reportar adjuntos que fallaron (cabecera de resumen).
      try {
        const resumenRaw = res.headers.get('X-Adjuntos-Resumen');
        if (resumenRaw) {
          const r = JSON.parse(decodeURIComponent(resumenRaw));
          if (r.fallidos?.length) {
            setAviso(`ZIP generado con ${r.incluidos}/${r.totalAdjuntos} adjuntos. Fallaron ${r.fallidos.length}: ${r.fallidos.map((f: { archivo: string }) => f.archivo).join(', ')}`);
          }
        }
      } catch { /* cabecera opcional */ }

      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') || '';
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || 'adjuntos.zip';
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlObj);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al descargar');
    } finally {
      setDescargando(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-navy">📦 Descargar adjuntos</h1>
        <p className="text-slate mt-1">Busca correos de un remitente y descarga todos sus adjuntos en un ZIP.</p>
      </div>

      {/* Formulario */}
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
            >
              {CUENTAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Remitente (email)</label>
            <input
              type="email"
              value={remitente}
              onChange={(e) => setRemitente(e.target.value)}
              placeholder="romaneli_rivera@hotmail.com"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde (opcional)</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta (opcional)</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={incluirInline} onChange={(e) => setIncluirInline(e.target.checked)} className="rounded" />
          Incluir imágenes incrustadas (firmas, logos). Por defecto se omiten.
        </label>

        <button
          onClick={buscar}
          disabled={buscando}
          className="px-5 py-2.5 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan/90 disabled:opacity-50 transition text-sm"
        >
          {buscando ? 'Buscando…' : '🔍 Buscar correos con adjuntos'}
        </button>
      </div>

      {error && (
        <div className="mt-4 flex items-start justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 font-bold">&times;</button>
        </div>
      )}
      {aviso && (
        <div className="mt-4 flex items-start justify-between bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          <span>{aviso}</span>
          <button onClick={() => setAviso(null)} className="ml-4 text-amber-400 hover:text-amber-600 font-bold">&times;</button>
        </div>
      )}

      {/* Resultados */}
      {resultado && resultado.totalCorreos > 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50">
            <div className="text-sm text-slate-700">
              <strong>{resultado.totalCorreos}</strong> correos · <strong>{resultado.totalAdjuntos}</strong> adjuntos ·
              <strong> {fmtTam(resultado.tamanoTotal)}</strong> en total
            </div>
            <button
              onClick={descargar}
              disabled={descargando}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition"
            >
              {descargando ? 'Generando ZIP…' : '📦 Descargar todos los adjuntos (ZIP)'}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {resultado.correos.map((c) => (
              <div key={c.id} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy truncate">{c.subject}</p>
                    <p className="text-xs text-slate-400">{fmtFecha(c.receivedDateTime)}</p>
                    <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {c.attachments.map((a) => (
                        <li key={a.id} className="text-xs text-slate-600">
                          📎 {a.name} <span className="text-slate-400">({fmtTam(a.size)})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">
                    {c.attachments.length} 📎
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
