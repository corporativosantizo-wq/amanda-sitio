// ============================================================================
// app/admin/plantillas/page.tsx
// Lista de plantillas de documentos con tarjetas, filtros y acciones
// ============================================================================
'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';

interface Plantilla {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  campos: { id: string; label: string; tipo: string; requerido: boolean }[];
  activa: boolean;
  archivo_original: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  data: Plantilla[];
  total: number;
  totalPages: number;
}

const TABS = [
  { key: 'activas', label: 'Activas' },
  { key: 'inactivas', label: 'Inactivas' },
  { key: 'todas', label: 'Todas' },
] as const;

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  contrato:  { bg: 'bg-blue-50',    text: 'text-blue-700' },
  demanda:   { bg: 'bg-red-50',     text: 'text-red-700' },
  acta:      { bg: 'bg-purple-50',  text: 'text-purple-700' },
  escritura: { bg: 'bg-amber-50',   text: 'text-amber-700' },
  memorial:  { bg: 'bg-orange-50',  text: 'text-orange-700' },
  recurso:   { bg: 'bg-pink-50',    text: 'text-pink-700' },
  poder:     { bg: 'bg-indigo-50',  text: 'text-indigo-700' },
  general:   { bg: 'bg-slate-100',  text: 'text-slate-600' },
  otro:      { bg: 'bg-slate-100',  text: 'text-slate-600' },
};

const TIPO_ICONS: Record<string, string> = {
  contrato: '📝', demanda: '⚖️', acta: '📋', escritura: '📜',
  memorial: '📑', recurso: '🔄', poder: '🔑', general: '📄', otro: '📄',
};

function getColors(tipo: string) {
  return TIPO_COLORS[tipo] || TIPO_COLORS.otro;
}

export default function PlantillasPage() {
  const [tab, setTab] = useState<string>('activas');
  const [busqueda, setBusqueda] = useState('');
  const { mutate } = useMutate();

  const activaParam = tab === 'activas' ? 'true' : tab === 'inactivas' ? 'false' : '';
  const params = new URLSearchParams();
  if (activaParam) params.set('activa', activaParam);
  if (busqueda) params.set('q', busqueda);
  params.set('limit', '100');

  const { data, loading, refetch } = useFetch<ListResponse>(
    `/api/admin/plantillas?${params.toString()}`
  );

  const plantillas = data?.data || [];

  const toggleActiva = useCallback(async (id: string, activa: boolean) => {
    await mutate(`/api/admin/plantillas/${id}`, {
      method: 'PUT' as any,
      body: { activa: !activa },
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  const eliminar = useCallback(async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar la plantilla "${nombre}"? Esta acción no se puede deshacer.`)) return;
    await mutate(`/api/admin/plantillas/${id}`, {
      method: 'DELETE',
      onSuccess: () => refetch(),
    });
  }, [mutate, refetch]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Plantillas</h1>
          <p className="text-sm text-slate-500 mt-1">
            {data ? `${data.total} plantilla${data.total !== 1 ? 's' : ''}` : 'Cargando...'}
          </p>
        </div>
        <Link
          href="/admin/plantillas/nueva"
          className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2] hover:opacity-90 transition-opacity"
        >
          + Nueva plantilla
        </Link>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === t.key
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar plantillas..."
          value={busqueda}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusqueda(e.target.value)}
          className="px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] w-full sm:w-64"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <div className="text-4xl mb-4">📄</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay plantillas</h3>
          <p className="text-sm text-slate-500 mb-4">
            Sube un documento .docx y el sistema extraerá los campos variables automáticamente.
          </p>
          <Link
            href="/admin/plantillas/nueva"
            className="inline-block px-4 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-[#1E40AF] to-[#0891B2]"
          >
            Crear primera plantilla
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plantillas.map((p: Plantilla) => {
            const colors = getColors(p.tipo);
            const icon = TIPO_ICONS[p.tipo] || TIPO_ICONS.otro;
            return (
              <div
                key={p.id}
                className={`bg-white rounded-xl border shadow-sm p-5 transition-all hover:shadow-md ${
                  p.activa ? 'border-slate-200' : 'border-slate-200 opacity-60'
                }`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl">{icon}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
                    {p.tipo}
                  </span>
                </div>

                {/* Info */}
                <h3 className="text-base font-semibold text-slate-900 mb-1 line-clamp-2">
                  {p.nombre}
                </h3>
                {p.descripcion && (
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{p.descripcion}</p>
                )}

                {/* Meta */}
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                  <span>{p.campos.length} campo{p.campos.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{new Date(p.created_at).toLocaleDateString('es-GT')}</span>
                  <span>·</span>
                  <span className={`flex items-center gap-1 ${p.activa ? 'text-emerald-600' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.activa ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    {p.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => toggleActiva(p.id, p.activa)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      p.activa
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {p.activa ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => eliminar(p.id, p.nombre)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
