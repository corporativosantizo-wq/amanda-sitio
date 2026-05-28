-- La plantilla "envio-documento" tenía el campo descripcion_documento en
-- campos_extra pero el cuerpo no incluía el placeholder {descripcion_documento},
-- así que la "Descripción (opcional)" se capturaba pero nunca se reflejaba en el
-- correo. Se agrega la línea de descripción al cuerpo.
--
-- Aplicado a producción 2026-05-28 vía Supabase MCP. Idempotente (UPDATE sobre slug).

UPDATE legal.plantillas_correo
SET
  cuerpo_template = $tpl$Estimado/a {nombre_cliente},

Por medio de la presente le hacemos entrega del siguiente documento:

📎 Documento: {nombre_documento}
📝 Descripción: {descripcion_documento}
📋 Referencia: {referencia}

Agradecemos revisarlo y comunicarnos cualquier observación.

Quedamos a sus órdenes para cualquier consulta.

Lic. Amanda Santizo
Despacho Jurídico
Tel. 2335-3613 | amandasantizo.com$tpl$,
  updated_at = now()
WHERE slug = 'envio-documento';
