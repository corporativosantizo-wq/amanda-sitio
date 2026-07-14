-- ============================================================================
-- Incidente reporte astrológico de Anita, 11-jul-2026: Telegram rechazó el
-- envío (mensaje rozaba el límite de 4096 caracteres) pero sendTelegramMessage
-- solo logueaba el error y el mensaje se marcó como enviado igual. El fallo no
-- dejó rastro consultable.
--
-- Testigo de fallos: se persiste la respuesta de error de Telegram en la fila
-- del mensaje programado. El código además deja de marcar ultima_enviada
-- cuando el envío es rechazado. Un envío exitoso posterior limpia ambas
-- columnas (NULL = último envío OK o sin envíos aún).
-- ============================================================================

ALTER TABLE legal.mensajes_programados_telegram
  ADD COLUMN IF NOT EXISTS ultimo_error text,
  ADD COLUMN IF NOT EXISTS ultimo_error_at timestamptz;

COMMENT ON COLUMN legal.mensajes_programados_telegram.ultimo_error IS
  'Testigo del último envío rechazado: respuesta de error de la API de Telegram (o error de red). NULL tras un envío exitoso.';

COMMENT ON COLUMN legal.mensajes_programados_telegram.ultimo_error_at IS
  'Cuándo ocurrió el último envío rechazado. NULL tras un envío exitoso.';
