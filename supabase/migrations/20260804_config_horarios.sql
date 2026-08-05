-- ============================================================================
-- legal.config_horarios — ventanas de agendamiento de citas, editables sin
-- redeploy (antes hardcodeadas en lib/types/citas.ts: HORARIOS y
-- HORARIOS_MODALIDAD, más el rango público de consultas en
-- app/api/public/disponibilidad/route.ts).
--
-- Una fila por tipo + modalidad. modalidad NULL = configuración base del tipo
-- (la que usan admin, portal y la validación de crearCita). Una fila con
-- modalidad la sobreescribe cuando la cita se pide con esa modalidad.
--
-- Columnas *_publico: ventana de OFERTA del flujo público (/agendar y
-- /api/public/*). NULL = igual que la base. Hoy solo consulta_nueva la usa:
-- al público se le ofrecen consultas lun/mié/vie de 8 a 12, aunque la ventana
-- de validación interna (admin/portal) siga siendo lun–vie 8 a 18.
--
-- dias_habiles usa la convención de JavaScript Date.getDay():
-- 0=Dom, 1=Lun … 6=Sáb (OJO: legal.config_recordatorios usa ISO 1=Lun..5=Vie).
--
-- Los valores sembrados replican EXACTAMENTE el comportamiento previo; los
-- defaults en código (lib/types/citas.ts) quedan como fallback si esta tabla
-- no se puede leer.
-- ============================================================================

create table legal.config_horarios (
  id smallserial primary key,
  tipo text not null,
  modalidad text null,
  dias_habiles smallint[] not null,
  hora_inicio time not null,
  hora_fin time not null,
  duracion_slot smallint not null,  -- minutos por slot
  costo numeric not null default 0,
  activo boolean not null default true,
  -- Ventana de oferta pública (NULL = igual que la base)
  dias_habiles_publico smallint[] null,
  hora_inicio_publico time null,
  hora_fin_publico time null,
  updated_at timestamptz not null default now()
);

comment on table legal.config_horarios is
  'Ventanas de agendamiento por tipo+modalidad de cita, editables sin redeploy. modalidad NULL = base del tipo. Columnas *_publico = ventana de oferta del flujo público (NULL = igual que la base). dias_habiles en convención JS getDay (0=Dom..6=Sáb).';

create unique index config_horarios_tipo_modalidad
  on legal.config_horarios (tipo, coalesce(modalidad, ''));

alter table legal.config_horarios enable row level security;

-- Mismo patrón que legal.config_recordatorios: solo service_role.
create policy config_horarios_service on legal.config_horarios
  for all to service_role using (true) with check (true);

-- ── Seed: valores actuales exactos ──────────────────────────────────────────

insert into legal.config_horarios
  (tipo, modalidad, dias_habiles, hora_inicio, hora_fin, duracion_slot, costo,
   dias_habiles_publico, hora_inicio_publico, hora_fin_publico)
values
  -- consulta_nueva: base lun–vie 8–18 (validación interna/admin/portal);
  -- oferta pública lun/mié/vie 8–12 (consolidación del rango 7..11 del route
  -- público — la hora 7 era código muerto — y de los días del formulario).
  ('consulta_nueva', null, '{1,2,3,4,5}', '08:00', '18:00', 30, 500,
   '{1,3,5}', '08:00', '12:00'),

  -- seguimiento base: lun–vie 14–18, slots de 15 min.
  ('seguimiento', null, '{1,2,3,4,5}', '14:00', '18:00', 15, 0,
   null, null, null),

  -- seguimiento virtual (Teams, lo atiende Amanda): mar/mié 14–18. Antes este
  -- filtro de días vivía solo en el cliente (app/agendar/page.tsx); ahora el
  -- servidor también lo aplica.
  ('seguimiento', 'virtual', '{2,3}', '14:00', '18:00', 15, 0,
   null, null, null),

  -- Entrega/firma de documentos (las atiende Mariano en oficina): lun–vie 9–16.
  ('seguimiento', 'entrega_documentos', '{1,2,3,4,5}', '09:00', '16:00', 15, 0,
   null, null, null),
  ('seguimiento', 'firma_documentos', '{1,2,3,4,5}', '09:00', '16:00', 30, 0,
   null, null, null),

  -- Tipos admin-only (sin validación de slots; la config se usa para generar
  -- sugerencias de disponibilidad).
  ('audiencia', null, '{1,2,3,4,5}', '06:00', '21:00', 30, 0, null, null, null),
  ('reunion', null, '{1,2,3,4,5}', '08:00', '18:00', 30, 0, null, null, null),
  ('bloqueo_personal', null, '{0,1,2,3,4,5,6}', '00:00', '23:59', 15, 0, null, null, null),
  ('evento_libre', null, '{1,2,3,4,5}', '08:00', '18:00', 30, 0, null, null, null);
