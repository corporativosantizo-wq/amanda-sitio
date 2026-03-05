// ============================================================================
// app/admin/proveedores/nuevo/page.tsx
// Formulario para crear nuevo proveedor
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader } from '@/components/admin/ui';

const TIPOS = [
  { value: 'freelance', label: 'Freelance' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'consultor', label: 'Consultor' },
  { value: 'perito', label: 'Perito' },
  { value: 'traductor', label: 'Traductor' },
  { value: 'notificador', label: 'Notificador' },
  { value: 'otro', label: 'Otro' },
];

const INPUT = 'w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';

export default function NuevoProveedorPage() {
  const router = useRouter();
  const { mutate, loading, error } = useMutate();

  const [tipo, setTipo] = useState('freelance');
  const [nombre, setNombre] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const [nit, setNit] = useState('');
  const [dpi, setDpi] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [banco, setBanco] = useState('');
  const [tipoCuenta, setTipoCuenta] = useState('');
  const [numeroCuenta, setNumeroCuenta] = useState('');
  const [cuentaNombre, setCuentaNombre] = useState('');
  const [tarifaHora, setTarifaHora] = useState('');
  const [notas, setNotas] = useState('');

  const guardar = useCallback(async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio');

    const body = {
      tipo,
      nombre: nombre.trim(),
      especialidad: especialidad.trim() || null,
      nit: nit.trim() || null,
      dpi: dpi.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
      banco: banco.trim() || null,
      tipo_cuenta: tipoCuenta.trim() || null,
      numero_cuenta: numeroCuenta.trim() || null,
      cuenta_nombre: cuentaNombre.trim() || null,
      tarifa_hora: tarifaHora ? parseFloat(tarifaHora) : null,
      notas: notas.trim() || null,
    };

    await mutate('/api/admin/proveedores', {
      body,
      onSuccess: (data: any) => router.push(`/admin/proveedores/${data.id}`),
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [tipo, nombre, especialidad, nit, dpi, email, telefono, direccion, banco, tipoCuenta, numeroCuenta, cuentaNombre, tarifaHora, notas, mutate, router]);

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Nuevo proveedor" description="Registra un proveedor, perito, traductor u otro colaborador" />

      {/* Datos generales */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        <h3 className="text-sm font-semibold text-slate-900">Datos generales</h3>

        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de proveedor</label>
          <div className="flex flex-wrap gap-2">
            {TIPOS.map(t => (
              <button key={t.value} onClick={() => setTipo(t.value)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  tipo === t.value ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo / Razón social *</label>
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus
            placeholder="Ej: Juan Pérez o Consultores Asociados, S.A."
            className={INPUT} />
        </div>

        {/* Especialidad */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Especialidad</label>
          <input type="text" value={especialidad} onChange={e => setEspecialidad(e.target.value)}
            placeholder="Ej: Derecho mercantil, traducciones juradas..."
            className={INPUT} />
        </div>

        {/* NIT + DPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">NIT</label>
            <input type="text" value={nit} onChange={e => setNit(e.target.value)}
              placeholder="1234567-8"
              className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">DPI</label>
            <input type="text" value={dpi} onChange={e => setDpi(e.target.value)} maxLength={13}
              placeholder="0000 00000 0000"
              className={`${INPUT} font-mono`} />
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="proveedor@email.com"
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

      {/* Datos bancarios */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900">Datos bancarios</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Banco</label>
            <input type="text" value={banco} onChange={e => setBanco(e.target.value)}
              placeholder="Ej: Banco Industrial"
              className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de cuenta</label>
            <input type="text" value={tipoCuenta} onChange={e => setTipoCuenta(e.target.value)}
              placeholder="Monetaria, Ahorro..."
              className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Número de cuenta</label>
            <input type="text" value={numeroCuenta} onChange={e => setNumeroCuenta(e.target.value)}
              placeholder="000-000000-0"
              className={`${INPUT} font-mono`} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Nombre en cuenta</label>
            <input type="text" value={cuentaNombre} onChange={e => setCuentaNombre(e.target.value)}
              placeholder="Titular de la cuenta"
              className={INPUT} />
          </div>
        </div>

        <div className="w-1/2">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tarifa por hora (Q)</label>
          <input type="number" value={tarifaHora} onChange={e => setTarifaHora(e.target.value)}
            placeholder="0.00" step="0.01" min="0"
            className={`${INPUT} font-mono`} />
        </div>
      </section>

      {/* Notas */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <label className="block text-sm font-medium text-slate-700 mb-2">Notas internas</label>
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
          placeholder="Ej: Referido por Lic. García, trabaja rápido..."
          className={`${INPUT} resize-none`} />
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex justify-end gap-3">
          <button onClick={() => router.back()}
            className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
          <button onClick={guardar} disabled={loading || !nombre.trim()}
            className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-30">
            {loading ? 'Guardando...' : 'Guardar proveedor'}
          </button>
        </div>
        {error && <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
      </section>
    </div>
  );
}
