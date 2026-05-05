-- ============================================================================
-- Migration: 20260505_recibos_manuales_cc
--
-- Feature: Recibos de Caja manuales + correos en CC al enviar
--
-- Cambios:
--   1. recibos_caja: cotizacion_id y pago_id nullable; + columna `origen`
--   2. clientes: + `emails_cc_recibos text[]` (CC fijos por cliente)
--   3. Nueva tabla `recibos_caja_envios` (historial completo de envíos)
--
-- Compatibilidad:
--   - Los recibos automáticos ya existentes quedan con origen='automatico'.
--   - El flujo de creación automática sigue requiriendo cotizacion_id+pago_id
--     en el service layer; los nullables son SOLO para recibos manuales.
-- ============================================================================

-- 1. recibos_caja: relajar nullability + agregar origen
ALTER TABLE legal.recibos_caja
  ALTER COLUMN cotizacion_id DROP NOT NULL,
  ALTER COLUMN pago_id        DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='legal' AND table_name='recibos_caja' AND column_name='origen'
  ) THEN
    ALTER TABLE legal.recibos_caja
      ADD COLUMN origen TEXT NOT NULL DEFAULT 'automatico'
      CHECK (origen IN ('automatico', 'manual'));
  END IF;
END $$;

COMMENT ON COLUMN legal.recibos_caja.origen IS
  '`automatico` = creado al pagar gastos de una cotización (con pago_id). '
  '`manual` = creado a mano por el admin (puede no tener cotización ni pago).';

CREATE INDEX IF NOT EXISTS idx_recibos_caja_origen ON legal.recibos_caja(origen);

-- 2. clientes: agregar emails_cc_recibos
ALTER TABLE legal.clientes
  ADD COLUMN IF NOT EXISTS emails_cc_recibos TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN legal.clientes.emails_cc_recibos IS
  'Lista de emails que reciben copia visible (CC) cuando se envía un Recibo de Caja '
  'al cliente. La validación de formato se hace en el backend antes de guardar.';

-- 3. Tabla de historial de envíos
CREATE TABLE IF NOT EXISTS legal.recibos_caja_envios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recibo_id       UUID NOT NULL REFERENCES legal.recibos_caja(id) ON DELETE CASCADE,
  enviado_a       TEXT NOT NULL,
  cc              TEXT[] NOT NULL DEFAULT '{}',
  enviado_por     TEXT,                                  -- email del admin que disparó el envío
  enviado_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  exito           BOOLEAN NOT NULL,
  error_mensaje   TEXT,
  asunto          TEXT,                                  -- snapshot del asunto enviado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.recibos_caja_envios IS
  'Historial de cada envío de email de un Recibo de Caja (incluye CC, quién lo envió, '
  'éxito/error). Una fila por intento, no se sobrescribe.';

CREATE INDEX IF NOT EXISTS idx_recibos_caja_envios_recibo ON legal.recibos_caja_envios(recibo_id);
CREATE INDEX IF NOT EXISTS idx_recibos_caja_envios_fecha  ON legal.recibos_caja_envios(enviado_at DESC);

ALTER TABLE legal.recibos_caja_envios ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_recibos_caja_envios ON legal.recibos_caja_envios;
CREATE TRIGGER audit_recibos_caja_envios
  AFTER INSERT OR UPDATE OR DELETE ON legal.recibos_caja_envios
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();
