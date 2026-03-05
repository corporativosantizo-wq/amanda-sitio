-- ============================================================================
-- Módulos: Cumplimiento Mercantil y Cumplimiento Laboral
-- Tablas: tramites_mercantiles, historial_tramite_mercantil,
--         tramites_laborales, historial_tramite_laboral
-- ============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE legal.categoria_mercantil AS ENUM (
  'patente_comercio',
  'patente_sociedad',
  'inscripcion_empresa',
  'inscripcion_sociedad',
  'asamblea_ordinaria',
  'asamblea_extraordinaria',
  'convocatoria_asamblea',
  'acta_asamblea_libro',
  'acta_asamblea_notarial',
  'certificacion_acta',
  'emision_acciones',
  'modificacion_sociedad',
  'nombramiento_representante',
  'fusion',
  'disolucion',
  'sucursal',
  'otro'
);

CREATE TYPE legal.estado_tramite_mercantil AS ENUM (
  'pendiente',
  'en_proceso',
  'en_registro',
  'inscrito',
  'vigente',
  'vencido',
  'rechazado',
  'cancelado'
);

CREATE TYPE legal.accion_historial_mercantil AS ENUM (
  'creado',
  'enviado_registro',
  'observado',
  'subsanado',
  'inscrito',
  'renovado',
  'vencido',
  'otro'
);

CREATE TYPE legal.categoria_laboral AS ENUM (
  'contrato_individual',
  'contrato_temporal',
  'contrato_profesional',
  'reglamento_interno',
  'registro_contrato_igt',
  'libro_salarios',
  'pacto_colectivo',
  'otro'
);

CREATE TYPE legal.estado_tramite_laboral AS ENUM (
  'pendiente',
  'en_elaboracion',
  'firmado',
  'registrado',
  'vigente',
  'vencido',
  'cancelado'
);

CREATE TYPE legal.accion_historial_laboral AS ENUM (
  'creado',
  'elaborado',
  'firmado',
  'enviado_igt',
  'registrado',
  'renovado',
  'vencido',
  'cancelado',
  'otro'
);

-- ── Tabla: tramites_mercantiles ───────────────────────────────────────────

CREATE TABLE legal.tramites_mercantiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES legal.clientes(id) ON DELETE CASCADE,
  categoria legal.categoria_mercantil NOT NULL,
  subtipo text,
  estado legal.estado_tramite_mercantil NOT NULL DEFAULT 'pendiente',
  numero_registro text,
  fecha_tramite date NOT NULL DEFAULT CURRENT_DATE,
  fecha_inscripcion date,
  fecha_vencimiento date,
  es_recurrente boolean NOT NULL DEFAULT false,
  periodicidad_meses integer,
  alerta_dias_antes integer NOT NULL DEFAULT 30,
  numero_expediente_rm text,
  notario_responsable text,
  descripcion text,
  notas text,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tramites_mercantiles_cliente ON legal.tramites_mercantiles(cliente_id);
CREATE INDEX idx_tramites_mercantiles_estado ON legal.tramites_mercantiles(estado);
CREATE INDEX idx_tramites_mercantiles_categoria ON legal.tramites_mercantiles(categoria);
CREATE INDEX idx_tramites_mercantiles_vencimiento ON legal.tramites_mercantiles(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

-- ── Tabla: historial_tramite_mercantil ────────────────────────────────────

CREATE TABLE legal.historial_tramite_mercantil (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_id uuid NOT NULL REFERENCES legal.tramites_mercantiles(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  accion legal.accion_historial_mercantil NOT NULL,
  descripcion text NOT NULL,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_mercantil_tramite ON legal.historial_tramite_mercantil(tramite_id);

-- ── Tabla: tramites_laborales ─────────────────────────────────────────────

CREATE TABLE legal.tramites_laborales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES legal.clientes(id) ON DELETE CASCADE,
  categoria legal.categoria_laboral NOT NULL,
  estado legal.estado_tramite_laboral NOT NULL DEFAULT 'pendiente',
  nombre_empleado text,
  puesto text,
  fecha_inicio date,
  fecha_fin date,
  fecha_registro_igt date,
  numero_registro_igt text,
  salario numeric(12,2),
  moneda text NOT NULL DEFAULT 'GTQ' CHECK (moneda IN ('GTQ', 'USD')),
  es_temporal boolean NOT NULL DEFAULT false,
  duracion_meses integer,
  alerta_dias_antes integer NOT NULL DEFAULT 30,
  descripcion text,
  notas text,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tramites_laborales_cliente ON legal.tramites_laborales(cliente_id);
CREATE INDEX idx_tramites_laborales_estado ON legal.tramites_laborales(estado);
CREATE INDEX idx_tramites_laborales_categoria ON legal.tramites_laborales(categoria);
CREATE INDEX idx_tramites_laborales_fecha_fin ON legal.tramites_laborales(fecha_fin)
  WHERE fecha_fin IS NOT NULL;

-- ── Tabla: historial_tramite_laboral ──────────────────────────────────────

CREATE TABLE legal.historial_tramite_laboral (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tramite_id uuid NOT NULL REFERENCES legal.tramites_laborales(id) ON DELETE CASCADE,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  accion legal.accion_historial_laboral NOT NULL,
  descripcion text NOT NULL,
  documento_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_historial_laboral_tramite ON legal.historial_tramite_laboral(tramite_id);

-- ── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE legal.tramites_mercantiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.historial_tramite_mercantil ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.tramites_laborales ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.historial_tramite_laboral ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read and write all records (internal admin tool)
CREATE POLICY "tramites_mercantiles_all" ON legal.tramites_mercantiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "historial_mercantil_all" ON legal.historial_tramite_mercantil
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "tramites_laborales_all" ON legal.tramites_laborales
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "historial_laboral_all" ON legal.historial_tramite_laboral
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
