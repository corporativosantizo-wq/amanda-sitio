-- ============================================================================
-- Migration: 20260621_recordatorios_plantilla
--
-- Aditivo: distingue qué plantilla usar al enviar cada recordatorio de
-- audiencia (detalle completo "2 días" vs corto "2 horas"). Nullable; la tabla
-- está vacía. No toca nada más.
-- ============================================================================

ALTER TABLE legal.audiencias_recordatorios
  ADD COLUMN IF NOT EXISTS plantilla TEXT;

COMMENT ON COLUMN legal.audiencias_recordatorios.plantilla IS
  'Qué plantilla rinde el envío: previo_2dias (detalle completo, respeta ventana '
  'hábil) | previo_2horas (corto, sin ventana). Lo setea el encolado automático.';
