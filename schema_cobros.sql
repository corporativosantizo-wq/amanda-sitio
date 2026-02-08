-- ============================================================================
-- Schema Módulo de Cobros — Amanda Santizo — Despacho Jurídico
-- Ejecutar manualmente en Supabase SQL Editor
-- ============================================================================

-- 1. Tabla de cobros (cuentas por cobrar)
CREATE TABLE IF NOT EXISTS legal.cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cobro SERIAL,
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  expediente_id UUID,
  concepto TEXT NOT NULL,
  descripcion TEXT,
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  monto_pagado DECIMAL(10,2) DEFAULT 0,
  saldo_pendiente DECIMAL(10,2) GENERATED ALWAYS AS (monto - monto_pagado) STORED,
  moneda TEXT DEFAULT 'GTQ',
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('borrador', 'pendiente', 'parcial', 'pagado', 'vencido', 'cancelado')),
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  dias_credito INTEGER DEFAULT 15,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cobros_cliente ON legal.cobros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobros_estado ON legal.cobros(estado);
CREATE INDEX IF NOT EXISTS idx_cobros_vencimiento ON legal.cobros(fecha_vencimiento) WHERE estado NOT IN ('pagado', 'cancelado');

-- Auto-set fecha_vencimiento from dias_credito
CREATE OR REPLACE FUNCTION legal.trg_cobros_set_vencimiento()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.fecha_vencimiento IS NULL AND NEW.dias_credito IS NOT NULL THEN
    NEW.fecha_vencimiento := NEW.fecha_emision + NEW.dias_credito;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cobros_vencimiento ON legal.cobros;
CREATE TRIGGER trg_cobros_vencimiento
  BEFORE INSERT ON legal.cobros
  FOR EACH ROW EXECUTE FUNCTION legal.trg_cobros_set_vencimiento();

-- Auto updated_at
CREATE OR REPLACE FUNCTION legal.trg_cobros_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cobros_updated ON legal.cobros;
CREATE TRIGGER trg_cobros_updated
  BEFORE UPDATE ON legal.cobros
  FOR EACH ROW EXECUTE FUNCTION legal.trg_cobros_updated();

-- 2. Agregar cobro_id a tabla de pagos existente
ALTER TABLE legal.pagos
  ADD COLUMN IF NOT EXISTS cobro_id UUID REFERENCES legal.cobros(id);

CREATE INDEX IF NOT EXISTS idx_pagos_cobro ON legal.pagos(cobro_id);

-- 3. Trigger: actualizar monto_pagado del cobro cuando se inserta/actualiza un pago
CREATE OR REPLACE FUNCTION legal.trg_pagos_actualizar_cobro()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar cobro vinculado
  IF NEW.cobro_id IS NOT NULL THEN
    UPDATE legal.cobros
    SET monto_pagado = COALESCE((
      SELECT SUM(monto) FROM legal.pagos
      WHERE cobro_id = NEW.cobro_id
        AND estado IN ('registrado', 'confirmado', 'procesado')
    ), 0)
    WHERE id = NEW.cobro_id;

    -- Auto-actualizar estado del cobro
    UPDATE legal.cobros
    SET estado = CASE
      WHEN monto_pagado >= monto THEN 'pagado'
      WHEN monto_pagado > 0 THEN 'parcial'
      ELSE estado
    END
    WHERE id = NEW.cobro_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pagos_cobro ON legal.pagos;
CREATE TRIGGER trg_pagos_cobro
  AFTER INSERT OR UPDATE ON legal.pagos
  FOR EACH ROW EXECUTE FUNCTION legal.trg_pagos_actualizar_cobro();

-- 4. Tabla de recordatorios de cobro
CREATE TABLE IF NOT EXISTS legal.recordatorios_cobro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id UUID NOT NULL REFERENCES legal.cobros(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('primer_aviso', 'segundo_aviso', 'tercer_aviso', 'urgente')),
  fecha_envio TIMESTAMPTZ DEFAULT NOW(),
  email_enviado BOOLEAN DEFAULT false,
  resultado TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_cobro ON legal.recordatorios_cobro(cobro_id);

-- 5. Auto-marcar cobros vencidos (ejecutar o agregar como cron)
-- UPDATE legal.cobros SET estado = 'vencido'
-- WHERE estado = 'pendiente' AND fecha_vencimiento < CURRENT_DATE;
