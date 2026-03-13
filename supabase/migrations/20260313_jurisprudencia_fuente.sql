-- ============================================================================
-- Agregar campo 'fuente' a jurisprudencia_tomos para diferenciar CSJ vs CC
-- ============================================================================

-- 1. Agregar columna fuente con default 'CSJ' (todos los existentes son CSJ)
ALTER TABLE legal.jurisprudencia_tomos
  ADD COLUMN IF NOT EXISTS fuente text NOT NULL DEFAULT 'CSJ';

-- 2. Crear índice para filtrar por fuente
CREATE INDEX IF NOT EXISTS idx_jurisprudencia_tomos_fuente
  ON legal.jurisprudencia_tomos (fuente);

-- 3. Check constraint para valores válidos
ALTER TABLE legal.jurisprudencia_tomos
  ADD CONSTRAINT chk_jurisprudencia_fuente
  CHECK (fuente IN ('CSJ', 'CC'));

-- 4. Carpetas para Gacetas CC
INSERT INTO legal.biblioteca_carpetas (id, nombre, icono, padre_id, orden) VALUES
  ('a1000000-0000-0000-0000-000000000007', 'Gacetas CC', '🏛️', NULL, 7)
ON CONFLICT (id) DO NOTHING;

INSERT INTO legal.biblioteca_carpetas (id, nombre, icono, padre_id, orden) VALUES
  ('b7000000-0000-0000-0000-000000000001', 'Inconstitucionalidades Generales',    '📜', 'a1000000-0000-0000-0000-000000000007', 1),
  ('b7000000-0000-0000-0000-000000000002', 'Amparos en Única Instancia',           '🛡️', 'a1000000-0000-0000-0000-000000000007', 2),
  ('b7000000-0000-0000-0000-000000000003', 'Apelaciones de Amparo',                '⚖️', 'a1000000-0000-0000-0000-000000000007', 3),
  ('b7000000-0000-0000-0000-000000000004', 'Apelaciones de Inconstitucionalidad',  '📋', 'a1000000-0000-0000-0000-000000000007', 4),
  ('b7000000-0000-0000-0000-000000000005', 'Opiniones Consultivas',                '💬', 'a1000000-0000-0000-0000-000000000007', 5),
  ('b7000000-0000-0000-0000-000000000006', 'Exhibición Personal',                  '👤', 'a1000000-0000-0000-0000-000000000007', 6)
ON CONFLICT (id) DO NOTHING;
