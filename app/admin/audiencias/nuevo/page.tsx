// ============================================================================
// app/admin/audiencias/nuevo/page.tsx
// Formulario de nueva audiencia — campos dinámicos según modalidad.
// Mismo patrón visual que /admin/expedientes/nuevo.
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { useMutate } from '@/lib/hooks/use-fetch';
import { EmailChips } from '@/components/admin/email-chips';
import {
  type ModalidadAudiencia,
  MODALIDAD_AUDIENCIA_LABEL,
  PLATAFORMAS_AUDIENCIA,
  PLATAFORMA_AUDIENCIA_LABEL,
} from '@/lib/types/audiencias';

interface ClienteSuggestion {
  id: string;
  codigo: string;
  nombre: string;
  nit: string | null;
  emails_cc: string[] | null;
}

interface ExpedienteSuggestion {
  id: string;
  numero_expediente: string | null;
  numero_mp: string | null;
  numero_administrativo: string | null;
  cliente?: { id: string; nombre: string } | null;
}

function numeroDe(e: ExpedienteSuggestion): string {
  return e.numero_expediente || e.numero_mp || e.numero_administrativo || '(sin número)';
}

export default function NuevaAudienciaPage() {
  const router = useRouter();
  const { mutate, loading: saving } = useMutate();

  // Modalidad (ramifica los campos de lugar / conexión)
  const [modalidad, setModalidad] = useState<ModalidadAudiencia>('presencial');

  // Cliente (autocomplete)
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteSug, setClienteSug] = useState<ClienteSuggestion[]>([]);
  const [showClienteSug, setShowClienteSug] = useState(false);
  const clienteTimer = useRef<NodeJS.Timeout>(undefined);

  // Expediente (autocomplete, filtrado por cliente si hay)
  const [expedienteId, setExpedienteId] = useState('');
  const [expedienteTexto, setExpedienteTexto] = useState('');
  const [expedienteSug, setExpedienteSug] = useState<ExpedienteSuggestion[]>([]);
  const [showExpedienteSug, setShowExpedienteSug] = useState(false);
  const expedienteTimer = useRef<NodeJS.Timeout>(undefined);

  // Datos generales
  const [titulo, setTitulo] = useState('');
  const [tipoAudiencia, setTipoAudiencia] = useState('');
  const [fechaHoraInicio, setFechaHoraInicio] = useState('');
  const [fechaHoraFin, setFechaHoraFin] = useState('');

  // Lugar (presencial / híbrida)
  const [juzgado, setJuzgado] = useState('');
  const [sala, setSala] = useState('');
  const [ubicacion, setUbicacion] = useState('');

  // Conexión (virtual / híbrida)
  const [plataforma, setPlataforma] = useState('');
  const [enlaceVirtual, setEnlaceVirtual] = useState('');

  // Copias (CC)
  const [emailsCc, setEmailsCc] = useState<string[]>([]);            // CC propio de esta audiencia (texto libre)
  const [ccHeredadoCliente, setCcHeredadoCliente] = useState<string[]>([]); // CC del cliente (legal.clientes.emails_cc), solo referencia
  const [ccHeredadoChecked, setCcHeredadoChecked] = useState<string[]>([]);  // los heredados que Amanda marca EXPLÍCITAMENTE (default: ninguno)

  function toggleHeredado(email: string) {
    setCcHeredadoChecked(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email],
    );
  }

  // Notas
  const [instrucciones, setInstrucciones] = useState('');
  const [notasInternas, setNotasInternas] = useState('');

  // Recordatorios automáticos (marcada por defecto).
  const [programarRecordatorios, setProgramarRecordatorios] = useState(true);

  const mostrarLugar = modalidad === 'presencial' || modalidad === 'hibrida';
  const mostrarConexion = modalidad === 'virtual' || modalidad === 'hibrida';

  // ── Autocomplete cliente ──
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

  // ── Autocomplete expediente (filtra por cliente si está seleccionado) ──
  useEffect(() => {
    if (expedienteTimer.current) clearTimeout(expedienteTimer.current);
    if (expedienteTexto.length < 2) { setExpedienteSug([]); return; }
    expedienteTimer.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: expedienteTexto, limit: '8' });
        if (clienteId) params.set('cliente_id', clienteId);
        const res = await adminFetch(`/api/admin/expedientes?${params}`);
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
    setCcHeredadoChecked([]); // confidencialidad: heredados arrancan DESMARCADOS
    setShowClienteSug(false);
    setClienteSug([]);
  }

  function selectExpediente(e: ExpedienteSuggestion) {
    setExpedienteId(e.id);
    setExpedienteTexto(numeroDe(e));
    setShowExpedienteSug(false);
    setExpedienteSug([]);
    // Si aún no hay cliente, adoptar el del expediente.
    if (!clienteId && e.cliente) {
      setClienteId(e.cliente.id);
      setClienteNombre(e.cliente.nombre);
    }
  }

  // datetime-local da hora local "naive". Guatemala es UTC-6 fijo (sin horario
  // de verano), así que anclamos el offset explícito para guardar el instante
  // correcto en la columna timestamptz.
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

    // CC final de la audiencia = SOLO lo explícito: lo tipeado + los heredados
    // que Amanda marcó. Los heredados NO marcados nunca se incluyen (regla de
    // confidencialidad). Dedup case-insensitive.
    const ccFinal = Array.from(
      new Set([...emailsCc, ...ccHeredadoChecked].map(x => x.trim().toLowerCase()).filter(Boolean)),
    );

    const body: Record<string, unknown> = {
      cliente_id: clienteId || null,
      expediente_id: expedienteId || null,
      titulo: titulo.trim() || null,
      tipo_audiencia: tipoAudiencia.trim() || null,
      modalidad,
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
      programar_recordatorios: programarRecordatorios,
    };

    await mutate('/api/admin/audiencias/registro', {
      body,
      onSuccess: (data: any) => router.push(`/admin/audiencias/${data.audiencia.id}`),
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
        <h1 className="text-xl font-bold text-slate-900">Nueva Audiencia</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Modalidad */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Modalidad</h2>
          <div className="flex gap-3">
            {(['presencial', 'virtual', 'hibrida'] as ModalidadAudiencia[]).map(m => (
              <button key={m} type="button" onClick={() => setModalidad(m)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  modalidad === m
                    ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                {MODALIDAD_AUDIENCIA_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {modalidad === 'presencial' && 'Presencial: se piden juzgado/sala y dirección.'}
            {modalidad === 'virtual' && 'Virtual: se piden plataforma y enlace de conexión.'}
            {modalidad === 'hibrida' && 'Híbrida: se piden ambos — lugar físico y enlace de conexión.'}
          </p>
        </div>

        {/* Vínculos: cliente + expediente */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Vínculos</h2>
          <p className="text-xs text-slate-500">Ambos son opcionales. Si eliges un expediente sin cliente, se toma el cliente del expediente.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cliente */}
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
                      <span className="text-xs text-slate-400">{c.codigo}{c.nit ? ` · ${c.nit}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {clienteId && <p className="text-xs text-green-600 mt-1">Cliente seleccionado</p>}
            </div>

            {/* Expediente */}
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

        {/* Datos de la audiencia */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Datos de la audiencia</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Título</label>
              <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                placeholder="Título humano (opcional)" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo de audiencia</label>
              <input type="text" value={tipoAudiencia} onChange={e => setTipoAudiencia(e.target.value)}
                placeholder="Ej: vista, declaración, conciliación" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Inicio (fecha y hora) *</label>
              <input type="datetime-local" value={fechaHoraInicio} onChange={e => setFechaHoraInicio(e.target.value)}
                className={inputCls} />
              <p className="text-xs text-slate-400 mt-1">Hora de Guatemala (UTC−6).</p>
            </div>
            <div>
              <label className={labelCls}>Fin (opcional)</label>
              <input type="datetime-local" value={fechaHoraFin} onChange={e => setFechaHoraFin(e.target.value)}
                className={inputCls} />
            </div>
          </div>
        </div>

        {/* Lugar (presencial / híbrida) */}
        {mostrarLugar && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Lugar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Juzgado</label>
                <input type="text" value={juzgado} onChange={e => setJuzgado(e.target.value)}
                  placeholder="Ej: Juzgado Primero de Familia" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Sala</label>
                <input type="text" value={sala} onChange={e => setSala(e.target.value)}
                  placeholder="Ej: Sala 3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dirección / ubicación</label>
                <input type="text" value={ubicacion} onChange={e => setUbicacion(e.target.value)}
                  placeholder="Dirección del juzgado" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Conexión (virtual / híbrida) */}
        {mostrarConexion && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Conexión virtual</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Plataforma</label>
                <select value={plataforma} onChange={e => setPlataforma(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {PLATAFORMAS_AUDIENCIA.map(p => (
                    <option key={p} value={p}>{PLATAFORMA_AUDIENCIA_LABEL[p]}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Enlace de conexión</label>
                <input type="url" value={enlaceVirtual} onChange={e => setEnlaceVirtual(e.target.value)}
                  placeholder="https://..." className={inputCls} />
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
                <strong> desmarcados</strong>; marcá solo a quién querés copiar en <em>esta</em> audiencia. (El grupo Rope, por
                ejemplo, tiene CC de firmas externas.)
              </p>
            </div>
          )}
        </div>

        {/* Notas */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Notas</h2>
          <div>
            <label className={labelCls}>Instrucciones para el cliente</label>
            <textarea value={instrucciones} onChange={e => setInstrucciones(e.target.value)}
              rows={2} className={inputCls} placeholder="Qué llevar, llegar 15 min antes, probar audio/cámara..." />
          </div>
          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)}
              rows={2} className={inputCls} placeholder="No sale al cliente" />
          </div>
        </div>

        {/* Recordatorios automáticos */}
        <div className={sectionCls}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={programarRecordatorios}
              onChange={e => setProgramarRecordatorios(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/30" />
            <span className="text-sm text-slate-700">
              <strong>Programar recordatorios automáticos para esta audiencia</strong>
              <span className="block text-xs text-slate-500 mt-0.5">
                Encola dos recordatorios al cliente: uno <strong>2 días hábiles antes</strong> (detalle completo) y otro
                <strong> 2 horas antes</strong> (corto). Quedan agendados sin pasar por aprobación.
                En modo prueba se envían al correo de prueba con banner [PRUEBA].
              </span>
            </span>
          </label>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear Audiencia'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
