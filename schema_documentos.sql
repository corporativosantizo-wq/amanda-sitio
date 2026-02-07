-- ============================================================================
-- Schema: Sistema de Gestión Documental con IA
-- Ejecutar manualmente en Supabase SQL Editor
-- TAMBIÉN crear bucket 'documentos' en Supabase Storage (público: false)
-- ============================================================================

-- Tabla principal de documentos
CREATE TABLE IF NOT EXISTS legal.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Archivo en Storage
  storage_path TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL DEFAULT 0,

  -- Clasificación IA
  tipo TEXT CHECK (tipo IN (
    'contrato_comercial',
    'escritura_publica',
    'testimonio',
    'acta_notarial',
    'poder',
    'contrato_laboral',
    'demanda_memorial',
    'resolucion_judicial',
    'otro'
  )),
  titulo TEXT,
  descripcion TEXT,
  fecha_documento DATE,
  numero_documento TEXT,
  partes JSONB DEFAULT '[]',
  nombre_cliente_extraido TEXT,
  confianza_ia NUMERIC(3,2) DEFAULT 0.00,
  metadata JSONB DEFAULT '{}',

  -- Vinculación con cliente
  cliente_id UUID REFERENCES legal.clientes(id),

  -- Estado y revisión
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN (
    'pendiente', 'clasificado', 'aprobado', 'rechazado'
  )),
  notas TEXT,

  -- Timestamps
  clasificado_at TIMESTAMPTZ,
  aprobado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON legal.documentos(estado);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON legal.documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON legal.documentos(tipo);
CREATE INDEX IF NOT EXISTS idx_documentos_fecha ON legal.documentos(fecha_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_created ON legal.documentos(created_at DESC);

-- Permisos
GRANT ALL ON legal.documentos TO authenticated, service_role;

-- ============================================================================
-- IMPORTANTE: Crear bucket 'documentos' en Supabase Dashboard → Storage
-- Configuración:
--   Nombre: documentos
--   Público: NO
--   Tamaño máximo: 20MB
--   MIME types: application/pdf
-- ============================================================================
