-- ============================================================================
-- Migración: outlook_event_id en legal.llamadas_programadas
-- Permite sincronizar reprogramaciones/cancelaciones con el evento de Outlook.
-- ============================================================================

ALTER TABLE legal.llamadas_programadas ADD COLUMN IF NOT EXISTS outlook_event_id TEXT;
COMMENT ON COLUMN legal.llamadas_programadas.outlook_event_id IS 'ID del evento en el calendario de Outlook de Amanda (para sincronizar reprogramaciones/cancelaciones).';
