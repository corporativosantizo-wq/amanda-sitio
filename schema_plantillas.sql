-- ============================================================================
-- Schema: Administrador de Plantillas de Documentos
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal.plantillas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Metadata
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'general',
  descripcion TEXT,

  -- Definición de campos variables (JSONB array)
  -- Cada elemento: { id, label, tipo, requerido, opciones?, placeholder? }
  campos JSONB NOT NULL DEFAULT '[]',

  -- Texto de la plantilla con marcadores {{campo_id}}
  estructura TEXT NOT NULL DEFAULT '',

  -- Path al .docx original en Storage
  archivo_original TEXT,

  -- Estado
  activa BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_plantillas_tipo ON legal.plantillas(tipo);
CREATE INDEX IF NOT EXISTS idx_plantillas_activa ON legal.plantillas(activa);
CREATE INDEX IF NOT EXISTS idx_plantillas_created ON legal.plantillas(created_at DESC);

-- Permisos
GRANT ALL ON legal.plantillas TO authenticated, service_role;
