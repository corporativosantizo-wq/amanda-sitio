-- ============================================================================
-- Migración: Múltiples firmantes en citas de firma de documentos
-- Una cita de firma_documentos puede involucrar a varias partes (p.ej. un
-- contrato entre dos sociedades, cada una con su propio representante). Todas
-- firman en la MISMA cita, pero cada firmante recibe su propio correo de
-- confirmación personalizado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal.cita_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cita_id UUID NOT NULL REFERENCES legal.citas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  confirmacion_enviada BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cita_participantes_cita_id
  ON legal.cita_participantes(cita_id);

COMMENT ON TABLE legal.cita_participantes IS
  'Firmantes adicionales (además del contacto principal) de una cita de firma de documentos. Cada uno recibe su propio correo de confirmación.';
COMMENT ON COLUMN legal.cita_participantes.confirmacion_enviada IS
  'true una vez que se le envió su correo de confirmación de la cita de firma.';
