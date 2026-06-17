-- ============================================================================
-- Migración: Programación de envío para correos salientes
-- programado_para NULL  = envío manual (botón Enviar)
-- programado_para valor = se envía automáticamente en esa fecha/hora vía cron
--                         (/api/cron/salientes-programados, cada 15 min)
-- ============================================================================

ALTER TABLE legal.borradores_salientes
  ADD COLUMN IF NOT EXISTS programado_para TIMESTAMPTZ;

-- Índice para que el cron encuentre rápido los pendientes ya vencidos.
CREATE INDEX IF NOT EXISTS idx_borradores_salientes_programado
  ON legal.borradores_salientes(programado_para)
  WHERE status = 'pendiente' AND programado_para IS NOT NULL;

COMMENT ON COLUMN legal.borradores_salientes.programado_para IS
  'Fecha/hora (UTC) en que se debe enviar automáticamente. NULL = envío manual.';
