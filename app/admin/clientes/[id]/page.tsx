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
import { Scale, Shield, Building2, AlertTriangle, Download } from 'lucide-react';
import type { CargoRepresentante } from '@/lib/types';
import { safeWindowOpen } from '@/lib/utils/validate-url';
import { CARGO_LABELS, CARGOS_DIRECCION, CARGOS_GESTION } from '@/lib/types';
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
  fecha: string;
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

type TabKey = 'datos' | 'citas' | 'expedientes' | 'mercantil' | 'laboral' | 'documentos' | 'cotizaciones' | 'pagos' | 'notas';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'datos', label: 'Datos generales', icon: '👤' },
  { key: 'citas', label: 'Citas', icon: '📅' },
  { key: 'expedientes', label: 'Expedientes', icon: '⚖️' },
  { key: 'mercantil', label: 'Mercantil', icon: '🏢' },
  { key: 'laboral', label: 'Laboral', icon: '👷' },
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
                {c.grupo_empresarial && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    {c.grupo_empresarial.nombre}
                  </span>
                )}
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
        const res = await fetch(`/api/admin/clientes/representantes?q=${encodeURIComponent(valor.trim())}`);
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
          const res = await fetch(`/api/admin/clientes/${emp.id}`);
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

  if (!expedientes.length) return (
    <EmptyState icon="⚖️" title="Sin expedientes" description="Este cliente no tiene expedientes registrados"
      action={{ label: '+ Nuevo Expediente', onClick: () => router.push(`/admin/expedientes/nuevo?cliente_id=${clienteId}`) }} />
  );

  const activos = expedientes.filter(e => e.estado === 'activo').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{activos} activo{activos !== 1 ? 's' : ''} de {expedientes.length} total</p>
        <div className="flex items-center gap-2">
          <button onClick={handleDownload} disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all">
            <Download size={14} />
            {downloading ? 'Descargando…' : 'Descargar'}
          </button>
          {grupoEmpresas && grupoEmpresas.length > 1 && (
            <button onClick={handleDownloadGrupo} disabled={downloadingGrupo}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-all">
              <Download size={14} />
              {downloadingGrupo ? 'Descargando…' : 'Grupo'}
            </button>
          )}
          <button onClick={() => router.push(`/admin/expedientes/nuevo?cliente_id=${clienteId}`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-gradient-to-r from-[#1E40AF] to-[#0891B2] text-white rounded-lg hover:shadow-lg transition-all">
            + Nuevo
          </button>
        </div>
      </div>

      <Section title={`Expedientes (${expedientes.length})`} noPadding>
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
              {expedientes.map(exp => (
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

function TabDocumentos({ documentos }: { documentos: DocRow[] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const openSignedUrl = async (doc: DocRow, download = false) => {
    setLoadingId(doc.id);
    try {
      const res = await fetch(`/api/admin/documentos/${doc.id}`);
      const data = await res.json();
      if (data.signed_url) {
        const url = download
          ? `${data.signed_url}&download=${encodeURIComponent(doc.nombre_archivo)}`
          : data.signed_url;
        safeWindowOpen(url);
      }
    } catch {
      // silently fail
    } finally {
      setLoadingId(null);
    }
  };

  if (!documentos.length) return (
    <EmptyState icon="📁" title="Sin documentos" description="No hay documentos clasificados para este cliente" />
  );

  return (
    <Section title={`Documentos (${documentos.length})`} noPadding>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {['Archivo', 'Título', 'Tipo', 'Estado', 'Fecha', 'Acciones'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider py-3 px-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {documentos.map((d: DocRow) => (
              <tr key={d.id} className="hover:bg-slate-50/50">
                <td className="py-3 px-4 max-w-[200px]">
                  <button
                    onClick={() => openSignedUrl(d)}
                    disabled={loadingId === d.id}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate block max-w-full text-left disabled:opacity-50"
                    title="Abrir vista previa"
                  >
                    {d.nombre_archivo}
                  </button>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{d.titulo ?? '—'}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{d.tipo ?? '—'}</td>
                <td className="py-3 px-4"><Badge variant={d.estado as any}>{d.estado}</Badge></td>
                <td className="py-3 px-4 text-sm text-slate-500">
                  {new Date(d.created_at).toLocaleDateString('es-GT')}
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openSignedUrl(d)}
                      disabled={loadingId === d.id}
                      className="p-1.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
                      title="Ver documento"
                    >
                      <span className="text-base">👁</span>
                    </button>
                    <button
                      onClick={() => openSignedUrl(d, true)}
                      disabled={loadingId === d.id}
                      className="p-1.5 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50"
                      title="Descargar"
                    >
                      <span className="text-base">📥</span>
                    </button>
                  </div>
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
