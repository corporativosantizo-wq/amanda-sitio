-- ============================================================================
-- Migration: 20260621_audiencias_modulo
--
-- Feature: Módulo de Audiencias y Recordatorios (IURISLEX) — Fase 1.
--   Registro dedicado de audiencias judiciales con pipeline propio:
--   recordatorios (cola + constancia), ventana hábil con asuetos, modo prueba.
--
-- Decisión de arquitectura (confirmada por Amanda):
--   REUSA la infraestructura de `legal.citas` (envío por Graph/Outlook,
--   Telegram/Molly, cron existente) pero NO la modifica. La rama
--   tipo='audiencia' de `citas` sigue viva en PARALELO durante las pruebas y
--   se retira recién en el cutover final (Fase 8, test_mode=false), para que el
--   cliente nunca reciba correos duplicados. Esta migración NO toca `citas`.
--
-- Cambios:
--   1. ENUMs: modalidad_audiencia, estado_audiencia, tipo_recordatorio_audiencia,
--      canal_recordatorio, estado_recordatorio, ambito_asueto
--   2. Tabla legal.audiencias            (FK reales a expedientes y clientes)
--   3. Tabla legal.audiencias_recordatorios (cola + constancia de envíos)
--   4. Tabla legal.dias_asueto           (+ seed 2026 y 2027, Semana Santa incl.)
--   5. Tabla legal.config_recordatorios  (singleton, test_mode=true)
--   6. Trigger updated_at + audit triggers + índices
--   7. RLS habilitada + política `_service` de respaldo (patrón service_role-only
--      idéntico a expedientes/citas). SIN políticas para authenticated/anon.
--
-- Notas:
--   - service_role hace BYPASS de RLS: todos los endpoints admin que usan
--     createAdminClient() tendrán acceso. La política `_service` es respaldo
--     explícito (mismo patrón que citas_service / expedientes_service).
--   - El encolado de reprogramaciones es lógica de la app (TypeScript), NO un
--     trigger de BD (testeable y en la capa de servicio). Esta migración solo
--     crea el esquema.
--   - Idempotente: enums con DO/EXCEPTION, CREATE ... IF NOT EXISTS, seeds con
--     ON CONFLICT DO NOTHING, DROP POLICY/TRIGGER IF EXISTS antes de CREATE.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUMs
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE legal.modalidad_audiencia AS ENUM ('presencial','virtual','hibrida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal.estado_audiencia AS ENUM
    ('programada','confirmada','realizada','suspendida','reprogramada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal.tipo_recordatorio_audiencia AS ENUM
    ('recordatorio_previo','confirmacion_creacion','reprogramacion','cancelacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal.canal_recordatorio AS ENUM ('email','telegram');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal.estado_recordatorio AS ENUM
    ('pendiente_aprobacion','aprobado','programado','enviado','pospuesto','descartado','fallido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE legal.ambito_asueto AS ENUM ('nacional','guatemala_ciudad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Función compartida de updated_at (search_path fijo por seguridad)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION legal.audiencias_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Tabla legal.audiencias
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal.audiencias (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK reales (no texto libre). Opcionales: una audiencia puede registrarse
  -- antes de vincular expediente/cliente. ON DELETE SET NULL para no perder la
  -- audiencia si se archiva/borra el expediente o cliente.
  expediente_id      UUID REFERENCES legal.expedientes(id) ON DELETE SET NULL,
  cliente_id         UUID REFERENCES legal.clientes(id)    ON DELETE SET NULL,
  titulo             TEXT,
  tipo_audiencia     TEXT,                                    -- libre por ahora (vista, declaración, conciliación, ...)
  modalidad          legal.modalidad_audiencia NOT NULL,      -- ramifica la plantilla de correo
  fecha_hora_inicio  TIMESTAMPTZ NOT NULL,                    -- crítico: huso correcto (America/Guatemala, UTC-6)
  fecha_hora_fin     TIMESTAMPTZ,
  juzgado            TEXT,
  sala               TEXT,
  ubicacion          TEXT,                                    -- dirección (presencial)
  enlace_virtual     TEXT,                                    -- URL de conexión (virtual/híbrida)
  plataforma         TEXT,                                    -- zoom / teams / meet / otro
  instrucciones      TEXT,                                    -- notas para el cliente (qué llevar, etc.)
  estado             legal.estado_audiencia NOT NULL DEFAULT 'programada',
  ics_sequence       INTEGER NOT NULL DEFAULT 0,              -- SEQUENCE del .ics; se incrementa en cada reprogramación
  notas_internas     TEXT,                                    -- NO sale al cliente
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audiencias_fin_despues_de_inicio
    CHECK (fecha_hora_fin IS NULL OR fecha_hora_fin >= fecha_hora_inicio)
);

COMMENT ON TABLE legal.audiencias IS
  'Audiencias judiciales con pipeline propio de recordatorios (.ics, aprobación, '
  'modo prueba). El id se usa como UID estable del .ics. Reusa la infraestructura '
  'de envío de citas pero es una tabla independiente; convive con la rama '
  'tipo=audiencia de legal.citas hasta el cutover (Fase 8).';
COMMENT ON COLUMN legal.audiencias.ics_sequence IS
  'SEQUENCE del VEVENT. UID = id (estable) + SEQUENCE creciente hace que al '
  'reprogramar el calendario del cliente ACTUALICE el evento en vez de duplicarlo.';

CREATE INDEX IF NOT EXISTS idx_audiencias_expediente ON legal.audiencias(expediente_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_cliente    ON legal.audiencias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_audiencias_fecha      ON legal.audiencias(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_audiencias_estado     ON legal.audiencias(estado);

ALTER TABLE legal.audiencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audiencias_service ON legal.audiencias;
CREATE POLICY audiencias_service ON legal.audiencias
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS audiencias_updated_at ON legal.audiencias;
CREATE TRIGGER audiencias_updated_at
  BEFORE UPDATE ON legal.audiencias
  FOR EACH ROW EXECUTE FUNCTION legal.audiencias_set_updated_at();

DROP TRIGGER IF EXISTS audit_audiencias ON legal.audiencias;
CREATE TRIGGER audit_audiencias
  AFTER INSERT OR UPDATE OR DELETE ON legal.audiencias
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Tabla legal.audiencias_recordatorios  (cola + constancia)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal.audiencias_recordatorios (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audiencia_id        UUID NOT NULL REFERENCES legal.audiencias(id) ON DELETE CASCADE,
  tipo                legal.tipo_recordatorio_audiencia NOT NULL,
  canal               legal.canal_recordatorio NOT NULL DEFAULT 'email',
  requiere_aprobacion BOOLEAN NOT NULL,                       -- true: recordatorio_previo · false: reprogramacion (auto)
  destinatario_nombre TEXT,
  destinatario_email  TEXT,                                   -- destinatario REAL (aunque en prueba se mande a otro)
  asunto              TEXT NOT NULL,
  cuerpo              TEXT NOT NULL,                           -- render final del correo
  estado              legal.estado_recordatorio NOT NULL DEFAULT 'pendiente_aprobacion',
  fecha_sugerida_envio TIMESTAMPTZ,                           -- calculada con ventana hábil + asuetos
  fecha_enviado       TIMESTAMPTZ,
  enviado_a_email     TEXT,                                   -- a quién se mandó DE VERDAD (en prueba = correo de Amanda)
  es_prueba           BOOLEAN NOT NULL DEFAULT true,          -- marca si salió en modo prueba
  error               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.audiencias_recordatorios IS
  'Cola y constancia de envíos de recordatorios de audiencia. El par '
  'destinatario_email (real) + enviado_a_email (efectivo) + es_prueba da la '
  'constancia auditable: qué se DEBIÓ enviar vs. qué se envió y si fue en prueba.';
COMMENT ON COLUMN legal.audiencias_recordatorios.estado IS
  'Default pendiente_aprobacion. La app lo sobreescribe a "programado" para los '
  'automáticos (reprogramacion, requiere_aprobacion=false), que no pasan por bandeja.';

CREATE INDEX IF NOT EXISTS idx_aud_recordatorios_audiencia ON legal.audiencias_recordatorios(audiencia_id);
CREATE INDEX IF NOT EXISTS idx_aud_recordatorios_estado    ON legal.audiencias_recordatorios(estado);
CREATE INDEX IF NOT EXISTS idx_aud_recordatorios_sugerida  ON legal.audiencias_recordatorios(fecha_sugerida_envio);
-- Cola de trabajo del cron: lo listo-para-enviar (aprobado o programado, aún sin enviar).
CREATE INDEX IF NOT EXISTS idx_aud_recordatorios_por_enviar
  ON legal.audiencias_recordatorios(fecha_sugerida_envio)
  WHERE estado IN ('aprobado','programado') AND fecha_enviado IS NULL;

ALTER TABLE legal.audiencias_recordatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audiencias_recordatorios_service ON legal.audiencias_recordatorios;
CREATE POLICY audiencias_recordatorios_service ON legal.audiencias_recordatorios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS audiencias_recordatorios_updated_at ON legal.audiencias_recordatorios;
CREATE TRIGGER audiencias_recordatorios_updated_at
  BEFORE UPDATE ON legal.audiencias_recordatorios
  FOR EACH ROW EXECUTE FUNCTION legal.audiencias_set_updated_at();

DROP TRIGGER IF EXISTS audit_audiencias_recordatorios ON legal.audiencias_recordatorios;
CREATE TRIGGER audit_audiencias_recordatorios
  AFTER INSERT OR UPDATE OR DELETE ON legal.audiencias_recordatorios
  FOR EACH ROW EXECUTE FUNCTION legal.audit_trigger_fn();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Tabla legal.dias_asueto  (+ seed)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal.dias_asueto (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       DATE NOT NULL UNIQUE,
  descripcion TEXT NOT NULL,
  ambito      legal.ambito_asueto NOT NULL DEFAULT 'nacional',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.dias_asueto IS
  'Calendario laboral (nacional + Ciudad de Guatemala) SOLO para no sugerir '
  'envíos de correo en feriado. NO es el calendario de días inhábiles del OJ '
  'para cómputo de plazos procesales (ese es más amplio y es otro problema).';

-- Seed 2026 y 2027. Fijos por ley + Semana Santa movible (fechas validadas:
-- Pascua 2026 = 5 abr → jue 2/vie 3/sáb 4; Pascua 2027 = 28 mar → jue 25/vie 26/sáb 27).
-- Los 24 y 31 dic son MEDIO día (tarde libre); aquí se marcan como asueto para
-- no programar envíos ese día. Refinar a "solo mañana" si se requiere más adelante.
INSERT INTO legal.dias_asueto (fecha, descripcion, ambito) VALUES
  ('2026-01-01', 'Año Nuevo',                        'nacional'),
  ('2026-04-02', 'Jueves Santo',                     'nacional'),
  ('2026-04-03', 'Viernes Santo',                    'nacional'),
  ('2026-04-04', 'Sábado Santo',                     'nacional'),
  ('2026-05-01', 'Día del Trabajo',                  'nacional'),
  ('2026-06-30', 'Día del Ejército',                 'nacional'),
  ('2026-08-15', 'Virgen de la Asunción',            'guatemala_ciudad'),
  ('2026-09-15', 'Día de la Independencia',          'nacional'),
  ('2026-10-20', 'Día de la Revolución de 1944',     'nacional'),
  ('2026-11-01', 'Día de Todos los Santos',          'nacional'),
  ('2026-12-24', 'Nochebuena (medio día)',           'nacional'),
  ('2026-12-25', 'Navidad',                          'nacional'),
  ('2026-12-31', 'Fin de Año (medio día)',           'nacional'),
  ('2027-01-01', 'Año Nuevo',                        'nacional'),
  ('2027-03-25', 'Jueves Santo',                     'nacional'),
  ('2027-03-26', 'Viernes Santo',                    'nacional'),
  ('2027-03-27', 'Sábado Santo',                     'nacional'),
  ('2027-05-01', 'Día del Trabajo',                  'nacional'),
  ('2027-06-30', 'Día del Ejército',                 'nacional'),
  ('2027-08-15', 'Virgen de la Asunción',            'guatemala_ciudad'),
  ('2027-09-15', 'Día de la Independencia',          'nacional'),
  ('2027-10-20', 'Día de la Revolución de 1944',     'nacional'),
  ('2027-11-01', 'Día de Todos los Santos',          'nacional'),
  ('2027-12-24', 'Nochebuena (medio día)',           'nacional'),
  ('2027-12-25', 'Navidad',                          'nacional'),
  ('2027-12-31', 'Fin de Año (medio día)',           'nacional')
ON CONFLICT (fecha) DO NOTHING;

ALTER TABLE legal.dias_asueto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dias_asueto_service ON legal.dias_asueto;
CREATE POLICY dias_asueto_service ON legal.dias_asueto
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Tabla legal.config_recordatorios  (singleton)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal.config_recordatorios (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- fuerza una sola fila
  dias_antes_default INTEGER NOT NULL DEFAULT 1,
  ventana_inicio     TIME NOT NULL DEFAULT '08:00',
  ventana_fin        TIME NOT NULL DEFAULT '17:00',
  dias_habiles       INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',     -- ISO dow: 1=lun ... 5=vie
  test_mode          BOOLEAN NOT NULL DEFAULT true,
  test_email         TEXT,                                          -- override opcional; si NULL la app usa env RECORDATORIOS_TEST_EMAIL
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE legal.config_recordatorios IS
  'Configuración (una sola fila) de la ventana hábil y el modo prueba, editable '
  'sin redeploy. Arranca en test_mode=true: todo correo al cliente se redirige al '
  'correo de prueba. Pasar a producción = un solo UPDATE test_mode=false.';
COMMENT ON COLUMN legal.config_recordatorios.test_email IS
  'Override del correo de prueba. Se deja NULL a propósito (no hardcodear el '
  'correo de Amanda): la app cae al env RECORDATORIOS_TEST_EMAIL.';

INSERT INTO legal.config_recordatorios (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE legal.config_recordatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_recordatorios_service ON legal.config_recordatorios;
CREATE POLICY config_recordatorios_service ON legal.config_recordatorios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS config_recordatorios_updated_at ON legal.config_recordatorios;
CREATE TRIGGER config_recordatorios_updated_at
  BEFORE UPDATE ON legal.config_recordatorios
  FOR EACH ROW EXECUTE FUNCTION legal.audiencias_set_updated_at();

-- ============================================================================
-- Fin de la migración. NO aplicada a producción todavía: revisar y aprobar.
-- ============================================================================
