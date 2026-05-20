-- Actualiza plantilla "seguimiento-cotizacion" para que el asunto incluya el
-- nombre del cliente. El cuerpo_template queda como fallback plano: el frontend
-- detecta el slug y genera el HTML profesional desde cero con los datos de la
-- cotización (trámites, avances) — ver lib/templates/seguimiento-cotizacion-email.ts
-- y el endpoint .../cotizaciones/[id]/seguimiento.
--
-- Aplicado a producción 2026-05-20 vía Supabase MCP. Idempotente (UPDATE sobre slug).

UPDATE legal.plantillas_correo
SET
  asunto_template = 'Reporte de avance — Cotización {numero_cotizacion} — {nombre_cliente}',
  updated_at = now()
WHERE slug = 'seguimiento-cotizacion';
