-- ============================================================================
-- Migración de seguridad: Habilitar RLS en tablas críticas
-- Fecha: 2026-02-15
-- Hallazgo: C4 de auditoría de ciberseguridad
-- ============================================================================

-- ── 1. Portal: mensajes, usuarios, consultas ────────────────────────────────
-- Estas tablas son accesibles por clientes del portal (rol authenticated).
-- Las policies restringen acceso solo a datos del propio cliente.

ALTER TABLE legal.portal_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.portal_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.consultas_extra ENABLE ROW LEVEL SECURITY;

-- Portal usuarios: solo ver/editar su propio registro
CREATE POLICY "portal_usuarios_own" ON legal.portal_usuarios
  FOR ALL TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Portal mensajes: solo ver mensajes de su propio cliente_id
CREATE POLICY "portal_mensajes_own" ON legal.portal_mensajes
  FOR ALL TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  );

-- Consultas extra: solo ver las propias
CREATE POLICY "consultas_extra_own" ON legal.consultas_extra
  FOR ALL TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  );

-- Service role siempre tiene acceso completo (admin backend)
CREATE POLICY "portal_usuarios_service" ON legal.portal_usuarios
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "portal_mensajes_service" ON legal.portal_mensajes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "consultas_extra_service" ON legal.consultas_extra
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 2. Documentos ───────────────────────────────────────────────────────────

ALTER TABLE legal.documentos ENABLE ROW LEVEL SECURITY;

-- Portal: solo documentos de su cliente
CREATE POLICY "documentos_portal_own" ON legal.documentos
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "documentos_service" ON legal.documentos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 3. Citas ────────────────────────────────────────────────────────────────

ALTER TABLE legal.citas ENABLE ROW LEVEL SECURITY;

-- Portal: solo ver sus propias citas
CREATE POLICY "citas_portal_own" ON legal.citas
  FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT cliente_id FROM legal.portal_usuarios
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "citas_service" ON legal.citas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 4. Configuración (solo service_role — datos sensibles) ──────────────────

ALTER TABLE legal.configuracion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "configuracion_service_only" ON legal.configuracion
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 5. Cobros y recordatorios ───────────────────────────────────────────────

ALTER TABLE legal.cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.recordatorios_cobro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobros_service" ON legal.cobros
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "recordatorios_cobro_service" ON legal.recordatorios_cobro
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 6. Tareas ───────────────────────────────────────────────────────────────

ALTER TABLE legal.tareas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tareas_service" ON legal.tareas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 7. Plantillas ───────────────────────────────────────────────────────────

ALTER TABLE legal.plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plantillas_service" ON legal.plantillas
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 8. Disponibilidad/bloqueos ──────────────────────────────────────────────

ALTER TABLE legal.disponibilidad_bloqueos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disponibilidad_service" ON legal.disponibilidad_bloqueos
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 9. Tablas de esquema que faltaban (expedientes, catalogo, etc.) ─────────

DO $$
BEGIN
  -- Estas tablas podrían ya tener RLS habilitado; usar IF NOT EXISTS pattern
  EXECUTE 'ALTER TABLE legal.expedientes ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE legal.catalogo_servicios ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE legal.protocolo_anual ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE legal.plantillas_razon ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE legal.reglas_timbres ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Algunas tablas ya tenían RLS habilitado: %', SQLERRM;
END $$;

-- Service role policies para tablas adicionales
CREATE POLICY IF NOT EXISTS "expedientes_service" ON legal.expedientes
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "catalogo_service" ON legal.catalogo_servicios
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "protocolo_service" ON legal.protocolo_anual
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "plantillas_razon_service" ON legal.plantillas_razon
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "reglas_timbres_service" ON legal.reglas_timbres
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── 10. Revocar GRANT ALL innecesario ───────────────────────────────────────
-- Las tablas del portal ya no necesitan GRANT ALL a authenticated
-- porque RLS ahora controla el acceso granularmente.
-- NOTA: No revocar SELECT porque el portal lo necesita para funcionar con RLS.

REVOKE INSERT, UPDATE, DELETE ON legal.documentos FROM authenticated;
REVOKE UPDATE, DELETE ON legal.citas FROM authenticated;
REVOKE UPDATE, DELETE ON legal.disponibilidad_bloqueos FROM authenticated;
