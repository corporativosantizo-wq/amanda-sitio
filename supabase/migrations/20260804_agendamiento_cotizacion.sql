-- ============================================================================
-- Enlaces de agendamiento por cotización (módulo agendamiento-cotizacion).
--
-- 1. legal.cotizaciones:
--    - tramite_finalizado_at: cierre del trámite (patrón enviada_at /
--      aceptada_at — NO se toca el enum estado_cotizacion). Con valor, el
--      enlace de agendamiento del cliente queda muerto.
--    - token_agendamiento: token del enlace personal de agendamiento que
--      recibe el cliente al aceptar. Columna NUEVA e independiente de
--      token_respuesta (ese sirve para aceptar/rechazar la cotización y no
--      debe habilitar agendamiento). Sin vencimiento por reloj: la validez es
--      por estado (estado='aceptada' AND tramite_finalizado_at IS NULL).
--      El DEFAULT volátil hace que Postgres genere un uuid DISTINTO por fila
--      existente (backfill automático); el UPDATE posterior es cinturón por
--      si alguna fila quedara en NULL.
--
-- 2. legal.citas.cotizacion_id: vincula la cita de seguimiento al trámite
--    (cotización) desde el que se agendó. ON DELETE SET NULL: borrar una
--    cotización no debe borrar ni bloquear las citas históricas.
--
-- RLS: ambas tablas ya lo tienen habilitado (cotizaciones: solo service_role;
-- citas: citas_service + citas_portal_own). Las columnas nuevas lo heredan;
-- no se requieren policies nuevas.
-- ============================================================================

alter table legal.cotizaciones
  add column tramite_finalizado_at timestamptz null,
  add column token_agendamiento uuid default gen_random_uuid();

comment on column legal.cotizaciones.tramite_finalizado_at is
  'Cierre del trámite (lo marca Amanda desde la ficha). Con valor, el enlace de agendamiento del cliente deja de ser válido. No sustituye al estado.';
comment on column legal.cotizaciones.token_agendamiento is
  'Token del enlace personal de agendamiento (/agendar?token=...). Independiente de token_respuesta. Válido solo con estado=aceptada y tramite_finalizado_at IS NULL.';

update legal.cotizaciones
  set token_agendamiento = gen_random_uuid()
  where token_agendamiento is null;

create unique index cotizaciones_token_agendamiento
  on legal.cotizaciones (token_agendamiento);

alter table legal.citas
  add column cotizacion_id uuid null
    references legal.cotizaciones (id) on delete set null;

comment on column legal.citas.cotizacion_id is
  'Cotización (trámite) desde cuyo enlace de agendamiento se creó la cita. NULL para citas ajenas al flujo por cotización.';

create index citas_cotizacion_id
  on legal.citas (cotizacion_id)
  where cotizacion_id is not null;
