-- ============================================================================
-- Fase B pagos con tarjeta (jul-2026): solicitudes de pago y cobros EN
-- (monto variable, USD, clientes internacionales).
--
-- cobros.token_pago: token del botón "Pay by card" de los correos EN
--   (solicitud de pago y recordatorios). Se genera AL ENVIAR el correo, solo
--   si cliente idioma='en' y moneda='USD', cobro en USD y saldo > 0. El link
--   /pagar/cobro?token= crea la sesión de Stripe al clic por el SALDO
--   PENDIENTE ACTUAL (nunca un monto del correo o del request).
-- pagos.stripe_session_id: idempotencia del webhook — un evento de Stripe
--   reenviado no registra el pago dos veces (UNIQUE parcial).
-- ============================================================================

ALTER TABLE legal.cobros
  ADD COLUMN IF NOT EXISTS token_pago text;

CREATE UNIQUE INDEX IF NOT EXISTS cobros_token_pago_key
  ON legal.cobros (token_pago) WHERE token_pago IS NOT NULL;

ALTER TABLE legal.pagos
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

CREATE UNIQUE INDEX IF NOT EXISTS pagos_stripe_session_id_key
  ON legal.pagos (stripe_session_id) WHERE stripe_session_id IS NOT NULL;

COMMENT ON COLUMN legal.cobros.token_pago IS
  'Token del link de pago con tarjeta (correos EN). NULL = sin pago online.';
COMMENT ON COLUMN legal.pagos.stripe_session_id IS
  'Checkout Session de Stripe que originó el pago (idempotencia del webhook). NULL = pago manual.';
