-- ============================================================================
-- Migration: 20260621_recordatorios_cc
--
-- Feature: CC visible (no BCC) en recordatorios de audiencia.
--
-- Decisión final de Amanda (21-jun-2026): el CC fijo por cliente se REUSA de la
-- columna existente legal.clientes.emails_cc (ya cargada con datos reales y
-- editable en la ficha). NO se crea emails_cc_default. NO se hace ningún ALTER
-- sobre legal.clientes en esta ni en ninguna migración.
--
-- Lo único nuevo es el CC POR AUDIENCIA, aditivo sobre legal.audiencias:
--   · legal.audiencias.emails_cc  text[]  (NO existía; la Fase 1 no lo creó)
--
-- En el envío (Fase 3): cc_final = dedup(clientes.emails_cc del cliente +
-- audiencias.emails_cc de la audiencia). En modo prueba, principal + todos los
-- CC se redirigen a test_email. Reusar emails_cc NO cambia su comportamiento en
-- los otros correos (cotizaciones, recibos, citas, etc.): aquí solo se LEE.
-- ============================================================================

ALTER TABLE legal.audiencias
  ADD COLUMN IF NOT EXISTS emails_cc TEXT[];

COMMENT ON COLUMN legal.audiencias.emails_cc IS
  'CC visible (no BCC) específico de ESTA audiencia. En el envío (Fase 3) se '
  'suma al CC fijo del cliente (legal.clientes.emails_cc, REUSADA), deduplicando. '
  'En modo prueba, principal + todos los CC se redirigen a test_email.';
