// ============================================================================
// components/admin/CorreosSalientes.tsx
// Sección "📤 Correos salientes" de Molly Mail: cargar (incl. carga masiva),
// revisar y enviar en lote correos salientes nuevos (legal.borradores_salientes).
// Funcionalidad paralela a los borradores de respuesta.
// ============================================================================
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface Saliente {
  id: string;
  account: string;
  to_emails: string[];
  cc_emails: string[] | null;
  subject: string;
  body_text: string;
  body_html: string | null;
  cliente_id: string | null;
  lote: string | null;
  status: string;
  created_at: string;
}

interface ClienteOpt {
  id: string;
  nombre: string;
  codigo: string;
  email: string | null;
  emails_cc: string[] | null;
}

const CUENTAS = [
  { value: 'asistente@papeleo.legal', label: '📧 Asistente' },
  { value: 'contador@papeleo.legal', label: '💰 Contador' },
  { value: 'amanda@papeleo.legal', label: '⭐ Amanda' },
];

const ACCOUNT_BADGE: Record<string, { label: string; className: string; emoji: string }> = {
  'contador@papeleo.legal': { label: 'Contador', className: 'bg-amber-100 text-amber-700', emoji: '💰' },
  'asistente@papeleo.legal': { label: 'Asistente', className: 'bg-blue-100 text-blue-700', emoji: '📧' },
  'amanda@papeleo.legal': { label: 'Amanda', className: 'bg-purple-100 text-purple-700', emoji: '⭐' },
};

function AccountBadge({ account }: { account: string }) {
  const cfg = ACCOUNT_BADGE[account] ?? { label: account.split('@')[0], className: 'bg-slate-100 text-slate-600', emoji: '📬' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full ${cfg.className}`}>
      <span aria-hidden>{cfg.emoji}</span>{cfg.label}
    </span>
  );
}

const splitEmails = (s: string): string[] => s.split(/[,;\n]/).map((e) => e.trim()).filter(Boolean);

export default function CorreosSalientes() {
  const [items, setItems] = useState<Saliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Saliente | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/molly/salientes?status=pendiente');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Agrupar por lote (los sin lote van bajo "Sin lote").
  const grupos = items.reduce<Record<string, Saliente[]>>((acc, it) => {
    const key = it.lote || 'Sin lote';
    (acc[key] ||= []).push(it);
    return acc;
  }, {});

  const enviarUno = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/molly/salientes/${id}/enviar`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al enviar');
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const cancelarUno = async (id: string) => {
    if (!confirm('¿Cancelar este correo saliente? No se enviará.')) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await adminFetch(`/api/admin/molly/salientes/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al cancelar');
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusyId(null);
    }
  };

  const enviarLote = async (lote: string) => {
    const delLote = grupos[lote] ?? [];
    if (lote === 'Sin lote') {
      // "Sin lote" no es un lote real: enviar uno por uno secuencialmente.
      if (!confirm(`¿Enviar los ${delLote.length} correos sin lote?`)) return;
      for (let i = 0; i < delLote.length; i++) {
        setBatchProgress(`Enviando ${i + 1} de ${delLote.length}…`);
        await enviarUno(delLote[i].id);
      }
      setBatchProgress(null);
      fetchItems();
      return;
    }
    if (!confirm(`¿Enviar todo el lote "${lote}" (${delLote.length} correos)?`)) return;
    setError(null);
    setBatchProgress(`Enviando lote "${lote}" (${delLote.length} correos)…`);
    try {
      const res = await adminFetch('/api/admin/molly/salientes/enviar-lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lote }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al enviar el lote');
      const r = json.data;
      if (r.fallidos?.length) {
        setError(`Lote enviado: ${r.enviados.length} OK, ${r.fallidos.length} fallaron — ${r.fallidos.map((f: { subject: string }) => f.subject).join(', ')}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBatchProgress(null);
      fetchItems();
    }
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-navy">📤 Correos salientes ({items.length})</h2>
        <button
          onClick={() => setComposeOpen(true)}
          className="px-4 py-2 bg-cyan text-navy-dark font-semibold rounded-lg hover:bg-cyan/90 transition-colors text-sm"
        >
          ➕ Nuevo / 📋 Carga masiva
        </button>
      </div>

      {error && (
        <div className="mb-4 flex items-start justify-between bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 font-bold">&times;</button>
        </div>
      )}

      {batchProgress && (
        <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm font-medium animate-pulse">
          {batchProgress}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate animate-pulse">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-slate">
          No hay correos salientes pendientes. Usa “➕ Nuevo / 📋 Carga masiva” para crear.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grupos).map(([lote, delLote]) => (
            <div key={lote} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="font-semibold text-navy text-sm">
                  {lote === 'Sin lote' ? '📭 Sin lote' : `🗂️ ${lote}`} <span className="text-slate font-normal">({delLote.length})</span>
                </h3>
                <button
                  onClick={() => enviarLote(lote)}
                  disabled={!!batchProgress || !!busyId}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition"
                >
                  📨 Enviar todo el lote
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {delLote.map((s) => (
                  <div key={s.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <AccountBadge account={s.account} />
                          <span className="text-sm font-semibold text-navy truncate">{s.subject}</span>
                        </div>
                        <p className="text-xs text-slate">
                          <strong>Para:</strong> {s.to_emails.join(', ')}
                          {s.cc_emails && s.cc_emails.length > 0 && <> · <strong>CC:</strong> {s.cc_emails.join(', ')}</>}
                        </p>
                        <p className="text-sm text-slate-600 mt-1 line-clamp-2 whitespace-pre-line">{s.body_text}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditing(s)}
                          disabled={busyId === s.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 transition"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          onClick={() => enviarUno(s.id)}
                          disabled={busyId === s.id || !!batchProgress}
                          className="px-3 py-1 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {busyId === s.id ? 'Enviando…' : '✅ Enviar'}
                        </button>
                        <button
                          onClick={() => cancelarUno(s.id)}
                          disabled={busyId === s.id}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-white border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition"
                        >
                          ❌ Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {composeOpen && (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onSaved={() => { setComposeOpen(false); fetchItems(); }}
        />
      )}
      {editing && (
        <EditModal
          saliente={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

// ── Modal: nuevo / carga masiva ─────────────────────────────────────────────

interface DraftQueued {
  account: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  cliente_id: string | null;
}

function ComposeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [account, setAccount] = useState(CUENTAS[0].value);
  const [lote, setLote] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [queue, setQueue] = useState<DraftQueued[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda de cliente
  const [search, setSearch] = useState('');
  const [resultados, setResultados] = useState<ClienteOpt[]>([]);
  const [showResults, setShowResults] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (search.trim().length < 2) { setResultados([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/clientes?q=${encodeURIComponent(search)}&limit=6`);
        const json = await res.json();
        setResultados(json.data ?? []);
        setShowResults(true);
      } catch { setResultados([]); }
    }, 300);
  }, [search]);

  const seleccionarCliente = (c: ClienteOpt) => {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    if (c.email) setTo(c.email);
    if (c.emails_cc && c.emails_cc.length) setCc(c.emails_cc.join(', '));
    setSearch('');
    setResultados([]);
    setShowResults(false);
  };

  const limpiarFormulario = () => {
    setTo(''); setCc(''); setSubject(''); setBody('');
    setClienteId(null); setClienteNombre('');
  };

  const formularioActual = (): DraftQueued | null => {
    if (!to.trim()) { setError('Falta el destinatario.'); return null; }
    if (!subject.trim()) { setError('Falta el asunto.'); return null; }
    if (!body.trim()) { setError('Falta el cuerpo.'); return null; }
    return { account, to, cc, subject, body, cliente_id: clienteId };
  };

  const agregarALista = () => {
    setError(null);
    const d = formularioActual();
    if (!d) return;
    setQueue((prev) => [...prev, d]);
    limpiarFormulario();
  };

  const guardar = async () => {
    setError(null);
    // Si hay datos en el formulario actual sin agregar, incluirlos.
    let lista = [...queue];
    if (to.trim() || subject.trim() || body.trim()) {
      const d = formularioActual();
      if (!d) return;
      lista = [...lista, d];
    }
    if (lista.length === 0) { setError('Agrega al menos un correo.'); return; }

    const payload = lista.map((d) => ({
      account: d.account,
      to_emails: splitEmails(d.to),
      cc_emails: splitEmails(d.cc),
      subject: d.subject,
      body_text: d.body,
      cliente_id: d.cliente_id,
      lote: lote.trim() || null,
    }));

    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/molly/salientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-navy">📤 Nuevo correo saliente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cuenta de envío</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
              >
                {CUENTAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Lote (opcional, agrupa)</label>
              <input
                type="text"
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ej: Resúmenes Asamblea Rope Junio 2026"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
              />
            </div>
          </div>

          {/* Buscar cliente */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cliente (opcional — autocompleta destinatario y CC)
              {clienteNombre && <span className="ml-2 text-emerald-600 font-semibold">✓ {clienteNombre}</span>}
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => resultados.length && setShowResults(true)}
              placeholder="Buscar por nombre o código…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
            />
            {showResults && resultados.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {resultados.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => seleccionarCliente(c)}
                    className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0"
                  >
                    <span className="font-medium text-navy">{c.nombre}</span>
                    <span className="text-slate-400 text-xs ml-2">{c.codigo}</span>
                    {c.email && <span className="block text-xs text-slate-400">{c.email}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Para (separar con coma)</label>
              <input
                type="text"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="cliente@correo.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CC (opcional)</label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="copia@correo.com"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuerpo</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Escriba o pegue el cuerpo del correo…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan"
            />
          </div>

          {queue.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">En cola para guardar ({queue.length}):</p>
              <ul className="space-y-1">
                {queue.map((d, i) => (
                  <li key={i} className="flex items-center justify-between text-xs text-slate-700">
                    <span className="truncate">{d.subject} → {d.to}</span>
                    <button onClick={() => setQueue((p) => p.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 ml-2">quitar</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
          <button
            onClick={agregarALista}
            disabled={saving}
            className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 text-sm font-medium transition"
          >
            ➕ Agregar otro (carga masiva)
          </button>
          <button
            onClick={guardar}
            disabled={saving}
            className="px-5 py-2 bg-cyan text-navy-dark rounded-lg hover:bg-cyan/90 disabled:opacity-50 text-sm font-semibold transition"
          >
            {saving ? 'Guardando…' : `Guardar ${queue.length > 0 ? `(${queue.length + (to.trim() || subject.trim() ? 1 : 0)})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: editar borrador ──────────────────────────────────────────────────

function EditModal({ saliente, onClose, onSaved }: { saliente: Saliente; onClose: () => void; onSaved: () => void }) {
  const [to, setTo] = useState(saliente.to_emails.join(', '));
  const [cc, setCc] = useState((saliente.cc_emails ?? []).join(', '));
  const [subject, setSubject] = useState(saliente.subject);
  const [body, setBody] = useState(saliente.body_text);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await adminFetch(`/api/admin/molly/salientes/${saliente.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_emails: splitEmails(to),
          cc_emails: splitEmails(cc),
          subject,
          body_text: body,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-navy">✏️ Editar correo saliente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Para</label>
              <input type="text" value={to} onChange={(e) => setTo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">CC</label>
              <input type="text" value={cc} onChange={(e) => setCc(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Asunto</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuerpo</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan focus:border-cyan" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-5 py-2 bg-cyan text-navy-dark rounded-lg hover:bg-cyan/90 disabled:opacity-50 text-sm font-semibold transition">
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
