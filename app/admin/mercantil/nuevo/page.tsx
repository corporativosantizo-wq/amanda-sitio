// ============================================================================
// app/admin/mercantil/nuevo/page.tsx
// Formulario de nuevo trámite mercantil
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutate } from '@/lib/hooks/use-fetch';
import {
  type CategoriaMercantil,
  CATEGORIA_MERCANTIL_LABEL,
  CATEGORIAS_CON_VENCIMIENTO,
  CATEGORIAS_RECURRENTES,
} from '@/lib/types/mercantil';

interface ClienteSuggestion {
  id: string;
  codigo: string;
  nombre: string;
  nit: string | null;
  tipo: string;
}

const CATEGORIAS = Object.entries(CATEGORIA_MERCANTIL_LABEL) as [CategoriaMercantil, string][];

export default function NuevoTramiteMercantilPage() {
  const router = useRouter();
  const { mutate, loading: saving } = useMutate();

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteSugerencias, setClienteSugerencias] = useState<ClienteSuggestion[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const clienteTimer = useRef<NodeJS.Timeout>(undefined);

  const [categoria, setCategoria] = useState<CategoriaMercantil>('patente_comercio');
  const [subtipo, setSubtipo] = useState('');
  const [fechaTramite, setFechaTramite] = useState(new Date().toISOString().slice(0, 10));
  const [fechaInscripcion, setFechaInscripcion] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');
  const [numeroRegistro, setNumeroRegistro] = useState('');
  const [numeroExpedienteRM, setNumeroExpedienteRM] = useState('');
  const [notarioResponsable, setNotarioResponsable] = useState('');
  const [esRecurrente, setEsRecurrente] = useState(false);
  const [periodicidadMeses, setPeriodicidadMeses] = useState('12');
  const [alertaDias, setAlertaDias] = useState('30');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // Auto-set recurrente based on category
  useEffect(() => {
    setEsRecurrente(CATEGORIAS_RECURRENTES.includes(categoria));
    if (CATEGORIAS_CON_VENCIMIENTO.includes(categoria)) {
      setPeriodicidadMeses('12');
    }
  }, [categoria]);

  // Client autocomplete
  useEffect(() => {
    if (!clienteNombre || clienteNombre.length < 2 || clienteId) {
      setClienteSugerencias([]);
      return;
    }
    clearTimeout(clienteTimer.current);
    clienteTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes?q=${encodeURIComponent(clienteNombre)}&limit=8&activo=true`);
        const json = await res.json();
        setClienteSugerencias(json.data ?? []);
        setShowSugerencias(true);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(clienteTimer.current);
  }, [clienteNombre, clienteId]);

  function selectCliente(c: ClienteSuggestion) {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setShowSugerencias(false);
    setClienteSugerencias([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return;

    const body: Record<string, unknown> = {
      cliente_id: clienteId,
      categoria,
      fecha_tramite: fechaTramite,
      es_recurrente: esRecurrente,
      alerta_dias_antes: parseInt(alertaDias) || 30,
    };

    if (subtipo) body.subtipo = subtipo;
    if (fechaInscripcion) body.fecha_inscripcion = fechaInscripcion;
    if (fechaVencimiento) body.fecha_vencimiento = fechaVencimiento;
    if (numeroRegistro) body.numero_registro = numeroRegistro;
    if (numeroExpedienteRM) body.numero_expediente_rm = numeroExpedienteRM;
    if (notarioResponsable) body.notario_responsable = notarioResponsable;
    if (esRecurrente && periodicidadMeses) body.periodicidad_meses = parseInt(periodicidadMeses);
    if (descripcion) body.descripcion = descripcion;
    if (notas) body.notas = notas;

    const result = await mutate('/api/admin/mercantil', { body });

    if (result?.tramite?.id) {
      router.push(`/admin/mercantil/${result.tramite.id}`);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <h1 className="text-xl font-bold text-slate-900">Nuevo Trámite Mercantil</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Cliente</h2>
          <div className="relative">
            <label className={labelCls}>Sociedad / Empresa *</label>
            <input type="text" value={clienteNombre}
              onChange={e => { setClienteNombre(e.target.value); setClienteId(''); }}
              onFocus={() => clienteSugerencias.length > 0 && setShowSugerencias(true)}
              onBlur={() => setTimeout(() => setShowSugerencias(false), 200)}
              placeholder="Buscar cliente..." className={inputCls} required />
            {clienteId && <p className="text-xs text-green-600 mt-1">Cliente seleccionado</p>}
            {showSugerencias && clienteSugerencias.length > 0 && (
              <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clienteSugerencias.map(c => (
                  <button key={c.id} type="button" onMouseDown={() => selectCliente(c)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm">
                    <span className="font-medium">{c.nombre}</span>
                    <span className="text-slate-400 ml-2">{c.codigo}</span>
                    {c.nit && <span className="text-slate-400 ml-2">NIT: {c.nit}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Categoría y datos del trámite */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Datos del Trámite</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Categoría *</label>
              <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaMercantil)} className={inputCls}>
                {CATEGORIAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subtipo (opcional)</label>
              <input type="text" value={subtipo} onChange={e => setSubtipo(e.target.value)}
                placeholder="Ej: Primera vez, Renovación" className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Fecha del Trámite *</label>
              <input type="date" value={fechaTramite} onChange={e => setFechaTramite(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Fecha de Inscripción</label>
              <input type="date" value={fechaInscripcion} onChange={e => setFechaInscripcion(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fecha de Vencimiento</label>
              <input type="date" value={fechaVencimiento} onChange={e => setFechaVencimiento(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. de Registro</label>
              <input type="text" value={numeroRegistro} onChange={e => setNumeroRegistro(e.target.value)}
                placeholder="Número de inscripción" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>No. Expediente RM</label>
              <input type="text" value={numeroExpedienteRM} onChange={e => setNumeroExpedienteRM(e.target.value)}
                placeholder="Expediente Registro Mercantil" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notario Responsable</label>
            <input type="text" value={notarioResponsable} onChange={e => setNotarioResponsable(e.target.value)}
              placeholder="Nombre del notario" className={inputCls} />
          </div>
        </div>

        {/* Recurrencia */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Recurrencia y Alertas</h2>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="recurrente" checked={esRecurrente}
              onChange={e => setEsRecurrente(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]" />
            <label htmlFor="recurrente" className="text-sm text-slate-700">Es un trámite recurrente</label>
          </div>

          {esRecurrente && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Periodicidad (meses)</label>
                <input type="number" value={periodicidadMeses} onChange={e => setPeriodicidadMeses(e.target.value)}
                  min="1" max="120" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Alertar días antes</label>
                <input type="number" value={alertaDias} onChange={e => setAlertaDias(e.target.value)}
                  min="1" max="365" className={inputCls} />
              </div>
            </div>
          )}

          {!esRecurrente && (
            <div className="max-w-xs">
              <label className={labelCls}>Alertar días antes del vencimiento</label>
              <input type="number" value={alertaDias} onChange={e => setAlertaDias(e.target.value)}
                min="1" max="365" className={inputCls} />
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Descripción y Notas</h2>
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3} className={inputCls} placeholder="Descripción del trámite..." />
          </div>
          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              rows={2} className={inputCls} placeholder="Observaciones internas..." />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !clienteId}
            className="px-6 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 disabled:opacity-50 transition-all">
            {saving ? 'Guardando...' : 'Crear Trámite'}
          </button>
        </div>
      </form>
    </div>
  );
}
