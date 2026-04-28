-- Migra plantilla seguimiento-cotizacion al nuevo type:'lookup' en el campo
-- numero_cotizacion. Permite autocompletar asunto + destinatario + cliente_id
-- al seleccionar una cotización existente desde el form del centro de
-- comunicaciones.
--
-- Aplicado a producción 2026-04-28 vía Supabase MCP. Este archivo existe para
-- parity dev/staging via supabase db reset. Idempotente (UPDATE sobre slug).
--
-- Notas sobre los populates aplicados:
--   - asunto_cotizacion ← asunto:          campo regular del form
--   - destinatario_email ← cliente_email:   key reservada → setDestinatarioEmail
--   - destinatario_nombre ← cliente_nombre: key reservada → setClienteNombre + replace {nombre_cliente}
--   - cliente_id ← cliente_id:              key reservada → setClienteId
--
-- NO se incluye cliente_nit porque el cuerpo actual de seguimiento-cotizacion
-- no tiene placeholder {nit}. Si en el futuro se agrega, se agrega también
-- el populate en el mismo cambio.

UPDATE legal.plantillas_correo
SET campos_extra = '[
  {
    "key": "numero_cotizacion",
    "type": "lookup",
    "label": "Número de cotización",
    "source": "cotizaciones",
    "populates": {
      "asunto_cotizacion": "asunto",
      "destinatario_email": "cliente_email",
      "destinatario_nombre": "cliente_nombre",
      "cliente_id": "cliente_id"
    }
  },
  {"key": "asunto_cotizacion", "type": "text", "label": "Asunto o servicio cotizado"},
  {"key": "detalle_avance", "type": "textarea", "label": "Detalle del avance"}
]'::jsonb,
    updated_at = now()
WHERE slug = 'seguimiento-cotizacion';
