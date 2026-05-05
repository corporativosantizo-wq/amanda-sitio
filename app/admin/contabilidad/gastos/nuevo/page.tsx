// ============================================================================
// app/admin/contabilidad/gastos/nuevo/page.tsx
// Registro rápido de gasto
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q } from '@/components/admin/ui';

const ICONS_POR_NOMBRE: Record<string, string> = {
  'Oficina': '🏢',
  'Legal': '⚖️',
  'Transporte': '🚗',
  'Servicios': '📱',
  'Honorarios': '💼',
  'Capacitación': '🎓',
  'Alimentación': '🍽️',
  'Publicidad': '📣',
  'Impuestos': '🏛️',
  'Mantenimiento': '🔧',
  'Registros': '📑',
  'Otros': '📋',
};

export default function NuevoGastoPage() {
  const router = useRouter();
  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [categoriaId, setCategoriaId] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [numeroFactura, setNumeroFactura] = useState('');
  const [deducible, setDeducible] = useState(true);
  const [notas, setNotas] = useState('');
  const [guardarYOtro, setGuardarYOtro] = useState(false);

  // Fetch real categories from DB
  const { data: catsResult } = useFetch<Array<{ id: string; nombre: string }>>(
    '/api/admin/contabilidad/gastos?categorias=true'
  );
  const categorias = (catsResult ?? []).map(c => ({
    id: c.id,
    nombre: c.nombre,
    icon: ICONS_POR_NOMBRE[c.nombre] ?? '📋',
  }));

  const montoNum = parseFloat(monto) || 0;

  const reset = () => {
    setDescripcion('');
    setMonto('');
    setFecha(new Date().toISOString().split('T')[0]);
    setCategoriaId('');
    setProveedor('');
    setNumeroFactura('');
    setNotas('');
  };

  const guardar = useCallback(async () => {
    if (!descripcion.trim()) return alert('La descripción es obligatoria');
    if (montoNum <= 0) return alert('El monto debe ser mayor a 0');
    if (!categoriaId) return alert('Selecciona una categoría');

    const body = {
      descripcion: descripcion.trim(),
      monto: montoNum,
      fecha,
      categoria_id: categoriaId,
      proveedor: proveedor.trim() || null,
      numero_factura_proveedor: numeroFactura.trim() || null,
      deducible,
      notas: notas.trim() || null,
    };

    await mutate('/api/admin/contabilidad/gastos', {
      body,
      onSuccess: (data: any) => {
        if (guardarYOtro) {
          reset();
        } else {
          router.push('/admin/contabilidad/gastos');
        }
      },
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [descripcion, montoNum, fecha, categoriaId, proveedor, numeroFactura, deducible, notas, guardarYOtro, mutate, router]);

  return (
    <div className="space-y-5 max-w-2xl">
      <PageHeader title="Nuevo gasto" description="Registra un gasto o compra" />

      {/* Main form */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-5">
        {/* Monto (BIG) */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Monto</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-slate-400 font-medium">Q</span>
            <input
              type="number" min="0" step="0.01" value={monto} autoFocus
              onChange={e => setMonto(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 pr-4 py-4 text-2xl font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] text-slate-900"
            />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label>
          <input type="text" value={descripcion} onChange={e => setDescripcion(e.target.value)}
            placeholder="Ej: Papel bond para impresiones, almuerzo con cliente..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        </div>

        {/* Fecha + Categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Categoría</label>
            <div className="grid grid-cols-5 gap-1.5">
              {categorias.map(c => (
                <button key={c.id} onClick={() => setCategoriaId(c.id)}
                  title={c.nombre}
                  className={`flex flex-col items-center gap-0.5 p-2 rounded-lg border transition-all ${
                    categoriaId === c.id
                      ? 'border-[#1E40AF] bg-blue-50 text-[#1E40AF]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[9px] font-medium leading-tight text-center truncate w-full">{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Proveedor + Factura */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Proveedor <span className="text-xs text-slate-400 font-normal">(opcional)</span>
            </label>
            <input type="text" value={proveedor} onChange={e => setProveedor(e.target.value)}
              placeholder="Nombre del proveedor"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              No. factura proveedor <span className="text-xs text-slate-400 font-normal">(opcional)</span>
            </label>
            <input type="text" value={numeroFactura} onChange={e => setNumeroFactura(e.target.value)}
              placeholder="FEL-12345678"
              className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={deducible} onChange={e => setDeducible(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/20" />
            <span className="text-sm text-slate-700">Deducible de ISR</span>
          </label>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Notas <span className="text-xs text-slate-400 font-normal">(opcional)</span>
          </label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
            placeholder="Detalle adicional..."
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        </div>
      </section>

      {/* Actions */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            {montoNum > 0 && (
              <span className="text-lg font-bold text-red-600">-{Q(montoNum)}</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => router.back()}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => { setGuardarYOtro(true); guardar(); }}
              disabled={guardando}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-30">
              💾 Guardar + otro
            </button>
            <button
              onClick={() => { setGuardarYOtro(false); guardar(); }}
              disabled={guardando || montoNum <= 0 || !descripcion.trim() || !categoriaId}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              {guardando ? 'Guardando...' : '💾 Guardar'}
            </button>
          </div>
        </div>
        {errorGuardar && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{errorGuardar}</div>
        )}
      </section>
    </div>
  );
}
