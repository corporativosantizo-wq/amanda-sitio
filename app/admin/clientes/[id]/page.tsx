// ============================================================================
// app/admin/clientes/[id]/page.tsx
// Detalle completo de cliente con edición inline, tabs y acciones rápidas
// ============================================================================

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useFetch, useMutate } from '@/lib/hooks/use-fetch';
import ExcelJS from 'exceljs';
import { Section, Badge, Q, Skeleton, EmptyState } from '@/components/admin/ui';
import {
  Scale, Shield, Building2, AlertTriangle, Download, ChevronRight,
  FileText, FolderOpen, FileSignature, Receipt, Mail, Phone, MapPin,
  Pencil, Trash2, Eye, Languages, Upload as UploadIcon,
} from 'lucide-react';
import type { CargoRepresentante } from '@/lib/types';
import { safeWindowOpen } from '@/lib/utils/validate-url';
import { adminFetch } from '@/lib/utils/admin-fetch';
import { CARGO_LABELS, CARGOS_DIRECCION, CARGOS_GESTION } from '@/lib/types';
import DocumentViewer from '@/components/admin/document-viewer';
import { EditarDocumentoModal, type DocumentoParaEditar } from '@/components/admin/editar-documento-modal';
import { EnviarReciboEmailModal } from '@/components/admin/enviar-recibo-email-modal';
import {
  type OrigenExpediente,
  ORIGEN_LABEL, ORIGEN_COLOR, TIPO_PROCESO_LABEL, FASE_LABEL,
  ESTADO_EXPEDIENTE_LABEL, ESTADO_EXPEDIENTE_COLOR,
} from '@/lib/types/expedientes';
import {
  type TramiteMercantil,
  CATEGORIA_MERCANTIL_SHORT, ESTADO_MERCANTIL_LABEL, ESTADO_MERCANTIL_COLOR,
  getSemaforoMercantil, SEMAFORO_DOT,
} from '@/lib/types/mercantil';
import {
  type TramiteLaboral,
  CATEGORIA_LABORAL_SHORT, ESTADO_LABORAL_LABEL, ESTADO_LABORAL_COLOR,
  getSemaforoLaboral, SEMAFORO_LABORAL_DOT,
} from '@/lib/types/laboral';

// ── Types ───────────────────────────────────────────────────────────────────

interface RepresentanteDetalle {
  cargo: CargoRepresentante;
  representante: { id: string; nombre_completo: string; email: string | null };
  otras_empresas: { id: string; codigo: string; nombre: string; cargo: CargoRepresentante }[];
}

interface GrupoEmpresarialDetalle {
  id: string;
  nombre: string;
  empresas: { id: string; codigo: string; nombre: string }[];
}

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
  grupo_empresarial_id: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
  stats: {
    cotizaciones: number;
    facturas: number;
    total_pagado: number;
  };
  citas: CitaRow[];
  expedientes: ExpedienteRow[];
  documentos: DocRow[];
  pagos: PagoRow[];
  cotizaciones: CotizacionRow[];
  representantes: RepresentanteDetalle[];
  grupo_empresarial: GrupoEmpresarialDetalle | null;
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
  archivo_url: string;
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
  fecha_pago: string;
  concepto: string | null;
  metodo: string | null;
}

interface ExpedienteRow {
  id: string;
  numero_expediente: string | null;
  numero_mp: string | null;
  numero_administrativo: string | null;
  origen: OrigenExpediente;
  tipo_proceso: string;
  fase_actual: string;
  estado: string;
  fecha_inicio: string;
  fecha_ultima_actuacion: string | null;
  juzgado: string | null;
  fiscalia: string | null;
  entidad_administrativa: string | null;
  plazo_proximo?: { fecha_vencimiento: string; descripcion: string; dias_restantes: number } | null;
}

type TabKey = 'resumen' | 'documentos' | 'expedientes' | 'cotizaciones' | 'recibos' | 'mercantil' | 'laboral' | 'citas' | 'pagos' | 'datos' | 'notas';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'resumen', label: 'Resumen', icon: '📊' },
  { key: 'documentos', label: 'Documentos', icon: '📁' },
  { key: 'expedientes', label: 'Expedientes', icon: '⚖️' },
  { key: 'cotizaciones', label: 'Cotizaciones', icon: '📋' },
  { key: 'recibos', label: 'Recibos', icon: '🧾' },
  { key: 'mercantil', label: 'Mercantil', icon: '🏢' },
  { key: 'laboral', label: 'Laboral', icon: '👷' },
  { key: 'citas', label: 'Citas', icon: '📅' },
  { key: 'pagos', label: 'Pagos', icon: '💰' },
  { key: 'datos', label: 'Datos', icon: '👤' },
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

  const [tab, setTab] = useState<TabKey>('resumen');
  const [editing, setEditing] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState<{ telefono: string; email: string; direccion: string }>({ telefono: '', email: '', direccion: '' });
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Representante edit state
  const [editCargoDireccion, setEditCargoDireccion] = useState<CargoRepresentante>('administrador_unico');
  const [editRepDireccionNombre, setEditRepDireccionNombre] = useState('');
  const [editRepDireccionEmail, setEditRepDireccionEmail] = useState('');
  const [editRepDireccionId, setEditRepDireccionId] = useState<string | null>(null);
  const [editCargoGestion, setEditCargoGestion] = useState<CargoRepresentante>('gerente_general');
  const [editRepGestionNombre, setEditRepGestionNombre] = useState('');
  const [editRepGestionEmail, setEditRepGestionEmail] = useState('');
  const [editRepGestionId, setEditRepGestionId] = useState<string | null>(null);

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

    // Initialize representante edit state from current data
    const repDireccion = (c.representantes ?? []).find(r => CARGOS_DIRECCION.includes(r.cargo));
    const repGestion = (c.representantes ?? []).find(r => CARGOS_GESTION.includes(r.cargo));

    if (repDireccion) {
      setEditCargoDireccion(repDireccion.cargo);
      setEditRepDireccionNombre(repDireccion.representante.nombre_completo);
      setEditRepDireccionEmail(repDireccion.representante.email ?? '');
      setEditRepDireccionId(repDireccion.representante.id);
    } else {
      setEditCargoDireccion('administrador_unico');
      setEditRepDireccionNombre('');
      setEditRepDireccionEmail('');
      setEditRepDireccionId(null);
    }

    if (repGestion) {
      setEditCargoGestion(repGestion.cargo);
      setEditRepGestionNombre(repGestion.representante.nombre_completo);
      setEditRepGestionEmail(repGestion.representante.email ?? '');
      setEditRepGestionId(repGestion.representante.id);
    } else {
      setEditCargoGestion('gerente_general');
      setEditRepGestionNombre('');
      setEditRepGestionEmail('');
      setEditRepGestionId(null);
    }

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

    const representantes = c?.tipo === 'empresa' ? [
      ...(editRepDireccionNombre.trim() ? [{
        cargo: editCargoDireccion,
        nombre_completo: editRepDireccionNombre.trim(),
        email: editRepDireccionEmail.trim() || null,
        representante_id: editRepDireccionId || undefined,
      }] : []),
      ...(editRepGestionNombre.trim() ? [{
        cargo: editCargoGestion,
        nombre_completo: editRepGestionNombre.trim(),
        email: editRepGestionEmail.trim() || null,
        representante_id: editRepGestionId || undefined,
      }] : []),
    ] : undefined;

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
        representantes,
      },
      onSuccess: () => { setEditing(false); refetch(); },
      onError: (err) => setSaveError(err),
    });
  }, [form, id, mutate, refetch, c?.tipo, editCargoDireccion, editRepDireccionNombre, editRepDireccionEmail, editRepDireccionId, editCargoGestion, editRepGestionNombre, editRepGestionEmail, editRepGestionId]);

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

  const startEditHeader = useCallback(() => {
    if (!c) return;
    setHeaderForm({
      telefono: c.telefono ?? '',
      email: c.email ?? '',
      direccion: c.direccion ?? '',
    });
    setHeaderError(null);
    setEditingHeader(true);
  }, [c]);

  const saveHeader = useCallback(async () => {
    setHeaderError(null);
    setSavingHeader(true);
    await mutate(`/api/admin/clientes/${id}`, {
      method: 'PATCH',
      body: {
        telefono: headerForm.telefono.trim() || null,
        email: headerForm.email.trim() || null,
        direccion: headerForm.direccion.trim() || null,
      },
      onSuccess: () => { setEditingHeader(false); refetch(); },
      onError: (err) => setHeaderError(typeof err === 'string' ? err : 'Error al guardar'),
    });
    setSavingHeader(false);
  }, [headerForm, id, mutate, refetch]);

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

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-slate-500">
        <Link href="/admin/clientes" className="hover:text-slate-900 transition-colors">Clientes</Link>
        <ChevronRight size={14} className="text-slate-400" />
        <span className="text-slate-900 font-medium truncate">{c.nombre}</span>
      </nav>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                c.tipo === 'empresa' ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'
              }`}>{c.tipo === 'empresa' ? '🏢' : '👤'}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-slate-900">{c.nombre}</h1>
                  {c.activo
                    ? <Badge variant="success">Activo</Badge>
                    : <Badge variant="danger">Inactivo</Badge>}
                  {c.grupo_empresarial && (
                    <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full font-medium">
                      {c.grupo_empresarial.nombre}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="font-mono">{c.codigo}</span>
                  <span>·</span>
                  <span><span className="text-slate-400">NIT:</span> <span className="font-mono">{c.nit}</span></span>
                  <span>·</span>
                  <span>{c.tipo === 'empresa' ? 'Empresa' : 'Individual'}</span>
                </div>

                {/* Contact info row — inline editable */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {editingHeader ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Phone size={12} /> Teléfono</label>
                        <input type="tel" value={headerForm.telefono}
                          onChange={e => setHeaderForm(p => ({ ...p, telefono: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><Mail size={12} /> Email</label>
                        <input type="email" value={headerForm.email}
                          onChange={e => setHeaderForm(p => ({ ...p, email: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5"><MapPin size={12} /> Dirección</label>
                        <input type="text" value={headerForm.direccion}
                          onChange={e => setHeaderForm(p => ({ ...p, direccion: e.target.value }))}
                          className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2 text-slate-600">
                        <Phone size={14} className="mt-0.5 text-slate-400 shrink-0" />
                        <span>{c.telefono ?? <span className="text-slate-400">—</span>}</span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600 min-w-0">
                        <Mail size={14} className="mt-0.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.email ?? <span className="text-slate-400">—</span>}</span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600 min-w-0">
                        <MapPin size={14} className="mt-0.5 text-slate-400 shrink-0" />
                        <span className="truncate" title={c.direccion ?? ''}>{c.direccion ?? <span className="text-slate-400">—</span>}</span>
                      </div>
                    </>
                  )}
                </div>

                {headerError && (
                  <div className="mt-3 p-2 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">{headerError}</div>
                )}
              </div>
            </div>

            {/* Right column: edit + quick actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex flex-wrap gap-2 justify-end">
                {editingHeader ? (
                  <>
                    <button onClick={() => { setEditingHeader(false); setHeaderError(null); }} disabled={savingHeader}
                      className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                      Cancelar
                    </button>
                    <button onClick={saveHeader} disabled={savingHeader}
                      className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#1E40AF] to-[#0891B2] rounded-lg hover:shadow-lg transition-all disabled:opacity-50">
                      {savingHeader ? 'Guardando…' : 'Guardar'}
                    </button>
                  </>
                ) : (
                  <button onClick={startEditHeader}
                    className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5">
                    <Pencil size={14} /> Editar datos
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                {c.email && (
                  <Link href={`/admin/ai?prompt=Mándale un email a ${c.nombre}`}
                    className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5">
                    ✉️ Email
                  </Link>
                )}
                <Link href={`/admin/calendario?accion=nueva&cliente_id=${id}`}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors inline-flex items-center gap-1.5">
                  📅 Cita
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
        </div>
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
            {t.key === 'expedientes' && (c.expedientes ?? []).length > 0 && (
              <span className="ml-1.5 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{c.expedientes.length}</span>
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
      {tab === 'resumen' && (
        <TabResumen c={c} clienteId={id} setTab={setTab} totalPagado={totalPagado} />
      )}
      {tab === 'datos' && (
        <TabDatos c={c} editing={editing} form={form} set={set}
          onStartEdit={startEdit} onCancel={cancelEdit} onSave={saveEdit}
          saving={saving} saveError={saveError} clienteId={id}
          editCargoDireccion={editCargoDireccion} setEditCargoDireccion={setEditCargoDireccion}
          editRepDireccionNombre={editRepDireccionNombre} setEditRepDireccionNombre={setEditRepDireccionNombre}
          editRepDireccionEmail={editRepDireccionEmail} setEditRepDireccionEmail={setEditRepDireccionEmail}
          editRepDireccionId={editRepDireccionId} setEditRepDireccionId={setEditRepDireccionId}
          editCargoGestion={editCargoGestion} setEditCargoGestion={setEditCargoGestion}
          editRepGestionNombre={editRepGestionNombre} setEditRepGestionNombre={setEditRepGestionNombre}
          editRepGestionEmail={editRepGestionEmail} setEditRepGestionEmail={setEditRepGestionEmail}
          editRepGestionId={editRepGestionId} setEditRepGestionId={setEditRepGestionId}
        />
      )}
      {tab === 'citas' && <TabCitas citas={c.citas} clienteId={id} />}
      {tab === 'expedientes' && <TabExpedientes expedientes={c.expedientes ?? []} clienteId={id} clienteNombre={c.nombre} grupoEmpresas={c.grupo_empresarial?.empresas ?? null} />}
      {tab === 'mercantil' && <TabMercantil clienteId={id} />}
      {tab === 'laboral' && <TabLaboral clienteId={id} />}
      {tab === 'documentos' && <TabDocumentos clienteId={id} onRefetch={refetch} />}
      {tab === 'cotizaciones' && <TabCotizaciones clienteId={id} clienteNombre={c.nombre} />}
      {tab === 'recibos' && <TabRecibos clienteId={id} />}
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

// ── Tab: Resumen ────────────────────────────────────────────────────────────

function TabResumen({ c, clienteId, setTab, totalPagado }: {
  c: ClienteDetalle;
  clienteId: string;
  setTab: (t: TabKey) => void;
  totalPagado: number;
}) {
  const router = useRouter();

  // Fetch cotizaciones with monto_pagado for accurate saldo
  const { data: cotData } = useFetch<{ data: CotizacionConPagos[]; total: number }>(
    `/api/admin/contabilidad/cotizaciones?cliente_id=${clienteId}&limit=100`
  );
  const cotizaciones = cotData?.data ?? [];

  const saldoCotizaciones = cotizaciones
    .filter(co => co.estado !== 'rechazada' && co.estado !== 'vencida')
    .reduce((s, co) => s + Math.max(0, co.total - (co.monto_pagado ?? 0)), 0);

  const expedientes = c.expedientes ?? [];
  const expedientesActivos = expedientes.filter(e => e.estado === 'activo');
  const ultimosDocumentos = (c.documentos ?? []).slice(0, 5);

  // Aggregate "última actividad": pick the most recent of doc, expediente actuación, cita, pago
  const actividades: { fecha: string; tipo: string; descripcion: string; tab?: TabKey }[] = [];
  for (const d of (c.documentos ?? []).slice(0, 3)) {
    actividades.push({
      fecha: d.created_at,
      tipo: 'Documento',
      descripcion: d.titulo ?? d.nombre_archivo,
      tab: 'documentos',
    });
  }
  for (const e of expedientes.slice(0, 3)) {
    if (e.fecha_ultima_actuacion) {
      actividades.push({
        fecha: e.fecha_ultima_actuacion,
        tipo: 'Expediente',
        descripcion: getExpedienteNumero(e),
        tab: 'expedientes',
      });
    }
  }
  for (const ci of (c.citas ?? []).slice(0, 3)) {
    actividades.push({
      fecha: ci.fecha,
      tipo: 'Cita',
      descripcion: ci.titulo,
      tab: 'citas',
    });
  }
  actividades.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const recientes = actividades.slice(0, 5);

  const proximaCita = (c.citas ?? [])
    .filter(ci => ci.estado !== 'cancelada' && ci.fecha >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0];

  // Plazos urgentes (≤ 5 días) en expedientes
  const plazosUrgentes = expedientes
    .filter(e => e.plazo_proximo && e.plazo_proximo.dias_restantes <= 5)
    .sort((a, b) => (a.plazo_proximo!.dias_restantes - b.plazo_proximo!.dias_restantes));

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={<FolderOpen size={18} />} label="Documentos" value={String(c.documentos.length)}
          onClick={() => setTab('documentos')} />
        <KpiTile icon={<Scale size={18} />} label="Expedientes" value={`${expedientesActivos.length} / ${expedientes.length}`}
          sub={`${expedientesActivos.length} activos`} onClick={() => setTab('expedientes')} />
        <KpiTile icon={<FileSignature size={18} />} label="Cotizaciones" value={String(cotizaciones.length || c.stats.cotizaciones)}
          onClick={() => setTab('cotizaciones')} />
        <KpiTile icon={<Receipt size={18} />} label="Saldo pendiente" value={Q(saldoCotizaciones)}
          accent={saldoCotizaciones > 0 ? 'amber' : 'emerald'} onClick={() => setTab('cotizaciones')} />
      </div>

      {/* Plazos urgentes alert */}
      {plazosUrgentes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">
                {plazosUrgentes.length} plazo{plazosUrgentes.length > 1 ? 's' : ''} urgente{plazosUrgentes.length > 1 ? 's' : ''} (≤5 días)
              </p>
              <ul className="mt-2 space-y-1">
                {plazosUrgentes.slice(0, 3).map(e => (
                  <li key={e.id} className="text-sm text-red-800">
                    <button onClick={() => router.push(`/admin/expedientes/${e.id}`)} className="hover:underline font-mono">
                      {getExpedienteNumero(e)}
                    </button>
                    <span className="ml-2">— {e.plazo_proximo!.descripcion} ({e.plazo_proximo!.dias_restantes} día{e.plazo_proximo!.dias_restantes !== 1 ? 's' : ''})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Últimos documentos */}
        <Section title="Últimos documentos" action={{ label: 'Ver todos', onClick: () => setTab('documentos') }} noPadding>
          {ultimosDocumentos.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin documentos</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ultimosDocumentos.map(d => (
                <li key={d.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <FileText size={16} className="text-slate-400 mt-1 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate" title={d.titulo ?? d.nombre_archivo}>
                        {d.titulo ?? d.nombre_archivo}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.tipo ? (TIPOS_DOC[d.tipo] ?? d.tipo) : 'Sin tipo'} · {new Date(d.created_at).toLocaleDateString('es-GT')}
                      </p>
                    </div>
                    <Badge variant={d.estado as any}>{d.estado}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Expedientes activos */}
        <Section title="Expedientes activos" action={{ label: 'Ver todos', onClick: () => setTab('expedientes') }} noPadding>
          {expedientesActivos.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin expedientes activos</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {expedientesActivos.slice(0, 5).map(e => (
                <li key={e.id} className="px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/expedientes/${e.id}`)}>
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${ORIGEN_COLOR[e.origen]}`}>
                      <OrigenIcon origen={e.origen} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 font-mono truncate">{getExpedienteNumero(e)}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {TIPO_PROCESO_LABEL[e.tipo_proceso as keyof typeof TIPO_PROCESO_LABEL] ?? e.tipo_proceso}
                        {' · '}
                        {FASE_LABEL[e.fase_actual as keyof typeof FASE_LABEL] ?? e.fase_actual}
                      </p>
                    </div>
                    {e.plazo_proximo && e.plazo_proximo.dias_restantes <= 5 && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                        e.plazo_proximo.dias_restantes <= 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        <AlertTriangle size={12} />
                        {e.plazo_proximo.dias_restantes}d
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Última actividad */}
        <Section title="Actividad reciente" noPadding>
          {recientes.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-400 text-center">Sin actividad reciente</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recientes.map((a, i) => (
                <li key={i} className="px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  onClick={() => a.tab && setTab(a.tab)}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-medium shrink-0">
                      {a.tipo}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-900 truncate">{a.descripcion}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {new Date(a.fecha).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Próxima cita / saldo info */}
        <Section title="Información rápida" noPadding>
          <div className="divide-y divide-slate-100">
            <div className="px-5 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Próxima cita</p>
              {proximaCita ? (
                <button onClick={() => setTab('citas')} className="text-sm text-slate-900 hover:text-[#0891B2] text-left">
                  <span className="font-medium">{proximaCita.titulo}</span>
                  <span className="text-slate-500"> · {proximaCita.fecha} {proximaCita.hora_inicio}</span>
                </button>
              ) : (
                <Link href={`/admin/calendario?accion=nueva&cliente_id=${clienteId}`} className="text-sm text-[#0891B2] hover:underline">
                  + Agendar cita
                </Link>
              )}
            </div>
            <div className="px-5 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total pagado</p>
              <p className="text-sm font-semibold text-emerald-700">{Q(totalPagado)}</p>
            </div>
            {c.grupo_empresarial && (
              <div className="px-5 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Grupo empresarial</p>
                <p className="text-sm font-medium text-slate-900">{c.grupo_empresarial.nombre}</p>
                <p className="text-xs text-slate-500 mt-0.5">{c.grupo_empresarial.empresas.length} empresas</p>
              </div>
            )}
            {c.notas && (
              <div className="px-5 py-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notas</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-3">{c.notas}</p>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}

function KpiTile({ icon, label, value, sub, accent, onClick }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: 'emerald' | 'amber';
  onClick?: () => void;
}) {
  const valueColor = accent === 'emerald' ? 'text-emerald-700' : accent === 'amber' ? 'text-amber-700' : 'text-slate-900';
  return (
    <button onClick={onClick} disabled={!onClick}
      className="bg-white rounded-xl border border-slate-200 p-4 text-left hover:border-[#0891B2] hover:shadow-sm transition-all disabled:cursor-default group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 group-hover:text-[#0891B2] transition-colors">{icon}</span>
      </div>
      <p className={`text-xl font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </button>
  );
}

// ── Tab: Datos generales ────────────────────────────────────────────────────

interface RepSugerencia {
  id: string;
  nombre_completo: string;
  email: string | null;
  empresas: { id: string; codigo: string; nombre: string; cargo: CargoRepresentante }[];
}

function TabDatos({ c, editing, form, set, onStartEdit, onCancel, onSave, saving, saveError, clienteId,
  editCargoDireccion, setEditCargoDireccion,
  editRepDireccionNombre, setEditRepDireccionNombre,
  editRepDireccionEmail, setEditRepDireccionEmail,
  editRepDireccionId, setEditRepDireccionId,
  editCargoGestion, setEditCargoGestion,
  editRepGestionNombre, setEditRepGestionNombre,
  editRepGestionEmail, setEditRepGestionEmail,
  editRepGestionId, setEditRepGestionId,
}: {
  c: ClienteDetalle;
  editing: boolean;
  form: Record<string, string>;
  set: (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  saveError: string | null;
  clienteId: string;
  editCargoDireccion: CargoRepresentante;
  setEditCargoDireccion: (v: CargoRepresentante) => void;
  editRepDireccionNombre: string;
  setEditRepDireccionNombre: (v: string) => void;
  editRepDireccionEmail: string;
  setEditRepDireccionEmail: (v: string) => void;
  editRepDireccionId: string | null;
  setEditRepDireccionId: (v: string | null) => void;
  editCargoGestion: CargoRepresentante;
  setEditCargoGestion: (v: CargoRepresentante) => void;
  editRepGestionNombre: string;
  setEditRepGestionNombre: (v: string) => void;
  editRepGestionEmail: string;
  setEditRepGestionEmail: (v: string) => void;
  editRepGestionId: string | null;
  setEditRepGestionId: (v: string | null) => void;
}) {
  // Autocomplete for representantes in edit mode
  const [sugerenciasDireccion, setSugerenciasDireccion] = useState<RepSugerencia[]>([]);
  const [sugerenciasGestion, setSugerenciasGestion] = useState<RepSugerencia[]>([]);
  const [showDireccionDropdown, setShowDireccionDropdown] = useState(false);
  const [showGestionDropdown, setShowGestionDropdown] = useState(false);
  const direccionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const direccionDropdownRef = useRef<HTMLDivElement>(null);
  const gestionDropdownRef = useRef<HTMLDivElement>(null);

  const buscarRep = useCallback((valor: string, setter: typeof setSugerenciasDireccion, timerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>, showSetter: typeof setShowDireccionDropdown) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!valor.trim() || valor.trim().length < 2) { setter([]); showSetter(false); return; }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/admin/clientes/representantes?q=${encodeURIComponent(valor.trim())}`);
        const json = await res.json();
        const reps = json.representantes ?? [];
        setter(reps);
        showSetter(reps.length > 0);
      } catch { setter([]); showSetter(false); }
    }, 300);
  }, []);

  useEffect(() => {
    if (editing && c.tipo === 'empresa' && !editRepDireccionId) {
      buscarRep(editRepDireccionNombre, setSugerenciasDireccion, direccionTimer, setShowDireccionDropdown);
    } else {
      setShowDireccionDropdown(false);
    }
  }, [editRepDireccionNombre, editing, c.tipo, editRepDireccionId, buscarRep]);

  useEffect(() => {
    if (editing && c.tipo === 'empresa' && !editRepGestionId) {
      buscarRep(editRepGestionNombre, setSugerenciasGestion, gestionTimer, setShowGestionDropdown);
    } else {
      setShowGestionDropdown(false);
    }
  }, [editRepGestionNombre, editing, c.tipo, editRepGestionId, buscarRep]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (direccionDropdownRef.current && !direccionDropdownRef.current.contains(e.target as Node)) setShowDireccionDropdown(false);
      if (gestionDropdownRef.current && !gestionDropdownRef.current.contains(e.target as Node)) setShowGestionDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const repDireccion = (c.representantes ?? []).find(r => CARGOS_DIRECCION.includes(r.cargo));
  const repGestion = (c.representantes ?? []).find(r => CARGOS_GESTION.includes(r.cargo));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        {!editing ? (
          <button onClick={onStartEdit}
            className="px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
            Editar datos
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

      {/* Representacion legal (solo empresa) */}
      {c.tipo === 'empresa' && (
        <Section title="Representacion legal">
          {!editing ? (
            /* View mode */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  {repDireccion ? CARGO_LABELS[repDireccion.cargo] : 'Representante de Direccion'}
                </p>
                <p className="text-sm text-slate-900">
                  {repDireccion?.representante.nombre_completo || <span className="text-slate-400">—</span>}
                </p>
                {repDireccion?.representante.email && (
                  <p className="text-xs text-slate-500">{repDireccion.representante.email}</p>
                )}
                {repDireccion && repDireccion.otras_empresas.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 mb-1">Tambien vinculado con:</p>
                    <div className="flex flex-wrap gap-1">
                      {repDireccion.otras_empresas.map(e => (
                        <Link key={e.id} href={`/admin/clientes/${e.id}`}
                          className="text-xs px-2 py-0.5 bg-amber-100 text-amber-900 rounded hover:bg-amber-200">
                          {e.codigo} · {e.nombre}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">
                  {repGestion ? CARGO_LABELS[repGestion.cargo] : 'Representante de Gestion'}
                </p>
                <p className="text-sm text-slate-900">
                  {repGestion?.representante.nombre_completo || <span className="text-slate-400">—</span>}
                </p>
                {repGestion?.representante.email && (
                  <p className="text-xs text-slate-500">{repGestion.representante.email}</p>
                )}
                {repGestion && repGestion.otras_empresas.length > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 mb-1">Tambien vinculado con:</p>
                    <div className="flex flex-wrap gap-1">
                      {repGestion.otras_empresas.map(e => (
                        <Link key={e.id} href={`/admin/clientes/${e.id}`}
                          className="text-xs px-2 py-0.5 bg-amber-100 text-amber-900 rounded hover:bg-amber-200">
                          {e.codigo} · {e.nombre}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit mode */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Direccion */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cargo de Direccion</label>
                  <select value={editCargoDireccion}
                    onChange={e => setEditCargoDireccion(e.target.value as CargoRepresentante)}
                    className={INPUT}>
                    {CARGOS_DIRECCION.map(c => (
                      <option key={c} value={c}>{CARGO_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div className="relative" ref={direccionDropdownRef}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                  <input type="text" value={editRepDireccionNombre}
                    onChange={e => { setEditRepDireccionNombre(e.target.value); setEditRepDireccionId(null); }}
                    className={INPUT} placeholder="Nombre del representante" />
                  {showDireccionDropdown && sugerenciasDireccion.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {sugerenciasDireccion.map(rep => (
                        <button key={rep.id} onClick={() => {
                          setEditRepDireccionNombre(rep.nombre_completo);
                          setEditRepDireccionEmail(rep.email ?? '');
                          setEditRepDireccionId(rep.id);
                          setShowDireccionDropdown(false);
                        }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-sm font-medium text-slate-900">{rep.nombre_completo}</p>
                          {rep.empresas.length > 0 && (
                            <p className="text-xs text-amber-600">Vinculado con: {rep.empresas.map(e => e.nombre).join(', ')}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={editRepDireccionEmail}
                    onChange={e => setEditRepDireccionEmail(e.target.value)}
                    className={INPUT} placeholder="email@representante.com" />
                </div>
              </div>

              {/* Gestion */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Cargo de Gestion</label>
                  <select value={editCargoGestion}
                    onChange={e => setEditCargoGestion(e.target.value as CargoRepresentante)}
                    className={INPUT}>
                    {CARGOS_GESTION.map(c => (
                      <option key={c} value={c}>{CARGO_LABELS[c]}</option>
                    ))}
                  </select>
                </div>
                <div className="relative" ref={gestionDropdownRef}>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
                  <input type="text" value={editRepGestionNombre}
                    onChange={e => { setEditRepGestionNombre(e.target.value); setEditRepGestionId(null); }}
                    className={INPUT} placeholder="Nombre del representante" />
                  {showGestionDropdown && sugerenciasGestion.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {sugerenciasGestion.map(rep => (
                        <button key={rep.id} onClick={() => {
                          setEditRepGestionNombre(rep.nombre_completo);
                          setEditRepGestionEmail(rep.email ?? '');
                          setEditRepGestionId(rep.id);
                          setShowGestionDropdown(false);
                        }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-sm font-medium text-slate-900">{rep.nombre_completo}</p>
                          {rep.empresas.length > 0 && (
                            <p className="text-xs text-amber-600">Vinculado con: {rep.empresas.map(e => e.nombre).join(', ')}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                  <input type="email" value={editRepGestionEmail}
                    onChange={e => setEditRepGestionEmail(e.target.value)}
                    className={INPUT} placeholder="email@representante.com" />
                </div>
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Grupo Empresarial (solo empresa) */}
      {c.tipo === 'empresa' && c.grupo_empresarial && (
        <Section title="Grupo Empresarial">
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-900">{c.grupo_empresarial.nombre}</p>
            <div className="flex flex-wrap gap-2">
              {c.grupo_empresarial.empresas.map(e => (
                <Link key={e.id} href={`/admin/clientes/${e.id}`}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    e.id === c.id
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}>
                  {e.codigo} · {e.nombre}
                </Link>
              ))}
            </div>
          </div>
        </Section>
      )}

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

// ── Tab: Expedientes ────────────────────────────────────────────────────────

const OrigenIcon = ({ origen }: { origen: OrigenExpediente }) => {
  const cls = 'w-4 h-4';
  switch (origen) {
    case 'judicial': return <Scale className={cls} />;
    case 'fiscal': return <Shield className={cls} />;
    case 'administrativo': return <Building2 className={cls} />;
  }
};

function getExpedienteNumero(e: ExpedienteRow): string {
  const nums: string[] = [];
  if (e.numero_expediente) nums.push(e.numero_expediente);
  if (e.numero_mp) nums.push(`MP: ${e.numero_mp}`);
  if (e.numero_administrativo) nums.push(`Admin: ${e.numero_administrativo}`);
  return nums.join(' / ') || '—';
}

function getExpedienteSede(e: ExpedienteRow): string {
  return e.juzgado ?? e.fiscalia ?? e.entidad_administrativa ?? '—';
}

function TabExpedientes({ expedientes, clienteId, clienteNombre, grupoEmpresas }: {
  expedientes: ExpedienteRow[];
  clienteId: string;
  clienteNombre: string;
  grupoEmpresas: { id: string; codigo: string; nombre: string }[] | null;
}) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [downloadingGrupo, setDownloadingGrupo] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState('');

  async function buildExcel(
    rows: (ExpedienteRow & { empresa?: string })[],
    filename: string,
    includeEmpresa = false,
  ) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Expedientes');

    const cols: Partial<ExcelJS.Column>[] = [];
    if (includeEmpresa) cols.push({ header: 'Empresa', key: 'empresa', width: 28 });
    cols.push(
      { header: 'No. Expediente', key: 'numero', width: 24 },
      { header: 'Origen', key: 'origen', width: 14 },
      { header: 'Tipo Proceso', key: 'tipo', width: 24 },
      { header: 'Juzgado/Tribunal', key: 'sede', width: 28 },
      { header: 'Fase Actual', key: 'fase', width: 24 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Fecha Inicio', key: 'fecha', width: 14 },
      { header: 'Última Actuación', key: 'ultima', width: 14 },
    );
    ws.columns = cols;

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { vertical: 'middle' };
    });

    rows.forEach(r => {
      const row: Record<string, string> = {
        numero: getExpedienteNumero(r),
        origen: ORIGEN_LABEL[r.origen],
        tipo: TIPO_PROCESO_LABEL[r.tipo_proceso as keyof typeof TIPO_PROCESO_LABEL] ?? r.tipo_proceso,
        sede: r.juzgado ?? r.fiscalia ?? r.entidad_administrativa ?? '',
        fase: FASE_LABEL[r.fase_actual as keyof typeof FASE_LABEL] ?? r.fase_actual,
        estado: ESTADO_EXPEDIENTE_LABEL[r.estado] ?? r.estado,
        fecha: r.fecha_inicio,
        ultima: r.fecha_ultima_actuacion ?? '',
      };
      if (includeEmpresa) row.empresa = r.empresa ?? '';
      ws.addRow(row);
    });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const fecha = new Date().toISOString().slice(0, 10);
      await buildExcel(expedientes, `Expedientes_${clienteNombre.replace(/\s+/g, '_')}_${fecha}.xlsx`);
    } catch (err) {
      console.error('Error al descargar expedientes:', err);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadGrupo() {
    if (!grupoEmpresas) return;
    setDownloadingGrupo(true);
    try {
      const results = await Promise.all(
        grupoEmpresas.map(async emp => {
          const res = await adminFetch(`/api/admin/clientes/${emp.id}`);
          const json = await res.json();
          return ((json.expedientes ?? []) as ExpedienteRow[]).map(e => ({ ...e, empresa: emp.nombre }));
        })
      );
      const combined = results.flat();
      const fecha = new Date().toISOString().slice(0, 10);
      await buildExcel(combined, `Expedientes_Grupo_${fecha}.xlsx`, true);
    } catch (err) {
      console.error('Error al descargar expedientes del grupo:', err);
    } finally {
      setDownloadingGrupo(false);
    }
  }

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await adminFetch('/api/admin/expedientes/reporte-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          tipo_proceso: filterTipo || undefined,
          estado: filterEstado || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tipoSlug = filterTipo ? `_${TIPO_PROCESO_LABEL[filterTipo as keyof typeof TIPO_PROCESO_LABEL] ?? filterTipo}` : '';
      a.download = `Expedientes${tipoSlug}_${clienteNombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al generar PDF:', err);
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!expedientes.length) return (
    <EmptyState icon="⚖️" title="Sin expedientes" description="Este cliente no tiene expedientes registrados"
      action={{ label: '+ Nuevo Expediente', onClick: () => router.push(`/admin/expedientes/nuevo?cliente_id=${clienteId}`) }} />
  );

  // Apply frontend filters
  const filtered = expedientes.filter(e => {
    if (filterTipo && e.tipo_proceso !== filterTipo) return false;
    if (filterEstado && e.estado !== filterEstado) return false;
    return true;
  });
  const activos = expedientes.filter(e => e.estado === 'activo').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{activos} activo{activos !== 1 ? 's' : ''} de {expedientes.length} total</p>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all">
            <Download size={14} />
            {downloading ? 'Descargando…' : 'Excel'}
          </button>
          {grupoEmpresas && grupoEmpresas.length > 1 && (
            <button onClick={handleDownloadGrupo} disabled={downloadingGrupo}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all">
              <Download size={14} />
              {downloadingGrupo ? 'Descargando…' : 'Grupo'}
            </button>
          )}
          <button onClick={handleDownloadPdf} disabled={downloadingPdf || filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#1E40AF] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-40 transition-all">
            <Download size={14} />
            {downloadingPdf ? 'Generando PDF…' : `PDF (${filtered.length})`}
          </button>
          <button onClick={() => router.push(`/admin/expedientes/nuevo?cliente_id=${clienteId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
            + Nuevo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterTipo}
          onChange={(e: any) => setFilterTipo(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        >
          <option value="">Todos los tipos</option>
          {Object.entries(TIPO_PROCESO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e: any) => setFilterEstado(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_EXPEDIENTE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        {(filterTipo || filterEstado) && (
          <button
            onClick={() => { setFilterTipo(''); setFilterEstado(''); }}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <Section title={`Expedientes (${filtered.length}${filtered.length !== expedientes.length ? ` de ${expedientes.length}` : ''})`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {['', 'Número(s)', 'Tipo', 'Sede', 'Fase', 'Estado', 'Plazos'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(exp => (
                <tr key={exp.id} onClick={() => router.push(`/admin/expedientes/${exp.id}`)}
                  className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <td className="py-3 px-4 pl-5">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg ${ORIGEN_COLOR[exp.origen]}`}>
                      <OrigenIcon origen={exp.origen} />
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-slate-900 font-mono">{getExpedienteNumero(exp)}</div>
                    {exp.fecha_ultima_actuacion && (
                      <div className="text-xs text-slate-400 mt-0.5">Últ. actuación: {exp.fecha_ultima_actuacion}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">{TIPO_PROCESO_LABEL[exp.tipo_proceso as keyof typeof TIPO_PROCESO_LABEL] ?? exp.tipo_proceso}</td>
                  <td className="py-3 px-4 text-sm text-slate-500 max-w-[160px] truncate">{getExpedienteSede(exp)}</td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                      {FASE_LABEL[exp.fase_actual as keyof typeof FASE_LABEL] ?? exp.fase_actual}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_EXPEDIENTE_COLOR[exp.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ESTADO_EXPEDIENTE_LABEL[exp.estado] ?? exp.estado}
                    </span>
                  </td>
                  <td className="py-3 px-4 pr-5">
                    {exp.plazo_proximo && exp.plazo_proximo.dias_restantes <= 5 && (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                        exp.plazo_proximo.dias_restantes <= 2
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        <AlertTriangle size={12} />
                        {exp.plazo_proximo.dias_restantes}d
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ── Tab: Documentos ─────────────────────────────────────────────────────────

const TIPOS_DOC: Record<string, string> = {
  acta_notarial: 'Acta Notarial',
  escritura_publica: 'Escritura Pública',
  testimonio: 'Testimonio',
  contrato_comercial: 'Contrato Comercial',
  contrato_laboral: 'Contrato Laboral',
  poder: 'Poder',
  demanda_memorial: 'Demanda / Memorial',
  resolucion_judicial: 'Resolución Judicial',
  otro: 'Otro',
};

interface DocItemFull {
  id: string;
  nombre_archivo: string;
  nombre_original: string | null;
  codigo_documento: string | null;
  tipo: string | null;
  titulo: string | null;
  fecha_documento: string | null;
  estado: string;
  cliente_id: string | null;
  archivo_url: string;
  created_at: string;
  cliente: { id: string; codigo: string; nombre: string } | null;
}

function TabDocumentos({ clienteId, onRefetch }: {
  clienteId: string;
  onRefetch: () => Promise<void>;
}) {
  const router = useRouter();
  const { mutate } = useMutate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ id: string; nombre: string } | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentoParaEditar | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocItemFull | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [transcribeStatus, setTranscribeStatus] = useState<{ docName: string; status: string; downloadUrl?: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; type: 'success' | 'error'; message: string }[]>([]);

  const params = new URLSearchParams();
  params.set('cliente_id', clienteId);
  if (tipoFilter) params.set('tipo', tipoFilter);
  if (search) params.set('q', search);
  params.set('page', String(page));
  params.set('limit', '25');

  const { data, loading, refetch } = useFetch<{
    data: DocItemFull[]; total: number; totalPages: number;
  }>(`/api/admin/documentos?${params}`);

  const docs = data?.data ?? [];

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const verPDF = (d: DocItemFull) => {
    setPreviewDoc({ id: d.id, nombre: d.nombre_original ?? d.nombre_archivo });
  };

  const descargar = async (d: DocItemFull) => {
    try {
      const res = await adminFetch(`/api/admin/documentos/${d.id}`);
      const json = await res.json();
      if (json.signed_url) {
        const url = `${json.signed_url}&download=${encodeURIComponent(d.nombre_original ?? d.nombre_archivo)}`;
        safeWindowOpen(url);
      }
    } catch { /* ignore */ }
  };

  const eliminar = useCallback(async (id: string) => {
    setDeletingIds(prev => new Set([...prev, id]));
    const result = await mutate(`/api/admin/documentos/${id}`, { method: 'DELETE' });
    setDeletingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (result) {
      addToast('Documento eliminado', 'success');
      refetch();
      onRefetch();
    } else {
      addToast('Error al eliminar', 'error');
    }
    setDeleteTarget(null);
  }, [mutate, refetch, onRefetch, addToast]);

  const transcribir = async (d: DocItemFull) => {
    setTranscribingId(d.id);
    setTranscribeStatus({ docName: d.titulo ?? d.nombre_archivo, status: 'Transcribiendo…' });
    try {
      const res = await adminFetch('/api/admin/documentos/transcribir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: d.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTranscribeStatus({ docName: d.titulo ?? d.nombre_archivo, status: `Error: ${json.error}` });
      } else {
        setTranscribeStatus({
          docName: `${json.transcripcion.paginas} páginas transcritas`,
          status: 'completado',
          downloadUrl: json.transcripcion.download_url,
        });
        refetch();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconocido';
      setTranscribeStatus({ docName: d.titulo ?? d.nombre_archivo, status: `Error: ${msg}` });
    } finally {
      setTranscribingId(null);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="text" placeholder="Buscar por título, archivo…"
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-64 px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]" />
        <select value={tipoFilter} onChange={e => { setTipoFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0891B2]/20 focus:border-[#0891B2]">
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_DOC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => router.push(`/admin/documentos/upload?cliente_id=${clienteId}`)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
          <UploadIcon size={14} /> Subir documento
        </button>
      </div>

      <Section title={`Documentos (${total})`} noPadding>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Cargando…</div>
        ) : docs.length === 0 ? (
          <EmptyState icon="📁" title="Sin documentos" description={search || tipoFilter ? 'No hay documentos con esos filtros' : 'Sube el primer documento de este cliente'}
            action={{ label: '+ Subir documento', onClick: () => router.push(`/admin/documentos/upload?cliente_id=${clienteId}`) }} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200">
                    {['Archivo', 'Título', 'Tipo', 'Estado', 'Fecha', 'Acciones'].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docs.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 pl-5 max-w-[260px]">
                        <button onClick={() => verPDF(d)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-full text-left"
                          title="Vista previa">
                          {d.nombre_original ?? d.nombre_archivo}
                        </button>
                        {d.codigo_documento && (
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{d.codigo_documento}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700 max-w-[220px] truncate" title={d.titulo ?? ''}>{d.titulo ?? '—'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{d.tipo ? (TIPOS_DOC[d.tipo] ?? d.tipo) : '—'}</td>
                      <td className="py-3 px-4"><Badge variant={d.estado as any}>{d.estado}</Badge></td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {d.fecha_documento ? new Date(d.fecha_documento).toLocaleDateString('es-GT') : new Date(d.created_at).toLocaleDateString('es-GT')}
                      </td>
                      <td className="py-3 px-4 pr-5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => verPDF(d)}
                            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
                            title="Ver documento">
                            <Eye size={15} />
                          </button>
                          <button onClick={() => descargar(d)}
                            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
                            title="Descargar">
                            <Download size={15} />
                          </button>
                          <button onClick={() => setEditingDoc({
                            id: d.id, titulo: d.titulo, tipo: d.tipo,
                            cliente_id: d.cliente_id, codigo_documento: d.codigo_documento,
                            fecha_documento: d.fecha_documento, cliente: d.cliente,
                          })}
                            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
                            title="Editar metadata">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => transcribir(d)}
                            disabled={transcribingId === d.id}
                            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700 disabled:opacity-40"
                            title="Transcribir con IA">
                            <Languages size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(d)}
                            disabled={deletingIds.has(d.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-slate-500 hover:text-red-600 disabled:opacity-40"
                            title="Eliminar">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <p className="text-sm text-slate-500">Página {page} de {totalPages} · {total} documentos</p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                    className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      {previewDoc && (
        <DocumentViewer docId={previewDoc.id} fileName={previewDoc.nombre} onClose={() => setPreviewDoc(null)} />
      )}

      {editingDoc && (
        <EditarDocumentoModal documento={editingDoc} onClose={() => setEditingDoc(null)}
          onSuccess={() => { setEditingDoc(null); refetch(); onRefetch(); addToast('Documento actualizado', 'success'); }} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar documento</h3>
            <p className="text-sm text-slate-600 mb-5">
              ¿Eliminar <strong>{deleteTarget.nombre_original ?? deleteTarget.nombre_archivo}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deletingIds.has(deleteTarget.id)}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => eliminar(deleteTarget.id)} disabled={deletingIds.has(deleteTarget.id)}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deletingIds.has(deleteTarget.id) ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {transcribeStatus && (
        <div className="fixed bottom-6 right-6 z-40 bg-white border border-slate-200 rounded-xl shadow-lg p-4 max-w-xs">
          <p className="text-xs font-medium text-slate-500 uppercase mb-1">Transcripción</p>
          <p className="text-sm text-slate-900">{transcribeStatus.docName}</p>
          <p className={`text-xs mt-1 ${transcribeStatus.status.startsWith('Error') ? 'text-red-600' : 'text-slate-500'}`}>
            {transcribeStatus.status}
          </p>
          {transcribeStatus.downloadUrl && (
            <a href={transcribeStatus.downloadUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-[#0891B2] hover:underline mt-1 inline-block">
              Descargar transcripción
            </a>
          )}
          <button onClick={() => setTranscribeStatus(null)}
            className="absolute top-2 right-2 text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
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

interface CotizacionConPagos {
  id: string;
  numero: string;
  fecha_emision: string;
  estado: string;
  total: number;
  monto_pagado: number;
  pdf_url: string | null;
}

function TabCotizaciones({ clienteId, clienteNombre }: { clienteId: string; clienteNombre: string }) {
  const router = useRouter();
  const { data, loading } = useFetch<{ data: CotizacionConPagos[]; total: number }>(
    `/api/admin/contabilidad/cotizaciones?cliente_id=${clienteId}&limit=100`
  );
  const cotizaciones = data?.data ?? [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>;

  if (!cotizaciones.length) return (
    <EmptyState icon="📋" title="Sin cotizaciones" description="Este cliente no tiene cotizaciones"
      action={{ label: '+ Nueva cotización', onClick: () => window.location.href = `/admin/ai?prompt=Genera una cotización para ${clienteNombre}` }} />
  );

  // KPIs
  const totalCotizado = cotizaciones.filter(c => c.estado !== 'rechazada' && c.estado !== 'vencida')
    .reduce((s, c) => s + c.total, 0);
  const totalPagado = cotizaciones.reduce((s, c) => s + (c.monto_pagado ?? 0), 0);
  const saldoPendiente = cotizaciones
    .filter(c => c.estado !== 'rechazada' && c.estado !== 'vencida')
    .reduce((s, c) => s + Math.max(0, c.total - (c.monto_pagado ?? 0)), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Total cotizado" value={Q(totalCotizado)} />
        <StatCard label="Total pagado" value={Q(totalPagado)} accent="emerald" />
        <StatCard label="Saldo pendiente" value={Q(saldoPendiente)} accent={saldoPendiente > 0 ? 'amber' : 'emerald'} />
      </div>

      <Section title={`Cotizaciones (${cotizaciones.length})`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {['Número', 'Fecha', 'Estado', 'Total', 'Pagado', 'Saldo', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cotizaciones.map(cot => {
                const saldo = Math.max(0, cot.total - (cot.monto_pagado ?? 0));
                return (
                  <tr key={cot.id} onClick={() => router.push(`/admin/contabilidad/cotizaciones/${cot.id}`)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <td className="py-3 px-4 pl-5 text-sm font-medium text-slate-900 font-mono">{cot.numero}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      {new Date(cot.fecha_emision).toLocaleDateString('es-GT')}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ESTADO_COT_BADGE[cot.estado] ?? 'bg-slate-100 text-slate-600'
                      }`}>{cot.estado}</span>
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-slate-900">{Q(cot.total)}</td>
                    <td className="py-3 px-4 text-sm text-emerald-700">{Q(cot.monto_pagado ?? 0)}</td>
                    <td className="py-3 px-4 text-sm font-medium" style={{ color: saldo > 0 ? '#b45309' : '#64748b' }}>
                      {saldo > 0 ? Q(saldo) : '—'}
                    </td>
                    <td className="py-3 px-4 pr-5">
                      <div className="flex items-center gap-3">
                        {cot.pdf_url ? (
                          <a
                            href={`${supabaseUrl}/storage/v1/object/public/documentos/${cot.pdf_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline">
                            PDF
                          </a>
                        ) : null}
                        <button onClick={e => { e.stopPropagation(); router.push(`/admin/contabilidad/cotizaciones/${cot.id}#tramites`); }}
                          className="text-sm text-[#0891B2] hover:underline">
                          Trámites
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

// ── Tab: Recibos de Caja ────────────────────────────────────────────────────

interface ReciboItem {
  id: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  concepto: string;
  email_enviado_at: string | null;
  email_error: string | null;
  pdf_url: string | null;
  origen: 'manual' | 'automatico';
  pago_id: string | null;
  cliente: { id: string; nombre: string; nit: string | null; email: string | null } | null;
  cotizacion: { id: string; numero: string } | null;
}

function TabRecibos({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { mutate } = useMutate();
  const [page, setPage] = useState(1);
  const [reciboModal, setReciboModal] = useState<ReciboItem | null>(null);
  const [reciboEliminar, setReciboEliminar] = useState<ReciboItem | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const params = new URLSearchParams();
  params.set('cliente_id', clienteId);
  params.set('page', String(page));
  params.set('limit', '20');

  const { data, loading, refetch } = useFetch<{
    data: ReciboItem[]; total: number; page: number; limit: number;
  }>(`/api/admin/contabilidad/recibos-caja?${params}`);

  const recibos = data?.data ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const totalEmitido = recibos.reduce((s, r) => s + (r.monto ?? 0), 0);

  const eliminarRecibo = useCallback(async () => {
    if (!reciboEliminar) return;
    setEliminando(true);
    let ok = false;
    await mutate(`/api/admin/contabilidad/recibos-caja/${reciboEliminar.id}`, {
      method: 'DELETE',
      onSuccess: () => { ok = true; },
      onError: (err: unknown) => alert(typeof err === 'string' ? err : 'Error al eliminar'),
    });
    setEliminando(false);
    if (ok) {
      setReciboEliminar(null);
      refetch();
    }
  }, [reciboEliminar, mutate, refetch]);

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>;

  if (recibos.length === 0) {
    return (
      <EmptyState icon="🧾" title="Sin recibos de caja"
        description="Los recibos se generan automáticamente al registrar el pago de gastos del trámite de una cotización."
        action={{ label: '+ Nuevo recibo manual', onClick: () => router.push(`/admin/contabilidad/recibos-caja/nuevo?cliente_id=${clienteId}`) }} />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Recibos emitidos" value={String(data?.total ?? 0)} />
        <StatCard label="Total en página" value={Q(totalEmitido)} accent="emerald" />
      </div>

      <Section title={`Recibos de Caja (${data?.total ?? 0})`} noPadding>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                {['Número', 'Cotización', 'Concepto', 'Monto', 'Emisión', 'Email', 'Acciones'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4 first:pl-5 last:pr-5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recibos.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-4 pl-5">
                    <span className="font-mono text-sm font-semibold text-slate-900">{r.numero}</span>
                  </td>
                  <td className="py-3 px-4 text-sm">
                    {r.cotizacion ? (
                      <button
                        onClick={() => router.push(`/admin/contabilidad/cotizaciones/${r.cotizacion!.id}`)}
                        className="text-[#0F172A] hover:underline font-mono text-xs"
                      >
                        {r.cotizacion.numero}
                      </button>
                    ) : '—'}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-700 max-w-[280px] truncate" title={r.concepto}>{r.concepto}</td>
                  <td className="py-3 px-4 text-sm font-semibold text-slate-900">{Q(r.monto)}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {new Date(r.fecha_emision).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Guatemala' })}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {r.email_enviado_at ? (
                      <span className="text-emerald-700">✓ Enviado</span>
                    ) : r.email_error ? (
                      <span className="text-amber-700" title={r.email_error}>⚠ Falló</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 pr-5 text-xs">
                    <div className="flex items-center gap-3">
                      <a
                        href={`/api/admin/contabilidad/recibos-caja/${r.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0F172A] hover:underline font-medium"
                      >
                        PDF
                      </a>
                      <button
                        onClick={() => setReciboModal(r)}
                        disabled={!r.pdf_url}
                        className="text-[#0F172A] hover:underline font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!r.pdf_url ? 'El recibo no tiene PDF' : (r.email_enviado_at ? 'Reenviar' : 'Enviar email')}
                      >
                        {r.email_enviado_at ? 'Reenviar' : 'Email'}
                      </button>
                      <button
                        onClick={() => router.push(`/admin/contabilidad/recibos-caja/${r.id}/editar`)}
                        className="text-[#0F172A] hover:underline font-medium"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setReciboEliminar(r)}
                        className="text-red-600 hover:underline font-medium"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">← Anterior</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-30">Siguiente →</button>
            </div>
          </div>
        )}
      </Section>

      {reciboModal && (
        <EnviarReciboEmailModal
          recibo={reciboModal}
          onClose={() => setReciboModal(null)}
          onSuccess={() => { setReciboModal(null); refetch(); }}
        />
      )}

      {reciboEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !eliminando && setReciboEliminar(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Eliminar recibo {reciboEliminar.numero}</h3>
            <p className="text-sm text-slate-600 mb-2">
              ¿Eliminar el recibo <strong className="font-mono">{reciboEliminar.numero}</strong>? Esta acción no se puede deshacer.
            </p>
            {reciboEliminar.email_enviado_at && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-3">
                Este recibo ya fue enviado al cliente. Se eliminará igualmente.
              </div>
            )}
            {(reciboEliminar.origen === 'automatico' || reciboEliminar.pago_id) && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-3">
                Este recibo proviene de un pago confirmado. El pago vinculado seguirá registrado.
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setReciboEliminar(null)} disabled={eliminando}
                className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={eliminarRecibo} disabled={eliminando}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {eliminando ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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
                  <td className="py-3 px-4 text-sm text-slate-700">{p.fecha_pago}</td>
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

// ── Tab: Mercantil ──────────────────────────────────────────────────────────

function TabMercantil({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { data, loading } = useFetch<{ data: TramiteMercantil[] }>(
    `/api/admin/mercantil?cliente_id=${clienteId}&limit=100`
  );
  const tramites = data?.data ?? [];

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>;

  if (tramites.length === 0) {
    return (
      <EmptyState icon="🏢" title="Sin trámites mercantiles" description="Este cliente no tiene trámites de cumplimiento mercantil"
        action={{ label: '+ Nuevo Trámite', onClick: () => router.push(`/admin/mercantil/nuevo`) }} />
    );
  }

  return (
    <Section title={`Trámites Mercantiles (${tramites.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {['', 'Categoría', 'No. Registro', 'Vencimiento', 'Estado'].map((h, i) => (
                <th key={i} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tramites.map(t => {
              const sem = getSemaforoMercantil(t.fecha_vencimiento, t.estado, t.alerta_dias_antes);
              return (
                <tr key={t.id} onClick={() => router.push(`/admin/mercantil/${t.id}`)} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <td className="py-2.5 px-3"><span className={`inline-block w-2 h-2 rounded-full ${SEMAFORO_DOT[sem]}`} /></td>
                  <td className="py-2.5 px-3 text-sm text-slate-900">{CATEGORIA_MERCANTIL_SHORT[t.categoria]}</td>
                  <td className="py-2.5 px-3 text-sm text-slate-600 font-mono">{t.numero_registro || '—'}</td>
                  <td className="py-2.5 px-3 text-sm text-slate-600">{t.fecha_vencimiento || '—'}</td>
                  <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_MERCANTIL_COLOR[t.estado]}`}>{ESTADO_MERCANTIL_LABEL[t.estado]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

// ── Tab: Laboral ────────────────────────────────────────────────────────────

function TabLaboral({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const { data, loading } = useFetch<{ data: TramiteLaboral[] }>(
    `/api/admin/laboral?cliente_id=${clienteId}&limit=100`
  );
  const tramites = data?.data ?? [];

  if (loading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>;

  if (tramites.length === 0) {
    return (
      <EmptyState icon="👷" title="Sin trámites laborales" description="Este cliente no tiene trámites de cumplimiento laboral"
        action={{ label: '+ Nuevo Trámite', onClick: () => router.push(`/admin/laboral/nuevo`) }} />
    );
  }

  return (
    <Section title={`Trámites Laborales (${tramites.length})`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              {['', 'Categoría', 'Empleado', 'Vigencia', 'Estado'].map((h, i) => (
                <th key={i} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-2.5 px-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tramites.map(t => {
              const sem = getSemaforoLaboral(t.fecha_fin, t.estado, t.alerta_dias_antes);
              return (
                <tr key={t.id} onClick={() => router.push(`/admin/laboral/${t.id}`)} className="hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <td className="py-2.5 px-3"><span className={`inline-block w-2 h-2 rounded-full ${SEMAFORO_LABORAL_DOT[sem]}`} /></td>
                  <td className="py-2.5 px-3 text-sm text-slate-900">{CATEGORIA_LABORAL_SHORT[t.categoria]}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-sm text-slate-900">{t.nombre_empleado || '—'}</div>
                    {t.puesto && <div className="text-xs text-slate-400">{t.puesto}</div>}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-slate-600">
                    {t.fecha_inicio && <span>{t.fecha_inicio}</span>}
                    {t.fecha_inicio && t.fecha_fin && <span> — </span>}
                    {t.fecha_fin && <span>{t.fecha_fin}</span>}
                    {!t.fecha_inicio && !t.fecha_fin && '—'}
                  </td>
                  <td className="py-2.5 px-3"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_LABORAL_COLOR[t.estado]}`}>{ESTADO_LABORAL_LABEL[t.estado]}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
