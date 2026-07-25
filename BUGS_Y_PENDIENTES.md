# Bugs conocidos y features pendientes — amanda-sitio

Documento de seguimiento para Claude Code y para Amanda.
Actualizar al cerrar cada ítem.

---

## 🔴 Bugs activos

### [BUG-001] JWT expiration — 404 en cotizaciones

**Estado:** Activo (workaround en uso)  
**Módulo:** Contabilidad > Cotizaciones  
**Síntoma:** Al crear la tercera cotización en una sesión de más de 1 hora, el endpoint devuelve 404 sin mensaje de error claro.  
**Causa confirmada:** El token JWT de Supabase Auth expira a la hora. Las API routes validan el token y rechazan la solicitud.  
**Workaround actual:** Ctrl+F5 para forzar refresco de sesión antes de operar en sesiones largas.  
**Fix pendiente:**
```typescript
// En lib/supabase/client.ts o en un provider de auth:
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'TOKEN_REFRESHED') {
    // actualizar estado global si es necesario
  }
});
// Asegurarse que el cliente tiene autoRefreshToken: true (default en supabase-js v2)
// Verificar que las cookies de sesión se propagan correctamente en SSR
```
**Prioridad:** Alta — afecta flujo de facturación.

---

### [BUG-002] Recibo de caja manual — cuelga sin error

**Estado:** Activo  
**Módulo:** Contabilidad > Recibos  
**Síntoma:** Al crear un recibo manual, la UI queda en estado de carga indefinido sin mostrar error.  
**Causa probable:** Timeout o `await` sin resolver en el route handler. Posiblemente relacionado con generación de PDF o consulta lenta.  
**Diagnóstico pendiente:** Revisar `/api/admin/recibos/` — buscar promesas sin resolver y agregar timeout + manejo de error explícito.  
**Prioridad:** Alta.

---

### [BUG-003] Stripe cobra citas en USD en vez de quetzales — DINERO REAL

**Estado:** Activo — PENDIENTE, **no tocado** (detectado 1-jul-2026 al corregir el correo de cita).
**Módulo:** Pagos > Checkout de cita (`app/api/pagos/checkout/route.ts`)
**Severidad:** IMPORTANTE — afecta cobros reales con tarjeta.
**Síntoma:** El checkout de Stripe usa `currency: 'usd'` (líneas 38 y 42) y `unit_amount: Math.round(cita.costo * 100)` (línea 47). Como `cita.costo` está en **quetzales** (ej. 500 = Q500), Stripe cobra **$500.00 USD** por tarjeta en lugar de Q500. Además el comentario del archivo dice "$75 USD" pero el código cobra `cita.costo` (inconsistencia preexistente).
**Alcance:** Independiente del correo de confirmación (ese ya quedó en Q en la rama `fix/correo-cita-moneda-quetzales`). Esto es el flujo de **pago online con tarjeta**.
**Pendiente (decisión de Amanda):** definir la moneda correcta del cobro. Si debe ser GTQ: (1) verificar que la cuenta de Stripe soporte GTQ, (2) cambiar `currency` en las 2 líneas, (3) validar el monto real (¿Q500, o el "$75" del comentario?). **No tocar sin confirmar — es dinero real.**

---

## 📝 Notas documentales (corrección de docs)

### [DOC-001] La auth real es Clerk, no Supabase Auth

**Fecha:** 21-jun-2026 (detectado en Fase 0 del módulo de audiencias)
**Qué dicen los docs viejos:** `CLAUDE.md` y `ARQUITECTURA.md` describen la autenticación como **Supabase Auth (JWT, sesiones de 1 h)**.
**Qué hace el código en realidad:** La autorización corre con **Clerk** (`@clerk/nextjs`) en `proxy.ts` (middleware): `clerkMiddleware` + `auth.protect()` + verificación de rol admin contra `legal.usuarios_admin` por email (matcher `/admin(.*)` y `/api/admin(.*)`). El acceso a datos es server-side con `createAdminClient()` (service_role, bypassa RLS). En el cliente hay `useSessionKeepAlive` + modal de sesión expirada.
**Implicación:** **BUG-001** y **FEAT-002** (auto-refresh del JWT de Supabase Auth) probablemente están **obsoletos**: el flujo de sesión ya no depende del token de Supabase Auth. Revisar/recategorizar cuando se priorice.
**Alcance de esta nota:** Solo documental. **No** se tocó código de auth. Pendiente (cuando Amanda lo apruebe): actualizar la sección de Autenticación en `CLAUDE.md` y `ARQUITECTURA.md`.

---

### [DOC-002] `clientes.emails_cc` auto-copiado / pre-llenado en correos — RESUELTO en cotizaciones, citas/audiencias y llamadas

**Fecha original:** 21-jun-2026 (diagnóstico). **Actualizado: 25-jul-2026** tras auditoría con verificación de encabezados reales por Graph (envíos de producción de los últimos 60 días).

**Estado por flujo (regla objetivo: heredados DESMARCADOS, solo va lo que Amanda marca/tipea):**

- **Cotizaciones — ✅ RESUELTO (fix `10979bd`, 21-jun-2026).** El envío/reenvío usa SOLO el CC del modal (heredados desmarcados); el cron de programadas envía sin CC. **Evidencia 25-jul:** encabezados Graph de las 10 últimas enviadas (COT-000050→060): las 8 post-fix con CC vacío — incluida COT-000060 (Juncaya, 4 `emails_cc` externos, ninguno copiado) y COT-000057 (el `cc_emails` guardado NO se envió). La exposición histórica al Grupo Rope (cotizaciones pre-21-jun con copia a `lexincorp.com`/`roalatam.com`) fue real y es irreversible, pero el flujo activo está limpio.

- **Citas / audiencias — ✅ RESUELTO (cutover `686cc70`, 21-jun-2026; rama muerta eliminada 25-jul-2026).** La rama vieja que auto-copiaba `cliente.emails_cc` en recordatorios de audiencia era código muerto desde el cutover (la query excluía `tipo='audiencia'`) y **nunca envió nada** (cero citas-audiencia con `recordatorio_24h_enviado`); se eliminó del código el 25-jul. El módulo nuevo (`audiencias-recordatorios.service.ts`) usa SOLO `audiencias.emails_cc` (lista explícita; UI con heredados desmarcados). **Evidencia 25-jul:** 4/4 recordatorios de audiencia enviados (Los Robles/Rope, 22-25 jun) con CC = solo direcciones internas del cliente, cero firmas externas pese a estar en su `emails_cc`; recordatorios de cita 24h/1h y confirmación van SIN CC (verificado en AGROPE y Juncaya, los únicos clientes con `emails_cc` en 60 días).

- **Llamadas — ✅ RESUELTO (25-jul-2026, esta rama).** La pantalla pre-llenaba el CC **completo** con `cliente.emails_cc` (chips que había que quitar a mano — opt-out, contrario a la regla). **Evidencia 25-jul:** 1 sola confirmación enviada en 60 días (ROPECO, 12-jun) con CC que incluyó `lemzcpaconsulting@gmail.com` y `conta1@roalatam.com` — lista editada a mano y aparentemente intencional (el contacto era la propia firma), pero el mecanismo era el riesgo. Fix aplicado: heredados como checkboxes DESMARCADOS + campo de tipeo libre, mismo patrón que cotizaciones/audiencias. El recordatorio de llamada del cron ya iba sin CC.

- **Recibos de caja y correos de Comunicaciones (`email/comunicaciones`) — ⚠️ PENDIENTE.** Siguen pre-llenando el CC con `cliente.emails_cc` en campo editable visible (opt-out). No auditados con evidencia de producción ni alineados a la regla de heredados desmarcados. Evaluar con Amanda si se les aplica el mismo patrón.

---

## 🟡 Features pendientes

### [AUD-1] Recordatorio "2 días antes" cuando la audiencia se crea/recrea con poca anticipación

**Contexto:** al recrear en el módulo nuevo audiencias cuya fecha está muy próxima (p. ej. la penal del 24-jun recreada el 22/23), el cálculo de "2 días hábiles antes" cae **en el pasado**.
**Comportamiento deseado (decisión de Amanda, 22-jun-2026):** si la fecha sugerida del recordatorio de **2 días antes** quedó en el pasado, **NO descartarlo** ni dispararlo a cualquier hora → **reprogramarlo a la próxima ventana hábil** (mañana 8–17h) para que el cliente reciba el aviso con ~1 día de anticipación. El de **2 horas antes** sale normal el día de la audiencia.
**Hoy:** `calcularFechaSugeridaEnvio` deja la fecha pasada → el cron lo mandaría en el próximo tick (envío inmediato, posible hora rara). Falta el "bump a próxima ventana hábil" cuando la sugerida < ahora. Existe `proximaVentanaHabil()` reutilizable. **Pendiente de implementar antes de que Amanda recree esa audiencia.**



### [FEAT-001] Cuadros de notas — Academia DIP

**Proyecto:** Academia DIP (`urauqhwcfpkysaeporoj`) — **no es este proyecto**  
**Descripción:** Sección dedicada en `/aula` para subir PDFs oficiales de calificaciones (cuadros de notas) por parcial.  
**Estado:** Diseñado, no implementado.

---

### [FEAT-002] Auto-refresh de token JWT

**Descripción:** Solución definitiva para BUG-001. Implementar renovación silenciosa del token antes de que expire, para que sesiones largas no interrumpan el trabajo.  
**Posible implementación:**
- Verificar que `supabase-js` tiene `autoRefreshToken: true` en la configuración del cliente.
- Si el problema es en SSR, asegurarse que el middleware de Next.js actualiza las cookies de sesión en cada request.
- Revisar si el `createServerClient` de `@supabase/ssr` está configurado correctamente para leer y escribir cookies.

---

### [FEAT-003] Visor de DOCX mejorado

**Descripción:** El proxy actual sirve DOCX como descarga. Evaluar conversión server-side a HTML para preview inline.  
**Consideración:** `mammoth` puede convertir DOCX a HTML en el servidor. Peso vs. beneficio.

---

## ✅ Cerrados recientemente

### [FIXED] Módulo notarial — tabla incorrecta

**Fecha de fix:** Febrero 2026  
**Síntoma:** Panel de notariado mostraba vacío.  
**Causa:** La query apuntaba a `legal.actas_notariales` (tabla vacía). Los docs notariales viven en `legal.documentos` filtrados por `tipo`.  
**Fix aplicado:** Corregir query en el componente del panel de notariado.

### [FIXED] Visor de documentos — proxy server-side

**Fecha de fix:** Marzo 2026  
**Descripción:** Creación del proxy en `/api/admin/documentos/[id]/preview/route.ts` para servir PDF/DOCX/imágenes desde Supabase Storage sin exponer el service role key.

### [FIXED] Expediente duplicado — cliente Robles

**Fecha de fix:** Marzo 2026  
**Descripción:** Registro duplicado de cliente detectado y resuelto. Se conservó el registro correcto y se eliminó el duplicado.

---

## Patrón de diagnóstico para bugs de Next.js

Cuando un bug aparece en una ruta pero la causa no es obvia:

1. Revisar no solo el archivo de la página errónea, sino todos los archivos que Next.js podría prefetchear por links adyacentes (layout, componentes en la misma carpeta).
2. Buscar queries con nombres de columna incorrectos — fallan silenciosamente en el cliente aunque lanzan error en el servidor.
3. Verificar si el error aparece solo después de cierto tiempo (→ probable JWT) o desde el primer intento (→ probable bug de código).
4. Usar el Network tab del DevTools para ver el response real del endpoint, no solo el mensaje de error de la UI.

---

*Actualizar este archivo después de cada sesión de trabajo con Claude Code.*
