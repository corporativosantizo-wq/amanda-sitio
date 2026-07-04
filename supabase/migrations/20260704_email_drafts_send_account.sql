-- Cuenta emisora elegida al aprobar/programar un borrador de respuesta.
-- NULL = usar la cuenta del hilo (email_threads.account), que es el
-- comportamiento histórico.
ALTER TABLE legal.email_drafts
  ADD COLUMN IF NOT EXISTS send_account TEXT;

COMMENT ON COLUMN legal.email_drafts.send_account IS
  'Cuenta desde la que se envía el borrador (elegida en el dashboard). NULL = cuenta del hilo.';
