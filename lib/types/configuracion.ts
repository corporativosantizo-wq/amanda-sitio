// ============================================================================
// lib/types/configuracion.ts
// ============================================================================

export interface Configuracion {
  id: string;
  nombre_despacho: string;
  abogada_principal: string;
  colegiado: string;
  clave_notario: string;
  telefono: string | null;
  email: string | null;
  direccion: string | null;

  // Datos bancarios
  banco: string | null;
  tipo_cuenta: string | null;
  numero_cuenta: string | null;
  cuenta_nombre: string | null;

  // Configuración contable
  email_contador: string | null;
  iva_porcentaje: number;
  isr_porcentaje_bajo: number;
  isr_porcentaje_alto: number;
  isr_umbral: number;
  validez_cotizacion_dias: number;
  anticipo_porcentaje: number;

  // Cobranza
  recordatorio_amable_dias: number;
  recordatorio_firme_dias: number;
  recordatorio_legal_dias: number;

  // Notarial
  lugar_protocolo: string;
  departamento_protocolo: string;

  nit_empresa: string | null;

  // Outlook Calendar
  outlook_access_token_encrypted: string | null;
  outlook_refresh_token_encrypted: string | null;
  outlook_token_expires_at: string | null;

  created_at: string;
  updated_at: string;
}
