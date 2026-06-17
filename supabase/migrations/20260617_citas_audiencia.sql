-- ============================================================================
-- Migración: Campos de audiencia judicial en legal.citas
-- Para eventos tipo='audiencia' (audiencias judiciales). Se usan columnas
-- dedicadas (no JSON) para poder mostrarlas/filtrarlas fácilmente en el panel.
-- ============================================================================

ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS audiencia_materia text;
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS audiencia_expediente text;
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS audiencia_diligencia text;
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS audiencia_juzgado text;

COMMENT ON COLUMN legal.citas.audiencia_materia IS 'Audiencia judicial: materia (Penal, Civil, Familia, Laboral, etc.).';
COMMENT ON COLUMN legal.citas.audiencia_expediente IS 'Audiencia judicial: número de juicio/expediente.';
COMMENT ON COLUMN legal.citas.audiencia_diligencia IS 'Audiencia judicial: tipo de diligencia.';
COMMENT ON COLUMN legal.citas.audiencia_juzgado IS 'Audiencia judicial: juzgado/tribunal (opcional).';
