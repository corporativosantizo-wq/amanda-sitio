-- ============================================================================
-- Schema: Sistema de Citas con Outlook Calendar
-- Run manually in Supabase SQL Editor
-- ============================================================================

-- Tabla principal de citas
CREATE TABLE IF NOT EXISTS legal.citas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES legal.clientes(id),
  expediente_id UUID REFERENCES legal.expedientes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('consulta_nueva', 'seguimiento', 'audiencia', 'reunion', 'bloqueo_personal', 'evento_libre')),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  duracion_minutos INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'confirmada' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio')),
  costo NUMERIC DEFAULT 0,
  outlook_event_id TEXT,
  teams_link TEXT,
  categoria_outlook TEXT,
  recordatorio_24h_enviado BOOLEAN DEFAULT false,
  recordatorio_1h_enviado BOOLEAN DEFAULT false,
  email_confirmacion_enviado BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_citas_cliente ON legal.citas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_citas_fecha ON legal.citas(fecha);
CREATE INDEX IF NOT EXISTS idx_citas_estado ON legal.citas(estado);
GRANT ALL ON legal.citas TO authenticated, service_role;

-- Bloqueos de horario
CREATE TABLE IF NOT EXISTS legal.disponibilidad_bloqueos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON legal.disponibilidad_bloqueos TO authenticated, service_role;

-- Columnas para tokens de Outlook en configuracion
ALTER TABLE legal.configuracion
  ADD COLUMN IF NOT EXISTS outlook_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS outlook_refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS outlook_token_expires_at TIMESTAMPTZ;
