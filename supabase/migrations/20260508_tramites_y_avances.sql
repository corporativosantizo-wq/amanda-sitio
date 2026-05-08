-- ============================================================================
-- Migration: 20260508_tramites_y_avances
--
-- Feature: Seguimiento de avances de trámites vinculados a cotizaciones.
--
-- Cambios:
--   1. ENUM legal.estado_tramite (pendiente, en_proceso, completado, suspendido)
--   2. Tabla legal.tramites
--   3. FK tramite_id en legal.cotizacion_items (1:N items por trámite)
--   4. Tabla legal.tramite_avances (avances con adjunto opcional + flag notificado)
--   5. Indices, RLS habilitada, audit triggers
--   6. Auto-grupación de cotizaciones existentes (heurística A: pares
--      "Gastos de X" + "Honorarios profesionales por X" → 1 trámite)
--
-- Adjuntos: se reutiliza el bucket existente 'documentos' bajo path
--   tramite-avances/{tramite_id}/{filename}. No se crea bucket nuevo.
-- ============================================================================

-- 1. ENUM
DO $$ BEGIN
  CREATE TYPE legal.estado_tramite AS ENUM ('pendiente','en_proceso','completado','suspendido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla tramites
CREATE TABLE IF NOT EXISTS legal.tramites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES legal.cotizaciones(id) ON DELETE CASCADE,
  nombre        TEXT NOT NULL,
  estado        legal.estado_tramite NOT NULL DEFAULT 'pendiente',
  orden         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.tramites IS
  'Trámite vinculado a una cotización. Agrupa cotizacion_items relacionados '
  '(ej. par Gastos+Honorarios del mismo servicio). Cada trámite tiene una '
  'línea de tiempo de avances que se pueden comunicar al cliente.';

CREATE INDEX IF NOT EXISTS idx_tramites_cotizacion ON legal.tramites(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_tramites_estado     ON legal.tramites(estado);

ALTER TABLE legal.tramites ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_tramites ON legal.tramites;
CREATE TRIGGER audit_tramites
  AFTER INSERT OR UPDATE OR DELETE ON legal.tramites
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();

-- 3. FK tramite_id en cotizacion_items
ALTER TABLE legal.cotizacion_items
  ADD COLUMN IF NOT EXISTS tramite_id UUID
  REFERENCES legal.tramites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cotizacion_items_tramite ON legal.cotizacion_items(tramite_id);

COMMENT ON COLUMN legal.cotizacion_items.tramite_id IS
  'Trámite al que pertenece este ítem. NULL = no asignado a ningún trámite '
  '(ej. ítems creados antes de la migración de trámites o si se borra el '
  'trámite contenedor — la fila item permanece).';

-- 4. Tabla tramite_avances
CREATE TABLE IF NOT EXISTS legal.tramite_avances (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_id     UUID NOT NULL REFERENCES legal.tramites(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL DEFAULT current_date,
  descripcion    TEXT NOT NULL CHECK (length(trim(descripcion)) > 0),
  documento_url  TEXT,
  notificado     BOOLEAN NOT NULL DEFAULT false,
  notificado_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.tramite_avances IS
  'Avance individual sobre un trámite. documento_url apunta al bucket '
  '"documentos" bajo prefijo tramite-avances/. notificado=true cuando se '
  'incluyó en un email "Informar al cliente".';

CREATE INDEX IF NOT EXISTS idx_tramite_avances_tramite    ON legal.tramite_avances(tramite_id);
CREATE INDEX IF NOT EXISTS idx_tramite_avances_pendientes ON legal.tramite_avances(tramite_id) WHERE notificado = false;
CREATE INDEX IF NOT EXISTS idx_tramite_avances_fecha      ON legal.tramite_avances(fecha DESC);

ALTER TABLE legal.tramite_avances ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS audit_tramite_avances ON legal.tramite_avances;
CREATE TRIGGER audit_tramite_avances
  AFTER INSERT OR UPDATE OR DELETE ON legal.tramite_avances
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();

-- 5. Trigger de updated_at en tramites
CREATE OR REPLACE FUNCTION legal.tramites_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tramites_updated_at ON legal.tramites;
CREATE TRIGGER tramites_updated_at
  BEFORE UPDATE ON legal.tramites
  FOR EACH ROW EXECUTE FUNCTION legal.tramites_set_updated_at();

-- ============================================================================
-- 6. Migración de datos: auto-agrupar cotizaciones aceptadas
--
-- Heurística A (conservadora): los pares "Gastos de X" + "Honorarios
-- profesionales por X" se agrupan bajo un solo trámite cuando el sufijo
-- normalizado coincide. Todo lo demás queda 1 ítem = 1 trámite.
--
-- Esta sección sólo crea trámites para items que NO tengan tramite_id ya
-- asignado, por lo que es idempotente: re-correrla no duplica.
-- ============================================================================

WITH normalizados AS (
  SELECT
    ci.id, ci.cotizacion_id, ci.descripcion, ci.orden,
    CASE
      WHEN ci.descripcion ~* '^\s*gastos\s+(de|por|del)\s+' THEN
        regexp_replace(ci.descripcion, '^\s*gastos\s+(de|por|del)\s+', '', 'i')
      WHEN ci.descripcion ~* '^\s*honorarios(\s+profesionales)?\s+(de|por|del)\s+' THEN
        regexp_replace(ci.descripcion, '^\s*honorarios(\s+profesionales)?\s+(de|por|del)\s+', '', 'i')
      ELSE NULL
    END AS suffix_raw,
    CASE
      WHEN ci.descripcion ~* '^\s*gastos\s+(de|por|del)\s+' THEN 'gastos'
      WHEN ci.descripcion ~* '^\s*honorarios(\s+profesionales)?\s+(de|por|del)\s+' THEN 'honorarios'
      ELSE NULL
    END AS tipo_prefijo
  FROM legal.cotizacion_items ci
  JOIN legal.cotizaciones c ON c.id = ci.cotizacion_id
  WHERE c.estado = 'aceptada' AND ci.tramite_id IS NULL
),
con_clave AS (
  SELECT *,
    CASE WHEN suffix_raw IS NOT NULL
      THEN lower(regexp_replace(trim(suffix_raw), '\s+', ' ', 'g'))
      ELSE NULL
    END AS clave_match
  FROM normalizados
),
pares AS (
  SELECT cotizacion_id, clave_match, min(orden) AS orden_min,
         (upper(substring(min(suffix_raw),1,1)) || substring(min(suffix_raw),2)) AS nombre
  FROM con_clave
  WHERE clave_match IS NOT NULL
  GROUP BY cotizacion_id, clave_match
  HAVING count(*) FILTER (WHERE tipo_prefijo='gastos') >= 1
     AND count(*) FILTER (WHERE tipo_prefijo='honorarios') >= 1
),
ins_grupos AS (
  INSERT INTO legal.tramites (cotizacion_id, nombre, estado, orden)
  SELECT cotizacion_id,
         trim(regexp_replace(nombre, '\s+', ' ', 'g')),
         'pendiente'::legal.estado_tramite,
         orden_min
  FROM pares
  RETURNING id, cotizacion_id, nombre, orden
),
upd_items_grupo AS (
  UPDATE legal.cotizacion_items ci
  SET tramite_id = g.id
  FROM con_clave ck
  JOIN pares p
    ON p.cotizacion_id = ck.cotizacion_id
   AND p.clave_match   = ck.clave_match
  JOIN ins_grupos g
    ON g.cotizacion_id = p.cotizacion_id
   AND g.orden         = p.orden_min
   AND lower(trim(g.nombre)) = lower(trim(p.nombre))
  WHERE ci.id = ck.id
  RETURNING ci.id
),
ins_individuales AS (
  INSERT INTO legal.tramites (cotizacion_id, nombre, estado, orden)
  SELECT ci.cotizacion_id,
         trim(regexp_replace(ci.descripcion, '\s+', ' ', 'g')),
         'pendiente'::legal.estado_tramite,
         ci.orden
  FROM legal.cotizacion_items ci
  JOIN legal.cotizaciones c ON c.id = ci.cotizacion_id
  WHERE c.estado = 'aceptada'
    AND ci.tramite_id IS NULL
    AND ci.id NOT IN (SELECT id FROM upd_items_grupo)
  RETURNING id, cotizacion_id, orden
)
UPDATE legal.cotizacion_items ci
SET tramite_id = ii.id
FROM ins_individuales ii
WHERE ci.cotizacion_id = ii.cotizacion_id
  AND ci.orden = ii.orden
  AND ci.tramite_id IS NULL;
