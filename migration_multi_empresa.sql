-- ============================================================================
-- Migración: Soporte multi-empresa en portal de clientes
-- Un email (auth_user_id) puede representar a múltiples clientes/empresas
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- 1. Eliminar constraint UNIQUE(email) que limita a 1 cliente por email
ALTER TABLE legal.portal_usuarios DROP CONSTRAINT IF EXISTS portal_usuarios_email_key;

-- 2. Eliminar constraint UNIQUE(auth_user_id) que limita a 1 cliente por usuario
ALTER TABLE legal.portal_usuarios DROP CONSTRAINT IF EXISTS portal_usuarios_auth_user_id_key;

-- 3. Agregar constraint compuesto: un usuario no puede vincularse dos veces al mismo cliente
ALTER TABLE legal.portal_usuarios
  ADD CONSTRAINT portal_usuarios_auth_user_cliente_unique
  UNIQUE (auth_user_id, cliente_id);

-- 4. Agregar índice para búsquedas por auth_user_id (ya no es unique, necesita índice)
CREATE INDEX IF NOT EXISTS idx_portal_usuarios_auth_user_id
  ON legal.portal_usuarios(auth_user_id);
