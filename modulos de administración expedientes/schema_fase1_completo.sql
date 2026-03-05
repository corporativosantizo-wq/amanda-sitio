-- ============================================================================
-- IURISLEX - Schema Fase 1 Completo
-- Supabase (PostgreSQL) | Schema: legal
-- Módulos: Base + Contabilidad + Notariado
-- Amanda Santizo - amandasantizo.com
-- ============================================================================

-- Crear schema dedicado
CREATE SCHEMA IF NOT EXISTS legal;

-- ============================================================================
-- ENUMS (tipos reutilizables)
-- ============================================================================

CREATE TYPE legal.tipo_persona AS ENUM ('persona', 'empresa');
CREATE TYPE legal.estado_cliente AS ENUM ('activo', 'inactivo', 'prospecto');
CREATE TYPE legal.estado_cotizacion AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida');
CREATE TYPE legal.estado_factura AS ENUM ('pendiente', 'pagada', 'parcial', 'anulada', 'vencida');
CREATE TYPE legal.estado_pago AS ENUM ('registrado', 'confirmado', 'rechazado');
CREATE TYPE legal.tipo_pago AS ENUM ('anticipo', 'parcial', 'total', 'consulta_extra');
CREATE TYPE legal.estado_expediente AS ENUM ('analisis', 'en_tramite', 'en_espera', 'archivado', 'cerrado');
CREATE TYPE legal.prioridad AS ENUM ('alta', 'media', 'baja');

-- Notariado
CREATE TYPE legal.tipo_instrumento AS ENUM (
  'compraventa', 'mandato', 'sociedad_anonima', 'sociedad_limitada',
  'donacion', 'mutuo', 'arrendamiento', 'poder', 'testamento',
  'capitulaciones', 'protocolizacion', 'ampliacion', 'modificacion_estatutos',
  'disolucion', 'liquidacion', 'fusion', 'otro'
);
CREATE TYPE legal.estado_escritura AS ENUM (
  'borrador',              -- Datos ingresados, aún no se firma
  'autorizada',            -- Firmada ante comparecientes (trigger: crea borradores de testimonios)
  'escaneada',             -- PDF de escritura firmada subido al sistema
  'con_testimonio',        -- Al menos un testimonio generado y entregado
  'cancelada'              -- Escritura cancelada (no produce efectos)
);
CREATE TYPE legal.tipo_testimonio AS ENUM ('primer_testimonio', 'testimonio_especial', 'duplicado', 'segundo_testimonio');
CREATE TYPE legal.estado_testimonio AS ENUM ('borrador', 'generado', 'firmado', 'entregado');
CREATE TYPE legal.estado_aviso AS ENUM ('borrador', 'generado', 'enviado', 'confirmado');
CREATE TYPE legal.tipo_acta AS ENUM (
  'notificacion', 'requerimiento', 'protesto', 'presencia',
  'sobrevivencia', 'matrimonio', 'union_de_hecho', 'otro'
);

-- ============================================================================
-- MÓDULO BASE: Configuración y Clientes
-- ============================================================================

-- Configuración del despacho (singleton)
CREATE TABLE legal.configuracion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_despacho TEXT NOT NULL DEFAULT 'IURISLEX - Corporación de Abogados',
  abogada_principal TEXT NOT NULL DEFAULT 'Licda. Amanda Santizo',
  colegiado TEXT NOT NULL DEFAULT '19565',
  clave_notario TEXT NOT NULL DEFAULT 'S-1254',
  telefono TEXT DEFAULT '+502 2335-3613',
  email TEXT DEFAULT 'amanda@papeleo.legal',
  direccion TEXT DEFAULT 'Ciudad de Guatemala, Guatemala',

  -- Datos bancarios
  banco TEXT DEFAULT 'Banco Industrial',
  tipo_cuenta TEXT DEFAULT 'Monetaria',
  numero_cuenta TEXT DEFAULT '455-008846-4',
  cuenta_nombre TEXT DEFAULT 'Invest & Jure-Advisor, S.A.',

  -- Configuración contable
  email_contador TEXT DEFAULT 'contador@papeleo.legal',
  iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  isr_porcentaje_bajo NUMERIC(5,2) NOT NULL DEFAULT 5.00,     -- < Q30,000
  isr_porcentaje_alto NUMERIC(5,2) NOT NULL DEFAULT 7.00,     -- >= Q30,000
  isr_umbral NUMERIC(12,2) NOT NULL DEFAULT 30000.00,
  validez_cotizacion_dias INT NOT NULL DEFAULT 30,
  anticipo_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 60.00,

  -- Configuración de cobranza
  recordatorio_amable_dias INT NOT NULL DEFAULT 7,
  recordatorio_firme_dias INT NOT NULL DEFAULT 15,
  recordatorio_legal_dias INT NOT NULL DEFAULT 25,

  -- Configuración notarial
  lugar_protocolo TEXT NOT NULL DEFAULT 'Ciudad de Guatemala',
  departamento_protocolo TEXT NOT NULL DEFAULT 'Guatemala',

  -- NIT empresa
  nit_empresa TEXT DEFAULT '106147455',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Clientes
CREATE TABLE legal.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,                          -- CLI-0001
  tipo legal.tipo_persona NOT NULL DEFAULT 'persona',
  nombre TEXT NOT NULL,
  nit TEXT,                                             -- NIT Guatemala
  dpi TEXT CHECK (dpi IS NULL OR length(dpi) = 13),     -- DPI: 13 dígitos
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fuente TEXT,                                          -- Cómo llegó el cliente
  estado legal.estado_cliente NOT NULL DEFAULT 'activo',
  abogado_asignado TEXT DEFAULT 'Amanda Santizo',

  -- Datos de facturación (pueden diferir del nombre)
  razon_social_facturacion TEXT,
  nit_facturacion TEXT,
  direccion_facturacion TEXT,

  -- Campos encriptados (se encriptarán a nivel de aplicación)
  datos_sensibles_encrypted JSONB,                      -- DPI, cuentas bancarias, etc.

  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clientes_codigo ON legal.clientes(codigo);
CREATE INDEX idx_clientes_nit ON legal.clientes(nit);
CREATE INDEX idx_clientes_nombre ON legal.clientes USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_clientes_estado ON legal.clientes(estado);

-- Catálogo de servicios
CREATE TABLE legal.catalogo_servicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,                          -- SRV-001
  categoria TEXT NOT NULL,                              -- Consultoría, Contratos, Notarial, etc.
  servicio TEXT NOT NULL,
  descripcion TEXT,
  precio_base NUMERIC(12,2) NOT NULL,
  unidad TEXT NOT NULL,                                 -- Por consulta, Por documento, etc.
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_catalogo_categoria ON legal.catalogo_servicios(categoria);
CREATE INDEX idx_catalogo_codigo ON legal.catalogo_servicios(codigo);

-- Expedientes / Casos
CREATE TABLE legal.expedientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_expediente TEXT UNIQUE NOT NULL,                -- EXP-2026-0145 o número de juzgado
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  tipo_caso TEXT NOT NULL,                               -- Laboral, Mercantil, Civil, etc.
  materia TEXT,
  tribunal TEXT,
  fecha_apertura DATE NOT NULL DEFAULT CURRENT_DATE,
  estado legal.estado_expediente NOT NULL DEFAULT 'analisis',
  prioridad legal.prioridad NOT NULL DEFAULT 'media',
  abogado_responsable TEXT DEFAULT 'Amanda Santizo',
  contraparte TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expedientes_cliente ON legal.expedientes(cliente_id);
CREATE INDEX idx_expedientes_estado ON legal.expedientes(estado);
CREATE INDEX idx_expedientes_numero ON legal.expedientes(numero_expediente);

-- ============================================================================
-- MÓDULO CONTABILIDAD: Cotizaciones
-- ============================================================================

CREATE TABLE legal.cotizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,                           -- COT-2026-0001
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  expediente_id UUID REFERENCES legal.expedientes(id),   -- Opcional: vincula a caso

  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE NOT NULL,                       -- fecha_emision + validez_dias
  estado legal.estado_cotizacion NOT NULL DEFAULT 'borrador',

  -- Montos (calculados desde items)
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Condiciones
  condiciones TEXT,                                      -- Términos y condiciones
  notas_internas TEXT,                                   -- Solo visible para admin
  incluye_consultas INT DEFAULT 2,                       -- Consultas incluidas (default 2)
  duracion_consulta_min INT DEFAULT 15,                  -- Minutos por consulta

  -- Anticipo
  requiere_anticipo BOOLEAN NOT NULL DEFAULT true,
  anticipo_porcentaje NUMERIC(5,2) DEFAULT 60.00,
  anticipo_monto NUMERIC(12,2) DEFAULT 0,

  -- PDF y email
  pdf_url TEXT,
  enviada_at TIMESTAMPTZ,
  aceptada_at TIMESTAMPTZ,

  created_by UUID,                                       -- Clerk user_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cotizaciones_cliente ON legal.cotizaciones(cliente_id);
CREATE INDEX idx_cotizaciones_estado ON legal.cotizaciones(estado);
CREATE INDEX idx_cotizaciones_fecha ON legal.cotizaciones(fecha_emision);
CREATE INDEX idx_cotizaciones_numero ON legal.cotizaciones(numero);

-- Items de cotización (líneas de detalle)
CREATE TABLE legal.cotizacion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id UUID NOT NULL REFERENCES legal.cotizaciones(id) ON DELETE CASCADE,
  servicio_id UUID REFERENCES legal.catalogo_servicios(id),  -- Del catálogo
  descripcion TEXT NOT NULL,                                  -- Puede ser custom
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,                               -- cantidad * precio_unitario
  orden INT NOT NULL DEFAULT 0,                               -- Orden de aparición
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cotizacion_items_cotizacion ON legal.cotizacion_items(cotizacion_id);

-- ============================================================================
-- MÓDULO CONTABILIDAD: Facturas
-- ============================================================================

CREATE TABLE legal.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,                           -- FAC-2026-0001
  cotizacion_id UUID REFERENCES legal.cotizaciones(id),  -- Vincula a cotización
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),
  expediente_id UUID REFERENCES legal.expedientes(id),

  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado legal.estado_factura NOT NULL DEFAULT 'pendiente',

  -- Datos de facturación
  razon_social TEXT NOT NULL,
  nit TEXT NOT NULL,
  direccion_fiscal TEXT,

  -- Montos
  subtotal NUMERIC(12,2) NOT NULL,
  iva_monto NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,

  -- Retención ISR (el cliente nos retiene)
  aplica_retencion BOOLEAN NOT NULL DEFAULT false,
  retencion_porcentaje NUMERIC(5,2) DEFAULT 0,           -- 5% o 7%
  retencion_monto NUMERIC(12,2) DEFAULT 0,
  monto_a_recibir NUMERIC(12,2) NOT NULL,                -- total - retención

  -- Megaprint FEL
  fel_uuid TEXT,                                          -- UUID de la factura FEL
  fel_numero_autorizacion TEXT,
  fel_serie TEXT,
  fel_numero_dte TEXT,
  fel_fecha_certificacion TIMESTAMPTZ,
  fel_xml_url TEXT,                                       -- URL del XML FEL
  fel_pdf_url TEXT,                                       -- URL del PDF FEL

  -- Email
  enviada_at TIMESTAMPTZ,

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_facturas_cliente ON legal.facturas(cliente_id);
CREATE INDEX idx_facturas_estado ON legal.facturas(estado);
CREATE INDEX idx_facturas_fecha ON legal.facturas(fecha_emision);
CREATE INDEX idx_facturas_cotizacion ON legal.facturas(cotizacion_id);

-- Items de factura
CREATE TABLE legal.factura_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES legal.facturas(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  precio_unitario NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_factura_items_factura ON legal.factura_items(factura_id);

-- ============================================================================
-- MÓDULO CONTABILIDAD: Pagos
-- ============================================================================

CREATE TABLE legal.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,                            -- PAG-2026-0001
  factura_id UUID REFERENCES legal.facturas(id),
  cotizacion_id UUID REFERENCES legal.cotizaciones(id),
  cliente_id UUID NOT NULL REFERENCES legal.clientes(id),

  fecha_pago DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  tipo legal.tipo_pago NOT NULL DEFAULT 'total',
  estado legal.estado_pago NOT NULL DEFAULT 'registrado',

  -- Detalles del pago
  metodo TEXT DEFAULT 'transferencia',                    -- transferencia, deposito, efectivo, cheque
  referencia_bancaria TEXT,                                -- Número de boleta/transferencia
  comprobante_url TEXT,                                    -- Foto/PDF del comprobante

  -- Anticipo tracking
  es_anticipo BOOLEAN NOT NULL DEFAULT false,
  porcentaje_anticipo NUMERIC(5,2),

  notas TEXT,
  confirmado_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagos_factura ON legal.pagos(factura_id);
CREATE INDEX idx_pagos_cliente ON legal.pagos(cliente_id);
CREATE INDEX idx_pagos_fecha ON legal.pagos(fecha_pago);
CREATE INDEX idx_pagos_estado ON legal.pagos(estado);

-- ============================================================================
-- MÓDULO CONTABILIDAD: Gastos
-- ============================================================================

CREATE TABLE legal.categorias_gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT UNIQUE NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed de categorías
INSERT INTO legal.categorias_gastos (nombre, descripcion) VALUES
  ('Oficina', 'Papelería, insumos, equipo de oficina'),
  ('Legal', 'Timbres fiscales, papel de protocolo, sellos notariales'),
  ('Transporte', 'Gasolina, parqueo, Uber, taxis'),
  ('Servicios', 'Internet, teléfono, software, hosting'),
  ('Honorarios', 'Pagos a otros profesionales, peritos'),
  ('Alimentación', 'Comidas de trabajo, reuniones con clientes'),
  ('Registros', 'Tasas registrales, certificaciones, aranceles'),
  ('Impuestos', 'ISR, IVA por pagar, timbres profesionales'),
  ('Publicidad', 'Marketing, redes sociales, sitio web'),
  ('Capacitación', 'Cursos, conferencias, colegiatura'),
  ('Mantenimiento', 'Reparaciones, limpieza, servicios generales'),
  ('Otros', 'Gastos no categorizados');

CREATE TABLE legal.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,                            -- GAS-2026-0001
  categoria_id UUID NOT NULL REFERENCES legal.categorias_gastos(id),
  expediente_id UUID REFERENCES legal.expedientes(id),    -- Opcional: vincular a caso

  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  proveedor TEXT,
  monto NUMERIC(12,2) NOT NULL,
  iva_incluido BOOLEAN NOT NULL DEFAULT true,
  iva_monto NUMERIC(12,2) DEFAULT 0,

  -- Comprobante
  tiene_factura BOOLEAN NOT NULL DEFAULT false,
  numero_factura TEXT,
  nit_proveedor TEXT,
  comprobante_url TEXT,                                    -- Foto/PDF

  -- Deducibilidad
  es_deducible BOOLEAN NOT NULL DEFAULT true,

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gastos_categoria ON legal.gastos(categoria_id);
CREATE INDEX idx_gastos_fecha ON legal.gastos(fecha);
CREATE INDEX idx_gastos_expediente ON legal.gastos(expediente_id);

-- ============================================================================
-- MÓDULO NOTARIADO: Protocolo y Escrituras
-- ============================================================================

-- Control del protocolo por año
CREATE TABLE legal.protocolo_anual (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INT UNIQUE NOT NULL,                               -- 2025, 2026, etc.
  ultima_escritura_numero INT NOT NULL DEFAULT 0,          -- Último número usado
  escrituras_autorizadas INT NOT NULL DEFAULT 0,
  escrituras_canceladas INT NOT NULL DEFAULT 0,
  hojas_protocolo_usadas INT NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'abierto'                   -- abierto, cerrado
    CHECK (estado IN ('abierto', 'cerrado')),
  fecha_apertura DATE,
  fecha_cierre DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Escrituras públicas (instrumentos del protocolo)
CREATE TABLE legal.escrituras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_anual_id UUID NOT NULL REFERENCES legal.protocolo_anual(id),
  cliente_id UUID REFERENCES legal.clientes(id),
  expediente_id UUID REFERENCES legal.expedientes(id),
  cotizacion_id UUID REFERENCES legal.cotizaciones(id),

  -- Datos de la escritura
  numero INT NOT NULL,                                     -- Número secuencial en el año
  numero_texto TEXT NOT NULL,                               -- "CUARENTA Y NUEVE (49)"
  fecha_autorizacion DATE NOT NULL,
  lugar_autorizacion TEXT NOT NULL,                         -- "Ciudad de Guatemala"
  departamento TEXT NOT NULL,                               -- "Guatemala"

  tipo_instrumento legal.tipo_instrumento NOT NULL,
  tipo_instrumento_texto TEXT NOT NULL,                     -- "contrato de compraventa"
  descripcion TEXT,                                         -- Descripción breve del contenido

  estado legal.estado_escritura NOT NULL DEFAULT 'borrador',

  -- Comparecientes
  comparecientes JSONB NOT NULL DEFAULT '[]',
  /*
    Formato:
    [
      {
        "nombre": "JULIO CÉSAR CATALÁN RICCO",
        "dpi": "1234567890123",
        "calidad": "vendedor",          -- comprador, vendedor, mandante, mandatario, etc.
        "representacion": null           -- o "en representación de EMPRESA S.A."
      }
    ]
  */

  -- Objeto del acto (para generación de razón)
  objeto_acto TEXT,                                         -- "un bien inmueble ubicado en..."
  valor_acto NUMERIC(14,2),                                 -- Valor del acto (para cálculo de timbres)
  moneda TEXT DEFAULT 'GTQ',

  -- Control de hojas
  hojas_protocolo INT,                                      -- Hojas del papel de protocolo usadas
  hojas_fotocopia INT,                                      -- Hojas de fotocopia para testimonios

  -- PDF firmado (escritura escaneada)
  pdf_escritura_url TEXT,                                    -- PDF de la escritura autorizada
  pdf_subido_at TIMESTAMPTZ,
  pdf_nombre_archivo TEXT,                                   -- Nombre original del archivo
  pdf_tamano_bytes BIGINT,                                   -- Tamaño para validación
  pdf_verificado BOOLEAN NOT NULL DEFAULT false,             -- ¿Revisaste que el escaneo está completo?
  pdf_notas TEXT,                                            -- "Falta página 3", "Borroso", etc.

  -- Timbres fiscales
  timbre_notarial NUMERIC(8,2) DEFAULT 0,                   -- Timbre de Q10 por hoja
  timbres_fiscales NUMERIC(8,2) DEFAULT 0,                  -- Según tipo de acto
  timbre_razon NUMERIC(8,2) DEFAULT 0.50,                   -- Q0.50 para razón
  timbres_auto_calculados BOOLEAN NOT NULL DEFAULT true,     -- Si fue cálculo automático
  timbres_notas TEXT,                                        -- Notas sobre cálculo de timbres

  -- Aranceles y pagos al Estado
  arancel_registro NUMERIC(10,2) DEFAULT 0,
  impuestos_aplicables JSONB DEFAULT '{}',
  /*
    Formato:
    {
      "iva_actos": 0,
      "timbre_compraventa": 0,
      "arancel_registro_propiedad": 0,
      "otros": []
    }
  */

  -- Vinculación a facturación
  factura_id UUID REFERENCES legal.facturas(id),

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Una escritura tiene un número único por año
  UNIQUE(protocolo_anual_id, numero)
);

CREATE INDEX idx_escrituras_protocolo ON legal.escrituras(protocolo_anual_id);
CREATE INDEX idx_escrituras_cliente ON legal.escrituras(cliente_id);
CREATE INDEX idx_escrituras_tipo ON legal.escrituras(tipo_instrumento);
CREATE INDEX idx_escrituras_estado ON legal.escrituras(estado);
CREATE INDEX idx_escrituras_fecha ON legal.escrituras(fecha_autorizacion);
CREATE INDEX idx_escrituras_numero ON legal.escrituras(protocolo_anual_id, numero);

-- ============================================================================
-- MÓDULO NOTARIADO: Plantillas de Razón Notarial (por tipo de acto)
-- ============================================================================

CREATE TABLE legal.plantillas_razon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_instrumento legal.tipo_instrumento NOT NULL,
  tipo_testimonio legal.tipo_testimonio NOT NULL,

  -- Plantilla con variables (Handlebars-style)
  plantilla TEXT NOT NULL,
  /*
    Variables disponibles:
    {{tipo_testimonio_texto}}   - "ES TESTIMONIO" o "ES TESTIMONIO ESPECIAL"
    {{numero_texto}}            - "CUARENTA Y NUEVE (49)"
    {{lugar_autorizacion}}      - "Ciudad de Guatemala"
    {{departamento}}            - "Guatemala"
    {{fecha_autorizacion_texto}} - "diecisiete de noviembre del año dos mil veinticinco"
    {{destinatario}}            - nombre del compareciente o "ARCHIVO GENERAL DE PROTOCOLOS"
    {{articulo_codigo}}         - "77" literal "b", "c", etc.
    {{hojas_texto}}             - "DOS HOJAS"
    {{hojas_detalle}}           - "la primera en su lado reverso..."
    {{tipo_acto_texto}}         - "contrato de compraventa"
    {{objeto_acto}}             - descripción del objeto
    {{timbre_texto}}            - texto sobre timbres aplicables
    {{fecha_emision_texto}}     - fecha de emisión del testimonio
    {{lugar_emision}}           - lugar de emisión
    {{notario_nombre}}          - "SOAZIG AMANDA SANTIZO CALDERÓN"
  */

  -- Metadata
  descripcion TEXT,
  es_default BOOLEAN NOT NULL DEFAULT false,               -- Plantilla por defecto si no hay específica
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Una plantilla por combinación tipo_instrumento + tipo_testimonio (o default)
  UNIQUE(tipo_instrumento, tipo_testimonio)
);

-- Plantilla DEFAULT para primer testimonio (se usa si no hay específica)
INSERT INTO legal.plantillas_razon (tipo_instrumento, tipo_testimonio, plantilla, descripcion, es_default) VALUES
('otro', 'primer_testimonio',
'{{tipo_testimonio_texto}} de la escritura pública número {{numero_texto}} que autoricé en la {{lugar_autorizacion}} del departamento de {{departamento}}, el día {{fecha_autorizacion_texto}}, que extiendo, numero, sello y firmo en esta ciudad el día {{fecha_emision_texto}}, de conformidad con el artículo setenta y siete (77) literal "b" del Código de Notariado, en {{hojas_texto}} de fotocopia impresas: {{hojas_detalle}} más la presente en una hoja de papel bond, impresa únicamente en su lado anverso. DOY FE: Que la fotocopia que integra este documento fue tomada de la escritura matriz del Registro Notarial a mi cargo y que las mismas concuerdan fielmente con el original que tuve a la vista. Este testimonio es para entregar a {{destinatario}}.-------- RAZÓN: {{timbre_texto}}. CONSTE.',
'Plantilla genérica de primer testimonio', true),

-- Plantilla DEFAULT para testimonio especial
('otro', 'testimonio_especial',
'{{tipo_testimonio_texto}} de la escritura pública número {{numero_texto}} que autoricé en la {{lugar_autorizacion}}, el día {{fecha_autorizacion_texto}}. Y, para remitir al ARCHIVO GENERAL DE PROTOCOLOS, extiendo, numero, sello y firmo en {{hojas_protocolo_texto}} hojas, las {{hojas_protocolo_texto}} en papel especial para fotocopia, que fueron reproducidas en su anverso y reverso, en mi presencia el día de hoy directamente de su original, más la presente razón en una hoja de papel bond. En la {{lugar_emision}} el {{fecha_emision_texto}}.',
'Plantilla genérica de testimonio especial', true),

-- Plantilla para mandato - primer testimonio
('mandato', 'primer_testimonio',
'{{tipo_testimonio_texto}} de la escritura pública número {{numero_texto}} que autoricé en la {{lugar_autorizacion}} del departamento de {{departamento}}, el día {{fecha_autorizacion_texto}}, que extiendo, numero, sello y firmo en esta ciudad el día {{fecha_emision_texto}}, de conformidad con el artículo setenta y siete (77) literal "b" del Código de Notariado, en {{hojas_texto}} de fotocopia impresas: {{hojas_detalle}} más la presente en una hoja de papel bond, impresa únicamente en su lado anverso. DOY FE: Que la fotocopia que integra este documento fue tomada de la escritura matriz del Registro Notarial a mi cargo y que las mismas concuerdan fielmente con el original que tuve a la vista. Este testimonio es para entregar a {{destinatario}}.-------- RAZÓN: Se hace constar que no está afecto impuesto de timbre fiscal por lo que únicamente se adhiere un timbre fiscal de cincuenta centavos para la razón de registro. CONSTE.',
'Primer testimonio para mandatos (exentos de timbre)', false),

-- Plantilla para compraventa - primer testimonio
('compraventa', 'primer_testimonio',
'{{tipo_testimonio_texto}} de la escritura pública número {{numero_texto}} que autoricé en la {{lugar_autorizacion}} del departamento de {{departamento}}, el día {{fecha_autorizacion_texto}}, que extiendo, numero, sello y firmo en esta ciudad el día {{fecha_emision_texto}}, de conformidad con el artículo setenta y siete (77) literal "b" del Código de Notariado, en {{hojas_texto}} de fotocopia impresas: {{hojas_detalle}} más la presente en una hoja de papel bond, impresa únicamente en su lado anverso. DOY FE: Que la fotocopia que integra este documento fue tomada de la escritura matriz del Registro Notarial a mi cargo y que las mismas concuerdan fielmente con el original que tuve a la vista. Este testimonio es para entregar a {{destinatario}}.-------- RAZÓN: Se hace constar que sobre el presente instrumento público se cubrieron los impuestos de ley. CONSTE.',
'Primer testimonio para compraventas (con impuestos)', false),

-- Plantilla para sociedad anónima - primer testimonio
('sociedad_anonima', 'primer_testimonio',
'{{tipo_testimonio_texto}} de la escritura pública número {{numero_texto}} que autoricé en la {{lugar_autorizacion}} del departamento de {{departamento}}, el día {{fecha_autorizacion_texto}}, que contiene {{tipo_acto_texto}}, que extiendo, numero, sello y firmo en esta ciudad el día {{fecha_emision_texto}}, de conformidad con el artículo setenta y siete (77) literal "b" del Código de Notariado, en {{hojas_texto}} de fotocopia impresas: {{hojas_detalle}} más la presente en una hoja de papel bond, impresa únicamente en su lado anverso. DOY FE: Que la fotocopia que integra este documento fue tomada de la escritura matriz del Registro Notarial a mi cargo y que las mismas concuerdan fielmente con el original que tuve a la vista. Este testimonio es para entregar a {{destinatario}}.-------- RAZÓN: {{timbre_texto}}. CONSTE.',
'Primer testimonio para constitución de S.A.', false);

-- ============================================================================
-- MÓDULO NOTARIADO: Testimonios
-- ============================================================================

CREATE TABLE legal.testimonios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escritura_id UUID NOT NULL REFERENCES legal.escrituras(id),
  tipo legal.tipo_testimonio NOT NULL,
  estado legal.estado_testimonio NOT NULL DEFAULT 'borrador',
  plantilla_id UUID REFERENCES legal.plantillas_razon(id),

  -- Destinatario
  destinatario TEXT NOT NULL,                              -- Nombre de persona o "ARCHIVO GENERAL DE PROTOCOLOS"

  -- Contenido generado
  texto_razon TEXT,                                        -- Texto completo de la razón (generado)
  texto_editado BOOLEAN NOT NULL DEFAULT false,            -- Si el usuario lo editó manualmente

  -- Control de hojas
  hojas_fotocopia INT,
  hojas_detalle TEXT,                                      -- "la primera en anverso..."
  hoja_bond INT DEFAULT 1,                                 -- Hoja de papel bond para la razón

  -- Artículo del Código de Notariado
  articulo_codigo TEXT DEFAULT '77',
  literal_codigo TEXT DEFAULT 'b',                         -- a, b, c, d, e

  -- Timbres
  timbre_razon NUMERIC(8,2) DEFAULT 0.50,
  timbres_adicionales NUMERIC(8,2) DEFAULT 0,
  timbre_notas TEXT,

  -- Fechas
  fecha_emision DATE,
  fecha_entrega DATE,

  -- PDF generado
  pdf_url TEXT,

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_testimonios_escritura ON legal.testimonios(escritura_id);
CREATE INDEX idx_testimonios_tipo ON legal.testimonios(tipo);
CREATE INDEX idx_testimonios_estado ON legal.testimonios(estado);

-- ============================================================================
-- MÓDULO NOTARIADO: Actas Notariales (fuera del protocolo)
-- ============================================================================

CREATE TABLE legal.actas_notariales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES legal.clientes(id),
  expediente_id UUID REFERENCES legal.expedientes(id),

  numero INT NOT NULL,                                     -- Numeración secuencial por año
  anio INT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  lugar TEXT NOT NULL,
  tipo legal.tipo_acta NOT NULL,
  tipo_texto TEXT,                                         -- Descripción personalizada

  -- Contenido
  requirente TEXT NOT NULL,                                -- Persona que solicita el acta
  requirente_dpi TEXT,
  hechos TEXT,                                             -- Resumen de hechos
  contenido_completo TEXT,                                 -- Texto completo del acta

  -- Control
  hojas INT DEFAULT 1,
  pdf_url TEXT,

  -- Facturación
  factura_id UUID REFERENCES legal.facturas(id),

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(anio, numero)
);

CREATE INDEX idx_actas_cliente ON legal.actas_notariales(cliente_id);
CREATE INDEX idx_actas_fecha ON legal.actas_notariales(fecha);

-- ============================================================================
-- MÓDULO NOTARIADO: Autenticaciones de Firmas
-- ============================================================================

CREATE TABLE legal.autenticaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES legal.clientes(id),

  numero INT NOT NULL,                                     -- Secuencial por año
  anio INT NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  lugar TEXT NOT NULL,

  -- Datos
  documento_autenticado TEXT NOT NULL,                      -- Qué documento se autentica
  firmantes JSONB NOT NULL DEFAULT '[]',
  /*
    [{ "nombre": "...", "dpi": "..." }]
  */
  numero_firmas INT NOT NULL DEFAULT 1,

  -- Control
  pdf_url TEXT,
  factura_id UUID REFERENCES legal.facturas(id),

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(anio, numero)
);

CREATE INDEX idx_autenticaciones_fecha ON legal.autenticaciones(fecha);

-- ============================================================================
-- MÓDULO NOTARIADO: Avisos Trimestrales
-- ============================================================================

CREATE TABLE legal.avisos_trimestrales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anio INT NOT NULL,
  trimestre INT NOT NULL CHECK (trimestre BETWEEN 1 AND 4),
  estado legal.estado_aviso NOT NULL DEFAULT 'borrador',

  -- Datos calculados automáticamente
  escrituras_autorizadas INT NOT NULL DEFAULT 0,
  escrituras_canceladas INT NOT NULL DEFAULT 0,
  ultimo_instrumento_numero INT,
  ultimo_instrumento_numero_texto TEXT,                     -- "tres (3)"
  ultimo_instrumento_tipo TEXT,                             -- "contrato de sociedad anónima"
  ultimo_instrumento_lugar TEXT,                            -- "La Antigua Guatemala, Sacatepequez"
  ultimo_instrumento_fecha DATE,
  ultimo_instrumento_fecha_texto TEXT,                      -- "doce de diciembre de dos mil veintitrés"

  -- Fechas del trimestre
  fecha_inicio_trimestre DATE NOT NULL,
  fecha_fin_trimestre DATE NOT NULL,
  fecha_limite_envio DATE NOT NULL,                        -- 10 días hábiles después del fin

  -- Texto generado
  texto_aviso TEXT,                                        -- Texto completo del aviso
  texto_editado BOOLEAN NOT NULL DEFAULT false,

  -- PDF y envío
  pdf_url TEXT,
  fecha_envio DATE,
  fecha_confirmacion DATE,
  metodo_envio TEXT,                                       -- presencial, correo, digital

  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(anio, trimestre)
);

CREATE INDEX idx_avisos_anio ON legal.avisos_trimestrales(anio, trimestre);
CREATE INDEX idx_avisos_estado ON legal.avisos_trimestrales(estado);

-- ============================================================================
-- MÓDULO NOTARIADO: Reglas de Timbres por Tipo de Acto
-- ============================================================================

CREATE TABLE legal.reglas_timbres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_instrumento legal.tipo_instrumento NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,

  -- Reglas de cálculo
  timbre_fijo NUMERIC(8,2),                                -- Monto fijo (ej: Q0.50)
  timbre_porcentaje NUMERIC(5,4),                          -- Porcentaje sobre valor del acto
  base_calculo TEXT,                                       -- 'valor_acto', 'capital_social', 'fijo'
  exento BOOLEAN NOT NULL DEFAULT false,                   -- Si está exento de timbres
  texto_razon TEXT,                                        -- Texto para la razón del testimonio

  -- Impuestos adicionales (IVA por acto notarial, etc.)
  impuestos_adicionales JSONB DEFAULT '{}',

  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed reglas de timbres comunes
INSERT INTO legal.reglas_timbres (tipo_instrumento, nombre, descripcion, timbre_fijo, timbre_porcentaje, base_calculo, exento, texto_razon) VALUES
('mandato', 'Mandato', 'Mandatos y poderes', 0.50, NULL, 'fijo', true,
 'Se hace constar que no está afecto impuesto de timbre fiscal por lo que únicamente se adhiere un timbre fiscal de cincuenta centavos para la razón de registro'),
('compraventa', 'Compraventa de Inmueble', 'Compraventa de bienes inmuebles', 0.50, NULL, 'valor_acto', false,
 'Se hace constar que sobre el presente instrumento público se cubrieron los impuestos de ley'),
('sociedad_anonima', 'Constitución S.A.', 'Constitución de sociedad anónima', 0.50, NULL, 'capital_social', false,
 'Se hace constar que sobre el presente instrumento público se cubrieron los impuestos conforme a ley'),
('donacion', 'Donación', 'Donación entre vivos', 0.50, NULL, 'valor_acto', false,
 'Se hace constar que sobre el presente instrumento público se cubrieron los impuestos de ley'),
('testamento', 'Testamento', 'Testamento y última voluntad', 0.50, NULL, 'fijo', true,
 'Se hace constar que no está afecto impuesto de timbre fiscal por lo que únicamente se adhiere un timbre fiscal de cincuenta centavos para la razón de registro'),
('protocolizacion', 'Protocolización', 'Protocolización de documento', 0.50, NULL, 'fijo', false,
 'Se hace constar que se adhieren los timbres de ley correspondientes'),
('arrendamiento', 'Arrendamiento', 'Contrato de arrendamiento', 0.50, NULL, 'valor_acto', false,
 'Se hace constar que sobre el presente instrumento público se cubrieron los impuestos de ley'),
('otro', 'Otros actos', 'Actos notariales varios', 0.50, NULL, 'fijo', false,
 'Se cubrieron los impuestos de ley conforme corresponde');

-- ============================================================================
-- SECUENCIAS para numeración automática
-- ============================================================================

-- Función para generar números secuenciales por tipo y año
CREATE OR REPLACE FUNCTION legal.next_sequence(
  p_tipo TEXT,    -- 'COT', 'FAC', 'PAG', 'GAS'
  p_anio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS TEXT AS $$
DECLARE
  v_seq INT;
  v_prefix TEXT;
BEGIN
  -- Tabla de secuencias
  CREATE TABLE IF NOT EXISTS legal.secuencias (
    tipo TEXT NOT NULL,
    anio INT NOT NULL,
    ultimo_numero INT NOT NULL DEFAULT 0,
    PRIMARY KEY (tipo, anio)
  );

  -- Incrementar y obtener siguiente número
  INSERT INTO legal.secuencias (tipo, anio, ultimo_numero)
  VALUES (p_tipo, p_anio, 1)
  ON CONFLICT (tipo, anio)
  DO UPDATE SET ultimo_numero = legal.secuencias.ultimo_numero + 1
  RETURNING ultimo_numero INTO v_seq;

  -- Formatear: COT-2026-0001
  RETURN p_tipo || '-' || p_anio || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIONES: Siguiente número de escritura (auto-incremental)
-- ============================================================================

CREATE OR REPLACE FUNCTION legal.next_escritura_numero(
  p_anio INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT
) RETURNS INT AS $$
DECLARE
  v_siguiente INT;
BEGIN
  -- Obtener el último número usado + 1
  SELECT COALESCE(ultima_escritura_numero, 0) + 1
  INTO v_siguiente
  FROM legal.protocolo_anual
  WHERE anio = p_anio;

  -- Si no existe protocolo para ese año, crearlo
  IF NOT FOUND THEN
    INSERT INTO legal.protocolo_anual (anio, fecha_apertura, ultima_escritura_numero)
    VALUES (p_anio, CURRENT_DATE, 0);
    v_siguiente := 1;
  END IF;

  RETURN v_siguiente;
END;
$$ LANGUAGE plpgsql;

-- Trigger: al insertar escritura, auto-asignar número si no se proporcionó
CREATE OR REPLACE FUNCTION legal.auto_numerar_escritura()
RETURNS TRIGGER AS $$
BEGIN
  -- Si no se proporcionó número, asignar el siguiente
  IF NEW.numero IS NULL OR NEW.numero = 0 THEN
    NEW.numero := legal.next_escritura_numero(
      EXTRACT(YEAR FROM NEW.fecha_autorizacion)::INT
    );
  END IF;

  -- Actualizar el último número en protocolo_anual
  UPDATE legal.protocolo_anual
  SET ultima_escritura_numero = GREATEST(ultima_escritura_numero, NEW.numero),
      updated_at = now()
  WHERE id = NEW.protocolo_anual_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escritura_auto_numero
  BEFORE INSERT ON legal.escrituras
  FOR EACH ROW
  EXECUTE FUNCTION legal.auto_numerar_escritura();

-- ============================================================================
-- FUNCIONES: Cálculos automáticos
-- ============================================================================

-- Calcular retención ISR
CREATE OR REPLACE FUNCTION legal.calcular_retencion_isr(
  p_monto NUMERIC
) RETURNS TABLE(porcentaje NUMERIC, monto NUMERIC) AS $$
DECLARE
  v_umbral NUMERIC;
  v_porcentaje NUMERIC;
BEGIN
  SELECT isr_umbral INTO v_umbral FROM legal.configuracion LIMIT 1;

  IF p_monto < v_umbral THEN
    SELECT isr_porcentaje_bajo INTO v_porcentaje FROM legal.configuracion LIMIT 1;
  ELSE
    SELECT isr_porcentaje_alto INTO v_porcentaje FROM legal.configuracion LIMIT 1;
  END IF;

  RETURN QUERY SELECT v_porcentaje, ROUND(p_monto * v_porcentaje / 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Calcular IVA
CREATE OR REPLACE FUNCTION legal.calcular_iva(
  p_subtotal NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  v_iva NUMERIC;
BEGIN
  SELECT iva_porcentaje INTO v_iva FROM legal.configuracion LIMIT 1;
  RETURN ROUND(p_subtotal * v_iva / 100, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCIONES: Flujo de carga de PDF escaneado
-- ============================================================================

-- Cuando se sube el PDF, auto-cambiar estado a 'escaneada'
CREATE OR REPLACE FUNCTION legal.on_pdf_escritura_subido()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se acaba de subir un PDF (campo pasó de NULL a un valor)
  IF NEW.pdf_escritura_url IS NOT NULL
     AND (OLD.pdf_escritura_url IS NULL OR OLD.pdf_escritura_url != NEW.pdf_escritura_url)
  THEN
    NEW.pdf_subido_at := now();

    -- Auto-avanzar a 'escaneada' si estaba en 'autorizada'
    IF NEW.estado = 'autorizada' THEN
      NEW.estado := 'escaneada';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escritura_pdf_subido
  BEFORE UPDATE OF pdf_escritura_url ON legal.escrituras
  FOR EACH ROW
  EXECUTE FUNCTION legal.on_pdf_escritura_subido();

-- Validar que no se pueda marcar testimonio como 'generado' o 'firmado'
-- si la escritura no tiene PDF subido
CREATE OR REPLACE FUNCTION legal.validar_testimonio_requiere_pdf()
RETURNS TRIGGER AS $$
DECLARE
  v_escritura RECORD;
BEGIN
  -- Solo validar cuando el testimonio avanza más allá de 'borrador'
  IF NEW.estado IN ('generado', 'firmado', 'entregado')
     AND (OLD.estado IS NULL OR OLD.estado = 'borrador')
  THEN
    SELECT estado, pdf_escritura_url
    INTO v_escritura
    FROM legal.escrituras
    WHERE id = NEW.escritura_id;

    IF v_escritura.pdf_escritura_url IS NULL THEN
      RAISE EXCEPTION 'No se puede generar el testimonio sin haber subido el PDF de la escritura firmada. Primero sube el escaneo de la escritura.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_testimonio_requiere_pdf
  BEFORE UPDATE OF estado ON legal.testimonios
  FOR EACH ROW
  EXECUTE FUNCTION legal.validar_testimonio_requiere_pdf();

-- ============================================================================
-- FUNCIONES: Auto-generar testimonios al crear escritura
-- ============================================================================

CREATE OR REPLACE FUNCTION legal.auto_crear_testimonios()
RETURNS TRIGGER AS $$
DECLARE
  v_plantilla_primer RECORD;
  v_plantilla_especial RECORD;
  v_destinatario TEXT;
BEGIN
  -- Solo cuando la escritura pasa a estado 'autorizada'
  IF NEW.estado = 'autorizada' AND (OLD.estado IS NULL OR OLD.estado != 'autorizada') THEN

    -- Obtener primer compareciente como destinatario del primer testimonio
    v_destinatario := NEW.comparecientes->0->>'nombre';
    IF v_destinatario IS NULL THEN
      v_destinatario := 'INTERESADO';
    END IF;

    -- Buscar plantilla específica para primer testimonio, si no existe usar default
    SELECT * INTO v_plantilla_primer
    FROM legal.plantillas_razon
    WHERE tipo_instrumento = NEW.tipo_instrumento
      AND tipo_testimonio = 'primer_testimonio'
      AND activo = true
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_plantilla_primer
      FROM legal.plantillas_razon
      WHERE es_default = true AND tipo_testimonio = 'primer_testimonio'
      LIMIT 1;
    END IF;

    -- Crear borrador de Primer Testimonio
    INSERT INTO legal.testimonios (
      escritura_id, tipo, estado, plantilla_id,
      destinatario, articulo_codigo, literal_codigo,
      hojas_fotocopia, timbre_razon
    ) VALUES (
      NEW.id, 'primer_testimonio', 'borrador', v_plantilla_primer.id,
      v_destinatario, '77', 'b',
      NEW.hojas_fotocopia, NEW.timbre_razon
    );

    -- Buscar plantilla para testimonio especial
    SELECT * INTO v_plantilla_especial
    FROM legal.plantillas_razon
    WHERE tipo_instrumento = NEW.tipo_instrumento
      AND tipo_testimonio = 'testimonio_especial'
      AND activo = true
    LIMIT 1;

    IF NOT FOUND THEN
      SELECT * INTO v_plantilla_especial
      FROM legal.plantillas_razon
      WHERE es_default = true AND tipo_testimonio = 'testimonio_especial'
      LIMIT 1;
    END IF;

    -- Crear borrador de Testimonio Especial
    INSERT INTO legal.testimonios (
      escritura_id, tipo, estado, plantilla_id,
      destinatario, articulo_codigo, literal_codigo,
      hojas_fotocopia, timbre_razon
    ) VALUES (
      NEW.id, 'testimonio_especial', 'borrador', v_plantilla_especial.id,
      'ARCHIVO GENERAL DE PROTOCOLOS', '77', 'b',
      NEW.hojas_fotocopia, 0.50
    );

    -- Actualizar conteo de escrituras en protocolo anual
    UPDATE legal.protocolo_anual
    SET escrituras_autorizadas = escrituras_autorizadas + 1,
        ultima_escritura_numero = NEW.numero,
        hojas_protocolo_usadas = hojas_protocolo_usadas + COALESCE(NEW.hojas_protocolo, 0),
        updated_at = now()
    WHERE id = NEW.protocolo_anual_id;

  END IF;

  -- Si se cancela una escritura
  IF NEW.estado = 'cancelada' AND OLD.estado != 'cancelada' THEN
    UPDATE legal.protocolo_anual
    SET escrituras_canceladas = escrituras_canceladas + 1,
        updated_at = now()
    WHERE id = NEW.protocolo_anual_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_escritura_auto_testimonios
  AFTER INSERT OR UPDATE OF estado ON legal.escrituras
  FOR EACH ROW
  EXECUTE FUNCTION legal.auto_crear_testimonios();

-- ============================================================================
-- FUNCIONES: Auto-generar factura cuando se confirma un pago
-- ============================================================================

-- Auto-avanzar escritura a 'con_testimonio' cuando se entrega un testimonio
CREATE OR REPLACE FUNCTION legal.on_testimonio_entregado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'entregado' AND OLD.estado != 'entregado' THEN
    NEW.fecha_entrega := COALESCE(NEW.fecha_entrega, CURRENT_DATE);

    -- Si la escritura está en 'escaneada', avanzar a 'con_testimonio'
    UPDATE legal.escrituras
    SET estado = 'con_testimonio', updated_at = now()
    WHERE id = NEW.escritura_id
      AND estado = 'escaneada';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_testimonio_entregado
  BEFORE UPDATE OF estado ON legal.testimonios
  FOR EACH ROW
  EXECUTE FUNCTION legal.on_testimonio_entregado();

CREATE OR REPLACE FUNCTION legal.on_pago_confirmado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'confirmado' AND OLD.estado != 'confirmado' THEN
    NEW.confirmado_at := now();

    -- Actualizar estado de factura vinculada
    IF NEW.factura_id IS NOT NULL THEN
      -- Verificar si es pago total
      IF (
        SELECT COALESCE(SUM(monto), 0)
        FROM legal.pagos
        WHERE factura_id = NEW.factura_id AND estado = 'confirmado'
      ) + NEW.monto >= (
        SELECT monto_a_recibir FROM legal.facturas WHERE id = NEW.factura_id
      ) THEN
        UPDATE legal.facturas SET estado = 'pagada', updated_at = now()
        WHERE id = NEW.factura_id;
      ELSE
        UPDATE legal.facturas SET estado = 'parcial', updated_at = now()
        WHERE id = NEW.factura_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pago_confirmado
  BEFORE UPDATE OF estado ON legal.pagos
  FOR EACH ROW
  EXECUTE FUNCTION legal.on_pago_confirmado();

-- ============================================================================
-- FUNCIONES: Vencimiento automático de cotizaciones
-- ============================================================================

CREATE OR REPLACE FUNCTION legal.vencer_cotizaciones()
RETURNS void AS $$
BEGIN
  UPDATE legal.cotizaciones
  SET estado = 'vencida', updated_at = now()
  WHERE estado IN ('borrador', 'enviada')
    AND fecha_vencimiento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VISTAS: Dashboard contable
-- ============================================================================

CREATE OR REPLACE VIEW legal.v_dashboard_contable AS
SELECT
  -- Ingresos del mes
  (SELECT COALESCE(SUM(monto), 0)
   FROM legal.pagos
   WHERE estado = 'confirmado'
     AND date_trunc('month', fecha_pago) = date_trunc('month', CURRENT_DATE)
  ) AS ingresos_mes,

  -- Gastos del mes
  (SELECT COALESCE(SUM(monto), 0)
   FROM legal.gastos
   WHERE date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)
  ) AS gastos_mes,

  -- Facturas pendientes
  (SELECT COUNT(*)
   FROM legal.facturas
   WHERE estado IN ('pendiente', 'parcial')
  ) AS facturas_pendientes_count,

  (SELECT COALESCE(SUM(total - COALESCE(
      (SELECT SUM(p.monto) FROM legal.pagos p
       WHERE p.factura_id = f.id AND p.estado = 'confirmado'), 0
    )), 0)
   FROM legal.facturas f
   WHERE f.estado IN ('pendiente', 'parcial')
  ) AS facturas_pendientes_monto,

  -- Facturas vencidas
  (SELECT COUNT(*)
   FROM legal.facturas
   WHERE estado IN ('pendiente', 'parcial')
     AND fecha_vencimiento < CURRENT_DATE
  ) AS facturas_vencidas_count,

  -- Cotizaciones pendientes
  (SELECT COUNT(*)
   FROM legal.cotizaciones
   WHERE estado IN ('borrador', 'enviada')
     AND fecha_vencimiento >= CURRENT_DATE
  ) AS cotizaciones_activas_count,

  -- Cotizaciones por vencer (próximos 5 días)
  (SELECT COUNT(*)
   FROM legal.cotizaciones
   WHERE estado = 'enviada'
     AND fecha_vencimiento BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '5 days'
  ) AS cotizaciones_por_vencer_count;

-- ============================================================================
-- VISTAS: Dashboard notarial
-- ============================================================================

CREATE OR REPLACE VIEW legal.v_dashboard_notarial AS
SELECT
  pa.anio,
  pa.ultima_escritura_numero,
  pa.escrituras_autorizadas,
  pa.escrituras_canceladas,
  pa.hojas_protocolo_usadas,

  -- Testimonios pendientes de entregar
  (SELECT COUNT(*)
   FROM legal.testimonios t
   JOIN legal.escrituras e ON t.escritura_id = e.id
   WHERE e.protocolo_anual_id = pa.id
     AND t.estado != 'entregado'
     AND t.tipo = 'primer_testimonio'
  ) AS testimonios_primer_pendientes,

  (SELECT COUNT(*)
   FROM legal.testimonios t
   JOIN legal.escrituras e ON t.escritura_id = e.id
   WHERE e.protocolo_anual_id = pa.id
     AND t.estado != 'entregado'
     AND t.tipo = 'testimonio_especial'
  ) AS testimonios_especial_pendientes,

  -- Próximo aviso trimestral
  (SELECT estado
   FROM legal.avisos_trimestrales
   WHERE anio = pa.anio
   ORDER BY trimestre DESC
   LIMIT 1
  ) AS ultimo_aviso_estado,

  (SELECT fecha_limite_envio
   FROM legal.avisos_trimestrales
   WHERE anio = pa.anio AND estado IN ('borrador', 'generado')
   ORDER BY trimestre ASC
   LIMIT 1
  ) AS proxima_fecha_limite_aviso

FROM legal.protocolo_anual pa
WHERE pa.estado = 'abierto';

-- ============================================================================
-- RLS (Row Level Security) - preparado para Clerk
-- ============================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE legal.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.cotizacion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.factura_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.escrituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.testimonios ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.actas_notariales ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.autenticaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal.avisos_trimestrales ENABLE ROW LEVEL SECURITY;

-- Policies se crearán cuando se integre Clerk (Fase 2)
-- Por ahora, permitir acceso al service_role
CREATE POLICY "service_role_all" ON legal.clientes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Repetir para cada tabla (se generará con script en implementación)

-- ============================================================================
-- EXTENSIONES NECESARIAS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Para búsqueda fuzzy de nombres
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- Para encriptación de campos sensibles

-- ============================================================================
-- SEED: Insertar configuración inicial
-- ============================================================================

INSERT INTO legal.configuracion DEFAULT VALUES;

-- Insertar protocolo para año actual
INSERT INTO legal.protocolo_anual (anio, fecha_apertura)
VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::INT, CURRENT_DATE);

-- ============================================================================
-- NOTAS DE IMPLEMENTACIÓN
-- ============================================================================
/*
  SIGUIENTE PASO: API Routes en Next.js

  1. /api/admin/cotizaciones     - CRUD + generación PDF + email
  2. /api/admin/facturas         - CRUD + integración Megaprint FEL
  3. /api/admin/pagos            - Registro + trigger factura
  4. /api/admin/gastos           - CRUD + upload comprobantes
  5. /api/admin/notariado/
     ├── escrituras              - CRUD + auto-genera testimonios
     ├── testimonios             - Edición + generación PDF
     ├── actas                   - CRUD
     ├── autenticaciones         - CRUD
     ├── avisos-trimestrales     - Auto-generación + PDF
     └── protocolo               - Dashboard del protocolo

  INTEGRACIONES PENDIENTES:
  - Megaprint FEL API (facturación electrónica)
  - Proton Mail SMTP (emails transaccionales)
  - Supabase Storage (PDFs, comprobantes)
  - Claude API (generación de textos, razones notariales)

  SEGURIDAD PENDIENTE:
  - Clerk integration + RLS policies por usuario
  - Encriptación de campos sensibles (pgcrypto)
  - Audit trail (tabla de logs)
*/
