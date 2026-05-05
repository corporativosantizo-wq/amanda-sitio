// ============================================================================
// app/admin/contabilidad/cotizaciones/[id]/editar/page.tsx
// Formulario de edición de cotización (solo borradores)
// ============================================================================

'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q, Skeleton, EmptyState } from '@/components/admin/ui';
import {
  CATALOGO, CATEGORIAS, CATEGORIA_COLORES,
  buscarServicios,
  type ServicioCatalogo, type CategoriaServicio,
} from '@/lib/data/catalogo-servicios';

// ── Types ───────────────────────────────────────────────────────────────

interface ItemForm {
  id: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  orden: number;
  codigoCatalogo?: string;
  aplica_iva: boolean;
}

const EXENTO_KEYWORDS = /gasto|registro|timbre|arancel/i;

interface CotizacionData {
  id: string;
  numero: string;
  estado: string;
  condiciones: string | null;
  notas_internas: string | null;
  cliente: {
    id: string;
    codigo: string;
    nombre: string;
    nit: string;
    email: string;
  } | null;
  items: Array<{
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    orden: number;
  }>;
}

// ── Page ────────────────────────────────────────────────────────────────

export default function EditarCotizacionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: cot, loading, error } = useFetch<CotizacionData>(
    `/api/admin/contabilidad/cotizaciones/${id}`
  );
  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  // Items
  const [items, setItems] = useState<ItemForm[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Catalog
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [catFiltro, setCatFiltro] = useState<CategoriaServicio | ''>('');
  const [catalogoBusqueda, setCatalogoBusqueda] = useState('');

  // CC emails
  const [ccEmails, setCcEmails] = useState('');

  // Gastos del trámite (Recibo de Caja)
  const [montoGastos, setMontoGastos] = useState('');

  // Terms
  const [condiciones, setCondiciones] = useState('');
  const [notasCliente, setNotasCliente] = useState('');
  const [notas, setNotas] = useState('');

  // Pre-populate when data loads
  useEffect(() => {
    if (cot && !initialized) {
      setItems(cot.items.map((item: any) => ({
        id: item.id,
        descripcion: item.descripcion,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        orden: item.orden,
        aplica_iva: item.aplica_iva ?? true,
      })));
      setCondiciones(cot.condiciones ?? '');
      setNotasCliente((cot as any).notas_cliente ?? '');
      setCcEmails((cot as any).cc_emails ?? '');
      setMontoGastos(((cot as any).monto_gastos ?? 0) > 0 ? String((cot as any).monto_gastos) : '');
      setNotas(cot.notas_internas ?? '');
      setInitialized(true);
    }
  }, [cot, initialized]);

  // ── Calculations ────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const baseGravable = items
      .filter(i => i.aplica_iva)
      .reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const iva = Math.round(baseGravable * 0.12 * 100) / 100;
    const total = subtotal + iva;
    const gastos = Math.max(0, parseFloat(montoGastos) || 0);
    const totalGeneral = total + gastos;
    const anticipo = Math.round(total * 0.6 * 100) / 100;
    const saldo = Math.round(total * 0.4 * 100) / 100;
    return { subtotal, baseGravable, iva, total, gastos, totalGeneral, anticipo, saldo };
  }, [items, montoGastos]);

  // ── Catalog filtering ─────────────────────────────────────────────

  const catalogoFiltrado = useMemo(() => {
    return buscarServicios(catalogoBusqueda, catFiltro || undefined);
  }, [catFiltro, catalogoBusqueda]);

  // ── Item actions ──────────────────────────────────────────────────

  const agregarDesdeCatalogo = useCallback((srv: ServicioCatalogo) => {
    const desc = `${srv.nombre} — ${srv.descripcion}`;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      descripcion: desc,
      cantidad: 1,
      precio_unitario: srv.precioBase,
      orden: prev.length,
      codigoCatalogo: srv.codigo,
      aplica_iva: !EXENTO_KEYWORDS.test(desc),
    }]);
  }, []);

  const agregarManual = useCallback(() => {
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      descripcion: '',
      cantidad: 1,
      precio_unitario: 0,
      orden: prev.length,
      aplica_iva: true,
    }]);
  }, []);

  const actualizarItem = useCallback((itemId: string, campo: string, valor: string | number | boolean) => {
    setItems(prev => prev.map(i => {
      if (i.id !== itemId) return i;
      const updated = { ...i, [campo]: valor };
      if (campo === 'descripcion') {
        updated.aplica_iva = !EXENTO_KEYWORDS.test(String(valor));
      }
      return updated;
    }));
  }, []);

  const eliminarItem = useCallback((itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId).map((item, idx) => ({ ...item, orden: idx })));
  }, []);

  const moverItem = useCallback((itemId: string, dir: 'up' | 'down') => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === itemId);
      const ni = dir === 'up' ? idx - 1 : idx + 1;
      if (ni < 0 || ni >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
      return copy.map((item, i) => ({ ...item, orden: i }));
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────

  const guardar = useCallback(async () => {
    if (items.length === 0) return alert('Agrega al menos un servicio');
    if (items.some(i => !i.descripcion.trim() || i.precio_unitario <= 0)) {
      return alert('Todos los items necesitan descripción y precio');
    }

    await mutate(`/api/admin/contabilidad/cotizaciones/${id}`, {
      method: 'PUT',
      body: {
        items: items.map(i => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          orden: i.orden,
          aplica_iva: i.aplica_iva,
        })),
        condiciones,
        notas_cliente: notasCliente || null,
        notas_internas: notas || null,
        cc_emails: ccEmails.trim() || null,
        monto_gastos: Math.max(0, parseFloat(montoGastos) || 0),
      },
      onSuccess: () => {
        router.push(`/admin/contabilidad/cotizaciones/${id}`);
      },
      onError: (err) => alert(`Error: ${err}`),
    });
  }, [id, items, condiciones, notasCliente, notas, ccEmails, montoGastos, mutate, router]);

  // ── Loading / Error / Not editable ────────────────────────────────

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );

  if (error || !cot) return (
    <EmptyState
      icon="❌"
      title="Cotización no encontrada"
      description={error ?? 'No se pudo cargar la cotización'}
      action={{ label: 'Volver', onClick: () => router.push('/admin/contabilidad/cotizaciones') }}
    />
  );

  if (cot.estado !== 'borrador') return (
    <EmptyState
      icon="🔒"
      title="No se puede editar"
      description={`Esta cotización está en estado "${cot.estado}". Solo se pueden editar borradores.`}
      action={{ label: 'Ver cotización', onClick: () => router.push(`/admin/contabilidad/cotizaciones/${id}`) }}
    />
  );

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title={`Editar ${cot.numero}`}
        description={`Modificar cotización para ${cot.cliente?.nombre ?? 'Sin cliente'}`}
      />

      {/* ══════════ CLIENTE (solo lectura) ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Cliente</h3>
        {cot.cliente && (
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg p-4 border border-slate-200">
            <div>
              <p className="font-medium text-slate-900">{cot.cliente.nombre}</p>
              <p className="text-sm text-slate-500">
                NIT: {cot.cliente.nit || 'CF'} · {cot.cliente.email || 'Sin email'}
              </p>
            </div>
          </div>
        )}

        {/* CC emails */}
        <div className="mt-3">
          <label className="text-xs text-slate-500 font-medium">CC (copia de correo)</label>
          <input
            type="text"
            placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
            value={ccEmails}
            onChange={e => setCcEmails(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
          />
          <p className="text-xs text-slate-400 mt-1">Separar múltiples correos con coma. Se enviarán como CC al enviar la cotización.</p>
        </div>
      </section>

      {/* ══════════ SERVICIOS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Servicios</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCatalogo(!showCatalogo)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                showCatalogo
                  ? 'bg-[#1E40AF] text-white'
                  : 'bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
              }`}
            >
              Catálogo {showCatalogo ? '▲' : '▼'}
            </button>
            <button
              onClick={agregarManual}
              className="px-3 py-1.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            >
              + Item libre
            </button>
          </div>
        </div>

        {/* Catalog Picker */}
        {showCatalogo && (
          <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-5 pt-4 pb-2 space-y-3">
              <input
                type="text"
                placeholder="Buscar servicio por nombre o código..."
                value={catalogoBusqueda}
                onChange={e => setCatalogoBusqueda(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
              />
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setCatFiltro('')}
                  className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border transition-all ${
                    !catFiltro ? 'bg-[#1E40AF] text-white border-[#1E40AF]' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Todos ({CATALOGO.length})
                </button>
                {CATEGORIAS.map(cat => {
                  const count = CATALOGO.filter(s => s.categoria === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setCatFiltro(catFiltro === cat ? '' : cat)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full whitespace-nowrap border transition-all ${
                        catFiltro === cat
                          ? 'bg-[#1E40AF] text-white border-[#1E40AF]'
                          : `${CATEGORIA_COLORES[cat]} hover:opacity-80`
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
              {catalogoFiltrado.map(srv => {
                const yaAgregado = items.some(i => i.codigoCatalogo === srv.codigo);
                return (
                  <button
                    key={srv.codigo}
                    onClick={() => !yaAgregado && agregarDesdeCatalogo(srv)}
                    disabled={yaAgregado}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      yaAgregado
                        ? 'bg-emerald-50/50 border-emerald-200 cursor-default'
                        : 'bg-white border-slate-200 hover:border-[#0891B2] hover:shadow-md cursor-pointer'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 leading-tight">{srv.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{srv.descripcion}</p>
                        <span className={`inline-block mt-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${CATEGORIA_COLORES[srv.categoria]}`}>
                          {srv.categoria}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-[#1E40AF]">{Q(srv.precioBase)}</p>
                        {yaAgregado && <span className="text-[10px] text-emerald-600 font-medium">✓</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {catalogoFiltrado.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm text-slate-400">
                  No se encontraron servicios
                </div>
              )}
            </div>
          </div>
        )}

        {/* Items List */}
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-500 mt-2">No hay servicios</p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Descripción</div>
              <div className="col-span-1 text-center">IVA</div>
              <div className="col-span-2 text-center">Cant.</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            {items.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 px-5 py-3 border-b border-slate-100 hover:bg-slate-50/40 group transition-colors"
              >
                <div className="hidden sm:flex col-span-1 items-center gap-1">
                  <span className="text-xs text-slate-400 w-4">{idx + 1}</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moverItem(item.id, 'up')} disabled={idx === 0} className="text-[10px] text-slate-400 hover:text-slate-700 disabled:invisible leading-none">▲</button>
                    <button onClick={() => moverItem(item.id, 'down')} disabled={idx === items.length - 1} className="text-[10px] text-slate-400 hover:text-slate-700 disabled:invisible leading-none">▼</button>
                  </div>
                </div>
                <div className="sm:col-span-4">
                  <textarea
                    value={item.descripcion}
                    onChange={e => actualizarItem(item.id, 'descripcion', e.target.value)}
                    rows={1}
                    placeholder="Descripción del servicio..."
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
                    onInput={(e) => { const el = e.target as HTMLTextAreaElement; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; }}
                  />
                  {item.codigoCatalogo && <span className="text-[10px] text-[#0891B2] ml-1">{item.codigoCatalogo}</span>}
                </div>
                <div className="sm:col-span-1 flex sm:justify-center items-start pt-2">
                  <label className="flex items-center gap-1 cursor-pointer" title={item.aplica_iva ? 'Aplica IVA' : 'Exento de IVA'}>
                    <input
                      type="checkbox"
                      checked={item.aplica_iva}
                      onChange={e => actualizarItem(item.id, 'aplica_iva', e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-[#1E40AF] focus:ring-[#0891B2]/30"
                    />
                    <span className={`text-[10px] ${item.aplica_iva ? 'text-slate-500' : 'text-amber-600 font-medium'}`}>
                      {item.aplica_iva ? '12%' : 'Exento'}
                    </span>
                  </label>
                </div>
                <div className="sm:col-span-2 flex sm:justify-center items-start gap-2">
                  <label className="sm:hidden text-xs text-slate-400 pt-2">Cant:</label>
                  <input type="number" min="1" value={item.cantidad} onChange={e => actualizarItem(item.id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))} className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30" />
                </div>
                <div className="sm:col-span-2 flex sm:justify-end items-start gap-2">
                  <label className="sm:hidden text-xs text-slate-400 pt-2">Precio:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Q</span>
                    <input type="number" min="0" step="50" value={item.precio_unitario} onChange={e => actualizarItem(item.id, 'precio_unitario', Math.max(0, parseFloat(e.target.value) || 0))} className="w-24 pl-6 pr-2 py-1.5 text-sm text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30" />
                  </div>
                </div>
                <div className="sm:col-span-1 flex sm:justify-end items-start">
                  <label className="sm:hidden text-xs text-slate-400 pt-2 mr-2">Total:</label>
                  <span className="text-sm font-semibold text-slate-900 pt-1.5">{Q(item.cantidad * item.precio_unitario)}</span>
                </div>
                <div className="sm:col-span-1 flex sm:justify-end items-start">
                  <button onClick={() => eliminarItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100" title="Eliminar">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-cyan-50/20">
              <div className="flex justify-end">
                <div className="w-80 space-y-1.5">
                  <div className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Honorarios profesionales (factura)</div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal (sin IVA)</span><span className="text-slate-700">{Q(calc.subtotal)}</span></div>
                  {calc.baseGravable < calc.subtotal && (
                    <div className="flex justify-between text-sm"><span className="text-slate-500">Base gravable</span><span className="text-slate-700">{Q(calc.baseGravable)}</span></div>
                  )}
                  <div className="flex justify-between text-sm"><span className="text-slate-500">IVA (12%)</span><span className="text-slate-700">{Q(calc.iva)}</span></div>
                  <div className="flex justify-between text-sm font-semibold pt-1 border-t border-slate-200"><span className="text-slate-700">Total honorarios</span><span className="text-slate-900">{Q(calc.total)}</span></div>

                  <div className="pt-3 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Gastos del trámite (Recibo de Caja)</div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm text-slate-500 whitespace-nowrap">Monto gastos</label>
                    <div className="relative w-32">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">Q</span>
                      <input
                        type="number" min="0" step="0.01"
                        value={montoGastos}
                        onChange={e => setMontoGastos(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-6 pr-2 py-1.5 text-sm text-right border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#22D3EE]/30 focus:border-[#22D3EE]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-lg font-bold border-t-2 border-[#0F172A] pt-2 mt-2"><span className="text-[#0F172A]">TOTAL GENERAL</span><span className="text-[#0F172A]">{Q(calc.totalGeneral)}</span></div>
                  <div className="mt-2 bg-cyan-50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs"><span className="text-slate-600">Anticipo 60% (honorarios)</span><span className="font-medium text-slate-800">{Q(calc.anticipo)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-slate-600">Saldo 40% (honorarios)</span><span className="font-medium text-slate-800">{Q(calc.saldo)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ══════════ NOTA IMPORTANTE ══════════ */}
      <section className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          ⚠️ Nota importante para el cliente <span className="text-xs text-amber-600 font-normal">(visible en cotización, PDF y email)</span>
        </h3>
        <p className="text-xs text-slate-400 mb-3">Se muestra de forma destacada en la cotización, PDF y email.</p>
        <textarea
          value={notasCliente}
          onChange={e => setNotasCliente(e.target.value)}
          rows={2}
          placeholder="Ej: Se requiere adicionalmente Q6,000 + IVA por honorarios..."
          className="w-full px-4 py-3 text-sm border border-amber-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400/20 focus:border-amber-400 bg-amber-50/30"
        />
      </section>

      {/* ══════════ TÉRMINOS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">Términos y condiciones</h3>
        <textarea
          value={condiciones}
          onChange={e => setCondiciones(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        />
      </section>

      {/* ══════════ NOTAS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          Notas internas <span className="text-xs text-slate-400 font-normal">(no van en la cotización)</span>
        </h3>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Ej: Cliente referido por Lic. García, negociar si pide descuento..."
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        />
      </section>

      {/* ══════════ ACTIONS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            {items.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">{items.length} servicio{items.length > 1 ? 's' : ''}</span>
                <span className="text-xl font-bold text-[#1E40AF]">{Q(calc.total)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(`/admin/contabilidad/cotizaciones/${id}`)}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando || items.length === 0}
              className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
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
