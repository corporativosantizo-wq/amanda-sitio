-- ============================================================================
-- 20260705_clientes_idioma_moneda.sql
-- Fase 0 comunicaciones internacionales: idioma y moneda por cliente.
-- Aditivo y seguro: NOT NULL con DEFAULT — todos los clientes existentes
-- quedan en 'es'/'GTQ' y ningún query actual cambia de comportamiento.
-- ============================================================================

ALTER TABLE legal.clientes
  ADD COLUMN IF NOT EXISTS idioma text NOT NULL DEFAULT 'es'
    CHECK (idioma IN ('es', 'en')),
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'GTQ'
    CHECK (moneda IN ('GTQ', 'USD'));

COMMENT ON COLUMN legal.clientes.idioma IS
  'Idioma de comunicaciones automáticas: es (default) | en (cliente internacional)';
COMMENT ON COLUMN legal.clientes.moneda IS
  'Moneda de cotizaciones/cobros: GTQ (default) | USD (cliente internacional)';
