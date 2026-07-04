-- FIX pre-existente: el CHECK de status no incluía 'programado' ni 'pospuesto',
-- aunque el código los usa (scheduleDraft, posponer desde Telegram) y el tipo
-- DraftStatus los declara. Resultado: "Programar" y "posponer" fallaban SIEMPRE
-- con violación de constraint (silenciosa en la UI porque el handler no revisa
-- res.ok). Se amplía el CHECK a la lista completa de DraftStatus.
ALTER TABLE legal.email_drafts
  DROP CONSTRAINT IF EXISTS email_drafts_status_check;

ALTER TABLE legal.email_drafts
  ADD CONSTRAINT email_drafts_status_check CHECK (
    status = ANY (ARRAY[
      'pendiente'::text,
      'aprobado'::text,
      'enviado'::text,
      'rechazado'::text,
      'editado'::text,
      'programado'::text,
      'pospuesto'::text
    ])
  );
