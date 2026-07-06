-- Unificación de firma en plantillas de correo (jul-2026, aprobada por Amanda):
-- "Lic. Amanda Santizo" (con o sin línea "Despacho Jurídico") → "Amanda Santizo
-- / Abogada y Notaria". Afecta 9 plantillas: avance-tramite, audiencia-judicial,
-- reunion-presencial, seguimiento-cotizacion, reunion-teams,
-- programacion-cita-virtual, envio-documento, solicitud-documentos,
-- solicitud-nit. Las 8 plantillas firmadas por Magaly Estrada NO se tocan.
--
-- PENDIENTE de aplicar a producción (vía Supabase MCP o scripts/
-- aplicar-firma-plantillas-bd.ts) tras el OK de Amanda. Idempotente.

-- Paso 1: bloque de dos líneas "Lic. Amanda Santizo / Despacho Jurídico"
UPDATE legal.plantillas_correo
SET cuerpo_template = replace(
      cuerpo_template,
      E'Lic. Amanda Santizo\nDespacho Jurídico',
      E'Amanda Santizo\nAbogada y Notaria'
    ),
    updated_at = now()
WHERE cuerpo_template LIKE '%Lic. Amanda Santizo%';

-- Paso 2: restos de una sola línea (plantillas sin la línea "Despacho Jurídico")
UPDATE legal.plantillas_correo
SET cuerpo_template = replace(
      cuerpo_template,
      'Lic. Amanda Santizo',
      E'Amanda Santizo\nAbogada y Notaria'
    ),
    updated_at = now()
WHERE cuerpo_template LIKE '%Lic. Amanda Santizo%';
