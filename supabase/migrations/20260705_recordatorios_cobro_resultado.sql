-- ============================================================================
-- 20260705_recordatorios_cobro_resultado.sql
-- Fix: registrarRecordatorio() (cobros.service.ts) siempre insertó una columna
-- `resultado` que no existía en legal.recordatorios_cobro — el insert fallaba
-- silencioso (PGRST204), el historial quedaba vacío y por eso la escalación de
-- tonos (1º→2º→3º aviso) y el anti-duplicado de 24h nunca funcionaron.
-- Descubierto en la prueba de Fase 3 EN (5-jul-2026). Columna aditiva.
-- ============================================================================

ALTER TABLE legal.recordatorios_cobro ADD COLUMN IF NOT EXISTS resultado text;
