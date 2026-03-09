// ============================================================================
// app/admin/email/comunicaciones/page.tsx
// Centro de Comunicaciones — Compositor con plantillas + historial
// ============================================================================

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import {
  PageHeader, Badge, EmptyState, Skeleton, Q,
} from '@/components/admin/ui';

// ── Types ────────────────────────────────────────────────────────────────

interface CampoExtra {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'time' | 'url';
}

interface Plantilla {
  id: string;
  nombre: string;
  slug: string | null;
  icono: string;
  categoria: string;
  asunto_template: string;
  cuerpo_template: string;
  cuenta_default: string;
  campos_extra: CampoExtra[];
}

interface PieConf {
  id: string;
  cuenta_email: string;
  texto: string;
}

interface Correo {
  id: string;
  destinatario_email: string;
  destinatario_nombre: string | null;
  cc_emails: string | null;
  cuenta_envio: string;
  asunto: string;
  cuerpo: string;
  estado: string;
  programado_para: string | null;
  enviado_at: string | null;
  error_mensaje: string | null;
  created_at: string;
  plantilla?: { nombre: string; icono: string } | null;
  cliente?: { nombre: string } | null;
}

interface ClienteBusqueda {
  id: string;
  nombre: string;
  email: string | null;
  nit: string | null;
  codigo: string;
}

const CUENTAS = [
  { value: 'amanda@papeleo.legal', label: 'amanda@papeleo.legal' },
  { value: 'asistente@papeleo.legal', label: 'asistente@papeleo.legal' },
  { value: 'contador@papeleo.legal', label: 'contador@papeleo.legal' },
];

// ── Page ─────────────────────────────────────────────────────────────────

export default function ComunicacionesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'nuevo' | 'programados' | 'enviados'>('nuevo');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centro de Comunicaciones"
        description="Envía correos personalizados desde plantillas profesionales"
      />

      {/* Tabs */}
      <div className="flex bg-white rounded-lg border border-slate-200 p-1 w-fit">
        {[
          { key: 'nuevo' as const, label: '📝 Nuevo correo' },
          { key: 'programados' as const, label: '📅 Programados' },
          { key: 'enviados' as const, label: '✅ Enviados' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
              tab === t.key
                ? 'bg-[#1E40AF] text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'nuevo' && <NuevoCorreoTab />}
      {tab === 'programados' && <CorreosListTab estado="programado" />}
      {tab === 'enviados' && <CorreosListTab estado="enviado" />}
    </div>
  );
}

// ── Tab: Nuevo Correo ────────────────────────────────────────────────────

function NuevoCorreoTab() {
  const { data: config, loading } = useFetch<{ plantillas: Plantilla[]; pies: PieConf[] }>(
    '/api/admin/comunicaciones?tipo=plantillas'
  );
  const { mutate, loading: sending } = useMutate();

  // Steps
  const [paso, setPaso] = useState(1);
  const [plantillaId, setPlantillaId] = useState<string | null>(null);

  // Destinatario
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [clienteNombre, setClienteNombre] = useState('');
  const [destinatarioEmail, setDestinatarioEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Content
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [camposExtra, setCamposExtra] = useState<Record<string, string>>({});
  const [cuenta, setCuenta] = useState('amanda@papeleo.legal');

  // Schedule
  const [programarFecha, setProgramarFecha] = useState('');
  const [programarHora, setProgramarHora] = useState('08:00');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }
  }, [toast]);

  // Client search
  const clienteUrl = clienteBusqueda.length >= 2
    ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=5`
    : null;
  const { data: clientesResult } = useFetch<{ data: ClienteBusqueda[] }>(clienteUrl);

  const plantilla = useMemo(
    () => config?.plantillas.find((p: Plantilla) => p.id === plantillaId) ?? null,
    [config, plantillaId]
  );

  const pieTexto = useMemo(
    () => config?.pies.find((p: PieConf) => p.cuenta_email === cuenta)?.texto ?? '',
    [config, cuenta]
  );

  // Select plantilla → advance to step 2
  const seleccionarPlantilla = (id: string | null) => {
    setPlantillaId(id);
    if (id) {
      const p = config?.plantillas.find((t: Plantilla) => t.id === id);
      if (p) {
        setCuenta(p.cuenta_default);
        // Don't populate content yet — wait for client selection
      }
    } else {
      // Correo libre
      setAsunto('');
      setCuerpo('');
      setCamposExtra({});
    }
    setPaso(2);
  };

  // Select client → populate template variables and advance
  const seleccionarCliente = (c: ClienteBusqueda) => {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setDestinatarioEmail(c.email ?? '');
    setClienteBusqueda('');
    setShowDropdown(false);

    // Populate template with client vars
    if (plantilla) {
      let asuntoFilled = plantilla.asunto_template
        .replace(/\{nombre_cliente\}/g, c.nombre)
        .replace(/\{nit\}/g, c.nit ?? 'CF');
      let cuerpoFilled = plantilla.cuerpo_template
        .replace(/\{nombre_cliente\}/g, c.nombre)
        .replace(/\{nit\}/g, c.nit ?? 'CF');

      setAsunto(asuntoFilled);
      setCuerpo(cuerpoFilled);
    }

    setPaso(3);
  };

  // Apply extra fields to content
  const aplicarCampos = useCallback(() => {
    let a = asunto;
    let c = cuerpo;
    for (const [key, val] of Object.entries(camposExtra)) {
      const formatted = key.includes('fecha') && val
        ? new Date(val + 'T12:00:00').toLocaleDateString('es-GT', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            timeZone: 'America/Guatemala',
          })
        : val;
      a = a.replace(new RegExp(`\\{${key}\\}`, 'g'), formatted || `{${key}}`);
      c = c.replace(new RegExp(`\\{${key}\\}`, 'g'), formatted || `{${key}}`);
    }
    setAsunto(a);
    setCuerpo(c);
  }, [asunto, cuerpo, camposExtra]);

  // Send
  const handleEnviar = async (modo: 'ahora' | 'programar') => {
    if (!destinatarioEmail) return setToast({ type: 'error', msg: 'Falta email de destinatario' });
    if (!asunto.trim()) return setToast({ type: 'error', msg: 'Falta asunto' });
    if (!cuerpo.trim()) return setToast({ type: 'error', msg: 'Falta contenido del correo' });

    if (modo === 'programar' && !programarFecha) {
      return setToast({ type: 'error', msg: 'Selecciona fecha de envío' });
    }

    const programadoPara = modo === 'programar'
      ? new Date(`${programarFecha}T${programarHora}:00`).toISOString()
      : null;

    const result = await mutate('/api/admin/comunicaciones', {
      body: {
        accion: modo === 'programar' ? 'programar' : 'crear',
        plantilla_id: plantillaId,
        cliente_id: clienteId,
        destinatario_email: destinatarioEmail,
        destinatario_nombre: clienteNombre || null,
        cc_emails: ccEmails.trim() || null,
        cuenta_envio: cuenta,
        asunto,
        cuerpo,
        enviar_ahora: modo === 'ahora',
        programado_para: programadoPara,
      },
      onSuccess: () => {
        setToast({
          type: 'success',
          msg: modo === 'ahora' ? 'Correo enviado exitosamente' : 'Correo programado',
        });
        // Reset
        setPaso(1);
        setPlantillaId(null);
        setClienteId(null);
        setClienteNombre('');
        setDestinatarioEmail('');
        setCcEmails('');
        setAsunto('');
        setCuerpo('');
        setCamposExtra({});
      },
      onError: (err: any) => setToast({ type: 'error', msg: String(err) }),
    });
  };

  if (loading) return <div className="space-y-4"><Skeleton className="h-48 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Toast */}
      {toast && (
        <div className={`px-4 py-3 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: 'Plantilla' },
          { n: 2, label: 'Destinatario' },
          { n: 3, label: 'Personalizar' },
          { n: 4, label: 'Enviar' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${paso >= s.n ? 'bg-[#0891B2]' : 'bg-slate-200'}`} />}
            <button
              onClick={() => paso > s.n && setPaso(s.n)}
              disabled={paso < s.n}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                paso === s.n
                  ? 'bg-[#0891B2] text-white'
                  : paso > s.n
                    ? 'bg-cyan-50 text-[#0891B2] cursor-pointer hover:bg-cyan-100'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span>{s.n}</span> {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* ═══ PASO 1: Elegir plantilla ═══ */}
      {paso === 1 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Elige una plantilla</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {config?.plantillas.map((p: Plantilla) => (
              <button
                key={p.id}
                onClick={() => seleccionarPlantilla(p.id)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-200 hover:border-[#0891B2] hover:bg-cyan-50/30 transition-all text-center"
              >
                <span className="text-2xl">{p.icono}</span>
                <span className="text-sm font-medium text-slate-800">{p.nombre}</span>
                <span className="text-xs text-slate-400">{p.cuenta_default}</span>
              </button>
            ))}
            <button
              onClick={() => seleccionarPlantilla(null)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#0891B2] hover:bg-cyan-50/30 transition-all text-center"
            >
              <span className="text-2xl">✏️</span>
              <span className="text-sm font-medium text-slate-800">Correo libre</span>
              <span className="text-xs text-slate-400">Redactar desde cero</span>
            </button>
          </div>
        </section>
      )}

      {/* ═══ PASO 2: Destinatario ═══ */}
      {paso === 2 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">
            Destinatario
            {plantilla && <span className="ml-2 text-xs text-slate-400 font-normal">{plantilla.icono} {plantilla.nombre}</span>}
          </h3>

          {/* Client search */}
          <div className="relative mb-4">
            <label className="text-xs text-slate-500 font-medium">Buscar cliente</label>
            <input
              type="text"
              placeholder="Nombre, NIT o código..."
              value={clienteId ? clienteNombre : clienteBusqueda}
              onChange={e => { setClienteBusqueda(e.target.value); setShowDropdown(true); setClienteId(null); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full mt-1 px-4 py-3 pl-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
            <span className="absolute left-3.5 bottom-3 text-slate-400">🔍</span>

            {showDropdown && clienteBusqueda.length >= 2 && !clienteId && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-48 overflow-y-auto">
                  {clientesResult?.data?.map((c: ClienteBusqueda) => (
                    <button
                      key={c.id}
                      onClick={() => seleccionarCliente(c)}
                      className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <span className="font-medium text-slate-900">{c.nombre}</span>
                      <span className="text-slate-400 text-xs ml-2">{c.email ?? 'Sin email'}</span>
                    </button>
                  ))}
                  {clientesResult?.data?.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-500">No encontrado</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Direct email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">Email destinatario</label>
              <input
                type="email"
                value={destinatarioEmail}
                onChange={e => setDestinatarioEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">CC (opcional)</label>
              <input
                type="text"
                value={ccEmails}
                onChange={e => setCcEmails(e.target.value)}
                placeholder="cc1@ejemplo.com, cc2@ejemplo.com"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setPaso(1)} className="text-sm text-slate-500 hover:text-slate-700">← Cambiar plantilla</button>
            <button
              onClick={() => {
                if (!destinatarioEmail) return setToast({ type: 'error', msg: 'Ingresa un email' });
                // If no template or no client, populate empty
                if (!plantilla) { setPaso(3); return; }
                if (!clienteId) {
                  setAsunto(plantilla.asunto_template.replace(/\{nombre_cliente\}/g, clienteNombre || 'Cliente'));
                  setCuerpo(plantilla.cuerpo_template.replace(/\{nombre_cliente\}/g, clienteNombre || 'Cliente'));
                }
                setPaso(3);
              }}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E40AF]/90"
            >
              Continuar →
            </button>
          </div>
        </section>
      )}

      {/* ═══ PASO 3: Personalizar ═══ */}
      {paso === 3 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Personalizar correo
            <span className="ml-2 text-xs text-slate-400 font-normal">→ {destinatarioEmail}</span>
          </h3>

          {/* Campos extra de la plantilla */}
          {plantilla && plantilla.campos_extra.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-blue-700">Campos de la plantilla</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plantilla.campos_extra.map((campo: CampoExtra) => (
                  <div key={campo.key}>
                    <label className="text-xs text-blue-600 font-medium">{campo.label}</label>
                    {campo.type === 'textarea' ? (
                      <textarea
                        value={camposExtra[campo.key] ?? ''}
                        onChange={e => setCamposExtra(prev => ({ ...prev, [campo.key]: e.target.value }))}
                        rows={3}
                        className="w-full mt-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/20 bg-white"
                      />
                    ) : (
                      <input
                        type={campo.type === 'date' ? 'date' : campo.type === 'time' ? 'time' : campo.type === 'url' ? 'url' : 'text'}
                        value={camposExtra[campo.key] ?? ''}
                        onChange={e => setCamposExtra(prev => ({ ...prev, [campo.key]: e.target.value }))}
                        className="w-full mt-1 px-3 py-2 text-sm border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/20 bg-white"
                      />
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={aplicarCampos}
                className="text-xs font-medium text-blue-700 bg-blue-100 px-3 py-1.5 rounded-lg hover:bg-blue-200"
              >
                Aplicar al correo ↓
              </button>
            </div>
          )}

          {/* Asunto */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          {/* Cuerpo */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Contenido</label>
            <textarea
              value={cuerpo}
              onChange={e => setCuerpo(e.target.value)}
              rows={12}
              className="w-full mt-1 px-4 py-3 text-sm border border-slate-200 rounded-lg font-sans leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          {/* Pie preview */}
          {pieTexto && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-400 mb-1">Pie de confidencialidad (se agrega automáticamente)</p>
              <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-50 rounded-lg p-3 border border-slate-100">
                {pieTexto.substring(0, 200)}...
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setPaso(2)} className="text-sm text-slate-500 hover:text-slate-700">← Destinatario</button>
            <button
              onClick={() => setPaso(4)}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E40AF]/90"
            >
              Revisar y enviar →
            </button>
          </div>
        </section>
      )}

      {/* ═══ PASO 4: Enviar ═══ */}
      {paso === 4 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          <h3 className="text-sm font-semibold text-slate-900">Revisar y enviar</h3>

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Para:</span><span className="text-slate-800">{destinatarioEmail}</span></div>
            {ccEmails && <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">CC:</span><span className="text-slate-600">{ccEmails}</span></div>}
            <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Cuenta:</span><span className="text-slate-600">{cuenta}</span></div>
            <div className="flex gap-2"><span className="text-slate-400 w-20 shrink-0">Asunto:</span><span className="font-medium text-slate-900">{asunto}</span></div>
          </div>

          {/* Preview */}
          <div className="border border-slate-200 rounded-lg p-5">
            <p className="text-xs text-slate-400 mb-3">Vista previa del correo</p>
            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{cuerpo}</div>
            {pieTexto && (
              <div className="mt-4 pt-3 border-t border-slate-200 text-[11px] text-slate-400 leading-relaxed">
                {pieTexto}
              </div>
            )}
          </div>

          {/* Cuenta de envío */}
          <div>
            <label className="text-xs text-slate-500 font-medium">Cuenta de envío</label>
            <select
              value={cuenta}
              onChange={e => setCuenta(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-cyan-500"
            >
              {CUENTAS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Schedule section */}
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
            <p className="text-xs font-medium text-violet-700 mb-2">📅 Programar envío (opcional)</p>
            <div className="flex gap-3">
              <input
                type="date"
                value={programarFecha}
                onChange={e => setProgramarFecha(e.target.value)}
                className="px-3 py-2 text-sm border border-violet-200 rounded-lg bg-white"
              />
              <input
                type="time"
                value={programarHora}
                onChange={e => setProgramarHora(e.target.value)}
                className="px-3 py-2 text-sm border border-violet-200 rounded-lg bg-white"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => setPaso(3)} className="text-sm text-slate-500 hover:text-slate-700">← Editar</button>
            <div className="flex-1" />
            {programarFecha && (
              <button
                onClick={() => handleEnviar('programar')}
                disabled={sending}
                className="px-4 py-2.5 text-sm font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 transition-colors"
              >
                {sending ? 'Programando...' : '📅 Programar envío'}
              </button>
            )}
            <button
              onClick={() => handleEnviar('ahora')}
              disabled={sending}
              className="px-5 py-2.5 text-sm font-semibold bg-[#0891B2] text-white rounded-lg hover:bg-[#0891B2]/90 disabled:opacity-50 transition-colors"
            >
              {sending ? 'Enviando...' : '📧 Enviar ahora'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Tab: Lista de correos (Programados / Enviados) ───────────────────────

function CorreosListTab({ estado }: { estado: 'programado' | 'enviado' }) {
  const { data: res, loading, refetch } = useFetch<{ data: Correo[]; total: number }>(
    `/api/admin/comunicaciones?tipo=correos&estado=${estado}&limit=30`
  );
  const { mutate, loading: acting } = useMutate();

  const handleAccion = async (id: string, accion: 'enviar' | 'cancelar') => {
    await mutate('/api/admin/comunicaciones', {
      body: { accion, id },
      onSuccess: () => refetch(),
      onError: (err: any) => alert(String(err)),
    });
  };

  if (loading) return <div className="space-y-3"><Skeleton className="h-12 w-full rounded-lg" /><Skeleton className="h-12 w-full rounded-lg" /><Skeleton className="h-12 w-full rounded-lg" /></div>;

  if (!res || res.data.length === 0) {
    return (
      <EmptyState
        icon={estado === 'programado' ? '📅' : '✅'}
        title={estado === 'programado' ? 'No hay correos programados' : 'No hay correos enviados'}
        description={estado === 'programado' ? 'Programa correos desde el compositor' : 'Los correos enviados aparecerán aquí'}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/50">
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Destinatario</th>
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Asunto</th>
            {estado === 'programado' && <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Envío</th>}
            {estado === 'enviado' && <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Enviado</th>}
            <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Cuenta</th>
            {estado === 'programado' && <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {res.data.map((c: Correo) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  {c.plantilla && <span className="text-sm">{c.plantilla.icono}</span>}
                  <div>
                    <p className="text-sm font-medium text-slate-900">{c.destinatario_nombre || c.destinatario_email}</p>
                    {c.destinatario_nombre && <p className="text-xs text-slate-400">{c.destinatario_email}</p>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-4 text-slate-700 max-w-[250px] truncate">{c.asunto}</td>
              <td className="py-3 px-4 text-xs text-slate-500">
                {estado === 'programado' && c.programado_para
                  ? new Date(c.programado_para).toLocaleDateString('es-GT', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      timeZone: 'America/Guatemala',
                    })
                  : c.enviado_at
                    ? new Date(c.enviado_at).toLocaleDateString('es-GT', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        timeZone: 'America/Guatemala',
                      })
                    : '—'}
              </td>
              <td className="py-3 px-4 text-xs text-slate-500">{c.cuenta_envio.split('@')[0]}</td>
              {estado === 'programado' && (
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleAccion(c.id, 'enviar')}
                      disabled={acting}
                      className="px-2.5 py-1 text-xs font-medium bg-[#0891B2] text-white rounded-md hover:bg-[#0891B2]/90 disabled:opacity-50"
                    >
                      Enviar ahora
                    </button>
                    <button
                      onClick={() => handleAccion(c.id, 'cancelar')}
                      disabled={acting}
                      className="px-2.5 py-1 text-xs font-medium border border-slate-200 text-slate-600 rounded-md hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
        {res.total} correo{res.total !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
