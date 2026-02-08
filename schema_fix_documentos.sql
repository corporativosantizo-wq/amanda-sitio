-- ============================================================================
-- Migration: Fix legal.documentos — make titulo nullable
-- Run manually in Supabase SQL Editor (OPTIONAL)
-- ============================================================================
-- The code has been updated to match the current DB column names:
--   archivo_url, archivo_tamano, cliente_nombre_detectado
--
-- This migration only makes titulo nullable so that document upload
-- (which creates rows with estado='pendiente') doesn't fail.
-- The titulo is set later during AI classification.
--
-- NOTE: If the table still has a NOT NULL constraint on titulo,
-- run this statement. Otherwise it's already fixed in the code
-- (crearDocumento now sets titulo = nombre_archivo by default).
-- ============================================================================

ALTER TABLE legal.documentos ALTER COLUMN titulo DROP NOT NULL;
