-- Fix: email_threads clasificacion constraint was missing 'publicidad' and 'notificacion_sistema'
-- These types were added in code (commit 2992de5) but the DB constraint was never updated,
-- causing silent UPDATE failures that left threads stuck as 'pendiente'
ALTER TABLE legal.email_threads DROP CONSTRAINT IF EXISTS email_threads_clasificacion_check;
ALTER TABLE legal.email_threads ADD CONSTRAINT email_threads_clasificacion_check
CHECK (clasificacion = ANY (ARRAY[
  'legal', 'administrativo', 'financiero', 'spam', 'personal', 'urgente', 'pendiente',
  'publicidad', 'notificacion_sistema'
]));

-- Sync stuck threads: copy clasificacion from their latest inbound message
UPDATE legal.email_threads t
SET clasificacion = sub.msg_clasificacion, updated_at = now()
FROM (
  SELECT DISTINCT ON (m.thread_id)
    m.thread_id,
    m.clasificacion as msg_clasificacion
  FROM legal.email_messages m
  WHERE m.clasificacion IS NOT NULL AND m.direction = 'inbound'
  ORDER BY m.thread_id, m.received_at DESC
) sub
WHERE t.id = sub.thread_id
  AND t.clasificacion = 'pendiente'
  AND sub.msg_clasificacion IS NOT NULL;
