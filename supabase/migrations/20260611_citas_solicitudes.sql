-- ============================================================================
-- Migración: Flujo de solicitudes para entrega/firma de documentos
-- El cliente envía una solicitud (estado='pendiente') con su fecha/hora
-- preferida; Amanda confirma esa fecha o propone otra desde el panel admin.
-- ============================================================================

-- fecha pasa a ser nullable: una solicitud puede no tener fecha asignada todavía.
ALTER TABLE legal.citas ALTER COLUMN fecha DROP NOT NULL;

-- Fecha/hora originalmente solicitada por el cliente (inmutable, para poder decir
-- "la fecha que seleccionó X no está disponible" si Amanda propone otra).
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS fecha_solicitada DATE;
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS hora_solicitada TIME;

-- Indicaciones adicionales que el cliente escribe en el formulario de solicitud.
ALTER TABLE legal.citas ADD COLUMN IF NOT EXISTS comentarios_cliente TEXT;

COMMENT ON COLUMN legal.citas.fecha_solicitada IS 'Fecha que el cliente eligió al enviar la solicitud (entrega/firma). Inmutable.';
COMMENT ON COLUMN legal.citas.hora_solicitada IS 'Hora que el cliente eligió al enviar la solicitud (entrega/firma). Inmutable.';
COMMENT ON COLUMN legal.citas.comentarios_cliente IS 'Indicaciones adicionales escritas por el cliente en el formulario de solicitud.';
