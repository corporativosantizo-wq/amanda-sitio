// ============================================================================
// app/admin/audiencias/[id]/page.tsx
// Detalle (solo lectura) de una audiencia del registro. La edición es el
// siguiente paso del módulo. Consume el GET del registro (NO el de Outlook).
// ============================================================================

'use client';

import { useRouter, useParams } from 'next/navigation';
import { useFetch } from '@/lib/hooks/use-fetch';
import {
  type Audiencia,
  MODALIDAD_AUDIENCIA_LABEL, MODALIDAD_AUDIENCIA_COLOR,
  ESTADO_AUDIENCIA_LABEL, ESTADO_AUDIENCIA_COLOR,
  PLATAFORMA_AUDIENCIA_LABEL, type PlataformaAudiencia,
  formatAudienciaFecha,
} from '@/lib/types/audiencias';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500 mb-0.5">{label}</div>
      <div className="text-sm text-slate-800">{children ?? '—'}</div>
    </div>
  );
}

export default function AudienciaDetallePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const { data, loading, error } = useFetch<{ audiencia: Audiencia }>(
    `/api/admin/audiencias/registro/${id}`,
  );
  const a = data?.audiencia;

  const sectionCls = 'bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4';

  if (loading) {
    return <div className="p-6 max-w-4xl"><div className="h-40 bg-slate-100 rounded-xl animate-pulse" /></div>;
  }
  if (error || !a) {
    return (
      <div className="p-6 max-w-4xl">
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-4">← Volver</button>
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-4">
          No se encontró la audiencia.
        </div>
      </div>
    );
  }

  const mostrarLugar = a.modalidad === 'presencial' || a.modalidad === 'hibrida';
  const mostrarConexion = a.modalidad === 'virtual' || a.modalidad === 'hibrida';
  const ccHeredado = a.cliente?.emails_cc ?? [];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700 mb-2">← Volver</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{a.titulo || 'Audiencia'}</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_AUDIENCIA_COLOR[a.estado]}`}>
              {ESTADO_AUDIENCIA_LABEL[a.estado]}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MODALIDAD_AUDIENCIA_COLOR[a.modalidad]}`}>
              {MODALIDAD_AUDIENCIA_LABEL[a.modalidad]}
            </span>
          </div>
          <button onClick={() => router.push(`/admin/audiencias/${a.id}/editar`)}
            className="px-4 py-2 text-sm font-medium border border-[#1E40AF] text-[#1E40AF] rounded-lg hover:bg-[#1E40AF]/5 transition-colors shrink-0">
            ✏️ Editar
          </button>
        </div>
      </div>

      {/* Cuándo + vínculos */}
      <div className={sectionCls}>
        <h2 className="font-semibold text-slate-900">Datos generales</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Campo label="Inicio">{formatAudienciaFecha(a.fecha_hora_inicio)}</Campo>
          <Campo label="Fin">{a.fecha_hora_fin ? formatAudienciaFecha(a.fecha_hora_fin) : '—'}</Campo>
          <Campo label="Tipo de audiencia">{a.tipo_audiencia || '—'}</Campo>
          <Campo label="Cliente">
            {a.cliente ? (
              <button onClick={() => router.push(`/admin/clientes/${a.cliente!.id}`)}
                className="text-[#1E40AF] hover:underline">
                {a.cliente.nombre} <span className="text-slate-400">({a.cliente.codigo})</span>
              </button>
            ) : '—'}
          </Campo>
          <Campo label="Expediente">
            {a.expediente ? (
              <button onClick={() => router.push(`/admin/expedientes/${a.expediente!.id}`)}
                className="text-[#1E40AF] hover:underline font-mono">
                {a.expediente.numero_expediente ?? '(sin número)'}
              </button>
            ) : '—'}
          </Campo>
        </div>
      </div>

      {/* Lugar (presencial / híbrida) */}
      {mostrarLugar && (
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Lugar</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Juzgado">{a.juzgado || '—'}</Campo>
            <Campo label="Sala">{a.sala || '—'}</Campo>
            <Campo label="Dirección / ubicación">{a.ubicacion || '—'}</Campo>
          </div>
        </div>
      )}

      {/* Conexión (virtual / híbrida) */}
      {mostrarConexion && (
        <div className={sectionCls}>
          <h2 className="font-semibold text-slate-900">Conexión virtual</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Campo label="Plataforma">
              {a.plataforma ? (PLATAFORMA_AUDIENCIA_LABEL[a.plataforma as PlataformaAudiencia] ?? a.plataforma) : '—'}
            </Campo>
            <div className="md:col-span-2">
              <Campo label="Enlace de conexión">
                {a.enlace_virtual
                  ? <a href={a.enlace_virtual} target="_blank" rel="noopener noreferrer" className="text-[#1E40AF] hover:underline break-all">{a.enlace_virtual}</a>
                  : '—'}
              </Campo>
            </div>
          </div>
        </div>
      )}

      {/* Instrucciones + CC */}
      <div className={sectionCls}>
        <h2 className="font-semibold text-slate-900">Comunicación al cliente</h2>
        <Campo label="Instrucciones para el cliente">
          {a.instrucciones ? <span className="whitespace-pre-wrap">{a.instrucciones}</span> : '—'}
        </Campo>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">CC de esta audiencia</div>
            {a.emails_cc && a.emails_cc.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {a.emails_cc.map(e => (
                  <span key={e} className="inline-flex items-center bg-cyan-50 text-[#0891B2] text-xs font-medium px-2 py-1 rounded-md">{e}</span>
                ))}
              </div>
            ) : <p className="text-sm text-slate-400">Sin copias</p>}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">CC del cliente (referencia)</div>
            {ccHeredado.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {ccHeredado.map(e => (
                    <span key={e} className="inline-flex items-center bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-md">{e}</span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">No se copian solos: se eligen al preparar cada recordatorio.</p>
              </>
            ) : <p className="text-sm text-slate-400">—</p>}
          </div>
        </div>
      </div>

      {/* Internas + meta */}
      <div className={sectionCls}>
        <h2 className="font-semibold text-slate-900">Interno</h2>
        <Campo label="Notas internas (no salen al cliente)">
          {a.notas_internas ? <span className="whitespace-pre-wrap">{a.notas_internas}</span> : '—'}
        </Campo>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
          <Campo label="Secuencia .ics">{a.ics_sequence}</Campo>
          <Campo label="Creada">{formatAudienciaFecha(a.created_at)}</Campo>
          <Campo label="Actualizada">{formatAudienciaFecha(a.updated_at)}</Campo>
        </div>
      </div>
    </div>
  );
}
