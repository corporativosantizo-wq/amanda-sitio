# CLAUDE.md — Proyecto amanda-sitio (IURISLEX)

> Instrucciones para Claude Code al trabajar en este repositorio.
> Leer este archivo completo antes de hacer cualquier cambio.

---

## Identidad del proyecto

**amanda-sitio** es el sistema de gestión legal del Despacho Jurídico Boutique IURISLEX, dirigido por la Abogada y Notaria Amanda Santizo (colegiada activa No. 19,565). El sistema corre en producción en **amandasantizo.com** y maneja datos reales de clientes, expedientes judiciales, documentos notariales y contabilidad de la firma.

Este no es un proyecto de práctica. Cada cambio llega a producción vía Vercel y afecta datos reales.

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Estilos | Tailwind CSS |
| Base de datos | Supabase PostgreSQL — proyecto `vutjuyjizvmqrqnlyujp` |
| Schema principal | `legal` (no `public`) |
| Autenticación | Supabase Auth |
| Storage | Supabase Storage — bucket `documentos` |
| Deploy | Vercel (auto-deploy desde rama `main`) |
| Package manager | pnpm |
| Shell | PowerShell 7 (Windows 11 Pro) |
| Editor / agente | Claude Code (terminal + VS Code) |

---

## Variables de entorno requeridas

Nunca escribir valores reales en código ni en este archivo. Usar siempre placeholders y referirse al archivo `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

**Regla de seguridad:** No escribir credenciales reales en ningún mensaje, commit, ni log. Si Claude Code necesita verificar algo en Supabase, usar el MCP de Supabase con el project ID.

---

## Estructura de carpetas relevante

```
amanda-sitio/
├── app/
│   ├── (auth)/              # Login, logout
│   ├── admin/               # Panel de administración principal
│   │   ├── clientes/        # Gestión de clientes
│   │   ├── expedientes/     # Expedientes judiciales
│   │   ├── documentos/      # Visor y gestor de documentos
│   │   ├── notariado/       # Módulo notarial
│   │   ├── contabilidad/    # Cotizaciones, recibos, gastos
│   │   └── ...
│   └── api/
│       └── admin/           # API routes (server-side)
│           └── documentos/
│               └── [id]/
│                   └── preview/
│                       └── route.ts   # Proxy server-side para documentos
├── components/              # Componentes reutilizables
├── lib/                     # Supabase client, utilidades
└── supabase/                # Migraciones SQL
```

---

## Base de datos — Schema `legal`

Todo el sistema corre en el schema `legal`, no en `public`. Al escribir queries SQL, siempre calificar las tablas con `legal.`:

```sql
SELECT * FROM legal.expedientes;
SELECT * FROM legal.clientes;
```

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `legal.clientes` | Clientes de la firma |
| `legal.expedientes` | Expedientes judiciales activos y archivados |
| `legal.actuaciones_procesales` | Historial de actuaciones por expediente |
| `legal.plazos_procesales` | Control de plazos con alertas |
| `legal.expedientes_vinculados` | Relaciones entre expedientes (apelación, amparo, etc.) |
| `legal.documentos` | Metadatos de documentos almacenados en Storage |
| `legal.cotizaciones` | Cotizaciones enviadas a clientes |
| `legal.recibos_caja` | Recibos de pago |
| `legal.gastos` | Gastos del despacho |
| `legal.tareas` | Tareas y recordatorios |

### Nota crítica — Módulo notarial

Los documentos notariales **no** están en la tabla `actas_notariales` (está vacía). Están en `legal.documentos` filtrados por el campo `tipo`. Al trabajar con el panel de notariado, consultar `legal.documentos WHERE tipo = 'notarial'` o similar, no `actas_notariales`.

### Storage

Bucket: `documentos`

Estructura de carpetas dentro del bucket:
```
documentos/
├── CLI-XXXX/              # Por cliente (ej: CLI-0008)
│   ├── resoluciones/
│   ├── memoriales/
│   └── ...
└── pendientes/            # Documentos sin clasificar
```

El visor de documentos usa un proxy server-side en `/api/admin/documentos/[id]/preview/route.ts` para generar signed URLs. Soporta PDF, DOCX e imágenes. **No exponer el service role key al cliente.**

---

## Bugs conocidos y workarounds activos

### JWT expiration (cotizaciones / 3ª creación)

- **Síntoma:** Al crear la tercera cotización en una sesión larga, aparece error 404.
- **Causa:** El token JWT de Supabase Auth expira en 1 hora por defecto.
- **Workaround actual:** Ctrl+F5 para refrescar la sesión.
- **Fix pendiente:** Implementar refresh automático del token en el cliente Supabase o aumentar el tiempo de expiración en la configuración de Auth.

### Prefetch cross-route de Next.js

- **Patrón conocido:** Next.js puede prefetchear bundles de rutas admin cuando el usuario está en `/aula` (Academia DIP es un proyecto separado, pero el patrón aplica aquí también). Si un query tiene un error de columna, puede ejecutarse silenciosamente al navegar.
- **Diagnóstico:** Revisar no solo la página que arroja el error visible, sino todos los archivos que Next.js podría cargar por links adyacentes.

---

## Convenciones de código

### TypeScript
- Tipado estricto. No usar `any` salvo casos extremos y con comentario justificando.
- Interfaces de tipos en `lib/types.ts` o junto al componente si son locales.

### Supabase client
- Para componentes de servidor (Server Components, API routes): usar `createServerClient` con cookies.
- Para componentes de cliente: usar el cliente singleton de `lib/supabase/client.ts`.
- **Nunca** usar el service role key en el lado del cliente.

### API routes
- Todas las rutas de administración bajo `/api/admin/`.
- Verificar autenticación al inicio de cada route handler antes de cualquier operación.
- Devolver errores con códigos HTTP apropiados (400, 401, 403, 404, 500).

### Tailwind CSS
- No usar clases CSS personalizadas si Tailwind lo resuelve.
- Mantener consistencia visual con el resto del admin panel.

### Commits
- Mensajes descriptivos en español o inglés, formato: `[módulo] descripción breve`
- Ejemplo: `[cotizaciones] fix 404 en creación por JWT expirado`
- **Importante:** El email del commit debe coincidir con el de la cuenta GitHub conectada a Vercel. Si el deploy falla por este motivo: `git config user.email "email-correcto@dominio.com"`

---

## Proceso de trabajo con Claude Code

1. **Antes de tocar archivos:** Leer el código existente del módulo afectado. No asumir la estructura.
2. **Antes de crear tablas o columnas:** Verificar con el MCP de Supabase qué existe ya en `legal.*`.
3. **Al agregar features:** Preguntar si hay RLS que configurar en las tablas nuevas.
4. **Al deployar:** El push a `main` dispara auto-deploy en Vercel. Probar en local primero con `pnpm dev`.
5. **Si algo se rompe en prod:** No hacer rollback automático sin confirmar con Amanda primero.

---

## Módulos en desarrollo activo / pendientes

- **Fix JWT refresh:** Implementar renovación automática de tokens para sesiones largas.
- **Cuadros de notas (Academia DIP):** Feature pendiente para subir PDFs de notas por parcial — en el proyecto `urauqhwcfpkysaeporoj`, no en este.
- **Recibo de caja manual:** Revisar bug de "queda pensando" sin error visible.

---

## Contexto del despacho

- **Abogados en el equipo:** 5 (incluyendo Amanda)
- **Casos activos:** ~200
- **Ubicación:** Edificio Géminis 10, Torre Sur, Oficina 402, Guatemala City
- **Email firma:** asistente@papeleo.legal, contador@papeleo.legal (Microsoft 365)
- **DNS papeleo.legal:** Gestionado en SiteGround — contiene registros MX de M365. **No cancelar SiteGround sin migrar el DNS primero.**

---

## Seguridad

- El sistema sufrió un ataque dirigido en marzo/abril 2026 (intercepción SMS + intento de breach en Telegram).
- Hardening completado en M365, Supabase, GitHub, Epik y Vercel.
- **Nunca** escribir claves reales o API keys en conversaciones, commits, ni logs.
- Password manager: Proton Pass. Email personal: ProtonMail.
- Ante cualquier comportamiento anómalo en auth o accesos, notificar a Amanda antes de proceder.

---

*Última actualización: junio 2026*
