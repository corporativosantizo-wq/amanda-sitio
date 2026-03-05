-- ============================================================================
-- Schema Portal de Clientes — Amanda Santizo — Despacho Jurídico
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- Tabla para vincular auth.users con legal.clientes
CREATE TABLE IF NOT EXISTS legal.portal_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  auth_user_id UUID NOT NULL,
  email TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(auth_user_id)
);

-- Tabla para solicitudes de consulta extra
CREATE TABLE IF NOT EXISTS legal.consultas_extra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  asunto TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'programada', 'completada', 'cancelada')),
  monto NUMERIC(12,2) NOT NULL DEFAULT 500.00,
  fecha_solicitada TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_programada TIMESTAMPTZ,
  notas_internas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla para mensajes del chat portal
CREATE TABLE IF NOT EXISTS legal.portal_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices para rendimiento
CREATE INDEX IF NOT EXISTS idx_portal_usuarios_email ON legal.portal_usuarios(email);
CREATE INDEX IF NOT EXISTS idx_portal_usuarios_auth_user ON legal.portal_usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_usuarios_cliente ON legal.portal_usuarios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_extra_cliente ON legal.consultas_extra(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_mensajes_cliente ON legal.portal_mensajes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_mensajes_fecha ON legal.portal_mensajes(cliente_id, created_at);

-- Permisos
GRANT ALL ON legal.portal_usuarios TO authenticated, service_role;
GRANT ALL ON legal.consultas_extra TO authenticated, service_role;
GRANT ALL ON legal.portal_mensajes TO authenticated, service_role;
