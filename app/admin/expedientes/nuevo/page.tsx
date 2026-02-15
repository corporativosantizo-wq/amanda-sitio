// ============================================================================
// app/admin/expedientes/nuevo/page.tsx
// Formulario de nuevo expediente — dinámico según origen
// ============================================================================

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutate } from '@/lib/hooks/use-fetch';
import {
  type OrigenExpediente, type TipoProceso, type FaseExpediente,
  type RolClienteExpediente, type MonedaExpediente,
  ORIGEN_LABEL, TIPO_PROCESO_LABEL, FASE_LABEL, ROL_CLIENTE_LABEL,
  getFasesForOrigen, TIPOS_PROCESO_FISCAL, TIPOS_PROCESO_ADMINISTRATIVO,
  TIPOS_PROCESO_JUDICIAL, DEPARTAMENTOS_GUATEMALA,
} from '@/lib/types/expedientes';

interface ClienteSuggestion {
  id: string;
  codigo: string;
  nombre: string;
  nit: string | null;
  tipo: string;
}

export default function NuevoExpedientePage() {
  const router = useRouter();
  const { mutate, loading: saving } = useMutate();

  // Core
  const [origen, setOrigen] = useState<OrigenExpediente>('judicial');
  const [tipoProceso, setTipoProceso] = useState<TipoProceso>('civil');
  const [subtipo, setSubtipo] = useState('');
  const [faseActual, setFaseActual] = useState<FaseExpediente>('demanda');
  const [estado] = useState('activo');

  // Números
  const [numeroExpediente, setNumeroExpediente] = useState('');
  const [numeroMp, setNumeroMp] = useState('');
  const [numeroAdministrativo, setNumeroAdministrativo] = useState('');

  // Cliente
  const [clienteId, setClienteId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteSugerencias, setClienteSugerencias] = useState<ClienteSuggestion[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const clienteTimer = useRef<NodeJS.Timeout>(undefined);

  // Sede fiscal
  const [fiscalia, setFiscalia] = useState('');
  const [agenteFiscal, setAgenteFiscal] = useState('');

  // Sede administrativa
  const [entidadAdministrativa, setEntidadAdministrativa] = useState('');
  const [dependencia, setDependencia] = useState('');
  const [montoMulta, setMontoMulta] = useState('');
  const [resolucionAdministrativa, setResolucionAdministrativa] = useState('');

  // Sede judicial
  const [juzgado, setJuzgado] = useState('');
  const [departamento, setDepartamento] = useState('Guatemala');

  // Partes
  const [actor, setActor] = useState('');
  const [demandado, setDemandado] = useState('');
  const [rolCliente, setRolCliente] = useState<RolClienteExpediente>('demandado');

  // Generales
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [descripcion, setDescripcion] = useState('');
  const [notasInternas, setNotasInternas] = useState('');
  const [montoPretension, setMontoPretension] = useState('');
  const [moneda, setMoneda] = useState<MonedaExpediente>('GTQ');

  // Reset fase and tipo when origen changes
  useEffect(() => {
    const fases = getFasesForOrigen(origen);
    setFaseActual(fases[0]);

    if (origen === 'fiscal') {
      setTipoProceso('penal');
      setRolCliente('denunciado');
    } else if (origen === 'administrativo') {
      setTipoProceso('administrativo_sancionador');
      setRolCliente('sancionado');
    } else {
      setTipoProceso('civil');
      setRolCliente('demandado');
    }
  }, [origen]);

  // Client autocomplete
  useEffect(() => {
    if (clienteTimer.current) clearTimeout(clienteTimer.current);
    if (clienteNombre.length < 2) { setClienteSugerencias([]); return; }

    clienteTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes?q=${encodeURIComponent(clienteNombre)}&limit=8&activo=true`);
        const json = await res.json();
        setClienteSugerencias(json.data ?? []);
        setShowSugerencias(true);
      } catch { /* ignore */ }
    }, 300);

    return () => { if (clienteTimer.current) clearTimeout(clienteTimer.current); };
  }, [clienteNombre]);

  function selectCliente(c: ClienteSuggestion) {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setShowSugerencias(false);
    setClienteSugerencias([]);
  }

  function getTiposProcesoForOrigen(): TipoProceso[] {
    switch (origen) {
      case 'fiscal': return TIPOS_PROCESO_FISCAL;
      case 'administrativo': return TIPOS_PROCESO_ADMINISTRATIVO;
      case 'judicial': return TIPOS_PROCESO_JUDICIAL;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!clienteId) { alert('Selecciona un cliente'); return; }

    const hasNumero = (origen === 'judicial' && numeroExpediente.trim()) ||
      (origen === 'fiscal' && numeroMp.trim()) ||
      (origen === 'administrativo' && numeroAdministrativo.trim()) ||
      numeroExpediente.trim() || numeroMp.trim() || numeroAdministrativo.trim();

    if (!hasNumero) { alert('Ingresa al menos un número de expediente'); return; }

    const body: Record<string, unknown> = {
      origen, tipo_proceso: tipoProceso, subtipo: subtipo || null,
      fase_actual: faseActual, estado, cliente_id: clienteId,
      numero_expediente: numeroExpediente.trim() || null,
      numero_mp: numeroMp.trim() || null,
      numero_administrativo: numeroAdministrativo.trim() || null,
      fiscalia: fiscalia.trim() || null,
      agente_fiscal: agenteFiscal.trim() || null,
      entidad_administrativa: entidadAdministrativa.trim() || null,
      dependencia: dependencia.trim() || null,
      monto_multa: montoMulta ? parseFloat(montoMulta) : null,
      resolucion_administrativa: resolucionAdministrativa.trim() || null,
      juzgado: juzgado.trim() || null,
      departamento: departamento || null,
      actor: actor.trim() || null,
      demandado: demandado.trim() || null,
      rol_cliente: rolCliente,
      fecha_inicio: fechaInicio,
      descripcion: descripcion.trim() || null,
      notas_internas: notasInternas.trim() || null,
      monto_pretension: montoPretension ? parseFloat(montoPretension) : null,
      moneda,
    };

    const result = await mutate('/api/admin/expedientes', {
      body,
      onSuccess: (data: any) => {
        router.push(`/admin/expedientes/${data.expediente.id}`);
      },
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
        <h1 className="text-xl font-bold text-slate-900">Nuevo Expediente</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Origen */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Origen del caso</h2>
          <div className="flex gap-3">
            {(['judicial', 'fiscal', 'administrativo'] as OrigenExpediente[]).map(o => (
              <button key={o} type="button" onClick={() => setOrigen(o)}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  origen === o
                    ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                {ORIGEN_LABEL[o]}
              </button>
            ))}
          </div>
        </div>

        {/* Cliente */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Cliente</h2>
          <div className="relative">
            <label className={labelCls}>Buscar cliente *</label>
            <input type="text" value={clienteNombre}
              onChange={e => { setClienteNombre(e.target.value); setClienteId(''); }}
              placeholder="Nombre del cliente..."
              className={inputCls} />
            {showSugerencias && clienteSugerencias.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {clienteSugerencias.map(c => (
                  <button key={c.id} type="button" onClick={() => selectCliente(c)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between">
                    <span className="font-medium text-slate-900">{c.nombre}</span>
                    <span className="text-xs text-slate-400">{c.codigo} · {c.nit}</span>
                  </button>
                ))}
              </div>
            )}
            {clienteId && (
              <p className="text-xs text-green-600 mt-1">Cliente seleccionado</p>
            )}
          </div>
        </div>

        {/* Números de expediente */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Números de identificación</h2>
          <p className="text-xs text-slate-500">Al menos uno es obligatorio</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(origen === 'judicial' || origen === 'fiscal') && (
              <div>
                <label className={labelCls}>No. Expediente Judicial</label>
                <input type="text" value={numeroExpediente} onChange={e => setNumeroExpediente(e.target.value)}
                  placeholder="01001-2024-00123" className={inputCls} />
              </div>
            )}
            {origen === 'fiscal' && (
              <div>
                <label className={labelCls}>No. MP / Fiscalía *</label>
                <input type="text" value={numeroMp} onChange={e => setNumeroMp(e.target.value)}
                  placeholder="MP001-2024-12345" className={inputCls} />
              </div>
            )}
            {origen === 'administrativo' && (
              <>
                <div>
                  <label className={labelCls}>No. Expediente Administrativo *</label>
                  <input type="text" value={numeroAdministrativo} onChange={e => setNumeroAdministrativo(e.target.value)}
                    placeholder="SAT-2024-00456" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>No. Expediente Judicial</label>
                  <input type="text" value={numeroExpediente} onChange={e => setNumeroExpediente(e.target.value)}
                    placeholder="Si ya fue judicializado" className={inputCls} />
                </div>
              </>
            )}
            {origen === 'judicial' && (
              <div>
                <label className={labelCls}>No. Expediente Judicial *</label>
                <input type="text" value={numeroExpediente} onChange={e => setNumeroExpediente(e.target.value)}
                  placeholder="01001-2024-00123" className={inputCls} />
              </div>
            )}
          </div>
        </div>

        {/* Clasificación */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Clasificación</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Tipo de proceso *</label>
              <select value={tipoProceso} onChange={e => setTipoProceso(e.target.value as TipoProceso)} className={inputCls}>
                {getTiposProcesoForOrigen().map(t => (
                  <option key={t} value={t}>{TIPO_PROCESO_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subtipo</label>
              <input type="text" value={subtipo} onChange={e => setSubtipo(e.target.value)}
                placeholder="Ej: Juicio Ordinario" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Fase actual *</label>
              <select value={faseActual} onChange={e => setFaseActual(e.target.value as FaseExpediente)} className={inputCls}>
                {getFasesForOrigen(origen).map(f => (
                  <option key={f} value={f}>{FASE_LABEL[f]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sede fiscal */}
        {origen === 'fiscal' && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Sede Fiscal</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Fiscalía</label>
                <input type="text" value={fiscalia} onChange={e => setFiscalia(e.target.value)}
                  placeholder="Ej: Fiscalía de Delitos Económicos" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Agente fiscal</label>
                <input type="text" value={agenteFiscal} onChange={e => setAgenteFiscal(e.target.value)}
                  placeholder="Nombre del fiscal" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Sede administrativa */}
        {origen === 'administrativo' && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Sede Administrativa</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Entidad administrativa</label>
                <input type="text" value={entidadAdministrativa} onChange={e => setEntidadAdministrativa(e.target.value)}
                  placeholder="Ej: SAT, SIB, CNEE" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Dependencia</label>
                <input type="text" value={dependencia} onChange={e => setDependencia(e.target.value)}
                  placeholder="Área específica" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Monto de multa</label>
                <input type="number" step="0.01" value={montoMulta} onChange={e => setMontoMulta(e.target.value)}
                  placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>No. resolución sancionatoria</label>
                <input type="text" value={resolucionAdministrativa} onChange={e => setResolucionAdministrativa(e.target.value)}
                  className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Sede judicial */}
        {(origen === 'judicial' || origen === 'fiscal') && (
          <div className={sectionCls}>
            <h2 className="font-semibold text-slate-900">Sede Judicial</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Juzgado</label>
                <input type="text" value={juzgado} onChange={e => setJuzgado(e.target.value)}
                  placeholder="Nombre completo del juzgado" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Departamento</label>
                <select value={departamento} onChange={e => setDepartamento(e.target.value)} className={inputCls}>
                  <option value="">Seleccionar</option>
                  {DEPARTAMENTOS_GUATEMALA.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Partes procesales */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Partes procesales</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>
                {origen === 'fiscal' ? 'Denunciante / MP' : origen === 'administrativo' ? 'Entidad sancionadora' : 'Actor / Demandante'}
              </label>
              <input type="text" value={actor} onChange={e => setActor(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                {origen === 'fiscal' ? 'Denunciado / Imputado' : origen === 'administrativo' ? 'Sancionado / Contribuyente' : 'Demandado'}
              </label>
              <input type="text" value={demandado} onChange={e => setDemandado(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rol del cliente</label>
              <select value={rolCliente} onChange={e => setRolCliente(e.target.value as RolClienteExpediente)} className={inputCls}>
                {Object.entries(ROL_CLIENTE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Datos generales */}
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Datos generales</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Fecha de inicio *</label>
              <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Monto pretensión</label>
              <input type="number" step="0.01" value={montoPretension} onChange={e => setMontoPretension(e.target.value)}
                placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value as MonedaExpediente)} className={inputCls}>
                <option value="GTQ">GTQ (Quetzales)</option>
                <option value="USD">USD (Dólares)</option>
                <option value="EUR">EUR (Euros)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Descripción del caso</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3} className={inputCls} placeholder="Resumen breve del caso..." />
          </div>
          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={notasInternas} onChange={e => setNotasInternas(e.target.value)}
              rows={2} className={inputCls} placeholder="Notas privadas del equipo..." />
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="submit" disabled={saving}
            className="px-6 py-2.5 bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white text-sm font-medium rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear Expediente'}
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
