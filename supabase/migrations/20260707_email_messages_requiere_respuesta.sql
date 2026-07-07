-- ============================================================================
-- Incidente Molly jul-2026: los borradores automáticos dependían de
-- requiere_respuesta, un booleano que el modelo emitía al clasificar y que NO
-- se guardaba — se evaluaba UNA sola vez. Si salía false (es no determinista
-- en respuestas "Re:" ambiguas) o el ciclo moría tras clasificar, el correo
-- quedaba sin borrador para siempre, sin registro y sin reintento.
--
-- Se persiste el flag para que el cron tenga "segunda oportunidad":
-- retryMissingDrafts() recoge mensajes con requiere_respuesta=true sin
-- borrador y les genera uno. NULL = clasificado antes de este cambio (o el
-- modelo no devolvió el campo); no se reintenta salvo backfill manual.
-- ============================================================================

ALTER TABLE legal.email_messages
  ADD COLUMN IF NOT EXISTS requiere_respuesta boolean;

COMMENT ON COLUMN legal.email_messages.requiere_respuesta IS
  'Flag del clasificador IA: el correo amerita borrador de respuesta. Persistido para la segunda oportunidad del cron (retryMissingDrafts). NULL = clasificado antes de jul-2026.';
