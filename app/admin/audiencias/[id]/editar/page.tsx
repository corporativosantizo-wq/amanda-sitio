// ============================================================================
// app/admin/audiencias/[id]/editar/page.tsx
// Edición de audiencia — mismo patrón y misma regla de CC (heredados
// DESMARCADOS) que el form de crear. PUT al registro; redirige al detalle.
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { EmailChips } from '@/components/admin/email-chips';
import {
  type Audiencia,
  type ModalidadAudiencia,
  type EstadoAudiencia,
  MODALIDAD_AUDIENCIA_LABEL,
  ESTADO_AUDIENCIA_LABEL,
  PLATAFORMAS_AUDIENCIA,
  PLATAFORMA_AUDIENCIA_LABEL,
} from '@/lib/types/audiencias';

interface ClienteSuggestion {
  id: string; codigo: string; nombre: string; nit: string | null; emails_cc: string[] | null;
}
interface ExpedienteSuggestion {
  id: string; numero_expediente: string | null; numero_mp: string | null; numero_administrativo: string | null;
  cliente?: { id: string; nombre: string } | null;
}
function numeroDe(e: ExpedienteSuggestion): string {
  return e.numero_expediente || e.numero_mp || e.numero_administrativo || '(sin número)';
}

// timestamptz almacenado → "YYYY-MM-DDTHH:MM" en hora de Guatemala (UTC-6 fijo).
function isoToLocalGTInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - 6 * 3600 * 1000).toISOString().slice(0, 16);
}

export default function EditarAudienciaPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data, loading, error } = useFetch<{ audiencia: Audiencia }>(
    `/api/admin/audiencias/registro/${id}`,
  );

  if (loading) {
    return <div className="p-6 max-w-4xl"><div className="h-40 bg-slate-100 rounded-xl animate-pulse" /></div>;
  }
  if (error || !data?.audiencia) {
    return (
      <div className="p-6 max-w-4xl">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-4">← Volver</button>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">No se encontró la audiencia.</div>
      </div>
    );
  }
  return <EditarForm audiencia={data.audiencia} />;
}

function EditarForm({ audiencia }: { audiencia: Audiencia }) {
  const router = useRouter();
  const { mutate, loading: saving } = useMutate();

  const [modalidad, setModalidad] = useState<ModalidadAudiencia>(audiencia.modalidad);
  const [estado, setEstado] = useState<EstadoAudiencia>(audiencia.estado);

  // Cliente
  const [clienteId, setClienteId] = useState(audiencia.cliente_id ?? '');
  const [clienteNombre, setClienteNombre] = useState(audiencia.cliente?.nombre ?? '');
  const [clienteSug, setClienteSug] = useState<ClienteSuggestion[]>([]);
  const [showClienteSug, setShowClienteSug] = useState(false);
  const clienteTimer = useRef<NodeJS.Timeout>(undefined);

  // Expediente
  const [expedienteId, setExpedienteId] = useState(audiencia.expediente_id ?? '');
  const [expedienteTexto, setExpedienteTexto] = useState(audiencia.expediente?.numero_expediente ?? '');
  const [expedienteSug, setExpedienteSug] = useState<ExpedienteSuggestion[]>([]);
  const [showExpedienteSug, setShowExpedienteSug] = useState(false);
  const expedienteTimer = useRef<NodeJS.Timeout>(undefined);

  // Generales
  const [titulo, setTitulo] = useState(audiencia.titulo ?? '');
  const [tipoAudiencia, setTipoAudiencia] = useState(audiencia.tipo_audiencia ?? '');
  const [fechaHoraInicio, setFechaHoraInicio] = useState(isoToLocalGTInput(audiencia.fecha_hora_inicio));
  const [fechaHoraFin, setFechaHoraFin] = useState(isoToLocalGTInput(audiencia.fecha_hora_fin));

  // Lugar / conexión
  const [juzgado, setJuzgado] = useState(audiencia.juzgado ?? '');
  const [sala, setSala] = useState(audiencia.sala ?? '');
  const [ubicacion, setUbicacion] = useState(audiencia.ubicacion ?? '');
  const [plataforma, setPlataforma] = useState(audiencia.plataforma ?? '');
  const [enlaceVirtual, setEnlaceVirtual] = useState(audiencia.enlace_virtual ?? '');

  // CC: lista guardada (editable) + heredados del cliente DESMARCADOS por defecto.
  const [emailsCc, setEmailsCc] = useState<string[]>(audiencia.emails_cc ?? []);
  const [ccHeredadoCliente, setCcHeredadoCliente] = useState<string[]>(audiencia.cliente?.emails_cc ?? []);
  const [ccHeredadoChecked, setCcHeredadoChecked] = useState<string[]>([]);

  // Notas
  const [instrucciones, setInstrucciones] = useState(audiencia.instrucciones ?? '');
  const [notasInternas, setNotasInternas] = useState(audiencia.notas_internas ?? '');

  const mostrarLugar = modalidad === 'presencial' || modalidad === 'hibrida';
  const mostrarConexion = modalidad === 'virtual' || modalidad === 'hibrida';

  function toggleHeredado(email: string) {
    setCcHeredadoChecked(prev => prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]);
  }

  // Autocomplete cliente
  useEffect(() => {
    if (clienteTimer.current) clearTimeout(clienteTimer.current);
    if (clienteNombre.length < 2) { setClienteSug([]); return; }
    clienteTimer.current = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/clientes?q=${encodeURIComponent(clienteNombre)}&limit=8&activo=true`);
        const json = await res.json();
        setClienteSug(json.data ?? []);
        setShowClienteSug(true);
      } catch { /* ignore */ }
    }, 300);
    return () => { if (clienteTimer.current) clearTimeout(clienteTimer.current); };
  }, [clienteNombre]);

  // Autocomplete expediente
  useEffect(() => {
    if (expedienteTimer.current) clearTimeout(expedienteTimer.current);
    if (expedienteTexto.length < 2) { setExpedienteSug([]); return; }
    expedienteTimer.current = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q: expedienteTexto, limit: '8' });
        if (clienteId) p.set('cliente_id', clienteId);
        const res = await adminFetch(`/api/admin/expedientes?${p}`);
        const json = await res.json();
        setExpedienteSug(json.data ?? []);
        setShowExpedienteSug(true);
      } catch { /* ignore */ }
    }, 300);
    return () => { if (expedienteTimer.current) clearTimeout(expedienteTimer.current); };
  }, [expedienteTexto, clienteId]);

  function selectCliente(c: ClienteSuggestion) {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setCcHeredadoCliente(c.emails_cc ?? []);
    setCcHeredadoChecked([]); // confidencialidad: heredados DESMARCADOS
    setShowClienteSug(false);
    setClienteSug([]);
  }
  function selectExpediente(e: ExpedienteSuggestion) {
    setExpedienteId(e.id);
    setExpedienteTexto(numeroDe(e));
    setShowExpedienteSug(false);
    setExpedienteSug([]);
    if (!clienteId && e.cliente) { setClienteId(e.cliente.id); setClienteNombre(e.cliente.nombre); }
  }

  function aISOGuatemala(local: string): string | null {
    return local ? `${local}:00-06:00` : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fechaHoraInicio) { alert('Indica la fecha y hora de inicio.'); return; }
    if (fechaHoraFin && fechaHoraFin < fechaHoraInicio) {
      alert('La hora de fin no puede ser anterior a la de inicio.');
      return;
    }

    // CC final = SOLO lo explícito (lista editable + heredados marcados). Dedup.
    const ccFinal = Array.from(
      new Set([...emailsCc, ...ccHeredadoChecked].map(x => x.trim().toLowerCase()).filter(Boolean)),
    );

    const body: Record<string, unknown> = {
      cliente_id: clienteId || null,
      expediente_id: expedienteId || null,
      titulo: titulo.trim() || null,
      tipo_audiencia: tipoAudiencia.trim() || null,
      modalidad,
      estado,
      fecha_hora_inicio: aISOGuatemala(fechaHoraInicio),
      fecha_hora_fin: aISOGuatemala(fechaHoraFin),
      juzgado: mostrarLugar ? (juzgado.trim() || null) : null,
      sala: mostrarLugar ? (sala.trim() || null) : null,
      ubicacion: mostrarLugar ? (ubicacion.trim() || null) : null,
      plataforma: mostrarConexion ? (plataforma || null) : null,
      enlace_virtual: mostrarConexion ? (enlaceVirtual.trim() || null) : null,
      emails_cc: ccFinal.length ? ccFinal : null,
      instrucciones: instrucciones.trim() || null,
      notas_internas: notasInternas.trim() || null,
    };

    await mutate(`/api/admin/audiencias/registro/${audiencia.id}`, {
      method: 'PUT',
      body,
      onSuccess: () => router.push(`/admin/audiencias/${audiencia.id}`),
      onError: (msg) => alert(msg),
    });
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';
  const sectionCls = 'bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4';

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <h1 className="text-xl font-bold text-slate-900">Editar Audiencia</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Modalidad + estado */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Modalidad y estado</h2>
          <div className="flex gap-3">
            {(['presencial', 'virtual', 'hibrida'] as ModalidadAudiencia[]).map(m => (
              <button key={m} type="button" onClick={() => setModalidad(m)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  modalidad === m ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                {MODALIDAD_AUDIENCIA_LABEL[m]}
              </button>
            ))}
          </div>
          <div className="max-w-xs">
            <label className={labelCls}>Estado</label>
            <select value={estado} onChange={e => setEstado(e.target.value as EstadoAudiencia)} className={inputCls}>
              {(Object.keys(ESTADO_AUDIENCIA_LABEL) as EstadoAudiencia[]).map(s => (
                <option key={s} value={s}>{ESTADO_AUDIENCIA_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Vínculos */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Vínculos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className={labelCls}>Cliente</label>
              <input type="text" value={clienteNombre}
                onChange={e => { setClienteNombre(e.target.value); setClienteId(''); setCcHeredadoCliente([]); setCcHeredadoChecked([]); }}
                onBlur={() => setTimeout(() => setShowClienteSug(false), 200)}
                placeholder="Buscar cliente..." className={inputCls} />
              {showClienteSug && clienteSug.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clienteSug.map(c => (
                    <button key={c.id} type="button" onClick={() => selectCliente(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between">
                      <span className="font-medium text-slate-900">{c.nombre}</span>
                      <span className="text-xs text-slate-400">{c.codigo}</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteId && <p className="text-xs text-green-600 mt-1">Cliente seleccionado</p>}
            </div>
            <div className="relative">
              <label className={labelCls}>Expediente</label>
              <input type="text" value={expedienteTexto}
                onChange={e => { setExpedienteTexto(e.target.value); setExpedienteId(''); }}
                onBlur={() => setTimeout(() => setShowExpedienteSug(false), 200)}
                placeholder="Buscar por número, actor..." className={inputCls} />
              {showExpedienteSug && expedienteSug.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {expedienteSug.map(ex => (
                    <button key={ex.id} type="button" onClick={() => selectExpediente(ex)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <span className="font-medium text-slate-900">{numeroDe(ex)}</span>
                      {ex.cliente && <span className="block text-xs text-slate-400">{ex.cliente.nombre}</span>}
                    </button>
                  ))}
                </div>
              )}
              {expedienteId && <p className="text-xs text-green-600 mt-1">Expediente seleccionado</p>}
            </div>
          </div>
        </div>

        {/* Datos */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Datos de la audiencia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Título</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de audiencia</label>
              <input type="text" value={tipoAudiencia} onChange={e => setTipoAudiencia(e.target.value)}
                placeholder="Ej: vista, declaración, conciliación" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Inicio (fecha y hora) *</label>
              <input type="datetime-local" value={fechaHoraInicio} onChange={e => setFechaHoraInicio(e.target.value)} className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Hora de Guatemala (UTC−6).</p>
            </div>
            <div>
              <label className={labelCls}>Fin (opcional)</label>
              <input type="datetime-local" value={fechaHoraFin} onChange={e => setFechaHoraFin(e.target.value)} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Lugar */}
        {mostrarLugar && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Lugar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div><label className={labelCls}>Juzgado</label><input type="text" value={juzgado} onChange={e => setJuzgado(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Sala</label><input type="text" value={sala} onChange={e => setSala(e.target.value)} className={inputCls} /></div>
              <div><label className={labelCls}>Dirección / ubicación</label><input type="text" value={ubicacion} onChange={e => setUbicacion(e.target.value)} className={inputCls} /></div>
            </div>
          </div>
        )}

        {/* Conexión */}
        {mostrarConexion && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Conexión virtual</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Plataforma</label>
                <select value={plataforma} onChange={e => setPlataforma(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {PLATAFORMAS_AUDIENCIA.map(p => (<option key={p} value={p}>{PLATAFORMA_AUDIENCIA_LABEL[p]}</option>))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Enlace de conexión</label>
                <input type="url" value={enlaceVirtual} onChange={e => setEnlaceVirtual(e.target.value)} placeholder="https://..." className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Copias (CC) */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Copias (CC)</h2>
          <div>
            <label className={labelCls}>CC de esta audiencia</label>
            <EmailChips value={emailsCc} onChange={setEmailsCc} placeholder="copia@email.com" />
            <p className="text-xs text-slate-400 mt-1">Copia visible (no oculta), solo para esta audiencia.</p>
          </div>
          {ccHeredadoCliente.length > 0 && (
            <div>
              <label className={labelCls}>CC del cliente (marcá a quién copiar)</label>
              <div className="space-y-1.5">
                {ccHeredadoCliente.map(e => (
                  <label key={e} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={ccHeredadoChecked.includes(e)} onChange={() => toggleHeredado(e)}
                      className="rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/30" />
                    <span>{e}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
                ⚠ Confidencialidad: estos correos del cliente <strong>NO se copian automáticamente</strong>. Vienen
                <strong> desmarcados</strong>; marcá solo a quién querés copiar en <em>esta</em> audiencia.
              </p>
            </div>
          )}
        </div>

        {/* Notas */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Notas</h2>
          <div>
            <label className={labelCls}>Instrucciones para el cliente</label>
            <textarea value={instrucciones} onChange={e => setInstrucciones(e.target.value)} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)} rows={2} className={inputCls} placeholder="No sale al cliente" />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
          <button type="button" onClick={() => router.push(`/admin/audiencias/${audiencia.id}`)}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
