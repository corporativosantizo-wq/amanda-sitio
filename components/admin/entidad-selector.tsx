'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

interface EntidadOption {
  id: string;
  nombre: string;
  nombre_corto: string | null;
  tipo_entidad: string;
  representante_legal_nombre: string | null;
  representante_legal_cargo: string | null;
}

interface EntidadSelectorProps {
  value: EntidadOption | null;
  onChange: (entidad: EntidadOption | null) => void;
  className?: string;
}

const TIPO_LABELS: Record<string, string> = {
  sociedad_anonima: 'S.A.',
  sociedad_limitada: 'S.R.L.',
  empresa_individual: 'E.I.',
  otra: 'Otra',
};

export type { EntidadOption };

export default function EntidadSelector({ value, onChange, className }: EntidadSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EntidadOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/admin/mercantil/entidades?quick&q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, search]);

  // Load initial results when opened
  useEffect(() => {
    if (open && results.length === 0) search('');
  }, [open, results.length, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (entidad: EntidadOption) => {
    onChange(entidad);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange(null);
    setQuery('');
  };

  return (
    <div ref={ref} className={`relative ${className ?? ''}`}>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        Entidad mercantil
        <span className="text-slate-400 font-normal ml-1">(opcional)</span>
      </label>

      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 text-sm border border-[#0891B2]/30 bg-[#0891B2]/5 rounded-lg">
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
            {TIPO_LABELS[value.tipo_entidad] ?? value.tipo_entidad}
          </span>
          <span className="font-medium text-slate-800 truncate">
            {value.nombre_corto ?? value.nombre}
          </span>
          <button
            onClick={handleClear}
            className="ml-auto p-0.5 text-slate-400 hover:text-red-500 transition-colors"
            type="button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <input
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2] bg-white"
          placeholder="Buscar entidad por nombre o NIT..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
      )}

      {open && !value && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400">
              {query ? 'Sin resultados' : 'No hay entidades registradas'}
            </div>
          ) : (
            results.map((e: EntidadOption) => (
              <button
                key={e.id}
                type="button"
                onClick={() => handleSelect(e)}
                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                    {TIPO_LABELS[e.tipo_entidad] ?? e.tipo_entidad}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {e.nombre_corto ?? e.nombre}
                  </span>
                </div>
                {e.representante_legal_nombre && (
                  <div className="text-xs text-slate-400 mt-0.5 ml-[3.5rem]">
                    RL: {e.representante_legal_nombre}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
