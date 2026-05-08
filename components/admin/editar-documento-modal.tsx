// ============================================================================
// components/admin/editar-documento-modal.tsx
// Modal para editar metadata de un documento: título, tipo, cliente,
// número (codigo_documento) y fecha. Crítico para reasignar documentos al
// cliente correcto cuando la asistente los asigna mal.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';

const TIPOS: Array<{ value: string; label: string }> = [
  { value: 'acta_notarial',       label: 'Acta Notarial' },
  { value: 'escritura_publica',   label: 'Escritura Pública' },
  { value: 'testimonio',          label: 'Testimonio' },
  { value: 'contrato_comercial',  label: 'Contrato Comercial' },
  { value: 'contrato_laboral',    label: 'Contrato Laboral' },
  { value: 'poder',               label: 'Poder' },
  { value: 'demanda_memorial',    label: 'Demanda / Memorial' },
  { value: 'resolucion_judicial', label: 'Resolución Judicial' },
  { value: 'otro',                label: 'Otro' },
];

export interface DocumentoParaEditar {
  id: string;
  titulo: string | null;
  tipo: string | null;
  cliente_id: string | null;
  codigo_documento: string | null;
  fecha_documento: string | null;
  cliente?: { id: string; codigo: string; nombre: string } | null;
}

interface ClienteOpcion {
  id: string;
  codigo: string;
  nombre: string;
}

export function EditarDocumentoModal({
  documento,
  onClose,
  onSuccess,
}: {
  documento: DocumentoParaEditar;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { mutate } = useMutate();

  const [titulo, setTitulo]                     = useState(documento.titulo ?? '');
  const [tipo, setTipo]                         = useState(documento.tipo ?? '');
  const [clienteId, setClienteId]               = useState(documento.cliente_id ?? '');
  const [clienteBusqueda, setClienteBusqueda]   = useState(documento.cliente?.nombre ?? '');
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteOpcion | null>(
    documento.cliente
      ? { id: documento.cliente.id, codigo: documento.cliente.codigo, nombre: documento.cliente.nombre }
      : null,
  );
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [codigo, setCodigo]                     = useState(documento.codigo_documento ?? '');
  const [fecha, setFecha]                       = useState(
    documento.fecha_documento ? documento.fecha_documento.slice(0, 10) : '',
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // Búsqueda de cliente
  const clienteUrl = clienteBusqueda.length >= 2 && (!clienteSeleccionado || clienteSeleccionado.nombre !== clienteBusqueda)
    ? `/api/admin/clientes?q=${encodeURIComponent(clienteBusqueda)}&limit=8`
    : null;
  const { data: clientesResult } = useFetch<{ data: ClienteOpcion[] }>(clienteUrl);
  const clientesEncontrados = clientesResult?.data ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !guardando) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, guardando]);

  const seleccionarCliente = (c: ClienteOpcion) => {
    setClienteId(c.id);
    setClienteSeleccionado(c);
    setClienteBusqueda(c.nombre);
    setShowClienteDropdown(false);
  };

  const limpiarCliente = () => {
    setClienteId('');
    setClienteSeleccionado(null);
    setClienteBusqueda('');
  };

  const guardar = async () => {
    setError(null);
    setGuardando(true);
    let ok = false;
    await mutate(`/api/admin/documentos/${documento.id}`, {
      method: 'PATCH',
      body: {
        titulo:           titulo.trim() || null,
        tipo:             tipo || null,
        cliente_id:       clienteId || null,
        codigo_documento: codigo.trim() || null,
        fecha_documento:  fecha || null,
      },
      onSuccess: () => { ok = true; },
      onError:   (err: unknown) => setError(typeof err === 'string' ? err : 'Error al guardar'),
    });
    setGuardando(false);
    if (ok) onSuccess();
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => { if (!guardando) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Editar documento</h2>
          <button
            onClick={onClose}
            disabled={guardando}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none disabled:opacity-30"
            aria-label="Cerrar"
          >×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Escritura constitutiva — Empresa XYZ"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de documento</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2] bg-white"
            >
              <option value="">— Sin tipo —</option>
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Cliente asignado <span className="text-slate-400 font-normal">(reasignar si está mal)</span>
            </label>
            {clienteSeleccionado && !showClienteDropdown ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 text-sm">{clienteSeleccionado.nombre}</p>
                  <p className="text-xs text-slate-500">{clienteSeleccionado.codigo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowClienteDropdown(true)}
                    className="text-xs text-[#0891B2] hover:underline"
                  >Cambiar</button>
                  <button
                    type="button"
                    onClick={limpiarCliente}
                    className="text-xs text-slate-400 hover:text-red-600"
                    title="Quitar cliente"
                  >×</button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  value={clienteBusqueda}
                  onChange={e => { setClienteBusqueda(e.target.value); setShowClienteDropdown(true); }}
                  onFocus={() => setShowClienteDropdown(true)}
                  placeholder="Buscar cliente por nombre o código…"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
                />
                {showClienteDropdown && clientesEncontrados.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {clientesEncontrados.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-cyan-50/50 transition-colors border-b border-slate-100 last:border-b-0"
                      >
                        <p className="font-medium text-slate-900">{c.nombre}</p>
                        <p className="text-xs text-slate-500">{c.codigo}</p>
                      </button>
                    ))}
                  </div>
                )}
                {clienteSeleccionado && (
                  <button
                    type="button"
                    onClick={() => setShowClienteDropdown(false)}
                    className="mt-1 text-xs text-slate-400 hover:text-slate-600"
                  >Cancelar cambio</button>
                )}
              </div>
            )}
          </div>

          {/* Número y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Número de documento</label>
              <input
                type="text"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                placeholder="Ej: 1234"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha del documento</label>
              <input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]"
              />
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={guardando}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-30"
          >Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0891B2] hover:bg-[#0E7490] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
