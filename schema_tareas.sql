-- ============================================================================
-- schema_tareas.sql
-- Task Tracker / Bullet Journal para IURISLEX
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE legal.tipo_tarea AS ENUM ('tarea', 'evento', 'nota');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE legal.estado_tarea AS ENUM ('pendiente', 'en_progreso', 'completada', 'migrada', 'cancelada');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE legal.categoria_tarea AS ENUM ('cobros', 'documentos', 'audiencias', 'tramites', 'personal', 'seguimiento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE legal.asignado_tarea AS ENUM ('amanda', 'asistente', 'contador', 'asesora');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabla principal
CREATE TABLE IF NOT EXISTS legal.tareas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  tipo          legal.tipo_tarea NOT NULL DEFAULT 'tarea',
  estado        legal.estado_tarea NOT NULL DEFAULT 'pendiente',
  prioridad     legal.prioridad NOT NULL DEFAULT 'media',
  fecha_limite  DATE,
  fecha_completada TIMESTAMPTZ,
  cliente_id    UUID REFERENCES legal.clientes(id) ON DELETE SET NULL,
  expediente_id UUID,
  asignado_a    legal.asignado_tarea NOT NULL DEFAULT 'amanda',
  categoria     legal.categoria_tarea NOT NULL DEFAULT 'tramites',
  recurrente    BOOLEAN NOT NULL DEFAULT false,
  recurrencia_tipo TEXT CHECK (recurrencia_tipo IN ('diario', 'semanal', 'mensual')),
  notas         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON legal.tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_asignado ON legal.tareas(asignado_a);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON legal.tareas(fecha_limite);
CREATE INDEX IF NOT EXISTS idx_tareas_cliente ON legal.tareas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tareas_categoria ON legal.tareas(categoria);
CREATE INDEX IF NOT EXISTS idx_tareas_created ON legal.tareas(created_at DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION legal.set_tareas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tareas_updated ON legal.tareas;
CREATE TRIGGER trg_tareas_updated
  BEFORE UPDATE ON legal.tareas
  FOR EACH ROW EXECUTE FUNCTION legal.set_tareas_updated_at();

-- Auto-set fecha_completada when estado changes to 'completada'
CREATE OR REPLACE FUNCTION legal.set_tarea_completada()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'completada' AND OLD.estado != 'completada' THEN
    NEW.fecha_completada = now();
  END IF;
  IF NEW.estado != 'completada' THEN
    NEW.fecha_completada = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tarea_completada ON legal.tareas;
CREATE TRIGGER trg_tarea_completada
  BEFORE UPDATE ON legal.tareas
  FOR EACH ROW EXECUTE FUNCTION legal.set_tarea_completada();
