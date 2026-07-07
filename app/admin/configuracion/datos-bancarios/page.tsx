// ============================================================================
// app/admin/configuracion/datos-bancarios/page.tsx
// Datos de transferencia Mercury Bank (pagos de clientes internacionales).
// Se guardan en legal.configuracion; el recuadro de pago de los correos EN
// aparece solo cuando los 4 campos principales están completos.
// ============================================================================

'use client';

import { useEffect, useState } from 'react';
import { useFetch } from '@/lib/hooks/use-fetch';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { PageHeader, Section } from '@/components/admin/ui';

interface DatosBancarios {
  id: string;
  banco: string | null;
  numero_cuenta: string | null;
  cuenta_nombre: string | null;
  mercury_beneficiario: string | null;
  mercury_numero_cuenta: string | null;
  mercury_routing: string | null;
  mercury_swift: string | null;
  mercury_banco_nombre: string | null;
  mercury_banco_direccion: string | null;
  updated_at: string | null;
}

interface FormState {
  mercury_beneficiario: string;
  mercury_numero_cuenta: string;
  mercury_routing: string;
  mercury_swift: string;
  mercury_banco_nombre: string;
  mercury_banco_direccion: string;
}

const CAMPOS: { key: keyof FormState; label: string; requerido: boolean; placeholder: string; hint?: string }[] = [
  { key: 'mercury_beneficiario', label: 'Beneficiario', requerido: true, placeholder: 'Nombre exacto del titular de la cuenta Mercury' },
  { key: 'mercury_numero_cuenta', label: 'Número de cuenta', requerido: true, placeholder: 'Account number' },
  { key: 'mercury_routing', label: 'Routing number', requerido: true, placeholder: 'ACH / wire doméstico (9 dígitos)' },
  { key: 'mercury_swift', label: 'SWIFT / BIC', requerido: true, placeholder: 'Para wires internacionales' },
  { key: 'mercury_banco_nombre', label: 'Banco receptor', requerido: false, placeholder: 'Partner bank de Mercury (opcional)', hint: 'Aparece en el dashboard de Mercury en "Account details".' },
  { key: 'mercury_banco_direccion', label: 'Dirección del banco', requerido: false, placeholder: 'Opcional — la piden algunos bancos emisores' },
];

const FORM_VACIO: FormState = {
  mercury_beneficiario: '',
  mercury_numero_cuenta: '',
  mercury_routing: '',
  mercury_swift: '',
  mercury_banco_nombre: '',
  mercury_banco_direccion: '',
};

export default function DatosBancariosPage() {
  const { data, loading, refetch } = useFetch<{ data: DatosBancarios }>(
    '/api/admin/configuracion/datos-bancarios',
  );
  const config = data?.data;

  const [form, setForm] = useState<FormState>(FORM_VACIO);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!config) return;
    setForm({
      mercury_beneficiario: config.mercury_beneficiario ?? '',
      mercury_numero_cuenta: config.mercury_numero_cuenta ?? '',
      mercury_routing: config.mercury_routing ?? '',
      mercury_swift: config.mercury_swift ?? '',
      mercury_banco_nombre: config.mercury_banco_nombre ?? '',
      mercury_banco_direccion: config.mercury_banco_direccion ?? '',
    });
  }, [config]);

  const avisar = (message: string, type: 'success' | 'error') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const completo = CAMPOS.filter(c => c.requerido).every(c => form[c.key].trim() !== '');

  const guardar = async () => {
    setSaving(true);
    try {
      const res = await adminFetch('/api/admin/configuracion/datos-bancarios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `Error (${res.status})`);
      avisar('Datos guardados. Los próximos correos EN llevan la información actualizada.', 'success');
      refetch();
    } catch (err: any) {
      avisar(err.message ?? 'Error al guardar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/30 focus:border-[#0891B2]';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Datos bancarios"
        description="Cuenta Mercury Bank (USD) para transferencias de clientes internacionales. Se muestran en el recuadro de pago de los correos en inglés."
      />

      {loading ? (
        <div className="h-40 bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <>
          <Section title="🏦 Mercury Bank — transferencias en USD (correos EN)">
            <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${completo
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {completo
                ? '✅ Datos completos: el recuadro de transferencia Mercury está VISIBLE en los correos en inglés.'
                : '⏳ Faltan datos: los correos en inglés muestran "Bank transfer — coming soon". El recuadro aparece al completar Beneficiario, Cuenta, Routing y SWIFT.'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CAMPOS.map(c => (
                <div key={c.key} className={c.key === 'mercury_banco_direccion' ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {c.label} {c.requerido ? '*' : <span className="text-slate-400 font-normal">(opcional)</span>}
                  </label>
                  <input
                    type="text"
                    value={form[c.key]}
                    onChange={e => setForm(f => ({ ...f, [c.key]: e.target.value }))}
                    placeholder={c.placeholder}
                    className={`${inputCls} font-mono`}
                  />
                  {c.hint && <p className="text-xs text-slate-400 mt-1">{c.hint}</p>}
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Verificá el resultado en{' '}
                <a href="/api/admin/plantillas/preview?tpl=solicitud_pago&lang=en" target="_blank" className="text-[#0891B2] hover:underline">
                  el preview de plantillas EN
                </a>{' '}
                antes de enviar nada a clientes.
              </p>
              <button
                onClick={guardar}
                disabled={saving}
                className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg disabled:opacity-40"
              >
                {saving ? 'Guardando…' : 'Guardar datos Mercury'}
              </button>
            </div>
          </Section>

          <Section title="🇬🇹 Banco Industrial — transferencias en Q (correos ES)">
            <div className="text-sm text-slate-600 space-y-1">
              <p><span className="font-medium text-slate-900">{config?.banco ?? 'Banco Industrial'}</span> — Cuenta {config?.numero_cuenta ?? '—'}</p>
              <p>A nombre de: {config?.cuenta_nombre ?? '—'}</p>
              <p className="text-xs text-slate-400 mt-2">
                Solo lectura por ahora: las plantillas en español usan estos datos (con respaldo fijo en el código). Si la cuenta local cambia, avisá para actualizar ambos lugares.
              </p>
            </div>
          </Section>
        </>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-50">
          <div className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
