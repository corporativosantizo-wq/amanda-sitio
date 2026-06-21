# Arquitectura y Base de Datos — amanda-sitio

## Diagrama general

```
Browser / Cliente
       │
       ▼
  Next.js 15 (Vercel)
  amandasantizo.com
       │
  ┌────┴────────────────────────────┐
  │  App Router                     │
  │  ├── /admin/*   (panel privado) │
  │  ├── /api/admin/* (API routes)  │
  │  └── /(auth)/*  (login)         │
  └────┬────────────────────────────┘
       │
       ▼
  Supabase (proyecto: vutjuyjizvmqrqnlyujp)
  ├── PostgreSQL — schema `legal`
  ├── Auth (JWT, sesiones)
  └── Storage — bucket `documentos`
```

---

## Schema `legal` — Tablas

### Clientes y expedientes

```sql
-- Clientes
legal.clientes
  id              uuid PK
  codigo          text UNIQUE  -- ej: CLI-0008
  nombre          text
  nit             text
  email           text
  telefono        text
  direccion       text
  tipo            enum: 'persona_natural', 'persona_juridica'
  activo          boolean DEFAULT true
  notas           text
  created_at      timestamptz
  updated_at      timestamptz

-- Expedientes judiciales
legal.expedientes
  id                    uuid PK
  numero_expediente     text UNIQUE  -- formato OJ: 01001-2024-00123
  cliente_id            uuid FK → legal.clientes
  tipo_proceso          enum: civil, penal, laboral, contencioso_administrativo,
                              constitucional, amparo, familia, mercantil, internacional
  subtipo               text         -- ej: "Juicio Ordinario"
  juzgado               text
  departamento          text
  actor                 text
  demandado             text
  rol_cliente           enum: actor, demandado, tercero, amicus_curiae
  estado                enum: activo, en_tramite, abierto_a_prueba, sentencia,
                              apelacion, casacion, amparo, ejecucion, archivado, finalizado
  fecha_inicio          date
  fecha_ultima_actuacion date
  fecha_finalizacion    date
  descripcion           text
  notas_internas        text
  monto_pretension      numeric
  moneda                enum: GTQ, USD, EUR  DEFAULT 'GTQ'
  created_at            timestamptz
  updated_at            timestamptz

-- Actuaciones procesales
legal.actuaciones_procesales
  id              uuid PK
  expediente_id   uuid FK → legal.expedientes
  fecha           date
  tipo            enum: memorial, resolucion, audiencia, notificacion,
                        sentencia, recurso, diligencia, otro
  descripcion     text
  realizado_por   text
  documento_url   text
  created_at      timestamptz

-- Plazos procesales
legal.plazos_procesales
  id                uuid PK
  expediente_id     uuid FK → legal.expedientes
  tipo_plazo        enum: contestacion_demanda, prueba, alegatos, apelacion,
                          casacion, amparo, evacuacion_audiencia, vista, otro
  descripcion       text
  fecha_inicio      date
  fecha_vencimiento date
  dias_habiles      boolean DEFAULT true
  estado            enum: pendiente, cumplido, vencido, prorrogado
  alerta_dias_antes integer DEFAULT 3
  created_at        timestamptz

-- Vínculos entre expedientes
legal.expedientes_vinculados
  id                    uuid PK
  expediente_origen_id  uuid FK → legal.expedientes
  expediente_destino_id uuid FK → legal.expedientes
  tipo_vinculo          enum: amparo, apelacion, casacion, acumulacion, incidente, relacionado
  descripcion           text
  created_at            timestamptz
```

### Documentos

```sql
-- Metadatos de documentos (archivo físico en Storage)
legal.documentos
  id              uuid PK
  cliente_id      uuid FK → legal.clientes
  expediente_id   uuid FK → legal.expedientes (nullable)
  nombre          text
  tipo            text  -- 'notarial', 'memorial', 'resolucion', etc.
                        -- LOS DOCUMENTOS NOTARIALES VIVEN AQUÍ,
                        -- NO EN actas_notariales (tabla vacía)
  storage_path    text  -- ruta dentro del bucket `documentos`
  mime_type       text
  tamano_bytes    bigint
  descripcion     text
  created_at      timestamptz
  updated_at      timestamptz
```

**Visor de documentos:** El proxy server-side en
`/api/admin/documentos/[id]/preview/route.ts` genera signed URLs y
sirve el contenido para PDF, DOCX e imágenes. Nunca exponer el
path directo del storage al cliente.

### Contabilidad

```sql
-- Cotizaciones
legal.cotizaciones
  id              uuid PK
  numero          text UNIQUE  -- correlativo
  cliente_id      uuid FK → legal.clientes
  expediente_id   uuid FK (nullable)
  estado          enum: borrador, enviada, aceptada, rechazada, facturada
  subtotal        numeric
  iva             numeric      -- 12% en Guatemala
  total           numeric
  notas           text
  fecha_emision   date
  fecha_vencimiento date
  created_at      timestamptz
  updated_at      timestamptz

-- Ítems de cotización
legal.cotizaciones_items
  id              uuid PK
  cotizacion_id   uuid FK → legal.cotizaciones
  descripcion     text
  cantidad        numeric
  precio_unitario numeric
  subtotal        numeric

-- Recibos de caja
legal.recibos_caja
  id              uuid PK
  numero          text UNIQUE
  cliente_id      uuid FK → legal.clientes
  cotizacion_id   uuid FK (nullable)
  monto           numeric
  concepto        text
  forma_pago      enum: efectivo, transferencia, cheque, deposito
  fecha           date
  created_at      timestamptz

-- Gastos
legal.gastos
  id              uuid PK
  expediente_id   uuid FK (nullable)
  descripcion     text
  monto           numeric
  fecha           date
  categoria       text
  comprobante_url text
  created_at      timestamptz
```

### Tareas

```sql
legal.tareas
  id              uuid PK
  expediente_id   uuid FK (nullable)
  cliente_id      uuid FK (nullable)
  asignado_a      text       -- nombre del abogado
  titulo          text
  descripcion     text
  fecha_limite    date
  prioridad       enum: baja, normal, alta, urgente
  estado          enum: pendiente, en_proceso, completada, cancelada
  created_at      timestamptz
  updated_at      timestamptz
```

---

## Storage — Bucket `documentos`

```
documentos/                    (bucket Supabase Storage)
├── CLI-XXXX/                  (carpeta por cliente)
│   ├── resoluciones/
│   ├── memoriales/
│   ├── contratos/
│   └── notarial/
└── pendientes/                (sin clasificar)
```

### Políticas RLS en Storage

- Solo usuarios autenticados pueden leer.
- Solo usuarios con rol `admin` pueden escribir/borrar.
- Los signed URLs se generan server-side; nunca se expone el bucket directamente al navegador.

---

## Autenticación

- Supabase Auth con email/password.
- Sesiones JWT con expiración de 1 hora (default).
- **Bug conocido:** En sesiones largas (>1 hora), las mutaciones (POST/PUT) devuelven 404 porque el token expiró. Fix pendiente: implementar refresh automático con `supabase.auth.onAuthStateChange`.
- RLS habilitado en todas las tablas del schema `legal`.

---

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (segura para exponer al cliente con RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo en server-side. **Nunca al cliente.** |

---

*Documento vivo — actualizar cuando se agreguen tablas o cambie la arquitectura.*
