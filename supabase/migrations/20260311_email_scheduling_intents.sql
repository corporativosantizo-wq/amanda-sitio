-- Create email_scheduling_intents table for Molly Mail scheduling pipeline
CREATE TABLE IF NOT EXISTS legal.email_scheduling_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES legal.email_threads(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES legal.email_messages(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('consulta_nueva', 'seguimiento')),
  suggested_date date NOT NULL,
  suggested_time time DEFAULT NULL,
  available_slots jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'agendada', 'ignorada')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for pending intent lookups
CREATE INDEX IF NOT EXISTS idx_scheduling_intents_status
  ON legal.email_scheduling_intents (status)
  WHERE status = 'pendiente';

-- Prevent duplicate intents per message
CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduling_intents_message
  ON legal.email_scheduling_intents (message_id);
