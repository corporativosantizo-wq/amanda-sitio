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

## 📝 Notas documentales (corrección de docs)

### [DOC-001] La auth real es Clerk, no Supabase Auth

**Fecha:** 21-jun-2026 (detectado en Fase 0 del módulo de audiencias)
**Qué dicen los docs viejos:** `CLAUDE.md` y `ARQUITECTURA.md` describen la autenticación como **Supabase Auth (JWT, sesiones de 1 h)**.
**Qué hace el código en realidad:** La autorización corre con **Clerk** (`@clerk/nextjs`) en `proxy.ts` (middleware): `clerkMiddleware` + `auth.protect()` + verificación de rol admin contra `legal.usuarios_admin` por email (matcher `/admin(.*)` y `/api/admin(.*)`). El acceso a datos es server-side con `createAdminClient()` (service_role, bypassa RLS). En el cliente hay `useSessionKeepAlive` + modal de sesión expirada.
**Implicación:** **BUG-001** y **FEAT-002** (auto-refresh del JWT de Supabase Auth) probablemente están **obsoletos**: el flujo de sesión ya no depende del token de Supabase Auth. Revisar/recategorizar cuando se priorice.
**Alcance de esta nota:** Solo documental. **No** se tocó código de auth. Pendiente (cuando Amanda lo apruebe): actualizar la sección de Autenticación en `CLAUDE.md` y `ARQUITECTURA.md`.

---

### [DOC-002] `clientes.emails_cc` se copia AUTOMÁTICO en cotizaciones (exposición a firmas externas)

**Fecha:** 21-jun-2026 (diagnóstico pedido por Amanda en Fase 2 de audiencias). **Solo diagnóstico — no se tocó código ni producción.**

**Cómo se comporta `clientes.emails_cc` hoy, por flujo:**
- **Cotizaciones** (`cotizaciones.service.ts`, 3 rutas: enviar / reenviar / lote): el CC = `cc_emails` de la cotización **+ `cliente.emails_cc`**, **automático y server-side**. Amanda **no** ve ni puede deseleccionar ese CC al enviar.
- **Citas / audiencia** (`citas.service.ts`, cron): si la cita-audiencia **no** tiene `audiencia_destinatarios`, el recordatorio hace `cc = [...cliente.emails_cc, 'amanda@']` **automático**. Si tiene `audiencia_destinatarios`, va solo a esos (+ amanda@), **sin** `emails_cc`.
- **Recibos de caja**, **Molly Mail saliente**, **Llamadas**: **pre-llenan** el CC con `cliente.emails_cc` en un campo **editable** que Amanda ve antes de enviar (puede quitarlo). No es silencioso.

**Exposición real del Grupo Rope (datos de prod, solo lectura):** 13 sociedades Rope/AGROPE, cada una con **9 `emails_cc`**. Dominios en esos CC: `ropecorp.com` (interno), `gmail.com`, y **firmas externas `lexincorp.com` y `roalatam.com`**. **8 de las 13** tienen ≥1 cotización ya enviada por correo → esas firmas externas **ya recibieron copia automática** de cotizaciones. En audiencias **no hay exposición** (0 citas tipo audiencia del grupo).

**Implicación:** la regla de confidencialidad de audiencias (heredados desmarcados por defecto) **no aplica a cotizaciones hoy**. Si Amanda quiere el mismo criterio en cotizaciones, es un cambio aparte a evaluar (fuera del módulo de audiencias). **Pendiente: decisión de Amanda.**

---

## 🟡 Features pendientes

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
