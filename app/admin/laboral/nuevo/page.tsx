// ============================================================================
// app/admin/laboral/nuevo/page.tsx
// Formulario de nuevo trámite laboral
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutate } from '@/lib/hooks/use-fetch';
import {
  type CategoriaLaboral,
  CATEGORIA_LABORAL_LABEL,
  CATEGORIAS_CON_FECHA_FIN,
  CATEGORIAS_CON_REGISTRO_IGT,
} from '@/lib/types/laboral';

interface ClienteSuggestion {
  id: string;
  codigo: string;
  nombre: string;
  nit: string | null;
  tipo: string;
}

const CATEGORIAS = Object.entries(CATEGORIA_LABORAL_LABEL) as [CategoriaLaboral, string][];

export default function NuevoTramiteLaboralPage() {
  const router = useRouter();
  const { mutate, loading: saving } = useMutate();

  // Form state
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteSugerencias, setClienteSugerencias] = useState<ClienteSuggestion[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const clienteTimer = useRef<NodeJS.Timeout>(undefined);

  const [categoria, setCategoria] = useState<CategoriaLaboral>('contrato_individual');
  const [nombreEmpleado, setNombreEmpleado] = useState('');
  const [puesto, setPuesto] = useState('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fechaFin, setFechaFin] = useState('');
  const [salario, setSalario] = useState('');
  const [moneda, setMoneda] = useState<'GTQ' | 'USD'>('GTQ');
  const [esTemporal, setEsTemporal] = useState(false);
  const [duracionMeses, setDuracionMeses] = useState('');
  const [alertaDias, setAlertaDias] = useState('30');
  const [descripcion, setDescripcion] = useState('');
  const [notas, setNotas] = useState('');

  // Auto-set temporal based on category
  useEffect(() => {
    setEsTemporal(CATEGORIAS_CON_FECHA_FIN.includes(categoria));
  }, [categoria]);

  // Show/hide fields based on category
  const showEmpleado = ['contrato_individual', 'contrato_temporal', 'contrato_profesional', 'registro_contrato_igt'].includes(categoria);
  const showFechaFin = CATEGORIAS_CON_FECHA_FIN.includes(categoria) || esTemporal;
  const showRegistroIGT = CATEGORIAS_CON_REGISTRO_IGT.includes(categoria);

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
      alerta_dias_antes: parseInt(alertaDias) || 30,
      es_temporal: esTemporal,
      moneda,
    };

    if (nombreEmpleado) body.nombre_empleado = nombreEmpleado;
    if (puesto) body.puesto = puesto;
    if (fechaInicio) body.fecha_inicio = fechaInicio;
    if (fechaFin) body.fecha_fin = fechaFin;
    if (salario) body.salario = parseFloat(salario);
    if (esTemporal && duracionMeses) body.duracion_meses = parseInt(duracionMeses);
    if (descripcion) body.descripcion = descripcion;
    if (notas) body.notas = notas;

    const result = await mutate('/api/admin/laboral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (result?.tramite?.id) {
      router.push(`/admin/laboral/${result.tramite.id}`);
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white';
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <h1 className="text-xl font-bold text-slate-900">Nuevo Trámite Laboral</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cliente */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Cliente</h2>
          <div className="relative">
            <label className={labelCls}>Empresa / Patrono *</label>
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

        {/* Categoría y datos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Datos del Trámite</h2>

          <div>
            <label className={labelCls}>Categoría *</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value as CategoriaLaboral)} className={inputCls}>
              {CATEGORIAS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          {showEmpleado && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Nombre del Empleado</label>
                <input type="text" value={nombreEmpleado} onChange={e => setNombreEmpleado(e.target.value)}
                  placeholder="Nombre completo" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Puesto</label>
                <input type="text" value={puesto} onChange={e => setPuesto(e.target.value)}
                  placeholder="Cargo o puesto" className={inputCls} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha de Inicio</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} />
            </div>
            {showFechaFin && (
              <div>
                <label className={labelCls}>Fecha de Finalización</label>
                <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Salario</label>
              <input type="number" value={salario} onChange={e => setSalario(e.target.value)}
                step="0.01" min="0" placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as 'GTQ' | 'USD')} className={inputCls}>
                <option value="GTQ">Quetzales (GTQ)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Alertar días antes</label>
              <input type="number" value={alertaDias} onChange={e => setAlertaDias(e.target.value)}
                min="1" max="365" className={inputCls} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input type="checkbox" id="temporal" checked={esTemporal}
              onChange={e => setEsTemporal(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]" />
            <label htmlFor="temporal" className="text-sm text-slate-700">Es contrato temporal</label>
          </div>

          {esTemporal && (
            <div className="max-w-xs">
              <label className={labelCls}>Duración (meses)</label>
              <input type="number" value={duracionMeses} onChange={e => setDuracionMeses(e.target.value)}
                min="1" className={inputCls} />
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
