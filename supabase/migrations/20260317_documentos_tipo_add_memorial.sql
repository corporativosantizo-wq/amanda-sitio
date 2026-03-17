-- Add 'memorial' as a valid tipo for legal.documentos
-- The classifier uses 'memorial' but the constraint only allowed 'demanda_memorial'
ALTER TABLE legal.documentos DROP CONSTRAINT IF EXISTS documentos_tipo_check;
ALTER TABLE legal.documentos ADD CONSTRAINT documentos_tipo_check
CHECK (tipo = ANY (ARRAY[
  'contrato_comercial',
  'escritura_publica',
  'testimonio',
  'acta_notarial',
  'poder',
  'contrato_laboral',
  'demanda_memorial',
  'memorial',
  'resolucion_judicial',
  'factura',
  'recibo',
  'correspondencia',
  'otro'
]));
