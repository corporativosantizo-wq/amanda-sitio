-- ============================================================================
-- Migración: entidades_mercantiles + documentos_mercantiles
-- Panel centralizado por entidad mercantil
-- ============================================================================

-- Tabla central de entidades mercantiles
CREATE TABLE IF NOT EXISTS legal.entidades_mercantiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Datos de la entidad
  nombre text NOT NULL,
  nombre_corto text,
  tipo_entidad text NOT NULL DEFAULT 'sociedad_anonima'
    CHECK (tipo_entidad IN ('sociedad_anonima', 'sociedad_limitada', 'empresa_individual', 'otra')),
  nit text,

  -- Datos de inscripción en Registro Mercantil
  registro_mercantil_numero int,
  registro_mercantil_folio int,
  registro_mercantil_libro int,
  patente_comercio text,

  -- Escritura constitutiva
  escritura_numero int,
  escritura_fecha date,
  escritura_notario text,
  escritura_archivo_url text,

  -- Representante legal actual
  representante_legal_nombre text,
  representante_legal_cargo text DEFAULT 'Administrador Único y Representante Legal',
  representante_legal_registro int,
  representante_legal_folio int,
  representante_legal_libro int,

  -- Vinculación con módulos existentes
  cliente_id uuid REFERENCES legal.clientes(id),
  expediente_id uuid REFERENCES legal.expedientes(id),

  -- Metadata
  activa boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Documentos mercantiles vinculados a la entidad
CREATE TABLE IF NOT EXISTS legal.documentos_mercantiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_id uuid NOT NULL REFERENCES legal.entidades_mercantiles(id) ON DELETE CASCADE,

  tipo text NOT NULL CHECK (tipo IN (
    'escritura_constitutiva',
    'acta_asamblea',
    'certificacion_acta',
    'nombramiento',
    'patente_comercio',
    'modificacion_escritura',
    'otro'
  )),

  titulo text NOT NULL,
  descripcion text,
  fecha_documento date,
  numero_acta int,
  tipo_asamblea text,

  archivo_generado_url text,
  archivo_generado_nombre text,
  archivo_escaneado_url text,
  archivo_escaneado_nombre text,

  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'generado', 'firmado', 'inscrito')),

  registro_numero int,
  registro_folio int,
  registro_libro int,
  fecha_inscripcion date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_entidades_nombre ON legal.entidades_mercantiles(nombre);
CREATE INDEX idx_entidades_cliente ON legal.entidades_mercantiles(cliente_id);
CREATE INDEX idx_docs_mercantiles_entidad ON legal.documentos_mercantiles(entidad_id);
CREATE INDEX idx_docs_mercantiles_tipo ON legal.documentos_mercantiles(tipo);

-- RLS
ALTER TABLE legal.entidades_mercantiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.documentos_mercantiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON legal.entidades_mercantiles FOR ALL USING (current_setting('role') = 'service_role');
CREATE POLICY "service_role_only" ON legal.documentos_mercantiles FOR ALL USING (current_setting('role') = 'service_role');
