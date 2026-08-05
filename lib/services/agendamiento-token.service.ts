// ============================================================================
// lib/services/agendamiento-token.service.ts
// Validación del enlace personal de agendamiento por cotización.
//
// Patrón /pagar/cita: lookup por columna (cotizaciones.token_agendamiento) +
// validación por ESTADO, sin vencimiento por reloj. El enlace es válido solo
// mientras el trámite esté en curso:
//   estado = 'aceptada'  AND  tramite_finalizado_at IS NULL
//
// PRIVACIDAD: si el enlace se reenvía o se filtra, no debe exponer el caso.
// De aquí sale ÚNICAMENTE el nombre del cliente (para que confirme identidad)
// y los ids internos que el servidor necesita. Nunca monto, servicios,
// expediente ni correo.
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';

export type TokenAgendamiento =
  | { ok: true; cotizacionId: string; clienteId: string; clienteNombre: string }
  | { ok: false; motivo: 'no_encontrado' | 'no_activo' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function validarTokenAgendamiento(token: string): Promise<TokenAgendamiento> {
  const limpio = (token ?? '').trim();
  if (!UUID_RE.test(limpio)) return { ok: false, motivo: 'no_encontrado' };

  const { data: cot, error } = await createAdminClient()
    .from('cotizaciones')
    .select('id, estado, tramite_finalizado_at, cliente_id, cliente:clientes!cliente_id(id, nombre)')
    .eq('token_agendamiento', limpio)
    .maybeSingle();

  if (error) {
    console.error('[AgendarToken] Error consultando token:', error.message);
    return { ok: false, motivo: 'no_encontrado' };
  }
  if (!cot) return { ok: false, motivo: 'no_encontrado' };

  // El enlace vive mientras el trámite esté en curso.
  if (cot.estado !== 'aceptada' || cot.tramite_finalizado_at !== null) {
    return { ok: false, motivo: 'no_activo' };
  }

  const cliente = cot.cliente as { id: string; nombre: string } | null;
  if (!cliente) {
    console.error('[AgendarToken] Cotización sin cliente:', cot.id);
    return { ok: false, motivo: 'no_encontrado' };
  }

  return {
    ok: true,
    cotizacionId: cot.id,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
  };
}
