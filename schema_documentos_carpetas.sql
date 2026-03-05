-- ============================================================================
-- Schema: Documentos con carpetas por cliente y nomenclatura automática
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- 1. Agregar columnas nuevas
ALTER TABLE legal.documentos
  ADD COLUMN IF NOT EXISTS codigo_documento TEXT,
  ADD COLUMN IF NOT EXISTS nombre_original TEXT;

-- 2. Poblar nombre_original con datos existentes
UPDATE legal.documentos
SET nombre_original = nombre_archivo
WHERE nombre_original IS NULL;

-- 3. Índice único en codigo_documento (permite NULL para docs pendientes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_codigo
  ON legal.documentos (codigo_documento)
  WHERE codigo_documento IS NOT NULL;
