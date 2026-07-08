-- ============================================================================
-- Fase A pagos con tarjeta (jul-2026): consulta internacional USD $150.
--
-- token_pago: token del link "Pay by card" del correo de confirmación EN.
--   Solo se genera para citas consulta_nueva de clientes idioma='en' y
--   moneda='USD' con costo > 0 (capa 2 del blindaje: un cliente local jamás
--   tiene token). El link va a /pagar/cita?token=... que valida TODO de nuevo
--   en servidor y crea la sesión de Stripe al momento del clic (los links
--   directos de Stripe expiran en 24 h; los correos viven más).
-- pago_recibido_at: lo marca el webhook de Stripe al completarse el pago.
--   NULL = no pagada. También corta el link (una cita pagada no re-cobra).
-- ============================================================================

ALTER TABLE legal.citas
  ADD COLUMN IF NOT EXISTS token_pago text,
  ADD COLUMN IF NOT EXISTS pago_recibido_at timestamptz;

-- Único (permite múltiples NULL); el lookup del route es por token.
CREATE UNIQUE INDEX IF NOT EXISTS citas_token_pago_key
  ON legal.citas (token_pago) WHERE token_pago IS NOT NULL;

COMMENT ON COLUMN legal.citas.token_pago IS
  'Token del link de pago con tarjeta (correos EN, consulta internacional). NULL = sin pago online.';
COMMENT ON COLUMN legal.citas.pago_recibido_at IS
  'Timestamp del pago vía Stripe (webhook). NULL = no pagada.';
