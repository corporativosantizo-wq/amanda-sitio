-- ============================================================================
-- Migración: Borradores de correos salientes nuevos (sin hilo previo)
-- Permite cargar, revisar y enviar en lote correos salientes que el despacho
-- inicia desde cero. Es una funcionalidad PARALELA a legal.email_drafts (que
-- solo genera respuestas a correos entrantes y exige thread_id) — esta tabla
-- NO requiere un hilo de conversación previo.
-- ============================================================================

CREATE TABLE IF NOT EXISTS legal.borradores_salientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account TEXT NOT NULL,                       -- cuenta de envío (asistente@/contador@/amanda@)
  to_emails TEXT[] NOT NULL,                   -- destinatarios
  cc_emails TEXT[],                            -- copias
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  cliente_id UUID REFERENCES legal.clientes(id), -- opcional, para asociar al cliente
  lote TEXT,                                   -- etiqueta de lote (para agrupar/enviar en bloque)
  status TEXT NOT NULL DEFAULT 'pendiente',    -- pendiente | enviado | cancelado
  enviado_via TEXT,                            -- microsoft_id del mensaje una vez enviado
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_borradores_salientes_status
  ON legal.borradores_salientes(status);
CREATE INDEX IF NOT EXISTS idx_borradores_salientes_lote
  ON legal.borradores_salientes(lote);

-- RLS: solo service_role (igual que el resto de tablas sensibles del despacho).
ALTER TABLE legal.borradores_salientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "borradores_salientes_service" ON legal.borradores_salientes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE legal.borradores_salientes IS
  'Borradores de correos salientes nuevos (sin hilo previo) para revisión y envío en lote desde Molly Mail. Paralelo a email_drafts.';
