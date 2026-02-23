-- ============================================================================
-- Fix: Restringir SELECT en legal.usuarios_admin
-- Hallazgo: Los usuarios del portal (authenticated) podían ver todos los admins
-- Solución: Solo service_role puede leer, el middleware verifica vía REST API
-- ============================================================================

-- Eliminar política anterior que permitía lectura a todos los autenticados
DROP POLICY IF EXISTS "usuarios_admin_select_authenticated" ON legal.usuarios_admin;

-- Solo service_role puede acceder (usado por API routes y middleware)
CREATE POLICY "usuarios_admin_service_only"
  ON legal.usuarios_admin
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
