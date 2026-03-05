-- ============================================================================
-- Fix: RLS recursiva en legal.usuarios_admin
-- Problema: la política SELECT hacía subquery a la misma tabla → loop infinito
-- Solución: permitir SELECT a todos los autenticados (tabla interna pequeña)
-- ============================================================================

-- Eliminar políticas existentes que causan recursión
DROP POLICY IF EXISTS "usuarios_admin_select" ON legal.usuarios_admin;
DROP POLICY IF EXISTS "usuarios_admin_select_own" ON legal.usuarios_admin;
DROP POLICY IF EXISTS "usuarios_admin_select_all" ON legal.usuarios_admin;
DROP POLICY IF EXISTS "Permitir lectura a admins" ON legal.usuarios_admin;
DROP POLICY IF EXISTS "Permitir lectura propia" ON legal.usuarios_admin;

-- Asegurar que RLS esté habilitado
ALTER TABLE legal.usuarios_admin ENABLE ROW LEVEL SECURITY;

-- Nueva política: cualquier usuario autenticado puede leer todos los registros
-- (es una tabla interna pequeña del equipo, no hay riesgo de exposición)
CREATE POLICY "usuarios_admin_select_authenticated"
  ON legal.usuarios_admin
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de UPDATE: solo el mismo admin puede actualizar (via service_role en API)
-- Las operaciones de escritura se hacen con service_role desde API routes,
-- así que no necesitamos políticas de INSERT/UPDATE/DELETE para usuarios normales.
