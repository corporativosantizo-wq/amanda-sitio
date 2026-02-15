// ============================================================================
// app/admin/clientes/nuevo/page.tsx
// Formulario para crear nuevo cliente
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader } from '@/components/admin/ui';
import type { CargoRepresentante } from '@/lib/types';
import { CARGO_LABELS, CARGOS_DIRECCION, CARGOS_GESTION } from '@/lib/types';

interface RepSugerencia {
  id: string;
  nombre_completo: string;
  email: string | null;
  empresas: { id: string; codigo: string; nombre: string; cargo: CargoRepresentante }[];
}

export default function NuevoClientePage() {
  const router = useRouter();
  const { mutate, loading, error } = useMutate();

  const [tipo, setTipo] = useState<'persona' | 'empresa'>('persona');
  const [nombre, setNombre] = useState('');
  const [nit, setNit] = useState('');
  const [dpi, setDpi] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [razonSocial, setRazonSocial] = useState('');
  const [nitFacturacion, setNitFacturacion] = useState('');
  const [dirFacturacion, setDirFacturacion] = useState('');
  const [notas, setNotas] = useState('');
  const [mismosDatos, setMismosDatos] = useState(true);

  // Representante de direccion
  const [cargoDireccion, setCargoDireccion] = useState<CargoRepresentante>('administrador_unico');
  const [repDireccionNombre, setRepDireccionNombre] = useState('');
  const [repDireccionEmail, setRepDireccionEmail] = useState('');
  const [repDireccionId, setRepDireccionId] = useState<string | null>(null);
  const [sugerenciasDireccion, setSugerenciasDireccion] = useState<RepSugerencia[]>([]);
  const [showDireccionDropdown, setShowDireccionDropdown] = useState(false);

  // Representante de gestion
  const [cargoGestion, setCargoGestion] = useState<CargoRepresentante>('gerente_general');
  const [repGestionNombre, setRepGestionNombre] = useState('');
  const [repGestionEmail, setRepGestionEmail] = useState('');
  const [repGestionId, setRepGestionId] = useState<string | null>(null);
  const [sugerenciasGestion, setSugerenciasGestion] = useState<RepSugerencia[]>([]);
  const [showGestionDropdown, setShowGestionDropdown] = useState(false);

  const direccionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const direccionDropdownRef = useRef<HTMLDivElement>(null);
  const gestionDropdownRef = useRef<HTMLDivElement>(null);

  // Autocomplete search
  const buscarRep = useCallback((valor: string, setter: typeof setSugerenciasDireccion, timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, showSetter: typeof setShowDireccionDropdown) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!valor.trim() || valor.trim().length < 2) { setter([]); showSetter(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes/representantes?q=${encodeURIComponent(valor.trim())}`);
        const json = await res.json();
        const reps = json.representantes ?? [];
        setter(reps);
        showSetter(reps.length > 0);
      } catch { setter([]); showSetter(false); }
    }, 300);
  }, []);

  useEffect(() => {
    if (!repDireccionId) {
      buscarRep(repDireccionNombre, setSugerenciasDireccion, direccionTimer, setShowDireccionDropdown);
    }
  }, [repDireccionNombre, repDireccionId, buscarRep]);

  useEffect(() => {
    if (!repGestionId) {
      buscarRep(repGestionNombre, setSugerenciasGestion, gestionTimer, setShowGestionDropdown);
    }
  }, [repGestionNombre, repGestionId, buscarRep]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (direccionDropdownRef.current && !direccionDropdownRef.current.contains(e.target as Node)) {
        setShowDireccionDropdown(false);
      }
      if (gestionDropdownRef.current && !gestionDropdownRef.current.contains(e.target as Node)) {
        setShowGestionDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectRepDireccion = (rep: RepSugerencia) => {
    setRepDireccionNombre(rep.nombre_completo);
    setRepDireccionEmail(rep.email ?? '');
    setRepDireccionId(rep.id);
    setShowDireccionDropdown(false);
  };

  const selectRepGestion = (rep: RepSugerencia) => {
    setRepGestionNombre(rep.nombre_completo);
    setRepGestionEmail(rep.email ?? '');
    setRepGestionId(rep.id);
    setShowGestionDropdown(false);
  };

  // Get linked empresas for selected representante (for warning)
  const empresasDireccion = repDireccionId
    ? sugerenciasDireccion.find(r => r.id === repDireccionId)?.empresas ?? []
    : [];
  const empresasGestion = repGestionId
    ? sugerenciasGestion.find(r => r.id === repGestionId)?.empresas ?? []
    : [];

  const guardar = useCallback(async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio');

    const representantes = tipo === 'empresa' ? [
      ...(repDireccionNombre.trim() ? [{
        cargo: cargoDireccion,
        nombre_completo: repDireccionNombre.trim(),
        email: repDireccionEmail.trim() || null,
        representante_id: repDireccionId || undefined,
      }] : []),
      ...(repGestionNombre.trim() ? [{
        cargo: cargoGestion,
        nombre_completo: repGestionNombre.trim(),
        email: repGestionEmail.trim() || null,
        representante_id: repGestionId || undefined,
      }] : []),
    ] : undefined;

    const body = {
      tipo,
      nombre: nombre.trim(),
      nit: nit.trim() || 'CF',
      dpi: tipo === 'persona' && dpi.trim() ? dpi.trim() : null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
      razon_social_facturacion: mismosDatos ? nombre.trim() : (razonSocial.trim() || nombre.trim()),
      nit_facturacion: mismosDatos ? (nit.trim() || 'CF') : (nitFacturacion.trim() || nit.trim() || 'CF'),
      direccion_facturacion: mismosDatos ? (direccion.trim() || 'Ciudad') : (dirFacturacion.trim() || 'Ciudad'),
      notas: notas.trim() || null,
      representantes,
    };

    await mutate('/api/admin/clientes', {
      body,
      onSuccess: (data: any) => router.push(`/admin/clientes/${data.id}`),
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [tipo, nombre, nit, dpi, email, telefono, direccion, razonSocial, nitFacturacion, dirFacturacion, notas, mismosDatos, cargoDireccion, repDireccionNombre, repDireccionEmail, repDireccionId, cargoGestion, repGestionNombre, repGestionEmail, repGestionId, mutate, router]);

  const INPUT = 'w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Nuevo cliente" description="Registra un cliente individual o empresa" />

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de cliente</label>
          <div className="flex gap-2">
            {([['persona', '👤 Individual'], ['empresa', '🏢 Empresa']] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setTipo(val)}
                className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-all ${
                  tipo === val ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>{lbl}</button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {tipo === 'empresa' ? 'Razón social' : 'Nombre completo'} *
          </label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
            placeholder={tipo === 'empresa' ? 'Ej: Grupo Rope, S.A.' : 'Ej: María García López'}
            className={INPUT} />
        </div>

        {/* NIT + DPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">NIT</label>
            <input type="text" value={nit} onChange={e => setNit(e.target.value)}
              placeholder="CF o 1234567-8"
              className={INPUT} />
          </div>
          {tipo === 'persona' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">DPI <span className="text-xs text-slate-400 font-normal">(13 dígitos)</span></label>
              <input type="text" value={dpi} onChange={e => setDpi(e.target.value)} maxLength={13}
                placeholder="0000 00000 0000"
                className={`${INPUT} font-mono`} />
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="+502 5555-1234"
              className={INPUT} />
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
          <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
            placeholder="Zona, ciudad..."
            className={INPUT} />
        </div>
      </section>

      {/* Representacion legal (solo empresa) */}
      {tipo === 'empresa' && (
        <>
          {/* Representante de Direccion */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Representante de Direccion</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Cargo</label>
              <select value={cargoDireccion} onChange={e => setCargoDireccion(e.target.value as CargoRepresentante)}
                className={INPUT}>
                {CARGOS_DIRECCION.map(c => (
                  <option key={c} value={c}>{CARGO_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="relative" ref={direccionDropdownRef}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo</label>
              <input type="text" value={repDireccionNombre}
                onChange={e => { setRepDireccionNombre(e.target.value); setRepDireccionId(null); }}
                placeholder="Nombre del representante"
                className={INPUT} />
              {showDireccionDropdown && sugerenciasDireccion.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {sugerenciasDireccion.map(rep => (
                    <button key={rep.id} onClick={() => selectRepDireccion(rep)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <p className="text-sm font-medium text-slate-900">{rep.nombre_completo}</p>
                      {rep.email && <p className="text-xs text-slate-500">{rep.email}</p>}
                      {rep.empresas.length > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Vinculado con: {rep.empresas.map(e => e.nombre).join(', ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input type="email" value={repDireccionEmail}
                onChange={e => setRepDireccionEmail(e.target.value)}
                placeholder="email@representante.com"
                className={INPUT} />
            </div>

            {empresasDireccion.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-800 mb-1.5 flex items-center gap-1">
                  <span>⚠️</span> Este representante tambien esta vinculado con:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {empresasDireccion.map(e => (
                    <Link key={e.id} href={`/admin/clientes/${e.id}`} target="_blank"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-900 rounded-md hover:bg-amber-200 transition-colors">
                      {e.codigo} · {e.nombre} <span className="text-amber-600">({CARGO_LABELS[e.cargo]})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Representante de Gestion */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900">Representante de Gestion</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Cargo</label>
              <select value={cargoGestion} onChange={e => setCargoGestion(e.target.value as CargoRepresentante)}
                className={INPUT}>
                {CARGOS_GESTION.map(c => (
                  <option key={c} value={c}>{CARGO_LABELS[c]}</option>
                ))}
              </select>
            </div>

            <div className="relative" ref={gestionDropdownRef}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo</label>
              <input type="text" value={repGestionNombre}
                onChange={e => { setRepGestionNombre(e.target.value); setRepGestionId(null); }}
                placeholder="Nombre del representante"
                className={INPUT} />
              {showGestionDropdown && sugerenciasGestion.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {sugerenciasGestion.map(rep => (
                    <button key={rep.id} onClick={() => selectRepGestion(rep)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                      <p className="text-sm font-medium text-slate-900">{rep.nombre_completo}</p>
                      {rep.email && <p className="text-xs text-slate-500">{rep.email}</p>}
                      {rep.empresas.length > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Vinculado con: {rep.empresas.map(e => e.nombre).join(', ')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input type="email" value={repGestionEmail}
                onChange={e => setRepGestionEmail(e.target.value)}
                placeholder="email@representante.com"
                className={INPUT} />
            </div>

            {empresasGestion.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs font-medium text-amber-800 mb-1.5 flex items-center gap-1">
                  <span>⚠️</span> Este representante tambien esta vinculado con:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {empresasGestion.map(e => (
                    <Link key={e.id} href={`/admin/clientes/${e.id}`} target="_blank"
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-amber-100 text-amber-900 rounded-md hover:bg-amber-200 transition-colors">
                      {e.codigo} · {e.nombre} <span className="text-amber-600">({CARGO_LABELS[e.cargo]})</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Facturacion */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Datos de facturación</h3>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={mismosDatos} onChange={e => setMismosDatos(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/20" />
            <span className="text-xs text-slate-600">Mismos datos del cliente</span>
          </label>
        </div>

        {!mismosDatos && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Razón social (factura)</label>
              <input type="text" value={razonSocial} onChange={e => setRazonSocial(e.target.value)}
                placeholder={nombre || 'Nombre para factura'}
                className={INPUT} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">NIT (factura)</label>
                <input type="text" value={nitFacturacion} onChange={e => setNitFacturacion(e.target.value)}
                  placeholder={nit || 'CF'}
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dirección (factura)</label>
                <input type="text" value={dirFacturacion} onChange={e => setDirFacturacion(e.target.value)}
                  placeholder="Ciudad"
                  className={INPUT} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Notas */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Notas internas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Ej: Referido por Lic. García, prefiere comunicación por WhatsApp..."
          className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-end gap-3">
          <button onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={guardar} disabled={loading || !nombre.trim()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-30">
            {loading ? 'Guardando...' : 'Guardar cliente'}
          </button>
        </div>
        {error && <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
      </section>
    </div>
  );
}
