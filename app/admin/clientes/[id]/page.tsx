// ============================================================================
// app/admin/clientes/[id]/page.tsx
// Detalle de cliente con stats y actividad reciente
// ============================================================================

'use client';

import { useRouter, useParams } from 'next/navigation';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { Badge, Section, Q, Skeleton, EmptyState } from '@/components/admin/ui';

interface ClienteDetalle {
  id: string;
  codigo: string;
  tipo: string;
  nombre: string;
  nit: string;
  dpi: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  razon_social_facturacion: string;
  nit_facturacion: string;
  direccion_facturacion: string;
  notas: string | null;
  activo: boolean;
  created_at: string;
  stats: {
    cotizaciones: number;
    facturas: number;
    total_pagado: number;
  };
}

export default function ClienteDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: c, loading, error, refetch } = useFetch<ClienteDetalle>(
    `/api/admin/clientes/${id}`
  );
  const { mutate } = useMutate();

  if (loading) return (
    <div className="space-y-4 max-w-4xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (error || !c) return (
    <EmptyState icon="❌" title="Cliente no encontrado"
      action={{ label: 'Volver', onClick: () => router.push('/admin/clientes') }} />
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <button onClick={() => router.push('/admin/clientes')}
            className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-block">← Clientes</button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
              c.tipo === 'empresa' ? 'bg-blue-100' : 'bg-slate-100'
            }`}>{c.tipo === 'empresa' ? '🏢' : '👤'}</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{c.nombre}</h1>
              <p className="text-sm text-slate-500">{c.codigo} · NIT: {c.nit} · {c.tipo}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/admin/clientes/${id}/editar`)}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">✏️ Editar</button>
          <button onClick={() => router.push(`/admin/contabilidad/cotizaciones/nueva?cliente_id=${id}`)}
            className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
            + Nueva cotización
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{c.stats.cotizaciones}</p>
          <p className="text-xs text-slate-500 mt-1">Cotizaciones</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{c.stats.facturas}</p>
          <p className="text-xs text-slate-500 mt-1">Facturas</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{Q(c.stats.total_pagado)}</p>
          <p className="text-xs text-slate-500 mt-1">Total pagado</p>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact info */}
        <Section title="Información de contacto">
          <div className="space-y-3 text-sm">
            <InfoRow label="Email" value={c.email} href={c.email ? `mailto:${c.email}` : undefined} />
            <InfoRow label="Teléfono" value={c.telefono} href={c.telefono ? `tel:${c.telefono}` : undefined} />
            <InfoRow label="Dirección" value={c.direccion} />
            {c.dpi && <InfoRow label="DPI" value={c.dpi} mono />}
            <InfoRow label="Desde" value={new Date(c.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })} />
          </div>
        </Section>

        {/* Billing info */}
        <Section title="Datos de facturación">
          <div className="space-y-3 text-sm">
            <InfoRow label="Razón social" value={c.razon_social_facturacion} />
            <InfoRow label="NIT facturación" value={c.nit_facturacion} mono />
            <InfoRow label="Dirección facturación" value={c.direccion_facturacion} />
          </div>
        </Section>
      </div>

      {/* Notes */}
      {c.notas && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-amber-800 mb-2">📌 Notas</h3>
          <p className="text-sm text-amber-700">{c.notas}</p>
        </div>
      )}

      {/* Quick links */}
      <Section title="Actividad">
        <div className="flex flex-wrap gap-2">
          <QuickLink href={`/admin/contabilidad/cotizaciones?cliente_id=${id}`} icon="📄" label="Ver cotizaciones" />
          <QuickLink href={`/admin/contabilidad/facturas?cliente_id=${id}`} icon="🧾" label="Ver facturas" />
          <QuickLink href={`/admin/contabilidad/pagos?cliente_id=${id}`} icon="💰" label="Ver pagos" />
        </div>
      </Section>
    </div>
  );
}

function InfoRow({ label, value, href, mono }: {
  label: string; value: string | null; href?: string; mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      {href ? (
        <a href={href} className="text-[#0891B2] hover:underline font-medium">{value}</a>
      ) : (
        <span className={`text-slate-900 ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</span>
      )}
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a href={href}
      className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-2">
      <span>{icon}</span>
      <span className="text-slate-700">{label}</span>
    </a>
  );
}
