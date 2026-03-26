-- ============================================================================
-- Migration: Create legal.escritura_documentos table (if not exists)
-- The notariado escrituras panel queries this table for PDF/DOCX files
-- but it was never created via migration
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal.escritura_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritura_id UUID NOT NULL REFERENCES legal.escrituras(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'borrador_docx', 'testimonio', 'aviso_trimestral',
    'aviso_general', 'escritura_pdf', 'escritura_docx'
  )),
  subcategoria TEXT,
  nombre_archivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamano_bytes BIGINT NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escritura_documentos_escritura
  ON legal.escritura_documentos(escritura_id);
CREATE INDEX IF NOT EXISTS idx_escritura_documentos_categoria
  ON legal.escritura_documentos(categoria);

-- RLS
ALTER TABLE legal.escritura_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "escritura_documentos_service"
  ON legal.escritura_documentos
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
