-- ============================================================================
-- Migración: Destinatarios propios del recordatorio de audiencia
-- Para audiencias sensibles (p.ej. materia penal) donde no se quiere exponer el
-- asunto al correo del cliente ni a sus emails_cc. Si esta columna tiene valor,
-- el recordatorio va SOLO a esos correos (con CC a amanda@). NULL = comportamiento
-- por defecto (email del cliente + emails_cc).
-- ============================================================================

ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS audiencia_destinatarios text[];

COMMENT ON COLUMN legal.citas.audiencia_destinatarios IS
  'Audiencia judicial: destinatarios específicos del recordatorio. Si tiene valor, el recordatorio va SOLO a estos correos (+ CC amanda@), ignorando el email/emails_cc del cliente. NULL = comportamiento por defecto.';
