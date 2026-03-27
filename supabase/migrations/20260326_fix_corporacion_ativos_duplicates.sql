-- ============================================================================
-- Migration: Find and resolve CORPORACION ATIVOS duplicate records
-- Run in Supabase SQL Editor
-- ============================================================================

-- ── STEP 1: Find duplicate records ─────────────────────────────────────────
-- Shows all clients matching "CORPORACION ATIVOS" or similar

SELECT id, codigo, nombre, nit, tipo, email, telefono, activo, created_at
FROM legal.clientes
WHERE nombre ILIKE '%CORPORACION ATIVOS%'
   OR nombre ILIKE '%CORPORACION ACTIVOS%'
   OR nombre ILIKE '%CORP%ATIVOS%'
ORDER BY created_at ASC;

-- ── STEP 2: Check linked data for each duplicate ──────────────────────────
-- Replace the UUIDs below with the actual IDs from Step 1 results.
-- Uncomment and run after identifying the duplicate IDs.

/*
-- Set the IDs here (oldest = keep, newest = duplicate to delete)
-- Example:
--   primary_id = (the one with more linked data / created first)
--   duplicate_id = (the one to merge into primary and then delete)

DO $$
DECLARE
  primary_id UUID := 'REPLACE_WITH_PRIMARY_ID';
  duplicate_id UUID := 'REPLACE_WITH_DUPLICATE_ID';
  cnt_expedientes INT;
  cnt_documentos INT;
  cnt_citas INT;
  cnt_pagos INT;
  cnt_cotizaciones INT;
  cnt_facturas INT;
  cnt_representantes INT;
BEGIN
  -- Count linked data for PRIMARY
  RAISE NOTICE '=== Datos vinculados al registro PRIMARIO (%) ===', primary_id;
  SELECT count(*) INTO cnt_expedientes FROM legal.expedientes WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_documentos FROM legal.documentos WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_citas FROM legal.citas WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_pagos FROM legal.pagos WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_cotizaciones FROM legal.cotizaciones WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_facturas FROM legal.facturas WHERE cliente_id = primary_id;
  SELECT count(*) INTO cnt_representantes FROM legal.cliente_representantes WHERE cliente_id = primary_id;
  RAISE NOTICE 'Expedientes: %, Documentos: %, Citas: %, Pagos: %, Cotizaciones: %, Facturas: %, Representantes: %',
    cnt_expedientes, cnt_documentos, cnt_citas, cnt_pagos, cnt_cotizaciones, cnt_facturas, cnt_representantes;

  -- Count linked data for DUPLICATE
  RAISE NOTICE '=== Datos vinculados al registro DUPLICADO (%) ===', duplicate_id;
  SELECT count(*) INTO cnt_expedientes FROM legal.expedientes WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_documentos FROM legal.documentos WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_citas FROM legal.citas WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_pagos FROM legal.pagos WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_cotizaciones FROM legal.cotizaciones WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_facturas FROM legal.facturas WHERE cliente_id = duplicate_id;
  SELECT count(*) INTO cnt_representantes FROM legal.cliente_representantes WHERE cliente_id = duplicate_id;
  RAISE NOTICE 'Expedientes: %, Documentos: %, Citas: %, Pagos: %, Cotizaciones: %, Facturas: %, Representantes: %',
    cnt_expedientes, cnt_documentos, cnt_citas, cnt_pagos, cnt_cotizaciones, cnt_facturas, cnt_representantes;
END $$;
*/

-- ── STEP 3: Merge and delete duplicate ────────────────────────────────────
-- Moves all linked data from duplicate → primary, then deletes duplicate.
-- Uncomment and run AFTER verifying Step 2.

/*
DO $$
DECLARE
  primary_id UUID := 'REPLACE_WITH_PRIMARY_ID';
  duplicate_id UUID := 'REPLACE_WITH_DUPLICATE_ID';
BEGIN
  -- Move all linked records from duplicate to primary
  UPDATE legal.expedientes SET cliente_id = primary_id WHERE cliente_id = duplicate_id;
  UPDATE legal.documentos SET cliente_id = primary_id WHERE cliente_id = duplicate_id;
  UPDATE legal.citas SET cliente_id = primary_id WHERE cliente_id = duplicate_id;
  UPDATE legal.pagos SET cliente_id = primary_id WHERE cliente_id = duplicate_id;
  UPDATE legal.cotizaciones SET cliente_id = primary_id WHERE cliente_id = duplicate_id;
  UPDATE legal.facturas SET cliente_id = primary_id WHERE cliente_id = duplicate_id;

  -- Move representantes (skip if already exists to avoid unique constraint violations)
  UPDATE legal.cliente_representantes
  SET cliente_id = primary_id
  WHERE cliente_id = duplicate_id
    AND representante_id NOT IN (
      SELECT representante_id FROM legal.cliente_representantes WHERE cliente_id = primary_id
    );

  -- Delete orphaned representante links
  DELETE FROM legal.cliente_representantes WHERE cliente_id = duplicate_id;

  -- Delete the duplicate client record
  DELETE FROM legal.clientes WHERE id = duplicate_id;

  RAISE NOTICE 'Duplicado eliminado. Todos los datos fueron migrados al registro primario.';
END $$;
*/
