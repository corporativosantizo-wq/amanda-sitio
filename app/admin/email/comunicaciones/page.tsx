// ============================================================================
// app/admin/email/comunicaciones/page.tsx
// Centro de Comunicaciones — Compositor con plantillas + historial
// ============================================================================

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { adminFetch } from '@/lib/utils/admin-fetch';
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

interface AdjuntoMeta {
  name: string;
  path: string;
  size: number;
  contentType: string;
}

interface Correo {
  id: string;
  destinatario_email: string;
  destinatario_nombre: string | null;
  cc_emails: string | null;
  cuenta_envio: string;
  asunto: string;
  cuerpo: string;
  adjuntos: AdjuntoMeta[];
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
  const [tab, setTab] = useState<'nuevo' | 'masivo' | 'programados' | 'enviados'>('nuevo');

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
          { key: 'masivo' as const, label: '📎 Envío masivo' },
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
      {tab === 'masivo' && <EnvioMasivoDocumentosTab />}
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

  // Attachments
  const [adjuntos, setAdjuntos] = useState<AdjuntoMeta[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const adjuntoInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-detect {placeholders} in template text and merge with campos_extra
  const camposExtraCompletos = useMemo<CampoExtra[]>(() => {
    if (!plantilla) return [];
    const definedKeys = new Set(plantilla.campos_extra.map(c => c.key));
    const hardcoded = new Set(['nombre_cliente', 'nit']);
    const extra: CampoExtra[] = [...plantilla.campos_extra];
    const pattern = /\{(\w+)\}/g;
    const text = (plantilla.asunto_template || '') + ' ' + (plantilla.cuerpo_template || '');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const key = match[1];
      if (!definedKeys.has(key) && !hardcoded.has(key)) {
        definedKeys.add(key);
        extra.push({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
          type: 'text',
        });
      }
    }
    return extra;
  }, [plantilla]);

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
      a = a.replace(new RegExp(`\\{${key}\\}`, 'g'), formatted || '');
      c = c.replace(new RegExp(`\\{${key}\\}`, 'g'), formatted || '');
    }
    setAsunto(a);
    setCuerpo(c);
  }, [asunto, cuerpo, camposExtra]);

  // Upload attachments
  const handleUploadAdjuntos = async (files: FileList) => {
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      for (const f of Array.from(files)) formData.append('files', f);
      const res = await adminFetch('/api/admin/comunicaciones/adjuntos', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setAdjuntos(prev => [...prev, ...data.adjuntos]);
    } catch (err: any) {
      setToast({ type: 'error', msg: err.message ?? 'Error al subir archivos' });
    } finally {
      setUploadingFiles(false);
      if (adjuntoInputRef.current) adjuntoInputRef.current.value = '';
    }
  };

  const handleRemoveAdjunto = async (idx: number) => {
    const adj = adjuntos[idx];
    try {
      await adminFetch('/api/admin/comunicaciones/adjuntos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: adj.path }),
      });
    } catch { /* best effort */ }
    setAdjuntos(prev => prev.filter((_, i) => i !== idx));
  };

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
        adjuntos,
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
        setAdjuntos([]);
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
                  setAsunto(plantilla.asunto_template
                    .replace(/\{nombre_cliente\}/g, clienteNombre || 'Cliente')
                    .replace(/\{nit\}/g, 'CF'));
                  setCuerpo(plantilla.cuerpo_template
                    .replace(/\{nombre_cliente\}/g, clienteNombre || 'Cliente')
                    .replace(/\{nit\}/g, 'CF'));
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
          {plantilla && camposExtraCompletos.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-medium text-blue-700">Campos de la plantilla</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {camposExtraCompletos.map((campo: CampoExtra) => (
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

          {/* Adjuntos */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">📎 Adjuntos</p>
              <button
                onClick={() => adjuntoInputRef.current?.click()}
                disabled={uploadingFiles}
                className="text-xs font-medium text-[#0891B2] bg-cyan-50 px-3 py-1.5 rounded-lg hover:bg-cyan-100 disabled:opacity-50"
              >
                {uploadingFiles ? 'Subiendo...' : '+ Adjuntar archivo'}
              </button>
              <input
                ref={adjuntoInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => e.target.files && handleUploadAdjuntos(e.target.files)}
              />
            </div>

            {/* Drop zone */}
            <div
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleUploadAdjuntos(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center text-xs text-slate-400 hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer"
              onClick={() => adjuntoInputRef.current?.click()}
            >
              Arrastra archivos aquí — PDF, DOCX, XLSX, JPG, PNG (máx. 25 MB)
            </div>

            {/* File list */}
            {adjuntos.length > 0 && (
              <div className="space-y-1.5">
                {adjuntos.map((adj: AdjuntoMeta, i: number) => (
                  <div key={adj.path} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{adj.name.endsWith('.pdf') ? '📕' : adj.name.match(/\.(jpg|jpeg|png)$/i) ? '🖼️' : '📘'}</span>
                      <span className="text-xs font-medium text-slate-700">{adj.name}</span>
                      <span className="text-xs text-slate-400">{(adj.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button onClick={() => handleRemoveAdjunto(i)} className="text-xs text-red-500 hover:text-red-700 font-medium">✕</button>
                  </div>
                ))}
              </div>
            )}
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
              onClick={() => { aplicarCampos(); setPaso(4); }}
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

          {/* Adjuntos summary */}
          {adjuntos.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-medium text-blue-700 mb-1.5">📎 {adjuntos.length} adjunto{adjuntos.length !== 1 ? 's' : ''}</p>
              <div className="space-y-1">
                {adjuntos.map((adj: AdjuntoMeta) => (
                  <p key={adj.path} className="text-xs text-blue-600">{adj.name} ({(adj.size / 1024).toFixed(0)} KB)</p>
                ))}
              </div>
            </div>
          )}

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

// ── Tab: Envío masivo de documentos ──────────────────────────────────────

interface ArchivoItem {
  file: File;
  base64: string;
  clienteId: string | null;
  clienteNombre: string;
  email: string;
  cc: string;
  matched: boolean;
}

function EnvioMasivoDocumentosTab() {
  const [paso, setPaso] = useState(1);
  const [archivos, setArchivos] = useState<ArchivoItem[]>([]);
  const [asunto, setAsunto] = useState('Envío de documento — {nombre_cliente}');
  const [cuerpo, setCuerpo] = useState('');
  const [cuenta, setCuenta] = useState('asistente@papeleo.legal');
  const [sending, setSending] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ enviados: number; errores: any[] } | null>(null);

  // Load plantilla "envio-documento" for default body
  const { data: config } = useFetch<{ plantillas: Plantilla[]; pies: PieConf[] }>(
    '/api/admin/comunicaciones?tipo=plantillas'
  );

  useEffect(() => {
    if (config && !cuerpo) {
      const tpl = config.plantillas.find((p: Plantilla) => p.slug === 'envio-documento');
      if (tpl) setCuerpo(tpl.cuerpo_template);
    }
  }, [config, cuerpo]);

  const pieTexto = useMemo(
    () => config?.pies.find((p: PieConf) => p.cuenta_email === cuenta)?.texto ?? '',
    [config, cuenta]
  );

  // ── Step 1: File upload ──────────────────────────────────────────────

  const handleFiles = async (files: FileList) => {
    const items: ArchivoItem[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'doc', 'docx'].includes(ext ?? '')) continue;

      const base64 = await fileToBase64(file);
      const baseName = file.name.replace(/\.[^.]+$/, '').trim();

      items.push({
        file,
        base64,
        clienteId: null,
        clienteNombre: baseName,
        email: '',
        cc: '',
        matched: false,
      });
    }
    setArchivos(prev => [...prev, ...items]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const removeFile = (idx: number) => {
    setArchivos(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Step 2: Auto-match clients ───────────────────────────────────────

  const autoMatchClientes = async () => {
    const updated = [...archivos];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].matched) continue;
      const nombre = updated[i].clienteNombre;
      try {
        const res = await adminFetch(`/api/admin/clientes?q=${encodeURIComponent(nombre)}&limit=1`);
        const json = await res.json();
        const clientes = json.data ?? json;
        if (clientes.length > 0) {
          const c = clientes[0];
          updated[i] = {
            ...updated[i],
            clienteId: c.id,
            clienteNombre: c.nombre,
            email: c.email ?? '',
            matched: true,
          };
        }
      } catch { /* ignore */ }
    }
    setArchivos(updated);
  };

  useEffect(() => {
    if (paso === 2 && archivos.some((a: ArchivoItem) => !a.matched)) {
      autoMatchClientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  const updateArchivo = (idx: number, updates: Partial<ArchivoItem>) => {
    setArchivos(prev => prev.map((a, i) => i === idx ? { ...a, ...updates } : a));
  };

  // ── Step 4: Send ─────────────────────────────────────────────────────

  const enviables = archivos.filter((a: ArchivoItem) => a.email);

  const handleEnviar = async () => {
    if (enviables.length === 0) return;
    setSending(true);
    setProgreso(`Enviando 0/${enviables.length}...`);

    try {
      const items = enviables.map((a: ArchivoItem) => ({
        filename: a.file.name,
        contentType: a.file.type || 'application/octet-stream',
        contentBase64: a.base64,
        clienteId: a.clienteId,
        clienteNombre: a.clienteNombre,
        email: a.email,
        cc: a.cc || null,
      }));

      const res = await adminFetch('/api/admin/comunicaciones/masivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          asunto_template: asunto,
          cuerpo_template: cuerpo,
          cuenta_envio: cuenta,
        }),
      });

      const data = await res.json();

      setResultado({ enviados: data.enviados, errores: data.errores ?? [] });
      setProgreso(null);
    } catch (err: any) {
      setResultado({ enviados: 0, errores: [{ filename: '', email: '', error: err.message }] });
    }
    setSending(false);
  };

  // ── Render ───────────────────────────────────────────────────────────

  if (resultado) {
    return (
      <div className="max-w-4xl space-y-4">
        <div className={`p-5 rounded-xl border ${resultado.enviados > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <h3 className="text-sm font-bold mb-2">
            {resultado.enviados > 0 ? '✅' : '❌'} Envío masivo completado
          </h3>
          <p className="text-sm">
            {resultado.enviados} correo{resultado.enviados !== 1 ? 's' : ''} enviado{resultado.enviados !== 1 ? 's' : ''} exitosamente
          </p>
          {resultado.errores.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium text-red-700">{resultado.errores.length} error{resultado.errores.length !== 1 ? 'es' : ''}:</p>
              {resultado.errores.map((e: any, i: number) => (
                <p key={i} className="text-xs text-red-600">{e.filename} → {e.email}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => { setResultado(null); setArchivos([]); setPaso(1); }}
          className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg"
        >
          Nuevo envío masivo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Step indicators */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { n: 1, label: 'Archivos' },
          { n: 2, label: 'Asignar clientes' },
          { n: 3, label: 'Mensaje' },
          { n: 4, label: 'Enviar' },
        ].map((s, i) => (
          <div key={s.n} className="flex items-center gap-2">
            {i > 0 && <div className={`w-8 h-0.5 ${paso >= s.n ? 'bg-[#0891B2]' : 'bg-slate-200'}`} />}
            <button
              onClick={() => paso > s.n && setPaso(s.n)}
              disabled={paso < s.n}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                paso === s.n ? 'bg-[#0891B2] text-white'
                  : paso > s.n ? 'bg-cyan-50 text-[#0891B2] cursor-pointer hover:bg-cyan-100'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              <span>{s.n}</span> {s.label}
            </button>
          </div>
        ))}
      </div>

      {/* ═══ PASO 1: Subir archivos ═══ */}
      {paso === 1 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Subir documentos</h3>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="text-3xl mb-2">📎</div>
            <p className="text-sm font-medium text-slate-700">Arrastra archivos aquí o haz clic para seleccionar</p>
            <p className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX</p>
            <input
              id="file-input"
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {archivos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">{archivos.length} archivo{archivos.length !== 1 ? 's' : ''}</p>
              {archivos.map((a: ArchivoItem, i: number) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-2.5 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{a.file.name.endsWith('.pdf') ? '📕' : '📘'}</span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.file.name}</p>
                      <p className="text-xs text-slate-400">{(a.file.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-xs text-red-500 hover:text-red-700 font-medium">Quitar</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => archivos.length > 0 && setPaso(2)}
              disabled={archivos.length === 0}
              className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg disabled:opacity-40"
            >
              Continuar →
            </button>
          </div>
        </section>
      )}

      {/* ═══ PASO 2: Asignar clientes ═══ */}
      {paso === 2 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Asignar clientes a documentos</h3>
            <button
              onClick={autoMatchClientes}
              className="text-xs font-medium text-[#0891B2] bg-cyan-50 px-3 py-1.5 rounded-lg hover:bg-cyan-100"
            >
              🔄 Re-buscar clientes
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">Archivo</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">Cliente</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">Email</th>
                  <th className="text-left py-2 px-4 font-medium text-slate-500 text-xs">CC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivos.map((a: ArchivoItem, i: number) => (
                  <ArchivoRow key={i} item={a} index={i} onChange={updateArchivo} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
            <button onClick={() => setPaso(1)} className="text-sm text-slate-500 hover:text-slate-700">← Archivos</button>
            <div className="flex items-center gap-3">
              {archivos.filter((a: ArchivoItem) => !a.email).length > 0 && (
                <span className="text-xs text-amber-600">⚠️ {archivos.filter((a: ArchivoItem) => !a.email).length} sin email</span>
              )}
              <button onClick={() => setPaso(3)} className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg">
                Continuar →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══ PASO 3: Mensaje ═══ */}
      {paso === 3 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Personalizar mensaje</h3>
          <p className="text-xs text-slate-400">Se usa el mismo mensaje para todos. Variables: {'{nombre_cliente}'}, {'{nombre_documento}'}</p>

          <div>
            <label className="text-xs text-slate-500 font-medium">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Cuerpo del correo</label>
            <textarea
              value={cuerpo}
              onChange={e => setCuerpo(e.target.value)}
              rows={10}
              className="w-full mt-1 px-4 py-3 text-sm border border-slate-200 rounded-lg font-sans leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Cuenta de envío</label>
            <select
              value={cuenta}
              onChange={e => setCuenta(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-cyan-500"
            >
              {CUENTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          {pieTexto && (
            <div className="border-t border-slate-200 pt-3">
              <p className="text-xs text-slate-400 mb-1">Pie de confidencialidad</p>
              <div className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-3 border border-slate-100 leading-relaxed">
                {pieTexto.substring(0, 200)}...
              </div>
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={() => setPaso(2)} className="text-sm text-slate-500 hover:text-slate-700">← Clientes</button>
            <button onClick={() => setPaso(4)} className="px-4 py-2 text-sm font-medium bg-[#1E40AF] text-white rounded-lg">
              Revisar y enviar →
            </button>
          </div>
        </section>
      )}

      {/* ═══ PASO 4: Confirmar ═══ */}
      {paso === 4 && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Confirmar envío masivo
          </h3>
          <p className="text-sm text-slate-600">
            Se enviarán <strong>{enviables.length}</strong> correo{enviables.length !== 1 ? 's' : ''} con documentos adjuntos desde <strong>{cuenta.split('@')[0]}</strong>
          </p>

          {archivos.filter((a: ArchivoItem) => !a.email).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
              ⚠️ {archivos.filter((a: ArchivoItem) => !a.email).length} archivo{archivos.filter((a: ArchivoItem) => !a.email).length !== 1 ? 's' : ''} sin email — no se enviarán
            </div>
          )}

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Archivo</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Cliente</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-500">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {archivos.map((a: ArchivoItem, i: number) => (
                  <tr key={i} className={!a.email ? 'bg-amber-50' : ''}>
                    <td className="py-2 px-3 text-slate-700">
                      <span className="mr-1">{a.file.name.endsWith('.pdf') ? '📕' : '📘'}</span>
                      {a.file.name}
                    </td>
                    <td className="py-2 px-3 text-slate-700">{a.clienteNombre || '—'}</td>
                    <td className="py-2 px-3">
                      {a.email ? (
                        <span className="text-slate-600">{a.email}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">⚠️ Sin email</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={() => setPaso(3)} className="text-sm text-slate-500 hover:text-slate-700">← Editar mensaje</button>
            <div className="flex-1" />
            <button
              onClick={handleEnviar}
              disabled={sending || enviables.length === 0}
              className="px-5 py-2.5 text-sm font-semibold bg-[#0891B2] text-white rounded-lg hover:bg-[#0891B2]/90 disabled:opacity-50 transition-colors"
            >
              {sending ? (progreso ?? 'Enviando...') : `📧 Enviar ${enviables.length} correo${enviables.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── ArchivoRow: editable row with client autocomplete ────────────────────

function ArchivoRow({ item, index, onChange }: {
  item: ArchivoItem;
  index: number;
  onChange: (idx: number, updates: Partial<ArchivoItem>) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [showDrop, setShowDrop] = useState(false);

  const clienteUrl = busqueda.length >= 2
    ? `/api/admin/clientes?q=${encodeURIComponent(busqueda)}&limit=3`
    : null;
  const { data: clientesRes } = useFetch<{ data: ClienteBusqueda[] }>(clienteUrl);

  const selectCliente = (c: ClienteBusqueda) => {
    onChange(index, {
      clienteId: c.id,
      clienteNombre: c.nombre,
      email: c.email ?? '',
      matched: true,
    });
    setBusqueda('');
    setShowDrop(false);
  };

  return (
    <tr className={!item.email ? 'bg-amber-50/50' : ''}>
      <td className="py-2 px-4">
        <div className="flex items-center gap-2">
          <span>{item.file.name.endsWith('.pdf') ? '📕' : '📘'}</span>
          <span className="text-xs text-slate-700 truncate max-w-[180px]">{item.file.name}</span>
        </div>
      </td>
      <td className="py-2 px-4 relative">
        {item.matched ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-800">{item.clienteNombre}</span>
            <button
              onClick={() => onChange(index, { clienteId: null, clienteNombre: '', email: '', matched: false })}
              className="text-[10px] text-red-500 hover:text-red-700"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setShowDrop(true); }}
              onFocus={() => setShowDrop(true)}
              className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-cyan-400"
            />
            {showDrop && clientesRes?.data && clientesRes.data.length > 0 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDrop(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-32 overflow-y-auto">
                  {clientesRes.data.map((c: ClienteBusqueda) => (
                    <button
                      key={c.id}
                      onClick={() => selectCliente(c)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b border-slate-50 last:border-0"
                    >
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-slate-400 ml-1">{c.email ?? ''}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </td>
      <td className="py-2 px-4">
        <input
          type="email"
          value={item.email}
          onChange={e => onChange(index, { email: e.target.value })}
          placeholder="correo@ejemplo.com"
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-cyan-400"
        />
      </td>
      <td className="py-2 px-4">
        <input
          type="text"
          value={item.cc}
          onChange={e => onChange(index, { cc: e.target.value })}
          placeholder="CC..."
          className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-cyan-400"
        />
      </td>
    </tr>
  );
}

// ── Helper: File to base64 ───────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:xxx;base64, prefix
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Tab: Lista de correos (Programados / Enviados) ───────────────────────

function CorreosListTab({ estado }: { estado: 'programado' | 'enviado' }) {
  const { data: res, loading, refetch } = useFetch<{ data: Correo[]; total: number }>(
    `/api/admin/comunicaciones?tipo=correos&estado=${estado}&limit=30`
  );
  const { mutate, loading: acting } = useMutate();
  const [editando, setEditando] = useState<Correo | null>(null);

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
    <>
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
          {res.data.map((c: Correo) => {
            const tieneAdjuntos = Array.isArray(c.adjuntos) && c.adjuntos.length > 0;
            return (
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
              <td className="py-3 px-4 text-slate-700 max-w-[250px]">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{c.asunto}</span>
                  {tieneAdjuntos && <span title={`${c.adjuntos.length} adjunto${c.adjuntos.length !== 1 ? 's' : ''}`} className="shrink-0">📎</span>}
                </div>
              </td>
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
                      onClick={() => setEditando(c)}
                      disabled={acting}
                      className="px-2.5 py-1 text-xs font-medium bg-amber-500 text-white rounded-md hover:bg-amber-400 disabled:opacity-50"
                    >
                      Editar
                    </button>
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
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">
        {res.total} correo{res.total !== 1 ? 's' : ''}
      </div>
    </div>

    {/* Modal editar */}
    {editando && (
      <EditarCorreoModal
        correo={editando}
        onClose={() => setEditando(null)}
        onSaved={() => { setEditando(null); refetch(); }}
      />
    )}
    </>
  );
}

// ── Modal: Editar correo programado ──────────────────────────────────────

function EditarCorreoModal({ correo, onClose, onSaved }: {
  correo: Correo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { mutate, loading: saving } = useMutate();
  const [asunto, setAsunto] = useState(correo.asunto);
  const [cuerpo, setCuerpo] = useState(correo.cuerpo);
  const [email, setEmail] = useState(correo.destinatario_email);
  const [cc, setCc] = useState(correo.cc_emails ?? '');
  const [cuenta, setCuenta] = useState(correo.cuenta_envio);
  const [adjuntos, setAdjuntos] = useState<AdjuntoMeta[]>(
    Array.isArray(correo.adjuntos) ? correo.adjuntos : []
  );
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      for (const f of Array.from(files)) formData.append('files', f);
      const res = await adminFetch('/api/admin/comunicaciones/adjuntos', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setAdjuntos(prev => [...prev, ...data.adjuntos]);
    } catch (err: any) {
      setError(err.message ?? 'Error al subir');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (idx: number) => {
    const adj = adjuntos[idx];
    try {
      await adminFetch('/api/admin/comunicaciones/adjuntos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: adj.path }),
      });
    } catch { /* best effort */ }
    setAdjuntos(prev => prev.filter((_, i) => i !== idx));
  };

  const handleGuardar = async () => {
    if (!email.trim()) { setError('Falta email'); return; }
    if (!asunto.trim()) { setError('Falta asunto'); return; }

    await mutate('/api/admin/comunicaciones', {
      body: {
        accion: 'actualizar',
        id: correo.id,
        destinatario_email: email,
        cc_emails: cc.trim() || null,
        cuenta_envio: cuenta,
        asunto,
        cuerpo,
        adjuntos,
      },
      onSuccess: () => onSaved(),
      onError: (err: any) => setError(String(err)),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-sm font-bold text-slate-900">Editar correo programado</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">{error}</div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 font-medium">Email destinatario</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 font-medium">CC (opcional)</label>
              <input
                type="text"
                value={cc}
                onChange={e => setCc(e.target.value)}
                placeholder="cc1@ejemplo.com, cc2@ejemplo.com"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Cuenta de envío</label>
            <select
              value={cuenta}
              onChange={e => setCuenta(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-cyan-500"
            >
              {CUENTAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={e => setAsunto(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          <div>
            <label className="text-xs text-slate-500 font-medium">Contenido</label>
            <textarea
              value={cuerpo}
              onChange={e => setCuerpo(e.target.value)}
              rows={10}
              className="w-full mt-1 px-4 py-3 text-sm border border-slate-200 rounded-lg font-sans leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
          </div>

          {/* Adjuntos */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">📎 Adjuntos</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFiles}
                className="text-xs font-medium text-[#0891B2] bg-cyan-50 px-3 py-1.5 rounded-lg hover:bg-cyan-100 disabled:opacity-50"
              >
                {uploadingFiles ? 'Subiendo...' : '+ Adjuntar archivo'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.xlsx,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => e.target.files && handleUpload(e.target.files)}
              />
            </div>

            <div
              onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files); }}
              onDragOver={e => e.preventDefault()}
              className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center text-xs text-slate-400 hover:border-[#0891B2] hover:bg-cyan-50/20 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              Arrastra archivos aquí — PDF, DOCX, XLSX, JPG, PNG (máx. 25 MB)
            </div>

            {adjuntos.length > 0 && (
              <div className="space-y-1.5">
                {adjuntos.map((adj: AdjuntoMeta, i: number) => (
                  <div key={adj.path} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{adj.name.endsWith('.pdf') ? '📕' : adj.name.match(/\.(jpg|jpeg|png)$/i) ? '🖼️' : '📘'}</span>
                      <span className="text-xs font-medium text-slate-700">{adj.name}</span>
                      <span className="text-xs text-slate-400">{(adj.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <button onClick={() => handleRemove(i)} className="text-xs text-red-500 hover:text-red-700 font-medium">✕</button>
                  </div>
                ))}
              </div>
            )}

            {adjuntos.length === 0 && (
              <p className="text-xs text-slate-400 text-center">Sin adjuntos</p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleGuardar}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold bg-[#1E40AF] text-white rounded-lg hover:bg-[#1E40AF]/90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
