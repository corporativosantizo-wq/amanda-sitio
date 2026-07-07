-- ============================================================================
-- Datos de transferencia a Mercury Bank (pagos de clientes internacionales).
-- Los valores los ingresa Amanda desde /admin/configuracion/datos-bancarios —
-- NUNCA van hardcodeados en el código. El recuadro de transferencia en los
-- correos EN solo aparece cuando beneficiario + cuenta + routing + SWIFT
-- están completos; mientras falten, se mantiene el "coming soon".
-- Aditivo: columnas nullable, no afecta el código en producción.
-- ============================================================================

ALTER TABLE legal.configuracion
  ADD COLUMN IF NOT EXISTS mercury_beneficiario    text,
  ADD COLUMN IF NOT EXISTS mercury_numero_cuenta   text,
  ADD COLUMN IF NOT EXISTS mercury_routing         text,
  ADD COLUMN IF NOT EXISTS mercury_swift           text,
  ADD COLUMN IF NOT EXISTS mercury_banco_nombre    text,
  ADD COLUMN IF NOT EXISTS mercury_banco_direccion text;

COMMENT ON COLUMN legal.configuracion.mercury_beneficiario IS 'Nombre del beneficiario de la cuenta Mercury (correos EN)';
COMMENT ON COLUMN legal.configuracion.mercury_numero_cuenta IS 'Número de cuenta Mercury';
COMMENT ON COLUMN legal.configuracion.mercury_routing IS 'Routing number (ACH/wire doméstico EE.UU.)';
COMMENT ON COLUMN legal.configuracion.mercury_swift IS 'Código SWIFT/BIC para wires internacionales';
COMMENT ON COLUMN legal.configuracion.mercury_banco_nombre IS 'Banco receptor (partner bank de Mercury) — opcional';
COMMENT ON COLUMN legal.configuracion.mercury_banco_direccion IS 'Dirección del banco receptor — opcional, requerida por algunos bancos emisores';
