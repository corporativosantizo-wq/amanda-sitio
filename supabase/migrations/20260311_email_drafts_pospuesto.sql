-- Add pospuesto_hasta column to legal.email_drafts for postpone functionality
ALTER TABLE legal.email_drafts
  ADD COLUMN IF NOT EXISTS pospuesto_hasta timestamptz DEFAULT NULL;

-- Index for efficient cron lookup of expired postponements
CREATE INDEX IF NOT EXISTS idx_legal.email_drafts_pospuesto
  ON legal.email_drafts (pospuesto_hasta)
  WHERE status = 'pospuesto' AND pospuesto_hasta IS NOT NULL;
