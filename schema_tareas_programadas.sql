-- ============================================================================
-- Migración: Tareas Programadas (Scheduled Tasks)
-- Agregar columnas para acciones automáticas del asistente IA
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- Nuevas columnas en legal.tareas
ALTER TABLE legal.tareas
  ADD COLUMN IF NOT EXISTS accion_automatica JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ejecutada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ejecutada_at TIMESTAMPTZ DEFAULT NULL;

-- Índice para el cron de tareas programadas
CREATE INDEX IF NOT EXISTS idx_tareas_programadas
  ON legal.tareas (estado, asignado_a, ejecutada, fecha_limite)
  WHERE accion_automatica IS NOT NULL AND ejecutada = false;

COMMENT ON COLUMN legal.tareas.accion_automatica IS 'JSON con la acción automática a ejecutar. Ejemplo: {"tipo": "enviar_email", "template": "solicitud_pago", "cliente_id": "uuid", "datos": {"concepto": "...", "monto": 5000}}';
COMMENT ON COLUMN legal.tareas.ejecutada IS 'true cuando la acción automática ya fue ejecutada por el cron';
COMMENT ON COLUMN legal.tareas.ejecutada_at IS 'Timestamp de cuando se ejecutó la acción automática';
