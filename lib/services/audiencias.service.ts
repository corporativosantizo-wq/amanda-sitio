// ============================================================================
// lib/services/audiencias.service.ts
// Lógica de negocio del módulo de Audiencias (tabla legal.audiencias).
//
// Acceso server-side con createAdminClient() (service_role, bypassa RLS), igual
// que expedientes.service.ts / citas.service.ts. La autorización la da el
// middleware Clerk (proxy.ts), no este servicio.
//
// REUSA / convive con citas: esta tabla es el registro formal de audiencias
// judiciales; NO toca legal.citas. La rama tipo='audiencia' de citas se retira
// recién en el cutover (Fase 8).
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import type { Audiencia, AudienciaInsert } from '@/lib/types/audiencias';

const db = () => createAdminClient();

export class AudienciaError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'AudienciaError';
  }
}

const SELECT_CON_RELACIONES =
  '*, cliente:clientes(id, codigo, nombre, email), expediente:expedientes(id, numero_expediente)';

export async function crearAudiencia(input: AudienciaInsert): Promise<Audiencia> {
  if (!input.fecha_hora_inicio) {
    throw new AudienciaError('fecha_hora_inicio es obligatorio');
  }
  if (!input.modalidad) {
    throw new AudienciaError('modalidad es obligatoria');
  }

  const { data, error } = await db()
    .from('audiencias')
    .insert({
      expediente_id: input.expediente_id ?? null,
      cliente_id: input.cliente_id ?? null,
      titulo: input.titulo ?? null,
      tipo_audiencia: input.tipo_audiencia ?? null,
      modalidad: input.modalidad,
      fecha_hora_inicio: input.fecha_hora_inicio,
      fecha_hora_fin: input.fecha_hora_fin ?? null,
      juzgado: input.juzgado ?? null,
      sala: input.sala ?? null,
      ubicacion: input.ubicacion ?? null,
      enlace_virtual: input.enlace_virtual ?? null,
      plataforma: input.plataforma ?? null,
      instrucciones: input.instrucciones ?? null,
      emails_cc: input.emails_cc?.length ? input.emails_cc : null,
      notas_internas: input.notas_internas ?? null,
      // estado se deja en el default de la tabla ('programada').
    })
    .select(SELECT_CON_RELACIONES)
    .single();

  if (error) throw new AudienciaError('Error al crear audiencia', error);
  return data as Audiencia;
}
