// ============================================================================
// components/admin/email-chips.tsx
// Input tipo chips/tags para capturar múltiples emails.
// Escribir un email + Enter (o coma) lo agrega; la X lo quita.
// ============================================================================

'use client';

import { useState } from 'react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailChipsProps {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
}

export function EmailChips({ value, onChange, placeholder }: EmailChipsProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = (raw: string) => {
    const email = raw.trim().toLowerCase().replace(/,$/, '');
    if (!email) return;
    if (!EMAIL_RE.test(email)) { setError('Email inválido'); return; }
    if (value.includes(email)) { setError('Email duplicado'); setDraft(''); return; }
    onChange([...value, email]);
    setDraft('');
    setError(null);
  };

  const remove = (email: string) => onChange(value.filter((e) => e !== email));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      remove(value[value.length - 1]);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 w-full px-2.5 py-2 text-sm border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-[#0891B2]/20 focus-within:border-[#0891B2] bg-white">
        {value.map((email) => (
          <span
            key={email}
            className="inline-flex items-center gap-1 bg-cyan-50 text-[#0891B2] text-xs font-medium px-2 py-1 rounded-md"
          >
            {email}
            <button
              type="button"
              onClick={() => remove(email)}
              className="text-[#0891B2]/60 hover:text-red-600 leading-none"
              aria-label={`Quitar ${email}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(null); }}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={value.length === 0 ? (placeholder ?? 'correo@ejemplo.com') : ''}
          className="flex-1 min-w-[140px] outline-none bg-transparent py-1"
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      <p className="text-xs text-slate-400 mt-1">Escribe un email y presiona Enter para agregarlo.</p>
    </div>
  );
}
