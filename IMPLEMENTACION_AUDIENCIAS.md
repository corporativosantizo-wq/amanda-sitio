# IMPLEMENTACIÓN — Módulo de Audiencias y Recordatorios (amanda-sitio / IURISLEX)

> Brief para Claude Code. Leer **completo** antes de tocar archivos.
> Este sistema corre en producción con datos reales. Trabajar por fases,
> en una rama aparte, probar en local, y **no mergear a `main` hasta que
> Amanda confirme**. `main` dispara auto-deploy en Vercel.

---

## Objetivo

Crear un módulo de **audiencias** vinculables a expedientes y clientes que:

1. Permita registrar audiencias **presenciales, virtuales o híbridas** con fecha y **hora exacta**.
2. Genere recordatorios por **correo al cliente** con un botón **"Agregar a mi calendario"** (archivo `.ics`).
3. Tenga dos flujos de envío distintos:
   - **Recordatorios previos** (X días antes): pasan por una **bandeja de aprobación manual** (Amanda da el visto bueno).
   - **Recordatorios de reprogramación** (cuando una audiencia se mueve): **automáticos**, sin aprobación.
4. Respete una **ventana de envío hábil** (lun–vie, horario de oficina) y los **asuetos de Guatemala**, para no mandar correos en domingo ni de madrugada.
5. Notifique al asistente **Mariano por Telegram** (interno, datos mínimos).
6. Arranque en **MODO DE PRUEBA**: todos los correos al cliente se redirigen al correo de Amanda hasta que ella confirme que está impecable.

---

## Reglas que NO se deben romper (de CLAUDE.md)

- Todo en el schema **`legal`** (no `public`). Calificar siempre: `legal.audiencias`.
- **Antes de crear tablas/columnas:** verificar con el **MCP de Supabase** (project `vutjuyjizvmqrqnlyujp`) qué existe ya. No asumir.
- **RLS habilitado** en todas las tablas nuevas, replicando el patrón de las demás tablas de `legal` (lectura para autenticados, escritura para rol admin). Si no está claro el patrón, **inspeccionar las políticas existentes y copiarlas**, no inventar.
- **Nunca** escribir credenciales, API keys ni tokens reales en código, commits ni logs. Solo placeholders y `.env.local`.
- **Nunca** el `service role key` en el cliente. Envío de correo, Graph, Telegram y `.ics` son **server-side**.
- API routes bajo `/api/admin/...`. **La autorización real vive en el middleware** (`proxy.ts`): `clerkMiddleware` + `auth.protect()` + verificación de rol admin contra `legal.usuarios_admin` por email. El matcher cubre `/admin(.*)` y `/api/admin(.*)`, así que las rutas nuevas quedan protegidas automáticamente; no hay que re-autenticar dentro de cada handler. El endpoint del cron (`/api/admin/recordatorios/procesar`) es la excepción: usa su propia auth por `CRON_SECRET` (`requireCronAuth`), porque Vercel Cron no manda sesión Clerk.
- Acceso a datos server-side con `createAdminClient()` (service_role, `db.schema='legal'`), igual que `expedientes.service.ts` y `citas.service.ts`. El service_role **bypassa RLS**; la RLS es muro de respaldo, no la autorización. **No** usar `createServerClient` con cookies de Supabase para audiencias (las tablas son service_role-only y el rol `authenticated` no vería nada).
- **Auth = Clerk, no Supabase Auth.** El sistema migró a Clerk; los .md viejos (CLAUDE.md, ARQUITECTURA.md) aún dicen "Supabase Auth / JWT 1h". No implementar auth Supabase. Ver nota en `BUGS_Y_PENDIENTES.md`.
- Tipado estricto, sin `any` salvo justificación comentada.
- Commits formato `[audiencias] descripción breve`. Verificar `git config user.email` correcto para que Vercel no rechace el deploy.
- Probar en local con `pnpm dev` antes de cualquier merge.

---

## Decisiones ya tomadas (no re-preguntar)

| Tema | Decisión |
|------|----------|
| Tabla | **Específica `legal.audiencias`**, no una tabla genérica de eventos. |
| Recordatorios previos | **Aprobación manual** vía bandeja. |
| Recordatorios de reprogramación | **Automáticos**. |
| Modo inicial | **Prueba**: todos los correos al cliente se redirigen al correo de Amanda. |
| Notificación interna | A **Mariano por Telegram**, datos mínimos, con link al panel. |
| Equipo / Outlook compartido | No por ahora. Los eventos quedan solo con Amanda. |

---

## Modelo de datos

> Verificar con el MCP que estos nombres no colisionan con nada existente.
> `id` por defecto `gen_random_uuid()`. `created_at` / `updated_at` `timestamptz default now()`.

### `legal.audiencias`

| Columna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | Se usa también como **UID del `.ics`** (estable). |
| `expediente_id` | uuid NULL → `legal.expedientes(id)` | Opcional. |
| `cliente_id` | uuid NULL → `legal.clientes(id)` | Opcional. |
| `titulo` | text NULL | Título humano opcional. |
| `tipo_audiencia` | text NULL | ej. vista, declaración, conciliación. Libre por ahora. |
| `modalidad` | enum `presencial \| virtual \| hibrida` | **Campo que ramifica la plantilla.** |
| `fecha_hora_inicio` | **timestamptz** NOT NULL | Crítico: guardar bien el huso. |
| `fecha_hora_fin` | timestamptz NULL | |
| `juzgado` | text NULL | |
| `sala` | text NULL | |
| `ubicacion` | text NULL | Dirección para presencial. |
| `enlace_virtual` | text NULL | URL de conexión para virtual/híbrida. |
| `plataforma` | text NULL | zoom / teams / meet / otro. |
| `instrucciones` | text NULL | Notas para el cliente (qué llevar, etc.). |
| `estado` | enum `programada \| confirmada \| realizada \| suspendida \| reprogramada \| cancelada` | Default `programada`. |
| `ics_sequence` | int DEFAULT 0 | Se incrementa en cada reprogramación. |
| `notas_internas` | text NULL | No sale al cliente. |
| `created_at` / `updated_at` | timestamptz | |

### `legal.audiencias_recordatorios`  (cola + constancia de envíos)

| Columna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `audiencia_id` | uuid → `legal.audiencias(id)` | |
| `tipo` | enum `recordatorio_previo \| confirmacion_creacion \| reprogramacion \| cancelacion` | |
| `canal` | enum `email \| telegram` | Cliente = email; interno = telegram. |
| `requiere_aprobacion` | boolean | `true` para `recordatorio_previo`; `false` para `reprogramacion`. |
| `destinatario_nombre` | text NULL | |
| `destinatario_email` | text NULL | **El destinatario REAL** (aunque en prueba se mande a otro). |
| `asunto` | text | |
| `cuerpo` | text | Render final del correo. |
| `estado` | enum `pendiente_aprobacion \| aprobado \| programado \| enviado \| pospuesto \| descartado \| fallido` | |
| `fecha_sugerida_envio` | timestamptz | Calculada respetando ventana hábil + asuetos. |
| `fecha_enviado` | timestamptz NULL | |
| `enviado_a_email` | text NULL | **A quién se mandó de verdad** (en prueba = correo de Amanda). |
| `es_prueba` | boolean DEFAULT true | Marca si salió en modo prueba. |
| `error` | text NULL | |
| `created_at` / `updated_at` | timestamptz | |

> El par `destinatario_email` (real) + `enviado_a_email` (efectivo) + `es_prueba` da la **constancia** que necesita el despacho cuando un cliente alega que "no le avisaron", y permite auditar qué salió en prueba vs. real.

### `legal.dias_asueto`  (para no sugerir envíos en feriados)

| Columna | Tipo |
|--------|------|
| `id` | uuid PK |
| `fecha` | date UNIQUE |
| `descripcion` | text |
| `ambito` | enum `nacional \| guatemala_ciudad` |

**Seed inicial** (año actual y siguiente). Nacionales fijos: 1 ene, 1 may, 30 jun, 15 sep, 20 oct, 1 nov, 25 dic. Medios días: 24 y 31 dic. Semana Santa (jueves, viernes, sábado santos) es **movible** → sembrar las fechas concretas por año (no calcular Pascua). Guatemala Ciudad: **15 ago (Asunción)**. Pedir a Amanda confirmar la lista antes de sembrar.

### `legal.config_recordatorios`  (una sola fila, editable sin redeploy)

| Columna | Tipo | Valor inicial |
|--------|------|---------------|
| `dias_antes_default` | int | 1 |
| `ventana_inicio` | time | 08:00 |
| `ventana_fin` | time | 17:00 |
| `dias_habiles` | int[] | {1,2,3,4,5} (lun–vie) |
| `test_mode` | boolean | **true** |
| `test_email` | text | (correo de Amanda, vía env, no hardcodear) |

> Alternativa aceptable para v1: un archivo de constantes en `lib/`. Pero una tabla permite que Amanda ajuste la ventana sin tocar código. Preferir tabla.

---

## Lógica de ventana hábil (clave — aquí estaba el problema viejo)

El sistema antiguo mandaba en días/horas inhábiles y los clientes alegaron. Función `calcularFechaSugeridaEnvio(audiencia)`:

1. Punto de partida: `fecha_hora_inicio` − `dias_antes_default` (en **días hábiles**).
2. Si cae fuera de `dias_habiles` o en `legal.dias_asueto`, **rodar al siguiente día hábil**.
3. Forzar la hora dentro de `[ventana_inicio, ventana_fin]`. Si quedó antes, usar `ventana_inicio`; si después, mover al siguiente día hábil a `ventana_inicio`.
4. **Nunca** programar un envío **después** de `fecha_hora_inicio`. Si no cabe, sugerir "enviar cuanto antes dentro de la próxima ventana" y marcarlo para revisión.

Esta misma función la usan tanto los recordatorios previos (manuales) como los de reprogramación (automáticos).

> **Nota para Fase 4 (decisión de Amanda, 21-jun-2026):** en `calcularFechaSugeridaEnvio`, los asuetos de ámbito `guatemala_ciudad` **también bloquean** el envío (la oficina está en la capital), igual que los `nacional`. Y los medios días (24 y 31 dic) se tratan como **no-envío de día completo**, no solo la tarde. O sea: cualquier fila de `legal.dias_asueto` cuya `fecha` coincida bloquea ese día entero, sin distinguir ámbito ni medio día.

---

## Generación del `.ics` (botón "Agregar a mi calendario")

Generar **server-side**. Guatemala es **UTC−6 sin horario de verano**, así que el `VTIMEZONE` es fijo y simple. Incluir el bloque explícito para que Apple/Outlook/Google lo interpreten bien:

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//IURISLEX//Audiencias//ES
METHOD:REQUEST
BEGIN:VTIMEZONE
TZID:America/Guatemala
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:-0600
TZOFFSETTO:-0600
TZNAME:CST
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:{audiencia.id}            ← UID ESTABLE = id de la audiencia
SEQUENCE:{ics_sequence}       ← incrementa en cada reprogramación
DTSTAMP:{ahora en UTC}
DTSTART;TZID=America/Guatemala:{YYYYMMDDTHHMMSS local}
DTEND;TZID=America/Guatemala:{...}
SUMMARY:Audiencia · {empresa/cliente} · {numero_expediente}
LOCATION:{dirección si presencial / enlace si virtual}
DESCRIPTION:{instrucciones + modalidad}
STATUS:CONFIRMED
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Recordatorio audiencia
END:VALARM
END:VEVENT
END:VCALENDAR
```

Reglas:
- **`UID = audiencia.id`** y **`SEQUENCE` creciente**: así, al reprogramar, el calendario del cliente **actualiza** el evento en vez de duplicarlo. Esto es lo que hace que reprogramaciones (frecuentes en los juzgados) no ensucien el calendario.
- `SUMMARY` arma solo el contexto: si hay `expediente_id`, jalar `numero_expediente`, y el nombre de la empresa/cliente. Resuelve el caso de "un contacto con varias empresas" (Robles/Pemueller, etc.).
- Si hay tiempo: ofrecer también enlaces directos de **Google Calendar** (`calendar.google.com/render?action=TEMPLATE&...`) y **Outlook web**, además del `.ics`. El `.ics` es el universal; los otros son comodidad.

> Evaluar la librería `ics` de npm, pero **verificar que respeta `TZID`** (varias generan horas "flotantes" sin huso). Si genera mala hora, hacer el generador a mano con el bloque de arriba — al ser offset fijo es trivial y a prueba de balas.

---

## Plantillas de correo según modalidad

Render server-side, mismas en prueba y en real (solo cambia el `To:`).

- **Presencial:** dirección de juzgado/sala arriba, "llegar 15 min antes", qué documentos llevar, (opcional) link de mapa.
- **Virtual:** **enlace de conexión grande y arriba**, plataforma, "probar audio/cámara antes", instrucciones de acceso.
- **Híbrida:** ambos, aclarando quién va presencial y quién por enlace.

Todas adjuntan el `.ics` y el botón "Agregar a mi calendario". El asunto sale del expediente vinculado (empresa + número).

---

## MODO DE PRUEBA (arranque obligatorio)

Mientras `config_recordatorios.test_mode = true`:

- **Todo** correo destinado a un cliente se envía en realidad a `test_email` (Amanda). Guardar el destinatario real en `destinatario_email` y el efectivo en `enviado_a_email`, y `es_prueba = true`.
- El correo lleva un banner visible arriba: **`[PRUEBA] Este correo se habría enviado a: {destinatario_real}`**.
- Todo lo demás idéntico a producción: plantillas, `.ics`, huso, ventana de envío, flujo de aprobación, reprogramación automática. La idea es ejercitar el pipeline completo y solo cambiar el destinatario.
- Cuando Amanda confirme que está impecable, **un solo cambio** (`test_mode = false`) activa el envío real. No debe requerir tocar código.

---

## Flujo de reprogramación automática

Cuando una audiencia cambia de fecha (`fecha_hora_inicio`) o pasa a `estado = reprogramada`:

1. Incrementar `ics_sequence`.
2. Encolar un `audiencias_recordatorios` tipo `reprogramacion`, `requiere_aprobacion = false`.
3. Calcular `fecha_sugerida_envio` con la ventana hábil.
4. El job de envío lo manda automáticamente al llegar su ventana (en prueba → a Amanda).
5. El `.ics` reusa el mismo `UID` con el nuevo `SEQUENCE` → actualiza, no duplica.

Implementar el encolado con un **trigger en la BD** o en la capa de la app (preferir capa app para mantener la lógica testeable y en TypeScript). Consideración menor: si la audiencia reprogramada es **muy próxima** (p. ej. < 24 h), marcar para envío inmediato dentro de la ventana en vez de esperar.

---

## Envío y job programado

- Crear API route protegida: `POST /api/admin/recordatorios/procesar`.
  - Protegerla con header secreto `CRON_SECRET` (Vercel Cron la llama públicamente).
  - Hace dos cosas: (a) **genera** los recordatorios previos pendientes para audiencias próximas; (b) **envía** los que estén `aprobado` o automáticos cuya `fecha_sugerida_envio <= now()` y estén dentro de la ventana.
- Programarla con **Vercel Cron** (cada 15–30 min en horario hábil).
- **Envío de correo:** Microsoft Graph como `asistente@papeleo.legal` (la firma usa M365). Hacerlo detrás de una interfaz `enviarCorreo()` para que el proveedor sea intercambiable.

> ⚠️ La **registración de la app en Azure AD** (permiso `Mail.Send`, client secret) la hace **Amanda**, no Claude Code. Claude Code solo lee las credenciales desde `.env.local` como placeholders. No intentar crear apps ni meter secretos.

---

## Bandeja de aprobación (recordatorios previos)

UI en `/admin/audiencias/recordatorios` (o pestaña dentro de audiencias). Lista de `recordatorios` en estado `pendiente_aprobacion`, cada tarjeta con:

- Destinatario real, audiencia/expediente, `fecha_sugerida_envio`.
- **Preview del correo tal cual le llegará** (incluido el banner de prueba si aplica).
- Botones: **Enviar** (→ `aprobado`), **Editar** (asunto/cuerpo/fecha), **Posponer** (re-sugiere siguiente ventana), **Descartar**.

El sistema **nunca** sugiere fechas fuera de la ventana hábil; si un recordatorio "tocaría" domingo o de noche, lo retiene y lo muestra en la siguiente franja hábil.

---

## Telegram → Mariano (interno, automático)

- Bot de Telegram (creado por Amanda vía `@BotFather`) posteando al grupo. Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
- Eventos a notificar: audiencia **creada**, **reprogramada**, **cancelada**, y "tienes N recordatorios por aprobar".
- **Datos mínimos** (por el intento de breach de marzo/abril): nunca volcar el enlace de Zoom ni detalle del caso. Formato tipo: `Audiencia {codigo_cliente} reprogramada. Revisa el panel: {APP_BASE_URL}/admin/audiencias/{id}`. Mariano abre el panel (tras auth) y ahí ve todo.
- Se le puede adjuntar el `.ics` por Telegram si quiere agregarlo a su calendario (ese archivo solo lleva fecha/lugar, nada explotable).

---

## Variables de entorno a agregar a `.env.local` (placeholders)

```
# Microsoft Graph (envío de correo) — Amanda registra la app en Azure
MS_GRAPH_TENANT_ID=...
MS_GRAPH_CLIENT_ID=...
MS_GRAPH_CLIENT_SECRET=...
MS_GRAPH_SENDER=asistente@papeleo.legal

# Telegram (bot de Mariano)
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...

# Modo prueba / recordatorios
RECORDATORIOS_TEST_EMAIL=...        # correo de Amanda
CRON_SECRET=...                     # protege el endpoint del cron
APP_BASE_URL=https://amandasantizo.com
```

---

## Plan por fases (no hacer todo de una)

> Crear rama `feat/audiencias`. Trabajar fase por fase, probar en `pnpm dev`, **no mergear a `main` hasta confirmación de Amanda**.

- **Fase 0 — Reconocimiento.** Con el MCP de Supabase, listar tablas y políticas RLS del schema `legal`. Confirmar que `audiencias`, `audiencias_recordatorios`, `dias_asueto`, `config_recordatorios` no existen. Reportar el patrón de RLS a replicar. **No crear nada todavía.**
- **Fase 1 — Migración.** Tablas + enums + RLS (replicando patrón) + seed de `dias_asueto` (pedir lista a Amanda) + fila de `config_recordatorios` con `test_mode=true`. Migración SQL en `supabase/`.
- **Fase 2 — CRUD audiencias.** UI en `/admin/audiencias` (crear/listar/detalle/editar), con selector de expediente y cliente, modalidad, fecha-hora, enlace/ubicación. Auth check en cada route.
- **Fase 3 — `.ics` + plantillas + MODO PRUEBA.** Generador `.ics` (con VTIMEZONE), plantillas presencial/virtual/híbrida, banner de prueba, `enviarCorreo()` con redirección a `test_email`. Probar mandándose correos a sí misma.
- **Fase 4 — Bandeja de aprobación + ventana hábil.** Cola de recordatorios previos, `calcularFechaSugeridaEnvio`, UI de aprobación.
- **Fase 5 — Reprogramación automática.** Encolado al cambiar fecha, `SEQUENCE++`, envío automático (en prueba → a Amanda).
- **Fase 6 — Telegram a Mariano.** Notificaciones internas mínimas con link al panel.
- **Fase 7 — Cron real (Graph).** Wiring de Vercel Cron + Microsoft Graph. Amanda hace la app de Azure; Claude Code solo consume env vars.
- **Fase 8 — Salida de prueba.** Cuando Amanda valide, `test_mode=false`. Verificar constancia (`audiencias_recordatorios`) completa.

---

## Al terminar cada fase

1. Resumir qué se creó/cambió y qué falta.
2. Recordar a Amanda probar en local antes de mergear.
3. Actualizar `BUGS_Y_PENDIENTES.md` y `ARQUITECTURA.md` con las tablas nuevas.
4. **No** deployar a producción sin confirmación explícita de Amanda.
