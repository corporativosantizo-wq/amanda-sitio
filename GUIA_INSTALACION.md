# GUÍA DE INSTALACIÓN — Sistema de Gestión Legal IURISLEX

## Resumen

Este documento te guía paso a paso para instalar el sistema de gestión legal en tu proyecto Next.js existente (amandasantizo.com). Al terminar tendrás: panel admin protegido con auth, módulos de cotizaciones/facturas/pagos/gastos, protocolo notarial y un directorio de clientes.

**Tiempo estimado:** 2-3 horas  
**Prerequisitos:** Node.js 18+, npm/pnpm, cuenta Supabase, cuenta Clerk

---

## Paso 1: Instalar dependencias

Desde la raíz de tu proyecto:

```bash
# Clerk (autenticación)
npm install @clerk/nextjs @clerk/localizations

# Supabase (ya deberías tenerlo, pero por si acaso)
npm install @supabase/supabase-js @supabase/ssr

# Utilidades
npm install uuid
npm install -D @types/uuid
```

No necesitas más dependencias. Todo lo demás usa lo que ya tienes (Next.js, TypeScript, Tailwind, shadcn/ui).

---

## Paso 2: Variables de entorno

Copia el archivo `.env.example` como `.env.local`:

```bash
cp .env.example .env.local
```

Llena estos 5 valores obligatorios:

| Variable | Dónde obtenerla |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role (⚠️ nunca exponer en browser) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk → API Keys → Publishable key |
| `CLERK_SECRET_KEY` | Clerk → API Keys → Secret key |

Las demás variables (Megaprint, SMTP, Sentry) son opcionales por ahora — el sistema funciona sin ellas.

---

## Paso 3: Configurar Clerk

### 3a. Crear aplicación en Clerk

1. Ve a [clerk.com](https://clerk.com) y crea una cuenta
2. Crea una nueva aplicación
3. En "Sign-in options" habilita: **Email** (y Google si quieres)
4. Copia las API keys al `.env.local`

### 3b. Configurar URLs en Clerk Dashboard

En Clerk → Settings → Paths:

```
Sign-in URL:          /sign-in
Sign-up URL:          /sign-up
After sign-in URL:    /admin
After sign-up URL:    /admin
```

### 3c. Crear tu usuario

1. En Clerk Dashboard → Users → Create user
2. Usa tu email real (amanda@papeleo.legal o el que uses)
3. Este será tu usuario admin

---

## Paso 4: Ejecutar el schema SQL en Supabase

### 4a. Abrir el SQL Editor

Ve a Supabase → SQL Editor → New query

### 4b. Ejecutar el schema

Copia **todo** el contenido de `schema_fase1_completo.sql` y ejecútalo.

Esto crea:
- Schema `legal` separado de `public`
- 14 tablas (clientes, cotizaciones, facturas, pagos, gastos, escrituras, testimonios, etc.)
- 6 funciones de base de datos (secuencias, cálculos, triggers)
- Índices de performance
- Categorías de gastos iniciales (seed)

### 4c. Verificar

En Supabase → Table Editor, cambia el schema a `legal`. Deberías ver todas las tablas. Verifica que `categorias_gastos` tiene datos (10 categorías iniciales).

### 4d. Crear bucket de Storage

En Supabase → Storage → New bucket:
- Nombre: `legal-docs`
- Public: **No** (privado)
- File size limit: 10MB

---

## Paso 5: Copiar archivos al proyecto

### Estructura de archivos a copiar

Todos los archivos están organizados para copiarse directamente a tu proyecto. Aquí la estructura:

```
tu-proyecto/
├── middleware.ts                          ← NUEVO (auth)
├── .env.example                          ← NUEVO
├── app/
│   ├── providers.tsx                     ← NUEVO (ClerkProvider)
│   ├── sign-in/[[...sign-in]]/page.tsx   ← NUEVO
│   ├── admin/                            ← NUEVO (todo el directorio)
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── contabilidad/
│   │   │   ├── cotizaciones/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── nueva/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── facturas/page.tsx
│   │   │   ├── pagos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── nuevo/page.tsx
│   │   │   ├── gastos/
│   │   │   │   ├── page.tsx
│   │   │   │   └── nuevo/page.tsx
│   │   │   └── reportes/page.tsx
│   │   ├── clientes/
│   │   │   ├── page.tsx
│   │   │   ├── nuevo/page.tsx
│   │   │   └── [id]/page.tsx
│   │   └── notariado/
│   │       └── escrituras/page.tsx
│   └── api/admin/                        ← NUEVO (todo el directorio)
│       ├── clientes/
│       ├── contabilidad/
│       └── notariado/
├── components/
│   └── admin/ui.tsx                      ← NUEVO
├── lib/
│   ├── auth/api-auth.ts                  ← NUEVO
│   ├── data/catalogo-servicios.ts        ← NUEVO
│   ├── hooks/use-fetch.ts                ← NUEVO
│   ├── services/                         ← NUEVO (7 archivos)
│   ├── supabase/                         ← NUEVO o REEMPLAZAR
│   ├── types/                            ← NUEVO (6 archivos)
│   └── utils/                            ← NUEVO (5 archivos)
```

### Comandos para copiar

Asumiendo que descargaste los archivos en una carpeta `iurislex-files/`:

```bash
# Desde la raíz de tu proyecto Next.js

# 1. Auth y providers
cp iurislex-files/middleware.ts ./middleware.ts
cp iurislex-files/.env.example ./.env.example
cp iurislex-files/app/providers.tsx ./app/providers.tsx
mkdir -p app/sign-in/\[\[...sign-in\]\]
cp iurislex-files/app/sign-in/\[\[...sign-in\]\]/page.tsx ./app/sign-in/\[\[...sign-in\]\]/page.tsx

# 2. Lib (types, utils, services, hooks, supabase, auth)
cp -r iurislex-files/lib/ ./lib/

# 3. Components
mkdir -p components/admin
cp iurislex-files/components/admin/ui.tsx ./components/admin/ui.tsx

# 4. Admin pages
cp -r iurislex-files/app/admin/ ./app/admin/

# 5. API routes
cp -r iurislex-files/app/api/admin/ ./app/api/admin/
```

---

## Paso 6: Integrar ClerkProvider en tu layout raíz

Edita tu `app/layout.tsx` existente para envolver la app con el provider:

```tsx
// app/layout.tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
```

Si ya tienes otros providers, simplemente agrega `<Providers>` como wrapper exterior.

---

## Paso 7: Verificar TypeScript paths

Tu `tsconfig.json` debe tener el path alias `@/`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Si usas `src/`, ajusta a `"@/*": ["./src/*"]` y mueve los archivos acorde.

---

## Paso 8: Probar localmente

```bash
npm run dev
```

### Verificar:

1. **Home** (`/`) → Tu sitio público debe funcionar normal
2. **Admin** (`/admin`) → Debe redirigir a `/sign-in`
3. **Sign in** → Inicia sesión con tu usuario de Clerk
4. **Dashboard** → Deberías ver el panel admin (sin datos aún)
5. **Nuevo cliente** (`/admin/clientes/nuevo`) → Crea un cliente de prueba
6. **Nueva cotización** (`/admin/contabilidad/cotizaciones/nueva`) → Busca el cliente, agrega servicios del catálogo

### Si hay errores:

| Error | Causa probable | Solución |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL is not defined` | Falta .env.local | Verifica que el archivo existe y reinicia `npm run dev` |
| `relation "legal.clientes" does not exist` | Schema no ejecutado | Ejecuta `schema_fase1_completo.sql` en Supabase |
| `Clerk: Missing publishable key` | Falta env var de Clerk | Agrega las keys de Clerk al .env.local |
| `Module not found: @clerk/nextjs` | Dependencia faltante | `npm install @clerk/nextjs` |
| Error en API `/api/admin/clientes` | Sin service_role key | Verifica `SUPABASE_SERVICE_ROLE_KEY` en .env.local |

---

## Paso 9: Deploy a Vercel

### 9a. Variables de entorno en Vercel

Ve a Vercel → tu proyecto → Settings → Environment Variables.

Agrega las 5 variables obligatorias (las mismas del `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```

Y las URLs de Clerk:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL = /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL = /sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = /admin
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = /admin
NEXT_PUBLIC_APP_URL = https://amandasantizo.com
```

### 9b. Deploy

```bash
git add .
git commit -m "feat: sistema gestión legal IURISLEX v1"
git push
```

Vercel hará el deploy automático.

### 9c. Configurar dominio en Clerk

En Clerk Dashboard → Settings → Domains:
- Agrega `amandasantizo.com` como production domain

---

## Paso 10: Datos iniciales

Una vez deployado, crea tus datos reales:

1. **Clientes** — Agrega tus ~10 clientes más activos primero
2. **Cotización de prueba** — Crea una real para validar el flujo completo
3. **Gastos** — Registra los gastos de la semana para probar

---

## Lo que funciona ahora

✅ Panel admin protegido con autenticación  
✅ CRUD completo de clientes (individual/empresa, datos de facturación)  
✅ Cotizaciones con catálogo de 49 servicios, cálculos IVA/anticipo  
✅ Lista y filtros de facturas, pagos y gastos  
✅ Registro rápido de pagos con selector de factura y montos 60/40  
✅ Registro de gastos con categorías y "guardar + otro"  
✅ Dashboard con KPIs y resumen financiero  
✅ Reportes mensuales (flujo, embudo de ventas, top clientes)  
✅ Protocolo notarial (escrituras, testimonios)  
✅ Todo responsive (mobile-friendly)  

## Lo que falta (próximas iteraciones)

⬜ **Megaprint FEL** — Emisión de factura electrónica (requiere credenciales de Megaprint)  
⬜ **Proton SMTP** — Envío automático de emails (requiere Proton Bridge)  
⬜ **Generación PDF** — Cotizaciones y facturas descargables  
⬜ **Portal cliente** — Fase 2  
⬜ **IA Assistant** — Fase 2  
⬜ **Cobranza automática** — Fase 2  

---

## Costos mensuales estimados

| Servicio | Plan | Costo |
|---|---|---|
| Vercel | Pro (ya lo tienes) | $20/mes |
| Supabase | Pro | $25/mes |
| Clerk | Pro | $25/mes |
| Anthropic | API | ~$30-50/mes (Fase 2) |
| **Total Fase 1** | | **~$70/mes** |

Esto es ~$530/mes menos que tu asistente anterior. Los $600-900 de presupuesto te sobran con creces para Fase 2.

---

## Soporte

Si algo falla durante la instalación:
1. Revisa la tabla de errores arriba
2. Verifica que todas las env vars están configuradas
3. Revisa la consola del browser (F12) para errores de frontend
4. Revisa los logs de Vercel para errores de API
