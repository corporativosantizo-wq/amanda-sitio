// ============================================================================
// app/admin/clientes/nuevo/page.tsx
// Formulario para crear nuevo cliente
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader } from '@/components/admin/ui';

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

  const guardar = useCallback(async () => {
    if (!nombre.trim()) return alert('El nombre es obligatorio');

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
    };

    await mutate('/api/admin/clientes', {
      body,
      onSuccess: (data: any) => router.push(`/admin/clientes/${data.id}`),
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [tipo, nombre, nit, dpi, email, telefono, direccion, razonSocial, nitFacturacion, dirFacturacion, notas, mismosDatos, mutate, router]);

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
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        </div>

        {/* NIT + DPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">NIT</label>
            <input type="text" value={nit} onChange={e => setNit(e.target.value)}
              placeholder="CF o 1234567-8"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
          {tipo === 'persona' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">DPI <span className="text-xs text-slate-400 font-normal">(13 dígitos)</span></label>
              <input type="text" value={dpi} onChange={e => setDpi(e.target.value)} maxLength={13}
                placeholder="0000 00000 0000"
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] font-mono" />
            </div>
          )}
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="cliente@email.com"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)}
              placeholder="+502 5555-1234"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
        </div>

        {/* Dirección */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
          <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)}
            placeholder="Zona, ciudad..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        </div>
      </section>

      {/* Facturación */}
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
                className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">NIT (factura)</label>
                <input type="text" value={nitFacturacion} onChange={e => setNitFacturacion(e.target.value)}
                  placeholder={nit || 'CF'}
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Dirección (factura)</label>
                <input type="text" value={dirFacturacion} onChange={e => setDirFacturacion(e.target.value)}
                  placeholder="Ciudad"
                  className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
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
            {loading ? 'Guardando...' : '💾 Guardar cliente'}
          </button>
        </div>
        {error && <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{error}</div>}
      </section>
    </div>
  );
}
