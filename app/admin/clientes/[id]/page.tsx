// ============================================================================
// app/admin/clientes/[id]/page.tsx
// Detalle completo de cliente con edición inline, tabs y acciones rápidas
// ============================================================================

'use client';

import { useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import { Section, Badge, Q, Skeleton, EmptyState } from '@/components/admin/ui';

// ── Types ───────────────────────────────────────────────────────────────────

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
  citas: CitaRow[];
  documentos: DocRow[];
  pagos: PagoRow[];
  cotizaciones: CotizacionRow[];
}

interface CitaRow {
  id: string;
  tipo: string;
  titulo: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  costo: number;
}

interface DocRow {
  id: string;
  nombre_archivo: string;
  titulo: string | null;
  tipo: string;
  estado: string;
  created_at: string;
}

interface CotizacionRow {
  id: string;
  numero: string;
  fecha_emision: string;
  estado: string;
  total: number;
  pdf_url: string | null;
}

interface PagoRow {
  id: string;
  monto: number;
  estado: string;
  fecha: string;
  concepto: string | null;
  metodo: string | null;
}

type TabKey = 'datos' | 'citas' | 'documentos' | 'cotizaciones' | 'pagos' | 'notas';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'datos', label: 'Datos generales', icon: '👤' },
  { key: 'citas', label: 'Citas', icon: '📅' },
  { key: 'documentos', label: 'Documentos', icon: '📁' },
  { key: 'cotizaciones', label: 'Cotizaciones', icon: '📋' },
  { key: 'pagos', label: 'Pagos', icon: '💰' },
  { key: 'notas', label: 'Notas', icon: '📝' },
];

const INPUT = 'w-full px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]';
// ── Page ────────────────────────────────────────────────────────────────────

export default function ClienteDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data: c, loading, error, refetch } = useFetch<ClienteDetalle>(
    `/api/admin/clientes/${id}`
  );
  const { mutate, loading: saving } = useMutate();

  const [tab, setTab] = useState<TabKey>('datos');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const startEdit = useCallback(() => {
    if (!c) return;
    setForm({
      nombre: c.nombre,
      nit: c.nit,
      dpi: c.dpi ?? '',
      email: c.email ?? '',
      telefono: c.telefono ?? '',
      direccion: c.direccion ?? '',
      razon_social_facturacion: c.razon_social_facturacion ?? '',
      nit_facturacion: c.nit_facturacion ?? '',
      direccion_facturacion: c.direccion_facturacion ?? '',
    });
    setEditing(true);
    setSaveError(null);
  }, [c]);

  const cancelEdit = () => {
    setEditing(false);
    setSaveError(null);
  };

  const saveEdit = useCallback(async () => {
    setSaveError(null);
    if (!form.nombre?.trim()) { setSaveError('El nombre es obligatorio'); return; }

    await mutate(`/api/admin/clientes/${id}`, {
      method: 'PATCH',
      body: {
        nombre: form.nombre.trim(),
        nit: form.nit.trim() || 'CF',
        dpi: form.dpi.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        razon_social_facturacion: form.razon_social_facturacion.trim() || form.nombre.trim(),
        nit_facturacion: form.nit_facturacion.trim() || form.nit.trim() || 'CF',
        direccion_facturacion: form.direccion_facturacion.trim() || 'Ciudad',
      },
      onSuccess: () => { setEditing(false); refetch(); },
      onError: (err) => setSaveError(err),
    });
  }, [form, id, mutate, refetch]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    await mutate(`/api/admin/clientes/${id}`, {
      method: 'DELETE',
      onSuccess: () => router.push('/admin/clientes'),
      onError: (err) => { alert(`Error: ${err}`); setDeleting(false); setShowDeleteModal(false); },
    });
  }, [id, mutate, router]);

  // ── Loading / Error ─────────────────────────────────────────────────────

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (error || !c) return (
    <EmptyState icon="❌" title="Cliente no encontrado"
      action={{ label: 'Volver a clientes', onClick: () => router.push('/admin/clientes') }} />
  );

  // ── Stats ───────────────────────────────────────────────────────────────

  const totalPagado = c.stats.total_pagado;
  const saldoPendiente = (c.citas ?? [])
    .filter((ci: CitaRow) => ci.estado !== 'cancelada')
    .reduce((s: number, ci: CitaRow) => s + (ci.costo ?? 0), 0) - totalPagado;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <button onClick={() => router.push('/admin/clientes')}
          className="text-sm text-slate-500 hover:text-slate-700 mb-2 inline-flex items-center gap-1">
          ← Clientes
        </button>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${
              c.tipo === 'empresa' ? 'bg-blue-100' : 'bg-slate-100'
            }`}>{c.tipo === 'empresa' ? '🏢' : '👤'}</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{c.nombre}</h1>
              <p className="text-sm text-slate-500">
                {c.codigo} · NIT: {c.nit} · {c.tipo === 'empresa' ? 'Empresa' : 'Individual'}
                {!c.activo && <Badge variant="danger" className="ml-2">Inactivo</Badge>}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {c.email && (
              <Link href={`/admin/ai?prompt=Mándale un email a ${c.nombre}`}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5">
                ✉️ Enviar email
              </Link>
            )}
            <Link href={`/admin/calendario?accion=nueva&cliente_id=${id}`}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5">
              📅 Agendar cita
            </Link>
            <Link href={`/admin/ai?prompt=Genera una cotización para ${c.nombre}`}
              className="px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all inline-flex items-center gap-1.5">
              + Cotización
            </Link>
            {c.activo && (
              <button onClick={() => setShowDeleteModal(true)}
                className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors inline-flex items-center gap-1.5">
                Desactivar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Cotizaciones" value={String(c.stats.cotizaciones)} />
        <StatCard label="Facturas" value={String(c.stats.facturas)} />
        <StatCard label="Total pagado" value={Q(totalPagado)} accent="emerald" />
        <StatCard label="Saldo pendiente" value={Q(Math.max(0, saldoPendiente))}
          accent={saldoPendiente > 0 ? 'amber' : 'emerald'} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px ${
              tab === t.key
                ? 'border-[#0891B2] text-[#0891B2]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <span className="mr-1.5">{t.icon}</span>{t.label}
            {t.key === 'citas' && c.citas.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c.citas.length}</span>
            )}
            {t.key === 'documentos' && c.documentos.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c.documentos.length}</span>
            )}
            {t.key === 'cotizaciones' && c.cotizaciones.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c.cotizaciones.length}</span>
            )}
            {t.key === 'pagos' && c.pagos.length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c.pagos.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'datos' && (
        <TabDatos c={c} editing={editing} form={form} set={set}
          onStartEdit={startEdit} onCancel={cancelEdit} onSave={saveEdit}
          saving={saving} saveError={saveError} />
      )}
      {tab === 'citas' && <TabCitas citas={c.citas} clienteId={id} />}
      {tab === 'documentos' && <TabDocumentos documentos={c.documentos} />}
      {tab === 'cotizaciones' && <TabCotizaciones cotizaciones={c.cotizaciones} clienteNombre={c.nombre} />}
      {tab === 'pagos' && <TabPagos pagos={c.pagos} clienteId={id} />}
      {tab === 'notas' && <TabNotas c={c} id={id} mutate={mutate} refetch={refetch} />}

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Desactivar cliente</h3>
            <p className="text-sm text-slate-600 mb-1">
              Se desactivará a <strong>{c.nombre}</strong>. Sus citas, documentos y pagos se mantendrán en el sistema.
            </p>
            <p className="text-xs text-slate-400 mb-5">Esta acción se puede revertir reactivando al cliente.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Datos generales ────────────────────────────────────────────────────

function TabDatos({ c, editing, form, set, onStartEdit, onCancel, onSave, saving, saveError }: {
  c: ClienteDetalle;
  editing: boolean;
  form: Record<string, string>;
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
}) {
  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!editing ? (
          <button onClick={onStartEdit}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            ✏️ Editar datos
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={onSave} disabled={saving}
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>

      {saveError && (
        <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-200">{saveError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Contact */}
        <Section title="Información de contacto">
          <div className="space-y-4">
            <Field label="Nombre completo" value={c.nombre} editValue={form.nombre} editing={editing} onChange={set('nombre')} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIT" value={c.nit} editValue={form.nit} editing={editing} onChange={set('nit')} mono />
              {(c.tipo === 'persona' || form.dpi) && (
                <Field label="DPI" value={c.dpi} editValue={form.dpi} editing={editing} onChange={set('dpi')} mono />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email" value={c.email} editValue={form.email} editing={editing} onChange={set('email')} type="email" />
              <Field label="Teléfono" value={c.telefono} editValue={form.telefono} editing={editing} onChange={set('telefono')} type="tel" />
            </div>
            <Field label="Dirección" value={c.direccion} editValue={form.direccion} editing={editing} onChange={set('direccion')} />
          </div>
        </Section>

        {/* Billing */}
        <Section title="Datos de facturación">
          <div className="space-y-4">
            <Field label="Razón social" value={c.razon_social_facturacion} editValue={form.razon_social_facturacion} editing={editing} onChange={set('razon_social_facturacion')} />
            <Field label="NIT facturación" value={c.nit_facturacion} editValue={form.nit_facturacion} editing={editing} onChange={set('nit_facturacion')} mono />
            <Field label="Dirección facturación" value={c.direccion_facturacion} editValue={form.direccion_facturacion} editing={editing} onChange={set('direccion_facturacion')} />
          </div>
        </Section>
      </div>

      {/* Meta */}
      <div className="text-xs text-slate-400 flex gap-4">
        <span>Creado: {new Date(c.created_at).toLocaleDateString('es-GT', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        <span>ID: {c.id}</span>
      </div>
    </div>
  );
}

// ── Tab: Citas ──────────────────────────────────────────────────────────────

function TabCitas({ citas, clienteId }: { citas: CitaRow[]; clienteId: string }) {
  if (!citas.length) return (
    <EmptyState icon="📅" title="Sin citas registradas" description="Este cliente no tiene citas agendadas"
      action={{ label: '+ Agendar cita', onClick: () => window.location.href = `/admin/calendario?accion=nueva&cliente_id=${clienteId}` }} />
  );

  return (
    <Section title={`Citas (${citas.length})`} noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {['Fecha', 'Hora', 'Título', 'Tipo', 'Estado', 'Costo'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {citas.map((ci: CitaRow) => (
              <tr key={ci.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-sm text-slate-700">{ci.fecha}</td>
                <td className="py-3 px-4 text-sm text-slate-600 font-mono">{ci.hora_inicio}-{ci.hora_fin}</td>
                <td className="py-3 px-4 text-sm font-medium text-slate-900">{ci.titulo}</td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ci.tipo === 'consulta_nueva' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                  }`}>{ci.tipo === 'consulta_nueva' ? 'Consulta' : 'Seguimiento'}</span>
                </td>
                <td className="py-3 px-4"><Badge variant={ci.estado as any}>{ci.estado}</Badge></td>
                <td className="py-3 px-4 text-sm text-slate-700">{Q(ci.costo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Tab: Documentos ─────────────────────────────────────────────────────────

function TabDocumentos({ documentos }: { documentos: DocRow[] }) {
  if (!documentos.length) return (
    <EmptyState icon="📁" title="Sin documentos" description="No hay documentos clasificados para este cliente" />
  );

  return (
    <Section title={`Documentos (${documentos.length})`} noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {['Archivo', 'Título', 'Tipo', 'Estado', 'Fecha'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documentos.map((d: DocRow) => (
              <tr key={d.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-sm font-medium text-slate-900 max-w-[200px] truncate">{d.nombre_archivo}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{d.titulo ?? '—'}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{d.tipo ?? '—'}</td>
                <td className="py-3 px-4"><Badge variant={d.estado as any}>{d.estado}</Badge></td>
                <td className="py-3 px-4 text-sm text-slate-500">
                  {new Date(d.created_at).toLocaleDateString('es-GT')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Tab: Cotizaciones ────────────────────────────────────────────────────────

const ESTADO_COT_BADGE: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-700',
  enviada: 'bg-blue-100 text-blue-700',
  aceptada: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  vencida: 'bg-amber-100 text-amber-700',
};

function TabCotizaciones({ cotizaciones, clienteNombre }: { cotizaciones: CotizacionRow[]; clienteNombre: string }) {
  if (!cotizaciones.length) return (
    <EmptyState icon="📋" title="Sin cotizaciones" description="Este cliente no tiene cotizaciones"
      action={{ label: '+ Nueva cotización', onClick: () => window.location.href = `/admin/ai?prompt=Genera una cotización para ${clienteNombre}` }} />
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <Section title={`Cotizaciones (${cotizaciones.length})`} noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {['Número', 'Fecha', 'Estado', 'Total', 'PDF'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cotizaciones.map((cot: CotizacionRow) => (
              <tr key={cot.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 text-sm font-medium text-slate-900 font-mono">{cot.numero}</td>
                <td className="py-3 px-4 text-sm text-slate-600">
                  {new Date(cot.fecha_emision).toLocaleDateString('es-GT')}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    ESTADO_COT_BADGE[cot.estado] ?? 'bg-slate-100 text-slate-600'
                  }`}>{cot.estado}</span>
                </td>
                <td className="py-3 px-4 text-sm font-medium text-slate-900">{Q(cot.total)}</td>
                <td className="py-3 px-4">
                  {cot.pdf_url ? (
                    <a
                      href={`${supabaseUrl}/storage/v1/object/public/documentos/${cot.pdf_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                    >
                      Descargar
                    </a>
                  ) : (
                    <span className="text-sm text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Tab: Pagos ──────────────────────────────────────────────────────────────

function TabPagos({ pagos, clienteId }: { pagos: PagoRow[]; clienteId: string }) {
  const totalPagado = pagos
    .filter((p: PagoRow) => p.estado === 'confirmado')
    .reduce((s: number, p: PagoRow) => s + (p.monto ?? 0), 0);

  if (!pagos.length) return (
    <EmptyState icon="💰" title="Sin pagos registrados" description="Este cliente no tiene pagos"
      action={{ label: '+ Registrar pago', onClick: () => window.location.href = `/admin/contabilidad/pagos/nuevo?cliente_id=${clienteId}` }} />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total pagado" value={Q(totalPagado)} accent="emerald" />
        <StatCard label="Pagos registrados" value={String(pagos.length)} />
      </div>

      <Section title={`Historial de pagos (${pagos.length})`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {['Fecha', 'Concepto', 'Método', 'Monto', 'Estado'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagos.map((p: PagoRow) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-4 text-sm text-slate-700">{p.fecha}</td>
                  <td className="py-3 px-4 text-sm text-slate-900">{p.concepto ?? '—'}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{p.metodo ?? '—'}</td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{Q(p.monto)}</td>
                  <td className="py-3 px-4"><Badge variant={p.estado as any}>{p.estado}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ── Tab: Notas ──────────────────────────────────────────────────────────────

function TabNotas({ c, id, mutate, refetch }: {
  c: ClienteDetalle;
  id: string;
  mutate: any;
  refetch: () => Promise<void>;
}) {
  const [notas, setNotas] = useState(c.notas ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const guardarNotas = async () => {
    setSaving(true);
    setSaved(false);
    await mutate(`/api/admin/clientes/${id}`, {
      method: 'PATCH',
      body: { notas: notas.trim() || null },
      onSuccess: () => { setSaved(true); refetch(); setTimeout(() => setSaved(false), 2000); },
      onError: (err: string) => alert(`Error: ${err}`),
    });
    setSaving(false);
  };

  return (
    <Section title="Notas internas">
      <div className="space-y-3">
        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={6}
          placeholder="Escribe notas internas sobre este cliente: preferencias, historial, referencias, etc."
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        <div className="flex items-center gap-3">
          <button onClick={guardarNotas} disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
            {saving ? 'Guardando...' : 'Guardar notas'}
          </button>
          {saved && <span className="text-sm text-emerald-600 font-medium">Guardado</span>}
        </div>
      </div>
    </Section>
  );
}

// ── Shared components ───────────────────────────────────────────────────────

function Field({ label, value, editValue, editing, onChange, type = 'text', mono }: {
  label: string;
  value: string | null;
  editValue?: string;
  editing: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      {editing ? (
        <input type={type} value={editValue ?? ''} onChange={onChange}
          className={`${INPUT} ${mono ? 'font-mono' : ''}`} />
      ) : (
        <p className={`text-sm text-slate-900 py-2.5 ${mono ? 'font-mono' : ''}`}>
          {value || <span className="text-slate-400">—</span>}
        </p>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  const color = accent === 'emerald' ? 'text-emerald-600' : accent === 'amber' ? 'text-amber-600' : 'text-slate-900';
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}
