-- ============================================================================
-- Migración: Agregar nuevos tipos de evento al calendario admin
-- Tipos nuevos: audiencia, reunion, bloqueo_personal, evento_libre
-- ============================================================================

-- Eliminar la constraint existente y crear una nueva con los tipos adicionales
ALTER TABLE legal.citas
  DROP CONSTRAINT IF EXISTS citas_tipo_check;

ALTER TABLE legal.citas
  ADD CONSTRAINT citas_tipo_check
  CHECK (tipo IN (
    'consulta_nueva',
    'seguimiento',
    'audiencia',
    'reunion',
    'bloqueo_personal',
    'evento_libre'
  ));
