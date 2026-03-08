// ============================================================================
// app/admin/contabilidad/cotizaciones/nueva/page.tsx
// Formulario de nueva cotización con selector de catálogo
// ============================================================================

'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { PageHeader, Q } from '@/components/admin/ui';
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

interface ClienteBusqueda {
  id: string;
  codigo: string;
  nombre: string;
  nit: string;
  email: string;
}

// ── Constants ───────────────────────────────────────────────────────────

const CONDICIONES_DEFAULT = `TÉRMINOS Y CONDICIONES

1. Si los servicios cotizados son trámites notariales o mercantiles, la cotización incluye dos consultas de seguimiento o dudas vía Teams (virtual).
2. Consultas adicionales: Q100.00 cada una.
3. NO incluye consultas ilimitadas ni asesoría fuera del alcance contratado.
4. Honorarios no incluyen gastos de registro, timbres fiscales ni aranceles.
5. Anticipo del 60% para iniciar. Saldo del 40% al finalizar.
6. Cotización válida por 30 días.

DATOS PARA PAGO:
Banco Industrial — Cuenta Monetaria No. 455-008846-4
A nombre de: Invest & Jure-Advisor, S.A.`;

// ── Form Page ───────────────────────────────────────────────────────────

export default function NuevaCotizacionPage() {
  const router = useRouter();
  const { mutate, loading: guardando, error: errorGuardar } = useMutate();

  // Client
  const [clienteId, setClienteId] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteBusqueda | null>(null);
  const [clienteBusqueda, setClienteBusqueda] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);

  // Items
  const [items, setItems] = useState<ItemForm[]>([]);

  // Catalog
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [catFiltro, setCatFiltro] = useState<CategoriaServicio | ''>('');
  const [catalogoBusqueda, setCatalogoBusqueda] = useState('');

  // CC emails
  const [ccEmails, setCcEmails] = useState('');

  // Terms
  const [condiciones, setCondiciones] = useState(CONDICIONES_DEFAULT);
  const [notasCliente, setNotasCliente] = useState('');
  const [notas, setNotas] = useState('');

  // Scheduled sending
  const [programarEnvio, setProgramarEnvio] = useState(false);
  const [envioFecha, setEnvioFecha] = useState('');
  const [envioHora, setEnvioHora] = useState('08:00');

  // Retroactive
  const [retroactiva, setRetroactiva] = useState(false);
  const [retroEstado, setRetroEstado] = useState<'enviada' | 'aceptada' | 'rechazada'>('aceptada');
  const [retroFechaEnvio, setRetroFechaEnvio] = useState('');
  const [retroFechaAceptacion, setRetroFechaAceptacion] = useState('');

  // Client search
  const clienteUrl = clienteBusqueda.length >= 2
    ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=5`
    : null;
  const { data: clientesResult } = useFetch<{ data: ClienteBusqueda[] }>(clienteUrl);

  // ── Calculations ────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const baseGravable = items
      .filter(i => i.aplica_iva)
      .reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
    const iva = Math.round(baseGravable * 0.12 * 100) / 100;
    const total = subtotal + iva;
    const anticipo = Math.round(total * 0.6 * 100) / 100;
    const saldo = Math.round(total * 0.4 * 100) / 100;
    return { subtotal, baseGravable, iva, total, anticipo, saldo };
  }, [items]);

  // ── Catalog filtering ───────────────────────────────────────────────

  const catalogoFiltrado = useMemo(() => {
    return buscarServicios(
      catalogoBusqueda,
      catFiltro || undefined,
    );
  }, [catFiltro, catalogoBusqueda]);

  // ── Item actions ────────────────────────────────────────────────────

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

  const actualizarItem = useCallback((id: string, campo: string, valor: string | number | boolean) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [campo]: valor };
      // Auto-detect aplica_iva when description changes
      if (campo === 'descripcion') {
        updated.aplica_iva = !EXENTO_KEYWORDS.test(String(valor));
      }
      return updated;
    }));
  }, []);

  const eliminarItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id).map((item, idx) => ({ ...item, orden: idx })));
  }, []);

  const moverItem = useCallback((id: string, dir: 'up' | 'down') => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === id);
      const ni = dir === 'up' ? idx - 1 : idx + 1;
      if (ni < 0 || ni >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[ni]] = [copy[ni], copy[idx]];
      return copy.map((item, i) => ({ ...item, orden: i }));
    });
  }, []);

  // ── Client selection ────────────────────────────────────────────────

  const seleccionarCliente = useCallback((c: ClienteBusqueda) => {
    setClienteId(c.id);
    setClienteSeleccionado(c);
    setClienteBusqueda('');
    setShowClienteDropdown(false);
  }, []);

  // ── Validation errors ────────────────────────────────────────────────
  const [formError, setFormError] = useState<string | null>(null);

  // ── Save (3 modes: borrador, borrador+programar, enviar ahora) ────

  const guardar = useCallback(async (modo: 'borrador' | 'programar' | 'enviar') => {
    setFormError(null);

    if (!clienteId) { setFormError('Selecciona un cliente'); return; }
    if (items.length === 0) { setFormError('Agrega al menos un servicio'); return; }
    if (items.some(i => !i.descripcion.trim() || i.precio_unitario <= 0)) {
      setFormError('Todos los items necesitan descripción y precio'); return;
    }
    if (modo === 'programar') {
      if (!envioFecha || !envioHora) {
        setFormError('Selecciona fecha y hora para el envío programado'); return;
      }
      const fechaProgramada = new Date(`${envioFecha}T${envioHora}:00`);
      if (fechaProgramada <= new Date()) {
        setFormError('La fecha de envío programado debe ser futura'); return;
      }
    }

    const body: Record<string, any> = {
      cliente_id: clienteId,
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
    };

    if (modo === 'programar') {
      body.envio_programado = true;
      body.envio_programado_fecha = new Date(`${envioFecha}T${envioHora}:00`).toISOString();
    }

    if (retroactiva) {
      body.retroactiva = true;
      body.retroactiva_estado = retroEstado;
      if (retroFechaEnvio) body.retroactiva_fecha_envio = retroFechaEnvio;
      if (retroFechaAceptacion) body.retroactiva_fecha_aceptacion = retroFechaAceptacion;
    }

    await mutate('/api/admin/contabilidad/cotizaciones', {
      body,
      onSuccess: async (data: any) => {
        if (modo === 'enviar' && !retroactiva && data?.id) {
          await mutate(`/api/admin/contabilidad/cotizaciones/${data.id}/acciones`, {
            body: { accion: 'enviar' },
          });
        }
        router.push(`/admin/contabilidad/cotizaciones/${data?.id ?? ''}`);
      },
      onError: (err: any) => setFormError(String(err)),
    });
  }, [clienteId, items, condiciones, notasCliente, notas, ccEmails, envioFecha, envioHora, retroactiva, retroEstado, retroFechaEnvio, retroFechaAceptacion, mutate, router]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader
        title="Nueva cotización"
        description="Selecciona servicios del catálogo o agrega items personalizados"
      />

      {/* ══════════ 1. CLIENTE ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">1. Cliente</h3>

        {clienteSeleccionado ? (
          <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg p-4 border border-slate-200">
            <div>
              <p className="font-medium text-slate-900">{clienteSeleccionado.nombre}</p>
              <p className="text-sm text-slate-500">
                NIT: {clienteSeleccionado.nit || 'CF'} · {clienteSeleccionado.email || 'Sin email'}
              </p>
            </div>
            <button
              onClick={() => { setClienteSeleccionado(null); setClienteId(''); }}
              className="text-xs text-red-500 hover:text-red-700 font-medium px-3 py-1 rounded-md hover:bg-red-50"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              autoFocus
              placeholder="Buscar por nombre, NIT o código..."
              value={clienteBusqueda}
              onChange={e => { setClienteBusqueda(e.target.value); setShowClienteDropdown(true); }}
              onFocus={() => setShowClienteDropdown(true)}
              className="w-full px-4 py-3 pl-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>

            {showClienteDropdown && clienteBusqueda.length >= 2 && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowClienteDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 overflow-hidden max-h-60 overflow-y-auto">
                  {clientesResult && clientesResult.data.length > 0 ? (
                    clientesResult.data.map(c => (
                      <button
                        key={c.id}
                        onClick={() => seleccionarCliente(c)}
                        className="w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <span className="font-medium text-slate-900">{c.nombre}</span>
                        <span className="text-slate-400 text-xs ml-2">{c.codigo}</span>
                        {c.nit && <span className="text-slate-400 text-xs ml-2">NIT: {c.nit}</span>}
                      </button>
                    ))
                  ) : clientesResult ? (
                    <div className="p-4 text-center">
                      <p className="text-sm text-slate-500">No se encontró cliente</p>
                      <button
                        onClick={() => router.push('/admin/clientes?nuevo=true')}
                        className="mt-2 text-sm text-[#0891B2] font-medium hover:underline"
                      >
                        + Crear cliente nuevo
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}

        {/* CC emails */}
        {clienteSeleccionado && (
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
        )}
      </section>

      {/* ══════════ 2. SERVICIOS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">2. Servicios</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCatalogo(!showCatalogo)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                showCatalogo
                  ? 'bg-[#1E40AF] text-white'
                  : 'bg-blue-50 text-[#1E40AF] hover:bg-blue-100'
              }`}
            >
              📋 Catálogo {showCatalogo ? '▲' : '▼'}
            </button>
            <button
              onClick={agregarManual}
              className="px-3 py-1.5 text-sm font-medium border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50"
            >
              + Item libre
            </button>
          </div>
        </div>

        {/* ── Catalog Picker ── */}
        {showCatalogo && (
          <div className="border-b border-slate-200 bg-gradient-to-b from-slate-50 to-white">
            <div className="px-5 pt-4 pb-2 space-y-3">
              {/* Search */}
              <input
                type="text"
                placeholder="Buscar servicio por nombre o código..."
                value={catalogoBusqueda}
                onChange={e => setCatalogoBusqueda(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
              />
              {/* Category pills */}
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

            {/* Service grid */}
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

        {/* ── Items List ── */}
        {items.length === 0 ? (
          <div className="p-10 text-center">
            <span className="text-3xl">📋</span>
            <p className="text-sm text-slate-500 mt-2">Aún no has agregado servicios</p>
            <p className="text-xs text-slate-400 mt-1">Abre el catálogo o agrega items libres</p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-2 bg-slate-50/80 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Descripción</div>
              <div className="col-span-1 text-center">IVA</div>
              <div className="col-span-2 text-center">Cant.</div>
              <div className="col-span-2 text-right">Precio</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            {/* Items */}
            {items.map((item, idx) => (
              <div
                key={item.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2 px-5 py-3 border-b border-slate-100 hover:bg-slate-50/40 group transition-colors"
              >
                {/* # + move */}
                <div className="hidden sm:flex col-span-1 items-center gap-1">
                  <span className="text-xs text-slate-400 w-4">{idx + 1}</span>
                  <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moverItem(item.id, 'up')}
                      disabled={idx === 0}
                      className="text-[10px] text-slate-400 hover:text-slate-700 disabled:invisible leading-none"
                    >▲</button>
                    <button
                      onClick={() => moverItem(item.id, 'down')}
                      disabled={idx === items.length - 1}
                      className="text-[10px] text-slate-400 hover:text-slate-700 disabled:invisible leading-none"
                    >▼</button>
                  </div>
                </div>

                {/* Description */}
                <div className="sm:col-span-4">
                  <textarea
                    value={item.descripcion}
                    onChange={e => actualizarItem(item.id, 'descripcion', e.target.value)}
                    rows={1}
                    placeholder="Descripción del servicio..."
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
                    onInput={(e) => {
                      const el = e.target as HTMLTextAreaElement;
                      el.style.height = 'auto';
                      el.style.height = el.scrollHeight + 'px';
                    }}
                  />
                  {item.codigoCatalogo && (
                    <span className="text-[10px] text-[#0891B2] ml-1">{item.codigoCatalogo}</span>
                  )}
                </div>

                {/* Aplica IVA */}
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

                {/* Quantity */}
                <div className="sm:col-span-2 flex sm:justify-center items-start gap-2">
                  <label className="sm:hidden text-xs text-slate-400 pt-2">Cant:</label>
                  <input
                    type="number"
                    min="1"
                    value={item.cantidad}
                    onChange={e => actualizarItem(item.id, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 text-sm text-center border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30"
                  />
                </div>

                {/* Price */}
                <div className="sm:col-span-2 flex sm:justify-end items-start gap-2">
                  <label className="sm:hidden text-xs text-slate-400 pt-2">Precio:</label>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Q</span>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={item.precio_unitario}
                      onChange={e => actualizarItem(item.id, 'precio_unitario', Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-24 pl-6 pr-2 py-1.5 text-sm text-right border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0891B2]/30"
                    />
                  </div>
                </div>

                {/* Line total */}
                <div className="sm:col-span-1 flex sm:justify-end items-start">
                  <label className="sm:hidden text-xs text-slate-400 pt-2 mr-2">Total:</label>
                  <span className="text-sm font-semibold text-slate-900 pt-1.5">
                    {Q(item.cantidad * item.precio_unitario)}
                  </span>
                </div>

                {/* Delete */}
                <div className="sm:col-span-1 flex sm:justify-end items-start">
                  <button
                    onClick={() => eliminarItem(item.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* ── Totals ── */}
            <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-blue-50/20">
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal (sin IVA)</span>
                    <span className="text-slate-700">{Q(calc.subtotal)}</span>
                  </div>
                  {calc.baseGravable < calc.subtotal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Base gravable</span>
                      <span className="text-slate-700">{Q(calc.baseGravable)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">IVA (12%)</span>
                    <span className="text-slate-700">{Q(calc.iva)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t-2 border-[#1E40AF] pt-2 mt-1">
                    <span className="text-[#1E40AF]">TOTAL</span>
                    <span className="text-[#1E40AF]">{Q(calc.total)}</span>
                  </div>
                  <div className="mt-2 bg-blue-50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-700">Anticipo 60%</span>
                      <span className="font-medium text-blue-800">{Q(calc.anticipo)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-700">Saldo 40%</span>
                      <span className="font-medium text-blue-800">{Q(calc.saldo)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </section>

      {/* ══════════ 3. NOTA IMPORTANTE ══════════ */}
      <section className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          3. Nota importante <span className="text-xs text-amber-600 font-normal">(visible para el cliente)</span>
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

      {/* ══════════ 4. TÉRMINOS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">4. Términos y condiciones</h3>
          <button
            onClick={() => setCondiciones(CONDICIONES_DEFAULT)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Restaurar
          </button>
        </div>
        <textarea
          value={condiciones}
          onChange={e => setCondiciones(e.target.value)}
          rows={8}
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        />
      </section>

      {/* ══════════ 5. NOTAS INTERNAS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-900 mb-3">
          5. Notas internas{' '}
          <span className="text-xs text-slate-400 font-normal">(no van en la cotización)</span>
        </h3>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Ej: Cliente referido por Lic. García, negociar si pide descuento..."
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        />
      </section>

      {/* ══════════ 6. PROGRAMAR ENVÍO ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">6. Programar envío</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={programarEnvio}
              onChange={e => setProgramarEnvio(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0891B2]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
            <span className="ml-2 text-sm text-slate-600">Programar envío automático</span>
          </label>
        </div>

        {programarEnvio && (
          <div className="flex flex-col sm:flex-row gap-3 mt-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex-1">
              <label className="block text-xs font-medium text-amber-800 mb-1">Fecha</label>
              <input
                type="date"
                value={envioFecha}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => setEnvioFecha(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              />
            </div>
            <div className="w-32">
              <label className="block text-xs font-medium text-amber-800 mb-1">Hora</label>
              <input
                type="time"
                value={envioHora}
                onChange={e => setEnvioHora(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400"
              />
            </div>
            <div className="flex items-end">
              <p className="text-xs text-amber-700">
                La cotización se enviará automáticamente en la fecha y hora seleccionadas.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ══════════ 7. REGISTRO RETROACTIVO ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">7. Registro retroactivo</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={retroactiva}
              onChange={e => { setRetroactiva(e.target.checked); if (e.target.checked) setProgramarEnvio(false); }}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0891B2]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0891B2]" />
            <span className="ml-2 text-sm text-slate-600">Cotización ya enviada</span>
          </label>
        </div>

        {retroactiva && (
          <div className="space-y-4 mt-3 p-4 bg-cyan-50 rounded-lg border border-cyan-200">
            <p className="text-xs text-cyan-700">
              Registra una cotización que ya fue enviada previamente. Se creará directamente con el estado que selecciones.
            </p>

            {/* Estado */}
            <div>
              <label className="block text-xs font-medium text-cyan-800 mb-1.5">Estado actual</label>
              <div className="flex gap-2">
                {([
                  { value: 'enviada', label: 'Enviada', icon: '📤' },
                  { value: 'aceptada', label: 'Aceptada', icon: '✅' },
                  { value: 'rechazada', label: 'Rechazada', icon: '❌' },
                ] as const).map(e => (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => setRetroEstado(e.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                      retroEstado === e.value
                        ? 'bg-white border-cyan-400 text-cyan-800 shadow-sm'
                        : 'border-transparent text-cyan-600 hover:bg-cyan-100/50'
                    }`}
                  >
                    <span>{e.icon}</span> {e.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-cyan-800 mb-1">Fecha de envío</label>
                <input
                  type="date"
                  value={retroFechaEnvio}
                  onChange={e => setRetroFechaEnvio(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-cyan-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
                />
              </div>
              {(retroEstado === 'aceptada') && (
                <div className="flex-1">
                  <label className="block text-xs font-medium text-cyan-800 mb-1">Fecha de aceptación</label>
                  <input
                    type="date"
                    value={retroFechaAceptacion}
                    onChange={e => setRetroFechaAceptacion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-cyan-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ══════════ ACTIONS ══════════ */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            {items.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {items.length} servicio{items.length > 1 ? 's' : ''}
                </span>
                <span className="text-xl font-bold text-[#1E40AF]">{Q(calc.total)}</span>
                {clienteSeleccionado && (
                  <span className="text-sm text-slate-400">→ {clienteSeleccionado.nombre}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.back()}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            {retroactiva ? (
              <button
                onClick={() => guardar('borrador')}
                disabled={guardando || !clienteId || items.length === 0}
                className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#0891B2] to-teal-600 rounded-lg hover:shadow-lg hover:shadow-teal-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {guardando ? 'Guardando...' : `Guardar como ${retroEstado}`}
              </button>
            ) : (
              <>
                <button
                  onClick={() => guardar('borrador')}
                  disabled={guardando || items.length === 0}
                  className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-30"
                >
                  {guardando ? 'Guardando...' : '💾 Guardar borrador'}
                </button>
                {programarEnvio ? (
                  <button
                    onClick={() => guardar('programar')}
                    disabled={guardando || !clienteId || items.length === 0}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg hover:shadow-lg hover:shadow-amber-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {guardando ? 'Guardando...' : '🕐 Guardar y programar envío'}
                  </button>
                ) : (
                  <button
                    onClick={() => guardar('enviar')}
                    disabled={guardando || !clienteId || items.length === 0}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg hover:shadow-blue-900/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {guardando ? 'Enviando...' : '📤 Guardar y enviar'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {(formError || errorGuardar) && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">
            {formError || errorGuardar}
          </div>
        )}
      </section>
    </div>
  );
}
