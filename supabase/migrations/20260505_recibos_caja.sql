-- ============================================================================
-- Migration: 20260505_recibos_caja
--
-- Feature: Gastos de trámite + Recibo de Caja (paralelo a factura/honorarios)
--
-- Cambios:
--   1. cotizaciones.monto_gastos NUMERIC(12,2) DEFAULT 0  (separado de total)
--   2. ENUM legal.tipo_pago: + valor 'gastos_tramite'
--   3. legal.secuencias: + fila 'RC' con formato 4 dígitos (RC-0001)
--   4. Tabla legal.recibos_caja con FK a cotizaciones, clientes, pagos
--   5. Indices, RLS habilitada, audit trigger
--   6. Storage bucket 'recibos-caja' (separado, no genérico) + RLS policies
--
-- Notas:
--   - El resto del sistema usa formato 6 dígitos (FAC-000001). Aquí se respeta
--     el formato 4 dígitos pedido en el spec del producto. Para homogeneizar:
--     UPDATE legal.secuencias SET formato = '000000' WHERE tipo = 'RC';
--   - service_role hace BYPASS de RLS, por lo que todos los endpoints admin
--     que usan createAdminClient() tendrán acceso. Sin policies adicionales
--     (mismo patrón que el resto de tablas en `legal`).
-- ============================================================================

-- 1. cotizaciones: separar gastos del trámite del total de honorarios
ALTER TABLE legal.cotizaciones
  ADD COLUMN IF NOT EXISTS monto_gastos NUMERIC(12, 2) NOT NULL DEFAULT 0
  CHECK (monto_gastos >= 0);

COMMENT ON COLUMN legal.cotizaciones.monto_gastos IS
  'Monto de gastos del trámite (timbres, tasas, viáticos). Separado de los honorarios. '
  'Se respalda con Recibo de Caja, NO con factura. Se paga independientemente.';

-- 2. tipo_pago: nuevo valor para diferenciar pago de gastos
ALTER TYPE legal.tipo_pago ADD VALUE IF NOT EXISTS 'gastos_tramite';

-- 3. Secuencia RC para correlativo del recibo (atómico vía next_sequence RPC)
INSERT INTO legal.secuencias (tipo, prefijo, siguiente, formato)
VALUES ('RC', 'RC', 1, '0000')
ON CONFLICT (tipo) DO NOTHING;

-- 4. Tabla recibos_caja
CREATE TABLE IF NOT EXISTS legal.recibos_caja (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE,
  cotizacion_id     UUID NOT NULL REFERENCES legal.cotizaciones(id) ON DELETE RESTRICT,
  cliente_id        UUID NOT NULL REFERENCES legal.clientes(id) ON DELETE RESTRICT,
  pago_id           UUID NOT NULL REFERENCES legal.pagos(id) ON DELETE RESTRICT,
  monto             NUMERIC(12, 2) NOT NULL CHECK (monto > 0),
  fecha_emision     TIMESTAMPTZ NOT NULL DEFAULT now(),
  concepto          TEXT NOT NULL,
  pdf_url           TEXT,
  email_enviado_at  TIMESTAMPTZ,
  email_error       TEXT,
  notas             TEXT,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.recibos_caja IS
  'Recibo de Caja: comprobante NO fiscal de pagos de gastos del trámite. '
  'Numeración correlativa propia RC-NNNN. 1:1 con un pago de tipo gastos_tramite.';

-- 5. Indices
CREATE INDEX IF NOT EXISTS idx_recibos_caja_cotizacion ON legal.recibos_caja(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_recibos_caja_cliente    ON legal.recibos_caja(cliente_id);
CREATE INDEX IF NOT EXISTS idx_recibos_caja_pago       ON legal.recibos_caja(pago_id);
CREATE INDEX IF NOT EXISTS idx_recibos_caja_fecha      ON legal.recibos_caja(fecha_emision DESC);

-- 6. RLS habilitada (deny-all por defecto; service_role hace bypass)
ALTER TABLE legal.recibos_caja ENABLE ROW LEVEL SECURITY;

-- 7. Audit trigger (mismo patrón que el resto de tablas)
DROP TRIGGER IF EXISTS audit_recibos_caja ON legal.recibos_caja;
CREATE TRIGGER audit_recibos_caja
  AFTER INSERT OR UPDATE OR DELETE ON legal.recibos_caja
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();

-- 8. Storage bucket dedicado (separado para auditoría/backup independientes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recibos-caja',
  'recibos-caja',
  false,
  10485760, -- 10 MB por PDF
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 9. Storage RLS policies bucket recibos-caja
--    (mismo patrón que documentos/notariado: service_role + anon para signed URLs)
DROP POLICY IF EXISTS "recibos_caja_service_select" ON storage.objects;
CREATE POLICY "recibos_caja_service_select"
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'recibos-caja');

DROP POLICY IF EXISTS "recibos_caja_service_insert" ON storage.objects;
CREATE POLICY "recibos_caja_service_insert"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'recibos-caja');

DROP POLICY IF EXISTS "recibos_caja_service_update" ON storage.objects;
CREATE POLICY "recibos_caja_service_update"
  ON storage.objects FOR UPDATE TO service_role
  USING (bucket_id = 'recibos-caja');

DROP POLICY IF EXISTS "recibos_caja_service_delete" ON storage.objects;
CREATE POLICY "recibos_caja_service_delete"
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'recibos-caja');

-- Las URLs firmadas se verifican como anon/authenticated, mismo patrón existente
DROP POLICY IF EXISTS "recibos_caja_anon_select" ON storage.objects;
CREATE POLICY "recibos_caja_anon_select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'recibos-caja');
