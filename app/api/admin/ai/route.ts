export const maxDuration = 300; // Allow 5 min for transcription tool

// Health check — confirms the module loaded and POST handler is available
export function GET() {
  return Response.json({ status: 'ok', handler: 'POST' });
}

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { Packer } from 'docx';
import { generarDocumento, PLANTILLAS_DISPONIBLES } from '@/lib/templates';
import type { TipoDocumentoGenerable } from '@/lib/templates';
import { sanitizarNombre } from '@/lib/services/documentos.service';
import { listarPlantillasActivas, obtenerPlantilla, generarDesdeCustomPlantilla } from '@/lib/services/plantillas.service';
import { buildDocument, convertirTextoAParagraphs } from '@/lib/templates/docx-utils';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import { searchEmails, getConversationThread, stripHtmlToText } from '@/lib/molly/graph-mail';
import { registrarYConfirmar } from '@/lib/services/pagos.service';
import { listarTareas, crearTarea, completarTarea, migrarTarea } from '@/lib/services/tareas.service';
import {
  listarCobros,
  crearCobro,
  registrarPagoCobro,
  enviarSolicitudPago,
  resumenCobros,
  CobroError,
} from '@/lib/services/cobros.service';
import {
  emailConfirmacionCita,
  emailRecordatorio24h,
  emailCancelacionCita,
  emailSolicitudPago,
  emailPagoRecibido,
  emailCotizacion,
  emailEstadoCuenta,
  emailFactura,
  emailDocumentosDisponibles,
  emailActualizacionExpediente,
  emailBienvenidaCliente,
  emailSolicitudDocumentos,
  emailAvisoAudiencia,
  emailWrapper,
} from '@/lib/templates/emails';
import {
  crearCotizacion,
  obtenerCotizacion,
  obtenerConfiguracion as obtenerConfigCotizacion,
} from '@/lib/services/cotizaciones.service';
import { generarPDFCotizacion } from '@/lib/services/pdf-cotizacion';

// ── Retry wrapper for Anthropic API (handles 529 Overloaded) ─────────────
class AnthropicOverloadedError extends Error {
  constructor() {
    super('El asistente está ocupado en este momento, intenta de nuevo en unos segundos.');
    this.name = 'AnthropicOverloadedError';
  }
}

async function callAnthropicWithRetry(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      if (status === 529 && attempt < maxRetries) {
        const delay = attempt * 2000; // 2s, 4s
        console.warn('[AI] Anthropic 529 overloaded – retry', attempt, '/', maxRetries, 'in', delay, 'ms');
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (status === 529) {
        console.error('[AI] Anthropic 529 overloaded – all', maxRetries, 'retries exhausted');
        throw new AnthropicOverloadedError();
      }
      throw err;
    }
  }
  // Unreachable, but satisfies TS
  throw new AnthropicOverloadedError();
}

const SYSTEM_PROMPT = `## 🚨 REGLA ABSOLUTA — LEER PRIMERO 🚨
NUNCA ejecutes la herramienta enviar_email ni enviar_email_con_adjunto directamente.
SIEMPRE muestra el borrador completo (destinatario, asunto, cuerpo del email) y pregunta "¿Apruebas el envío?" ANTES de llamar a la herramienta.
Si Amanda dice "envíalo", "mándale", "dile que..." — PRIMERO muestra el borrador y pide confirmación.
NUNCA asumas que una instrucción de envío significa enviar sin mostrar qué vas a enviar.
Violar esta regla puede causar daño real e irreversible al trabajo de Amanda.

La ÚNICA excepción son las tareas PROGRAMADAS (accion_automatica en gestionar_tareas), donde el cron ejecuta después. En ese caso, muestra el borrador de la tarea y confirma la creación de la tarea, pero NO necesitas doble confirmación.

Eres el asistente IA de IURISLEX, el sistema de gestión legal de Amanda Santizo — Despacho Jurídico, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales.

## TU PERSONALIDAD
Eres profesional, eficiente y proactiva. Tuteas a Amanda porque es tu jefa. Eres directa, no das vueltas. Si Amanda pide algo, preparas todo pero SIEMPRE confirmas antes de ejecutar acciones irreversibles (emails, pagos, cobros). Si necesitas datos que no tienes, preguntas solo lo esencial.

## DATOS DEL BUFETE
- Firma: Amanda Santizo — Despacho Jurídico
- Especialidad: Derecho internacional, litigios, procedimientos comerciales
- Equipo: 5 abogados
- Casos activos: ~200
- Ubicación: Guatemala
- Tarifa por hora (caso complejo): Q1,200/hora

## HONORARIOS MÍNIMOS — CÓDIGO DE NOTARIADO (Art. 109)
Estos son los honorarios MÍNIMOS establecidos por ley. El bufete SIEMPRE cobra igual o más que estos mínimos.

### Escrituras de valor determinado
- Hasta Q5,000: Q300 base + 10% sobre el valor
- De Q5,001 a Q25,000: Q400 base + 8%
- De Q25,001 a Q50,000: Q450 base + 6%
- De Q50,001 a Q100,000: Q500 base + 4%
- De Q100,001 a Q1,000,000: Q500 base + 3%
- Más de Q1,000,000: Q500 base + 2%

### Escrituras de valor indeterminado
- Entre Q200 y Q5,000, según importancia del asunto

### Testamentos y donaciones por causa de muerte
- Se aplican las mismas tarifas de escrituras (incisos 1 y 2 del Art. 109)

### Testimonios
- Del mismo año: Q50
- De años anteriores: Q75

### Actas notariales
- De Q100 a Q2,000, según importancia

### Inventarios
- Base de Q100 + porcentajes sobre el activo inventariado (del 10% al 2%)

### Servicios fuera de oficina
- Dentro de la población: Q50 por hora
- Fuera de la población: Q6 por kilómetro (ida y vuelta)

### Redacción de documentos privados o minutas
- Mitad de los honorarios de escrituras (inciso 1 o 2 según corresponda)

### Proyectos de partición
- Q300 base + 6% hasta Q20,000 + 3% sobre el excedente

### Consultas notariales
- De Q100 a Q1,000, según complejidad

### Hojas adicionales
- Q5 por cada hoja adicional

## EJEMPLO DE CÁLCULO DE HONORARIOS NOTARIALES
Si un cliente pide una escritura de compraventa por Q150,000:
- Rango: Q100,001 a Q1,000,000
- Cálculo: Q500 base + 3% de Q150,000 = Q500 + Q4,500 = Q5,000
- Más IVA si aplica

## CATÁLOGO DE SERVICIOS LEGALES
**IMPORTANTE:** NO uses precios hardcodeados. SIEMPRE consulta el catálogo actualizado de la base de datos usando la herramienta consultar_catalogo con consulta="catalogo_servicios" antes de cotizar cualquier servicio. Los precios pueden cambiar y el catálogo de la BD es la fuente de verdad.

## DATOS BANCARIOS Y CONFIGURACIÓN DEL DESPACHO
**IMPORTANTE:** NO uses datos bancarios de memoria. SIEMPRE consulta la configuración del despacho usando consultar_catalogo con consulta="configuracion" para obtener los datos bancarios correctos, porcentaje de IVA, dirección y teléfono actualizados. El único banco autorizado actualmente es Banco Industrial — cuenta 455-008846-4 a nombre de Invest & Jure-Advisor, S.A.

## REGLAS FISCALES GUATEMALA
- IVA: 12% (se incluye en el precio o se suma, según acuerdo con el cliente)
- ISR servicios profesionales: 5% sobre Q30,000+ (régimen simplificado) o 7% (régimen general)
- Facturación FEL obligatoria
- Timbre fiscal notarial: Q0.50 por hoja
- Timbres forenses: según arancel del CANG

## INSTRUCCIONES PARA COTIZACIONES
Cuando te pidan una cotización:
1. SIEMPRE ejecuta consultar_catalogo con consulta="catalogo_servicios" para obtener precios actualizados
2. SIEMPRE ejecuta consultar_catalogo con consulta="configuracion" para obtener datos bancarios e IVA
3. Para servicios NOTARIALES: calcula siempre usando el Art. 109 como mínimo
4. Para servicios LEGALES no notariales: usa los precios del catálogo de la BD
5. IVA (12%): SIEMPRE calcúlalo y muéstralo separado (subtotal + IVA = total)
6. Formato para chat:

---
COTIZACIÓN
Cliente: [nombre]
Fecha: [fecha actual]

Servicios:
1. [Servicio] — Q[monto] (base legal: Art. 109 / tarifa del bufete)

Subtotal: Q[suma]
IVA (12%): Q[iva]
Total: Q[total]

Vigencia: 15 días
Forma de pago: 50% anticipo, 50% al finalizar
Cuenta para depósito: [datos de consultar_catalogo configuracion]
---

7. Cuando envíes cotización por email (tipo=cotizacion), incluye en los servicios el IVA como línea separada o súmalo al total, según lo que Amanda indique.
8. NUNCA inventes datos bancarios. Solo usa los que devuelve consultar_catalogo configuracion.

## CREAR COTIZACIONES (herramienta completa)
Puedes crear cotizaciones completas con PDF profesional usando la herramienta crear_cotizacion_completa. Esto:
1. Crea la cotización en la base de datos con número secuencial (COT-XXXX)
2. Calcula automáticamente subtotal, IVA (12%), total y anticipo (60%)
3. Genera un PDF profesional con diseño corporativo
4. Sube el PDF a Storage
5. Opcionalmente envía el PDF al cliente por email desde contador@papeleo.legal

### Parámetros:
- **cliente_id** (requerido): UUID o nombre del cliente
- **items** (requerido): Lista de {servicio, cantidad, precio_unitario} — precios SIN IVA
- **notas** (opcional): Notas internas (no visibles para el cliente)
- **enviar_por_correo** (opcional): true para enviar email con PDF adjunto al cliente

### Flujo:
1. SIEMPRE consulta consultar_catalogo("catalogo_servicios") para obtener precios actualizados del catálogo
2. Si Amanda especifica un monto diferente al del catálogo, usa el monto que ella indique
3. Busca al cliente por nombre para obtener su UUID
4. Usa crear_cotizacion_completa con los items y precios correctos

### Ejemplos:
- "Hazle cotización a Roberto Salazar por constitución de sociedad" → consulta catálogo (SRV-027 = Q8,000), busca cliente, crear_cotizacion_completa(cliente_id="Roberto Salazar", items=[{servicio:"Constitución de sociedad anónima", cantidad:1, precio_unitario:8000}])
- "Cotización a Jessica por Q7,000 de registro de marca" → crear_cotizacion_completa(cliente_id="Jessica", items=[{servicio:"Registro de marca", cantidad:1, precio_unitario:7000}])
- "Mándale cotización a Silvia Valdez por consulta especializada y revisión de contrato, envíasela" → consultar catálogo para ambos precios, crear_cotizacion_completa(cliente_id="Silvia Valdez", items=[...], enviar_por_correo=true)

### IMPORTANTE:
- Los precios en items son SIN IVA (el sistema agrega IVA 12% automáticamente)
- Usa esta herramienta (NO enviar_email tipo=cotizacion) cuando Amanda quiera crear una cotización formal con PDF
- Si Amanda dice "cotiza y envíale" o "envíasela", usa enviar_por_correo=true
- Después de crear, reporta: número de cotización, total con IVA, anticipo, y si se envió el email

## PLANTILLA DE RECORDATORIO DE AUDIENCIA
Puedes consultar la plantilla de recordatorio de audiencia usando consultar_catalogo con consulta="plantilla_recordatorio_audiencia". Esto te da la estructura y campos disponibles para generar recordatorios con la herramienta generar_documento.

## PLANTILLAS DE DOCUMENTOS DISPONIBLES
Puedes generar los siguientes documentos en formato Word (.docx) usando la herramienta generar_documento:

1. **arrendamiento** — Contrato de arrendamiento. Datos: arrendante (nombre, edad, estado civil, nacionalidad, profesión, DPI, dirección), arrendatario (mismos datos), inmueble (descripción, dirección, finca, folio, libro), plazo en meses, renta mensual, depósito.
2. **laboral** — Contrato individual de trabajo. Datos: trabajador (nombre, edad, etc.), patrono (empresa, representante), puesto, fecha inicio, salario mensual, horario, lugar de trabajo.
3. **agot** — Acta de Asamblea General Ordinaria Totalitaria. Datos: entidad, número de acta, fecha, dirección sede, socios (nombre y calidad), presidente, secretario, puntos de agenda.
4. **acta_notarial_certificacion** — Acta notarial de certificación de punto de acta. Datos: fecha, lugar, requirente, entidad, número de acta, fecha del acta, punto a certificar, contenido literal.
5. **amparo** — Recurso de amparo. Datos: amparista, autoridad impugnada, acto reclamado, legitimación, derecho amenazado, disposiciones violadas, casos de procedencia, hechos, petición.
6. **rendicion_cuentas** — Demanda oral de rendición de cuentas. Datos: juzgado, demandante, demandado, relación jurídica, hechos, fundamento de derecho, petición.
7. **sumario_nulidad** — Juicio sumario de nulidad. Datos: juzgado, actor, demandado, acto impugnado, hechos, fundamento de derecho, petición.
8. **oposicion_desestimacion** — Oposición a desestimación. Datos: expediente, tribunal, querellante, motivo, hechos, fundamento de derecho, petición.

### Instrucciones para generar documentos:
- Cuando Amanda pida un documento, identifica qué plantilla necesita
- Pregunta SOLO los datos que faltan (nombre del cliente, fechas, montos)
- Si mencionó un cliente, busca sus datos en la BD primero
- Usa la herramienta generar_documento con tipo y datos completos
- Después de generar, presenta el enlace de descarga con formato: [Descargar documento](url)

## ENVÍO DE EMAILS
Puedes enviar emails a CUALQUIER persona usando la herramienta enviar_email — tanto a clientes registrados como a personas externas.

### 🚨 FLUJO OBLIGATORIO PARA TODO EMAIL (SIN EXCEPCIONES):
1. **Recopilar información**: Busca el cliente, lee emails previos si es respuesta, obtén datos necesarios
2. **Redactar borrador**: Prepara el email completo internamente
3. **MOSTRAR BORRADOR A AMANDA** con este formato:

📧 **Borrador de email**
**De:** [remitente]@papeleo.legal
**Para:** [destinatario] ([email])
**Asunto:** [asunto]
**Cuerpo:**
[contenido del email en texto legible]

¿Apruebas el envío?

4. **ESPERAR** la respuesta de Amanda — NO llamar a enviar_email todavía
5. **Solo cuando Amanda confirme** ("sí", "apruebo", "dale", "envía", "ok") → ejecutar enviar_email

Si Amanda pide cambios al borrador, ajústalo y muéstralo de nuevo.
NUNCA envíes sin este flujo, aunque Amanda diga "envíalo" o "mándale" — eso es la INSTRUCCIÓN de iniciar el flujo, no la APROBACIÓN.

### Templates disponibles:

**Desde asistente@papeleo.legal:**
- **documentos_disponibles** — Notifica que sus documentos están en el portal. Datos: (solo necesita cliente)
- **actualizacion_expediente** — Informa novedad en su caso. Datos: expediente (número), novedad (texto libre)
- **bienvenida_cliente** — Da la bienvenida y acceso al portal. Datos: (solo necesita cliente)
- **solicitud_documentos** — Pide documentos al cliente. Datos: documentos (lista de strings), plazo (texto, ej: "5 días hábiles")
- **aviso_audiencia** — Avisa de audiencia programada. Datos: fecha (YYYY-MM-DD), hora (HH:mm), juzgado, direccion, presencia_requerida (bool), instrucciones, documentos_llevar (lista)
- **confirmacion_cita** — Confirma una cita agendada. Datos: cita_id
- **recordatorio_cita** — Recuerda una cita próxima. Datos: cita_id
- **personalizado** — Email libre redactado por ti. Datos: asunto, contenido (HTML)

**Desde contador@papeleo.legal:**
- **solicitud_pago** — Cobra al cliente. Datos: concepto, monto, fecha_limite (YYYY-MM-DD, opcional)
- **comprobante_pago** — Confirma recepción de pago. Datos: concepto, monto, fecha_pago (YYYY-MM-DD)
- **cotizacion** — Envía cotización. Datos: servicios (lista de {descripcion, monto}), vigencia (YYYY-MM-DD, opcional)
- **estado_cuenta** — Envía estado de cuenta. Datos: movimientos (lista de {fecha, concepto, cargo, abono}), saldo
- **factura** — Envía factura. Datos: nit, numero, conceptos (lista de {descripcion, monto}), total

### Resolución de destinatarios:
- **Cliente registrado**: Busca con consultar_base_datos (buscar_contacto:[nombre]) para obtener ID y email
- **Persona externa**: Usa email_directo y nombre_destinatario, NO busques en BD
- El remitente se determina automáticamente según el tipo de email

### Ejemplos (TODOS requieren mostrar borrador antes de enviar):
- "Mándale a Flor sus documentos" → busca cliente, MUESTRA BORRADOR, espera aprobación, envía
- "Cobrale a Procapeli Q5,000" → busca cliente, MUESTRA BORRADOR de solicitud_pago, espera aprobación
- "Dile a Kristel que su audiencia es el 15" → busca cliente, MUESTRA BORRADOR de aviso_audiencia, espera aprobación
- "Mándale email a juan@gmail.com diciendo que ya tenemos resolución" → MUESTRA BORRADOR personalizado, espera aprobación

## CONFIRMAR PAGOS
Puedes registrar y confirmar pagos usando la herramienta confirmar_pago. Esto:
1. Registra el pago en la BD (estado: registrado → confirmado en un solo paso)
2. Envía comprobante de pago al cliente por email desde contador@papeleo.legal
3. Si el pago está asociado a una factura, el trigger de BD actualiza el estado de la factura

### Parámetros:
- **cliente_id** (requerido): UUID o nombre del cliente
- **monto** (requerido): Monto en Quetzales
- **concepto** (requerido): Descripción del pago
- **metodo_pago**: transferencia (default), deposito, efectivo, cheque
- **referencia_bancaria**: Número de boleta o referencia
- **fecha_pago**: YYYY-MM-DD (default: hoy)

### Ejemplos:
- "Registra el pago de Q5,000 de Procapeli por la constitución de sociedad" → confirmar_pago(cliente_id="Procapeli", monto=5000, concepto="Constitución de sociedad")
- "Flor pagó Q500 de su consulta, referencia 123456" → confirmar_pago(cliente_id="Flor", monto=500, concepto="Consulta legal", referencia_bancaria="123456")

## GESTIÓN DE TAREAS (Bullet Journal)
Puedes gestionar la agenda del despacho usando la herramienta gestionar_tareas. Acciones disponibles:

### Acciones:
- **crear**: Crea una nueva tarea/evento/nota
- **listar**: Lista tareas con filtros (estado, prioridad, categoria, fecha, cliente)
- **completar**: Marca una tarea como completada
- **migrar**: Mueve una tarea a una nueva fecha

### Parámetros para crear:
- titulo (requerido), descripcion, tipo (tarea/evento/nota), prioridad (alta/media/baja)
- fecha_limite (YYYY-MM-DD), cliente_id (UUID o nombre), categoria (cobros/documentos/audiencias/tramites/personal/seguimiento)
- asignado_a (amanda/asistente/contador/asesora)

### Ejemplos:
- "¿Qué tengo pendiente hoy?" → listar con estado=pendiente, fecha=hoy
- "Agrégale a mi agenda cobrarle a Flor los Q500" → crear tarea, categoria=cobros, buscar cliente "Flor"
- "Marca como completada la tarea de entregar protocolo" → listar para encontrar, luego completar
- "¿Qué tareas tiene el contador?" → listar con asignado_a=contador
- "Migra las tareas vencidas a mañana" → listar vencidas, luego migrar cada una

### Ejecución inmediata:
Cuando Amanda pide algo para AHORA, prepara el email y MUESTRA EL BORRADOR para aprobación:
- Tarea de cobro → prepara borrador de solicitud_pago → muestra → espera aprobación → envía
- Tarea de enviar documentos → prepara borrador de documentos_disponibles → muestra → espera aprobación → envía
- Tarea de recordatorio → prepara borrador del tipo apropiado → muestra → espera aprobación → envía

### Tareas PROGRAMADAS (para fecha futura):
Cuando Amanda dice "el martes envíale..." o "mañana cobra..." o "el 15 mándale...":
1. Crea la tarea con gestionar_tareas accion=crear
2. Incluye accion_automatica en los datos con la acción a ejecutar automáticamente
3. El cron ejecutará la acción cuando llegue la fecha_limite

Formato de accion_automatica:
{
  "tipo": "enviar_email",
  "template": "solicitud_pago|documentos_disponibles|aviso_audiencia|solicitud_documentos|personalizado",
  "cliente_id": "UUID del cliente",
  "email_directo": "email@ejemplo.com (si lo conoces)",
  "nombre_destinatario": "Nombre del destinatario",
  "datos": { ... datos del template — VER CAMPOS OBLIGATORIOS ABAJO ... }
}

⚠️ CAMPOS OBLIGATORIOS POR TEMPLATE (la tarea NO se creará si faltan):

1. template="solicitud_pago" → datos DEBE tener:
   - "concepto": string (ej: "Honorarios caso laboral")
   - "monto": number > 0 (ej: 5000)
   - "fecha_limite": string opcional (ej: "2026-02-20")

2. template="documentos_disponibles" → no requiere datos adicionales

3. template="aviso_audiencia" → datos DEBE tener:
   - "fecha": string (ej: "2026-02-15")
   - "hora": string (ej: "09:00")
   - "juzgado": string (ej: "Juzgado 1o Civil")

4. template="solicitud_documentos" → datos DEBE tener:
   - "documentos": string[] (ej: ["DPI vigente", "Recibo de luz"])

5. template="personalizado" → datos DEBE tener:
   - "asunto": string — el subject del email. OBLIGATORIO.
   - "contenido": string — el cuerpo del email en HTML. OBLIGATORIO.
   Ejemplo de contenido: "<p>Estimado Lic. García,</p><p>Le recordamos que tiene pendiente...</p><p>Saludos cordiales,<br>Amanda Santizo</p>"

🚨 REGLA CRÍTICA PARA EMAILS PROGRAMADOS:
- NUNCA crees una tarea de email sin TODOS los campos obligatorios del template.
- Para template "personalizado": SIEMPRE genera tú misma el asunto y el contenido HTML completo ANTES de crear la tarea. NO dejes datos.asunto o datos.contenido vacíos — el sistema rechazará la tarea.
- Si Amanda te pide programar un email pero no te da el texto exacto, REDÁCTALO tú como lo haría Amanda (profesional, cordial, en español) y guárdalo en datos.contenido.
- SIEMPRE incluir email_directo del destinatario si lo conoces.
- SIEMPRE incluir nombre_destinatario cuando esté disponible.
- Si usas cliente_id, el sistema resolverá el email automáticamente como respaldo.

Ejemplos:
- "Mándale recordatorio de pago a Procapeli el lunes" → crear tarea con fecha_limite=lunes, asignado_a=asistente, accion_automatica={"tipo":"enviar_email","template":"solicitud_pago","cliente_id":"[UUID]","datos":{"concepto":"Honorarios legales pendientes","monto":5000}}
- "El miércoles envíale a Roberto sus documentos" → crear tarea con fecha_limite=miércoles, asignado_a=asistente, accion_automatica={"tipo":"enviar_email","template":"documentos_disponibles","cliente_id":"[UUID]"}
- "El viernes recuérdale al Lic. Alvarez su cita" → crear tarea con fecha_limite=viernes, asignado_a=asistente, accion_automatica={"tipo":"enviar_email","template":"personalizado","cliente_id":"[UUID]","datos":{"asunto":"Recordatorio de cita — Despacho Amanda Santizo","contenido":"<p>Estimado Lic. Alvarez,</p><p>Le enviamos un cordial recordatorio de su cita programada con nuestro despacho.</p><p>Quedamos a su disposición para cualquier consulta.</p><p>Saludos cordiales,<br>Amanda Santizo<br>Despacho Jurídico</p>"}}
- "Recuérdame el viernes revisar el contrato de Juan" → crear tarea normal para Amanda SIN accion_automatica (es solo recordatorio PARA AMANDA, no email a un cliente)

IMPORTANTE: Solo usa accion_automatica cuando la tarea es para el asistente y requiere una acción automática (como enviar email a un CLIENTE o tercero). Para recordatorios personales de Amanda, crea la tarea sin accion_automatica.

## GESTIÓN DE COBROS
Puedes gestionar las cuentas por cobrar del despacho usando la herramienta gestionar_cobros. Acciones disponibles:

### Acciones:
- **crear_cobro**: Crea un nuevo cobro (cuenta por cobrar) y envía solicitud de pago al cliente
- **listar_cobros**: Lista cobros con filtros (estado, cliente)
- **registrar_pago**: Registra un pago contra un cobro existente
- **enviar_recordatorio**: Envía recordatorio de pago al cliente
- **resumen_cobros**: Dashboard con totales (pendiente, vencido, por vencer, cobrado este mes)

### Parámetros para crear_cobro:
- cliente_id (UUID o nombre), concepto, monto, descripcion (opcional), dias_credito (default 15), expediente_id (opcional)

### Parámetros para listar_cobros:
- estado (pendiente/parcial/vencido/pagado/cancelado/vencidos), cliente_id, busqueda

### Parámetros para registrar_pago:
- cobro_id (requerido), monto, metodo (transferencia_gyt/deposito_gyt/transferencia_bi/deposito_bi/efectivo/cheque), referencia_bancaria, fecha_pago

### Parámetros para enviar_recordatorio:
- cobro_id (requerido)

### Ejemplos:
- "Cóbrale Q5,000 a Procapeli por la constitución de sociedad" → crear_cobro(cliente_id="Procapeli", concepto="Constitución de sociedad", monto=5000)
- "¿Quién me debe?" → resumen_cobros o listar_cobros con estado=vencidos
- "Registra el pago de Q2,500 del cobro COB-15" → registrar_pago(cobro_id=[UUID], monto=2500)
- "Mándale recordatorio de cobro a Procapeli" → primero listar_cobros para encontrar el cobro, luego enviar_recordatorio
- "¿Cuánto he cobrado este mes?" → resumen_cobros
- "Lista los cobros vencidos" → listar_cobros(estado="vencidos")

### IMPORTANTE:
- Cuando Amanda dice "cóbrale a..." SIEMPRE usa gestionar_cobros con crear_cobro (NO enviar_email). Esto crea el cobro en el sistema Y envía la solicitud de pago automáticamente.
- Para registrar pagos contra cobros existentes, usa registrar_pago (NO confirmar_pago). confirmar_pago es para pagos sueltos sin cobro asociado.

## GESTIÓN DE CLIENTES
Puedes buscar, actualizar y crear clientes usando la herramienta gestionar_clientes. Acciones disponibles:

### Acciones:
- **buscar**: Busca clientes por nombre, email, empresa, razón social o NIT (ILIKE, case-insensitive).
- **actualizar**: Actualiza datos de un cliente existente. Requiere cliente_id (UUID) y los campos a modificar en datos.
- **crear**: Crea un nuevo cliente. Requiere al menos nombre en datos.

### Campos disponibles para actualizar/crear:
nombre, email, telefono, nit, dpi, empresa, direccion, razon_social, representante_legal, nit_facturacion, direccion_facturacion, notas, tipo, estado, fuente

### Ejemplos:
- "Actualiza el correo de Ricardo Valle a ricardo@gmail.com" → buscar(busqueda="Ricardo Valle") para obtener ID, luego actualizar(cliente_id=UUID, datos={email:"ricardo@gmail.com"})
- "Agrega a María López, NIT 12345, tel 55551234" → crear(datos={nombre:"María López", nit:"12345", telefono:"55551234"})
- "¿Cuál es el email de Procapeli?" → buscar(busqueda="Procapeli")
- "Vincula a Ricardo como representante de G.E., S.A." → buscar primero, luego actualizar(cliente_id=UUID, datos={empresa:"G.E., S.A."})
- "Cambia el NIT de facturación de Flor a 987654" → buscar, luego actualizar(cliente_id=UUID, datos={nit_facturacion:"987654"})

### IMPORTANTE:
- Para actualizar, SIEMPRE busca primero al cliente para obtener su UUID, luego actualiza con ese UUID.
- Si Amanda dice "actualiza" o "cambia" datos de un cliente, usa esta herramienta (NO consultar_base_datos).

## ARCHIVOS ADJUNTOS
Amanda puede adjuntar archivos al chat (PDF, DOCX, imágenes, max 3 MB). Cuando recibas un archivo:
- Si es PDF, recibirás el texto extraído automáticamente. Úsalo para responder preguntas sobre el documento.
- Si Amanda pide que envíes el archivo por email, usa la herramienta enviar_email_con_adjunto (NO enviar_email).
- El archivo queda en Storage temporal (molly-temp/). Usa el archivo_url que te llega en el contexto del mensaje.

### Ejemplos:
- [Amanda adjunta factura.pdf] "¿Qué dice esta factura?" → Lee el texto extraído y responde.
- [Amanda adjunta contrato.pdf] "Envíaselo a Flor Coronado" → usa enviar_email_con_adjunto con el archivo_url del adjunto.
- [Amanda adjunta foto.jpg] "Mándalo a juan@gmail.com" → usa enviar_email_con_adjunto.

## BÚSQUEDA DE JURISPRUDENCIA
Tienes acceso a una base de jurisprudencia del despacho con tomos procesados y búsqueda semántica. Usa la herramienta buscar_jurisprudencia cuando:
- Amanda pregunte sobre jurisprudencia, precedentes o criterios de tribunales
- Necesites fundamentar una opinión legal con fuentes
- Te pregunten sobre interpretación de leyes o doctrina legal guatemalteca

### Cómo usar:
1. Usa buscar_jurisprudencia con una consulta descriptiva del tema
2. Analiza los fragmentos devueltos
3. Responde citando las fuentes: "Según el Tomo X, páginas Y-Z: [contenido relevante]"
4. Si no hay resultados, indica que no se encontró jurisprudencia relevante en la base

### Ejemplos:
- "¿Qué dice la jurisprudencia sobre prescripción mercantil?" → buscar_jurisprudencia(consulta="prescripción en materia mercantil")
- "Necesito precedentes de nulidad de contrato" → buscar_jurisprudencia(consulta="nulidad de contrato elementos requisitos")
- "¿Hay jurisprudencia sobre daño moral en Guatemala?" → buscar_jurisprudencia(consulta="daño moral indemnización Guatemala")

## MÓDULOS LEGALES — CONSULTAS CON consultar_legal

Tienes acceso a los módulos legales del sistema a través de la herramienta consultar_legal. Puedes consultar:

### 1. EXPEDIENTES JUDICIALES/FISCALES/ADMINISTRATIVOS (legal.expedientes)
Un expediente puede ser de origen **judicial**, **fiscal** (Ministerio Público) o **administrativo**, y puede evolucionar (ej: fiscal → judicializado, administrativo → económico coactivo).

**Consultas disponibles:**
- **expedientes_cliente**: Expedientes de un cliente. Params: cliente_id (UUID o nombre), estado (activo/suspendido/archivado/finalizado), origen (judicial/fiscal/administrativo), tipo_proceso
- **expedientes_buscar**: Buscar por número de expediente, MP, administrativo, o texto. Params: busqueda
- **plazos_proximos**: Plazos procesales por vencer en los próximos N días. Params: dias (default 7), cliente_id (opcional)
- **actuaciones_expediente**: Últimas actuaciones de un expediente. Params: expediente_id
- **expedientes_vinculados**: Expedientes vinculados entre sí. Params: expediente_id
- **expedientes_resumen**: Resumen general: totales por estado, por origen, por tipo de proceso.

**Ejemplos:**
- "¿Cuántos expedientes activos tiene Rope?" → consultar_legal(consulta="expedientes_cliente", params={cliente_id:"Rope", estado:"activo"})
- "¿Qué plazos vencen esta semana?" → consultar_legal(consulta="plazos_proximos", params={dias:7})
- "Muéstrame todos los expedientes de económico coactivo" → consultar_legal(consulta="expedientes_cliente", params={tipo_proceso:"economico_coactivo"})
- "¿Qué expedientes tiene Agrope en Suchitepéquez?" → consultar_legal(consulta="expedientes_buscar", params={busqueda:"Agrope Suchitepéquez"})

### 2. CUMPLIMIENTO MERCANTIL (legal.tramites_mercantiles)
Trámites de registro mercantil: patentes de comercio, inscripciones, asambleas, nombramientos, etc.

**Consultas disponibles:**
- **mercantil_cliente**: Trámites de un cliente. Params: cliente_id (UUID o nombre), categoria, estado
- **mercantil_por_vencer**: Trámites próximos a vencer (patentes, etc). Params: dias (default 30)
- **mercantil_asambleas_pendientes**: Empresas que no han celebrado asamblea ordinaria este año. Params: (ninguno)
- **mercantil_resumen**: Resumen: totales por estado y categoría, por vencer, vencidos.

**Ejemplos:**
- "¿Qué patentes de comercio están por vencer?" → consultar_legal(consulta="mercantil_por_vencer", params={dias:60})
- "¿Qué empresas no han celebrado asamblea ordinaria este año?" → consultar_legal(consulta="mercantil_asambleas_pendientes")
- "Trámites mercantiles de Rope" → consultar_legal(consulta="mercantil_cliente", params={cliente_id:"Rope"})

### 3. CUMPLIMIENTO LABORAL (legal.tramites_laborales)
Contratos laborales, reglamentos internos, registros IGT, libros de salarios, etc.

**Consultas disponibles:**
- **laboral_cliente**: Trámites de un cliente. Params: cliente_id (UUID o nombre), categoria, estado
- **laboral_por_vencer**: Contratos temporales próximos a vencer. Params: dias (default 30)
- **laboral_pendientes_igt**: Contratos pendientes de registro en la IGT. Params: cliente_id (opcional)
- **laboral_reglamento_vigente**: Verifica si una empresa tiene reglamento interno vigente. Params: cliente_id (UUID o nombre)
- **laboral_libro_salarios**: Verifica si una empresa tiene libro de salarios autorizado. Params: cliente_id (UUID o nombre)
- **laboral_resumen**: Resumen: totales por estado, categoría, por vencer, vencidos.

**Ejemplos:**
- "¿Cuántos contratos de Rope están pendientes de registro en la IGT?" → consultar_legal(consulta="laboral_pendientes_igt", params={cliente_id:"Rope"})
- "¿Rope tiene reglamento interno vigente?" → consultar_legal(consulta="laboral_reglamento_vigente", params={cliente_id:"Rope"})

### 4. DIRECTORIOS INSTITUCIONALES
- **tribunales_buscar**: Buscar juzgados/tribunales en el OJ. Params: busqueda (nombre), departamento, tipo (juzgado_paz/juzgado_primera_instancia/sala_apelaciones/tribunal_sentencia), ramo
- **fiscalias_buscar**: Buscar fiscalías del MP. Params: busqueda (nombre), departamento, tipo

**Ejemplos:**
- "¿Cuál es el teléfono del Juzgado Civil de Mixco?" → consultar_legal(consulta="tribunales_buscar", params={busqueda:"Civil Mixco"})
- "¿Qué fiscalías hay en Escuintla?" → consultar_legal(consulta="fiscalias_buscar", params={departamento:"Escuintla"})
- "¿Qué fiscalías hay en Guatemala?" → consultar_legal(consulta="fiscalias_buscar", params={departamento:"Guatemala"})

### 5. REPRESENTANTES LEGALES Y GRUPO EMPRESARIAL
Las empresas pueden tener representantes legales con cargos de dirección (Administrador Único, Presidente del Consejo) o gestión (Gerente General, Gerente Operativo). Empresas que comparten representante legal forman un **grupo empresarial**.

- **representantes_empresa**: Representantes de una empresa. Params: cliente_id (UUID o nombre)
- **grupo_empresarial**: Empresas del grupo empresarial (comparten representante). Params: cliente_id (UUID o nombre)
- **empresas_representante**: Todas las empresas donde trabaja un representante. Params: busqueda (nombre del representante)

**Ejemplos:**
- "¿Qué empresas comparten representante legal?" → consultar_legal(consulta="grupo_empresarial", params={cliente_id:"Rope"})
- "¿Cuáles son las empresas del grupo empresarial de Rope?" → consultar_legal(consulta="grupo_empresarial", params={cliente_id:"Rope"})
- "Representantes legales de Marope" → consultar_legal(consulta="representantes_empresa", params={cliente_id:"Marope"})

### 6. BIBLIOTECA LEGAL
Documentos de referencia: legislación, formularios, modelos de documentos, jurisprudencia indexada.

- **biblioteca_buscar**: Buscar documentos. Params: busqueda (texto), categoria (legislacion/formulario/modelo/jurisprudencia/otro)

**Ejemplos:**
- "Busca el modelo de contrato individual de trabajo" → consultar_legal(consulta="biblioteca_buscar", params={busqueda:"contrato individual trabajo"})
- "Encuentra el Código de Comercio" → consultar_legal(consulta="biblioteca_buscar", params={busqueda:"Código de Comercio"})

## LECTURA DE EMAILS
Puedes buscar y leer emails del buzón del despacho usando las herramientas buscar_emails y leer_hilo_email. Las tres cuentas disponibles son:
- **asistente@papeleo.legal** — consultas generales, agendamiento, solicitudes
- **contador@papeleo.legal** — facturas, pagos, retenciones, SAT
- **amanda@papeleo.legal** — clientes VIP, juzgados, colegas abogados

### Flujo para leer emails:
1. Usa buscar_emails con la cuenta apropiada y un término de búsqueda
2. Revisa los resultados (asunto, remitente, preview)
3. Si Amanda quiere el detalle, usa leer_hilo_email con el conversationId para ver el hilo completo
4. Si Amanda quiere responder, redacta la respuesta y usa enviar_email tipo=personalizado

### Cómo elegir la cuenta:
- Si Amanda dice "emails nuevos" o "bandeja" sin especificar → busca en asistente@papeleo.legal
- Si menciona facturas, pagos, contabilidad → busca en contador@papeleo.legal
- Si dice "mis emails" o "mi correo" → busca en amanda@papeleo.legal
- Si menciona un remitente específico, busca en las tres cuentas si no está claro

### Reglas:
- NUNCA inventes contenido de emails. Solo reporta lo que retorna la herramienta.
- Presenta los resultados de forma clara: fecha, de, asunto, preview
- Cuando muestres un hilo, ordénalo cronológicamente y resume si es largo
- Si Amanda dice "responde ese email", primero lee el hilo completo, luego redacta el borrador, MUÉSTRALO A AMANDA y espera aprobación antes de enviar

### Ejemplos:
- "¿Qué emails nuevos hay?" → buscar_emails(cuenta="asistente@papeleo.legal", busqueda="*", dias=1)
- "Busca emails de Procapeli" → buscar_emails(cuenta="asistente@papeleo.legal", busqueda="Procapeli")
- "¿Qué facturas llegaron esta semana?" → buscar_emails(cuenta="contador@papeleo.legal", busqueda="factura", dias=7)
- "Lee el hilo de ese email" → leer_hilo_email con el conversationId del resultado anterior
- "Respóndele que ya tenemos la resolución" → leer hilo → redactar borrador → MOSTRAR A AMANDA → esperar aprobación → enviar

## INSTRUCCIONES GENERALES
- Sé concisa y profesional, como una abogada guatemalteca experimentada
- Usa moneda guatemalteca (Q) siempre, formateada con separador de miles
- Cuando calcules honorarios notariales, SIEMPRE muestra el desglose del cálculo
- Los honorarios notariales del Art. 109 son MÍNIMOS por ley, nunca cotizar menos
- La tarifa hora del bufete para casos complejos es Q1,200
- Cuando no sepas algo, dilo honestamente
- Puedes usar markdown para formatear respuestas
- NUNCA tomes acciones irreversibles sin confirmación explícita de Amanda (emails, pagos, cobros, eliminaciones)
- NUNCA inventes datos de emails, clientes o expedientes — usa solo datos reales del sistema
- Si Amanda dice "envía", "manda", "dile" — eso inicia el flujo de borrador, NO es la aprobación final`;

// ── Helper: búsqueda de contactos (clientes + proveedores) ─────────────────
// Usa la RPC legal.buscar_contacto que hace fuzzy search por palabras en ambas tablas.
// Retorna: { id, nombre, email, telefono, tipo_contacto, codigo }

async function buscarContacto(
  db: ReturnType<typeof createAdminClient>,
  nombre: string,
  limit: number = 5,
): Promise<{ id: string; nombre: string; email: string | null; telefono: string | null; tipo_contacto: 'cliente' | 'proveedor'; codigo: string }[]> {
  console.log('[AI] Búsqueda de contacto:', nombre);
  // @ts-ignore
  const { data, error } = await db.schema('public').rpc('buscar_contacto', { nombre });
  if (error) throw new Error(`Error buscando contacto: ${error.message}`);
  return (data ?? []).slice(0, limit);
}

// Helper: fetch nit for a contact (not returned by RPC)
async function fetchContactoNit(
  db: ReturnType<typeof createAdminClient>,
  contacto: { id: string; tipo_contacto: string },
): Promise<string> {
  const table = contacto.tipo_contacto === 'proveedor' ? 'proveedores' : 'clientes';
  const { data } = await db.from(table).select('nit').eq('id', contacto.id).single();
  return data?.nit ?? 'CF';
}

// ── Consultas a BD ────────────────────────────────────────────────────────

async function queryDatabase(query: string): Promise<string> {
  const db = createAdminClient();
  try {
    if (query.includes('clientes_count')) {
      const { count } = await db.from('clientes').select('*', { count: 'exact', head: true });
      return `Total de clientes registrados: ${count ?? 0}`;
    }
    if (query.includes('facturas_pendientes')) {
      const { data } = await db.from('facturas').select('*').eq('estado', 'emitida');
      const total = (data ?? []).reduce((s: number, f: any) => s + (f.total ?? 0), 0);
      return `Facturas pendientes: ${data?.length ?? 0} por un total de Q${total.toFixed(2)}`;
    }
    if (query.includes('cotizaciones_mes')) {
      const inicio = new Date();
      inicio.setDate(1);
      const { data } = await db.from('cotizaciones').select('*').gte('fecha', inicio.toISOString().split('T')[0]);
      const total = (data ?? []).reduce((s: number, c: any) => s + (c.total ?? 0), 0);
      return `Cotizaciones este mes: ${data?.length ?? 0} por un total de Q${total.toFixed(2)}`;
    }
    if (query.includes('clientes_recientes')) {
      const { data } = await db.from('clientes').select('nombre, email, telefono, created_at').order('created_at', { ascending: false }).limit(5);
      if (!data?.length) return 'No hay clientes registrados aún.';
      return 'Últimos 5 clientes:\n' + data.map((c: any) => `- ${c.nombre} (${c.email ?? 'sin email'})`).join('\n');
    }
    if (query.includes('gastos_mes')) {
      const inicio = new Date();
      inicio.setDate(1);
      const { data } = await db.from('gastos').select('*').gte('fecha', inicio.toISOString().split('T')[0]);
      const total = (data ?? []).reduce((s: number, g: any) => s + (g.monto ?? 0), 0);
      return `Gastos este mes: ${data?.length ?? 0} por un total de Q${total.toFixed(2)}`;
    }
    if (query.includes('pagos_mes')) {
      const inicio = new Date();
      inicio.setDate(1);
      const { data } = await db.from('pagos').select('*').gte('fecha', inicio.toISOString().split('T')[0]);
      const total = (data ?? []).reduce((s: number, p: any) => s + (p.monto ?? 0), 0);
      return `Pagos recibidos este mes: ${data?.length ?? 0} por un total de Q${total.toFixed(2)}`;
    }
    if (query.includes('buscar_cliente') || query.includes('buscar_contacto')) {
      const nombre = query.replace(/buscar_cliente:|buscar_contacto:/, '').trim();
      const contactos = await buscarContacto(db, nombre, 5);
      if (!contactos.length) return `No se encontraron contactos con nombre "${nombre}".`;
      return 'Contactos encontrados:\n' + contactos.map((c: any) =>
        `- ${c.nombre} (${c.tipo_contacto}) | Email: ${c.email ?? 'N/A'} | Tel: ${c.telefono ?? 'N/A'} | Código: ${c.codigo ?? 'N/A'}`
      ).join('\n');
    }
    return 'Consulta no reconocida. Queries disponibles: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_contacto:[nombre]';
  } catch (error: any) {
    return `Error al consultar: ${error.message}`;
  }
}

// ── Generación de documentos ──────────────────────────────────────────────

async function generateDocument(tipo: string, datos: any): Promise<string> {
  console.log('[AI] Generando documento: tipo=', tipo, ', datos keys:', Object.keys(datos || {}));

  // Validar env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)');
  }

  // Paso 1: Generar buffer .docx
  console.log('[AI] Paso 1: Generando buffer docx...');
  let buffer: Buffer;
  try {
    buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);
    console.log('[AI] Buffer generado OK:', (buffer.length / 1024).toFixed(0), 'KB');
  } catch (err: any) {
    console.error('[AI] Error generando docx:', err.message, err.stack);
    throw new Error('Error al generar el documento .docx (tipo: ' + tipo + '): ' + err.message);
  }

  // Paso 2: Subir a Storage
  console.log('[AI] Paso 2: Subiendo a Storage...');
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dateStr = new Date().toISOString().split('T')[0];
  const storagePath = `generados/${dateStr}_${sanitizarNombre(tipo)}_${Date.now()}.docx`;

  const { error: uploadError } = await storage.storage
    .from('documentos')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (uploadError) {
    console.error('[AI] Error upload Storage:', uploadError);
    throw new Error(`Error al subir a Storage: ${uploadError.message}`);
  }
  console.log('[AI] Subido OK:', storagePath);

  // Paso 3: Generar URL firmada
  console.log('[AI] Paso 3: Generando URL firmada...');
  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    console.error('[AI] Error signed URL:', signError);
    throw new Error(`Error al generar URL de descarga: ${signError?.message}`);
  }

  const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable] ?? tipo;
  console.log('[AI] Documento generado exitosamente:', nombre);

  return `Documento "${nombre}" generado exitosamente.\nEnlace de descarga (válido por 10 minutos): ${signedData.signedUrl}`;
}

// ── Generación desde plantilla custom ────────────────────────────────────

async function generateCustomDocument(plantillaId: string, datos: any): Promise<string> {
  console.log('[AI] Generando documento custom: plantilla_id=', plantillaId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno de Supabase');
  }

  // Paso 1: Obtener plantilla
  console.log('[AI] Custom paso 1: Obteniendo plantilla...');
  const plantilla = await obtenerPlantilla(plantillaId);
  if (!plantilla.activa) throw new Error('La plantilla está inactiva');
  console.log('[AI] Plantilla:', plantilla.nombre, ',', (plantilla.campos as any[]).length, 'campos');

  // Paso 2: Reemplazar campos y generar docx
  console.log('[AI] Custom paso 2: Generando docx...');
  let buffer: Buffer;
  try {
    const textoFinal = generarDesdeCustomPlantilla(plantilla, datos);
    const paragraphs = convertirTextoAParagraphs(textoFinal);
    const doc = buildDocument(paragraphs);
    buffer = Buffer.from(await Packer.toBuffer(doc));
    console.log('[AI] Buffer custom generado:', (buffer.length / 1024).toFixed(0), 'KB');
  } catch (err: any) {
    console.error('[AI] Error generando docx custom:', err.message, err.stack);
    throw new Error(`Error al generar .docx custom: ${err.message}`);
  }

  // Paso 3: Subir a Storage
  console.log('[AI] Custom paso 3: Subiendo a Storage...');
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const dateStr = new Date().toISOString().split('T')[0];
  const storagePath = `generados/${dateStr}_custom_${sanitizarNombre(plantilla.nombre)}_${Date.now()}.docx`;

  const { error: uploadError } = await storage.storage
    .from('documentos')
    .upload(storagePath, buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: false,
    });

  if (uploadError) {
    console.error('[AI] Error upload custom:', uploadError);
    throw new Error(`Error al subir a Storage: ${uploadError.message}`);
  }

  // Paso 4: URL firmada
  console.log('[AI] Custom paso 4: Generando URL firmada...');
  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    console.error('[AI] Error signed URL custom:', signError);
    throw new Error(`Error al generar URL: ${signError?.message}`);
  }

  console.log('[AI] Documento custom generado exitosamente:', plantilla.nombre);
  return `Documento "${plantilla.nombre}" generado exitosamente.\nEnlace de descarga (válido por 10 minutos): ${signedData.signedUrl}`;
}

// ── Envío de emails ───────────────────────────────────────────────────────

async function handleEnviarEmail(
  tipoEmail: string,
  clienteId: string | undefined,
  datos: any,
  emailDirecto?: string,
  nombreDestinatario?: string,
): Promise<string> {
  const db = createAdminClient();

  // 1. Resolve destination: email_directo OR cliente lookup
  let destinatarioEmail: string;
  let destinatarioNombre: string;
  let clienteNit = 'CF';

  if (emailDirecto?.trim()) {
    // Direct email — no DB lookup needed
    destinatarioEmail = emailDirecto.trim();
    destinatarioNombre = nombreDestinatario?.trim() || destinatarioEmail;
    console.log('[AI] Email directo a:', destinatarioEmail.replace(/(.{2}).+(@.+)/, '$1***$2'), '(' + destinatarioNombre + ')');
  } else if (clienteId) {
    // Lookup by UUID or name
    let cliente: any;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);

    if (isUUID) {
      const { data, error } = await db.from('clientes').select('id, nombre, email, nit').eq('id', clienteId).single();
      if (error || !data) throw new Error(`Cliente no encontrado con ID: ${clienteId}`);
      cliente = data;
    } else {
      const contactos = await buscarContacto(db, clienteId, 1);
      if (!contactos.length) throw new Error(`Contacto no encontrado: "${clienteId}"`);
      cliente = contactos[0];
      cliente.nit = await fetchContactoNit(db, cliente);
    }

    if (!cliente.email) {
      throw new Error(`El contacto ${cliente.nombre} no tiene email registrado.`);
    }

    destinatarioEmail = cliente.email;
    destinatarioNombre = cliente.nombre;
    clienteNit = cliente.nit ?? 'CF';
  } else {
    throw new Error('Se requiere cliente_id o email_directo para enviar un email.');
  }

  // 2. Build email from template
  let from: MailboxAlias;
  let subject: string;
  let html: string;

  switch (tipoEmail) {
    case 'documentos_disponibles': {
      const t = emailDocumentosDisponibles({ clienteNombre: destinatarioNombre });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'actualizacion_expediente': {
      const t = emailActualizacionExpediente({
        clienteNombre: destinatarioNombre,
        expediente: datos?.expediente ?? 'N/A',
        novedad: datos?.novedad ?? 'Sin detalle',
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'bienvenida_cliente': {
      const t = emailBienvenidaCliente({ clienteNombre: destinatarioNombre });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'solicitud_documentos': {
      const t = emailSolicitudDocumentos({
        clienteNombre: destinatarioNombre,
        documentos: datos?.documentos ?? ['Documentos pendientes'],
        plazo: datos?.plazo,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'aviso_audiencia': {
      const t = emailAvisoAudiencia({
        clienteNombre: destinatarioNombre,
        fecha: datos?.fecha ?? new Date().toISOString().split('T')[0],
        hora: datos?.hora ?? '09:00',
        juzgado: datos?.juzgado ?? 'Por confirmar',
        direccion: datos?.direccion,
        presenciaRequerida: datos?.presencia_requerida ?? true,
        instrucciones: datos?.instrucciones,
        documentosLlevar: datos?.documentos_llevar,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'confirmacion_cita': {
      if (!datos?.cita_id) throw new Error('Se requiere cita_id para confirmación de cita');
      const { data: cita, error } = await db
        .from('citas')
        .select('*, cliente:clientes(id, nombre, email)')
        .eq('id', datos.cita_id)
        .single();
      if (error || !cita) throw new Error(`Cita no encontrada: ${datos.cita_id}`);
      const t = emailConfirmacionCita(cita);
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'recordatorio_cita': {
      if (!datos?.cita_id) throw new Error('Se requiere cita_id para recordatorio de cita');
      const { data: cita, error } = await db
        .from('citas')
        .select('*, cliente:clientes(id, nombre, email)')
        .eq('id', datos.cita_id)
        .single();
      if (error || !cita) throw new Error(`Cita no encontrada: ${datos.cita_id}`);
      const t = emailRecordatorio24h(cita);
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'solicitud_pago': {
      const t = emailSolicitudPago({
        clienteNombre: destinatarioNombre,
        concepto: datos?.concepto ?? 'Servicios legales',
        monto: datos?.monto ?? 0,
        fechaLimite: datos?.fecha_limite,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'comprobante_pago': {
      const t = emailPagoRecibido({
        clienteNombre: destinatarioNombre,
        concepto: datos?.concepto ?? 'Servicios legales',
        monto: datos?.monto ?? 0,
        fechaPago: datos?.fecha_pago ?? new Date().toISOString().split('T')[0],
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'cotizacion': {
      const t = emailCotizacion({
        clienteNombre: destinatarioNombre,
        servicios: datos?.servicios ?? [],
        vigencia: datos?.vigencia,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'estado_cuenta': {
      const t = emailEstadoCuenta({
        clienteNombre: destinatarioNombre,
        movimientos: datos?.movimientos ?? [],
        saldo: datos?.saldo ?? 0,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'factura': {
      const t = emailFactura({
        clienteNombre: destinatarioNombre,
        nit: datos?.nit ?? clienteNit,
        numero: datos?.numero ?? 'S/N',
        conceptos: datos?.conceptos ?? [],
        total: datos?.total ?? 0,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'personalizado': {
      from = 'asistente@papeleo.legal';
      subject = datos?.asunto ?? 'Mensaje de Amanda Santizo — Despacho Jurídico';
      html = emailWrapper(datos?.contenido ?? '');
      break;
    }
    default:
      throw new Error(`Tipo de email no reconocido: ${tipoEmail}`);
  }

  // 3. Send
  await sendMail({ from, to: destinatarioEmail, subject, htmlBody: html, cc: 'amanda@papeleo.legal' });

  const emailMask = destinatarioEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
  console.log('[AI] Email enviado: tipo=', tipoEmail, ', from=', from, ', to=', emailMask, ', asunto=', subject);
  return `Email enviado a ${destinatarioNombre} (${destinatarioEmail}) desde ${from} — Asunto: ${subject}`;
}

// ── Envío de email con adjunto ────────────────────────────────────────────

const CONTENT_TYPES_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

async function handleEnviarEmailConAdjunto(
  clienteId: string | undefined,
  emailDirecto: string | undefined,
  nombreDestinatario: string | undefined,
  asunto: string,
  contenidoHtml: string,
  archivoUrl: string,
): Promise<string> {
  const db = createAdminClient();

  // 1. Resolve destination (same pattern as handleEnviarEmail)
  let destinatarioEmail: string;
  let destinatarioNombre: string;

  if (emailDirecto?.trim()) {
    destinatarioEmail = emailDirecto.trim();
    destinatarioNombre = nombreDestinatario?.trim() || destinatarioEmail;
  } else if (clienteId) {
    let cliente: any;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);

    if (isUUID) {
      const { data, error } = await db.from('clientes').select('id, nombre, email').eq('id', clienteId).single();
      if (error || !data) throw new Error(`Cliente no encontrado con ID: ${clienteId}`);
      cliente = data;
    } else {
      const contactos = await buscarContacto(db, clienteId, 1);
      if (!contactos.length) throw new Error(`Contacto no encontrado: "${clienteId}"`);
      cliente = contactos[0];
    }

    if (!cliente.email) throw new Error(`El contacto ${cliente.nombre} no tiene email registrado.`);
    destinatarioEmail = cliente.email;
    destinatarioNombre = cliente.nombre;
  } else {
    throw new Error('Se requiere cliente_id o email_directo para enviar el email.');
  }

  // 2. Download file from Storage
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: fileData, error: dlError } = await storage.storage
    .from('documentos')
    .download(archivoUrl);

  if (dlError || !fileData) throw new Error(`Error al descargar archivo: ${dlError?.message ?? 'sin datos'}`);

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const contentBytes = buffer.toString('base64');

  // 3. Detect content type from extension
  const fileName = archivoUrl.split('/').pop() ?? 'archivo';
  const ext = fileName.includes('.') ? '.' + fileName.split('.').pop()!.toLowerCase() : '';
  const contentType = CONTENT_TYPES_MAP[ext] ?? 'application/octet-stream';

  // Use original filename if available (remove timestamp prefix from molly-temp/)
  const displayName = fileName.replace(/^\d+_/, '');

  // 4. Build HTML
  const { emailWrapper } = await import('@/lib/templates/emails');
  const html = contenidoHtml
    ? emailWrapper(contenidoHtml)
    : emailWrapper(`<p>Adjunto el archivo solicitado.</p>`);

  // 5. Send with attachment
  await sendMail({
    from: 'asistente@papeleo.legal',
    to: destinatarioEmail,
    subject: asunto,
    htmlBody: html,
    cc: 'amanda@papeleo.legal',
    attachments: [{ name: displayName, contentType, contentBytes }],
  });

  const emailMask = destinatarioEmail.replace(/(.{2}).+(@.+)/, '$1***$2');
  console.log('[AI] Email con adjunto enviado: to=', emailMask, ', archivo=', displayName);
  return `Email enviado a ${destinatarioNombre} (${destinatarioEmail}) con adjunto "${displayName}" desde asistente@papeleo.legal — Asunto: ${asunto}`;
}

// ── Confirmar pago ────────────────────────────────────────────────────────

async function handleConfirmarPago(
  clienteId: string,
  monto: number,
  concepto: string,
  metodoPago?: string,
  referenciaBancaria?: string,
  fechaPago?: string,
): Promise<string> {
  const db = createAdminClient();

  // 1. Resolve client
  let cliente: any;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);

  if (isUUID) {
    const { data, error } = await db.from('clientes').select('id, nombre, email').eq('id', clienteId).single();
    if (error || !data) throw new Error(`Cliente no encontrado con ID: ${clienteId}`);
    cliente = data;
  } else {
    const contactos = await buscarContacto(db, clienteId, 1);
    if (!contactos.length) throw new Error(`Contacto no encontrado: "${clienteId}"`);
    cliente = contactos[0];
  }

  // 2. Register + confirm payment in one step
  const pago = await registrarYConfirmar({
    cliente_id: cliente.id,
    monto,
    metodo: metodoPago ?? 'transferencia',
    referencia_bancaria: referenciaBancaria ?? null,
    fecha_pago: fechaPago ?? new Date().toISOString().split('T')[0],
    notas: concepto,
  });

  console.log('[AI] Pago registrado y confirmado:', pago.numero, '— Q', monto, '—', cliente.nombre);

  // 3. Send comprobante email from contador@
  if (cliente.email) {
    try {
      const t = emailPagoRecibido({
        clienteNombre: cliente.nombre,
        concepto,
        monto,
        fechaPago: pago.fecha_pago ?? new Date().toISOString().split('T')[0],
      });
      await sendMail({ from: t.from, to: cliente.email, subject: t.subject, htmlBody: t.html, cc: 'amanda@papeleo.legal' });
      console.log('[AI] Comprobante enviado a', cliente.email, 'desde', t.from);
      return `Pago confirmado: ${pago.numero} — Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} de ${cliente.nombre}. Comprobante enviado a ${cliente.email} desde contador@papeleo.legal.`;
    } catch (emailErr: any) {
      console.error('[AI] Error enviando comprobante:', emailErr.message);
      return `Pago confirmado: ${pago.numero} — Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} de ${cliente.nombre}. ADVERTENCIA: no se pudo enviar el comprobante por email (${emailErr.message}).`;
    }
  }

  return `Pago confirmado: ${pago.numero} — Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} de ${cliente.nombre}. El cliente no tiene email registrado, no se envió comprobante.`;
}

// ── Gestionar tareas ──────────────────────────────────────────────────────

async function handleGestionarTareas(
  accion: string,
  datos: any,
): Promise<string> {
  const db = createAdminClient();

  switch (accion) {
    case 'crear': {
      // Resolve client name → ID if provided as text
      let clienteId = datos.cliente_id ?? null;
      if (clienteId && !/^[0-9a-f]{8}-/i.test(clienteId)) {
        const contactos = await buscarContacto(db, clienteId, 1);
        if (contactos.length) {
          clienteId = contactos[0].id;
        } else {
          clienteId = null;
        }
      }

      // Validar y enriquecer accion_automatica para emails programados
      if (datos.accion_automatica?.tipo === 'enviar_email') {
        const aa = datos.accion_automatica;
        aa.datos = aa.datos ?? {};

        // Normalizar contenido_html → contenido (el cron usa datos.contenido)
        if (aa.datos.contenido_html && !aa.datos.contenido) {
          aa.datos.contenido = aa.datos.contenido_html;
        }

        // Validar que exista un template válido
        const TEMPLATES_VALIDOS = ['solicitud_pago', 'documentos_disponibles', 'aviso_audiencia', 'solicitud_documentos', 'personalizado'];
        if (!aa.template) {
          return 'Error: falta el campo template en accion_automatica. No se creó la tarea.';
        }
        if (!TEMPLATES_VALIDOS.includes(aa.template)) {
          return `Error: template "${aa.template}" no soportado. Templates válidos: ${TEMPLATES_VALIDOS.join(', ')}. No se creó la tarea.`;
        }

        // Validar campos OBLIGATORIOS según template
        switch (aa.template) {
          case 'personalizado': {
            if (!aa.datos.asunto?.trim()) {
              return 'Error: para email personalizado se requiere datos.asunto. Genera el asunto del email y vuelve a intentar. No se creó la tarea.';
            }
            if (!aa.datos.contenido?.trim() && !aa.datos.contenido_html?.trim()) {
              return 'Error: para email personalizado se requiere datos.contenido (HTML del cuerpo del email). Genera el contenido completo del email y vuelve a intentar. No se creó la tarea.';
            }
            break;
          }
          case 'solicitud_pago': {
            if (!aa.datos.concepto?.trim()) {
              return 'Error: para solicitud_pago se requiere datos.concepto. No se creó la tarea.';
            }
            if (!aa.datos.monto || aa.datos.monto <= 0) {
              return 'Error: para solicitud_pago se requiere datos.monto (mayor a 0). No se creó la tarea.';
            }
            break;
          }
          case 'aviso_audiencia': {
            if (!aa.datos.fecha || !aa.datos.hora) {
              return 'Error: para aviso_audiencia se requiere datos.fecha y datos.hora. No se creó la tarea.';
            }
            if (!aa.datos.juzgado?.trim()) {
              return 'Error: para aviso_audiencia se requiere datos.juzgado. No se creó la tarea.';
            }
            break;
          }
          case 'solicitud_documentos': {
            if (!aa.datos.documentos || !Array.isArray(aa.datos.documentos) || aa.datos.documentos.length === 0) {
              return 'Error: para solicitud_documentos se requiere datos.documentos (array de nombres de documentos). No se creó la tarea.';
            }
            break;
          }
          // documentos_disponibles: no requiere datos adicionales
        }

        // Asegurar cliente_id es el UUID resuelto
        if (clienteId) aa.cliente_id = clienteId;

        // Resolver email del destinatario y guardarlo como respaldo
        if (!aa.email_directo) {
          const resolvedId = aa.cliente_id ?? clienteId;
          if (resolvedId) {
            const { data: cli } = await db
              .from('clientes').select('id, nombre, email')
              .eq('id', resolvedId).single();
            if (cli?.email) {
              aa.email_directo = cli.email;
              aa.nombre_destinatario = aa.nombre_destinatario ?? cli.nombre;
            }
          }
        }

        if (!aa.email_directo && !aa.cliente_id && !clienteId) {
          return 'Error: no se pudo determinar el destinatario del email. Se necesita cliente_id o email_directo. No se creó la tarea.';
        }

        datos.accion_automatica = aa;
      }

      const tarea = await crearTarea({
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        tipo: datos.tipo ?? 'tarea',
        prioridad: datos.prioridad ?? 'media',
        fecha_limite: datos.fecha_limite ?? new Date().toISOString().split('T')[0],
        cliente_id: clienteId,
        asignado_a: datos.asignado_a ?? 'amanda',
        categoria: datos.categoria ?? 'tramites',
        notas: datos.notas,
        accion_automatica: datos.accion_automatica ?? null,
      });

      const programada = tarea.accion_automatica ? ' ⏰ PROGRAMADA' : '';
      return `Tarea creada${programada}: "${tarea.titulo}" (${tarea.prioridad}, ${tarea.categoria}${tarea.fecha_limite ? ', fecha: ' + tarea.fecha_limite : ''})`;
    }

    case 'listar': {
      const hoy = new Date().toISOString().split('T')[0];
      const result = await listarTareas({
        estado: datos.estado,
        prioridad: datos.prioridad,
        categoria: datos.categoria,
        asignado_a: datos.asignado_a,
        cliente_id: datos.cliente_id,
        fecha_desde: datos.fecha === 'hoy' ? hoy : datos.fecha_desde,
        fecha_hasta: datos.fecha === 'hoy' ? hoy : datos.fecha_hasta,
        busqueda: datos.busqueda,
        limit: 20,
      });

      if (result.data.length === 0) {
        return 'No se encontraron tareas con esos filtros.';
      }

      const lines = result.data.map((t: any) => {
        const cliente = t.cliente?.nombre ? ` [${t.cliente.nombre}]` : '';
        const fecha = t.fecha_limite ? ` (${t.fecha_limite})` : '';
        const symbol = t.tipo === 'tarea' ? '\u2022' : t.tipo === 'evento' ? '\u25CB' : '\u2014';
        return `${symbol} **${t.titulo}**${cliente}${fecha} — ${t.estado}, ${t.prioridad}, ${t.categoria} (id: ${t.id})`;
      });

      return `${result.total} tarea(s) encontrada(s):\n${lines.join('\n')}`;
    }

    case 'completar': {
      if (!datos.tarea_id) throw new Error('Se requiere tarea_id para completar');
      const tarea = await completarTarea(datos.tarea_id);
      return `Tarea completada: "${tarea.titulo}"`;
    }

    case 'migrar': {
      if (!datos.tarea_id) throw new Error('Se requiere tarea_id para migrar');
      const nuevaFecha = datos.nueva_fecha ?? (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })();
      const tarea = await migrarTarea(datos.tarea_id, nuevaFecha);
      return `Tarea migrada: "${tarea.titulo}" → ${nuevaFecha}`;
    }

    default:
      throw new Error(`Acción no reconocida: ${accion}. Acciones válidas: crear, listar, completar, migrar`);
  }
}

// ── Gestionar clientes ───────────────────────────────────────────────────

async function handleGestionarClientes(
  accion: string,
  clienteId: string | undefined,
  busqueda: string | undefined,
  datos: any,
): Promise<string> {
  const db = createAdminClient();

  switch (accion) {
    case 'buscar': {
      if (!busqueda?.trim()) throw new Error('Se requiere busqueda (nombre, email, empresa, NIT, etc.)');
      const q = busqueda.trim();
      const words = q.split(/\s+/).filter(Boolean);
      console.log('[AI] gestionar_clientes buscar:', q, '-> palabras:', words);

      // Build query: each word must match nombre (AND), OR full query matches email/empresa/nit
      const selectCols = 'id, codigo, tipo, nombre, nit, dpi, telefono, email, direccion, empresa, representante_legal, razon_social, nit_facturacion, direccion_facturacion, notas, activo';
      let query = db.from('clientes').select(selectCols);

      if (words.length <= 1) {
        // Single word: search across all fields
        query = query.or(`nombre.ilike.%${q}%,email.ilike.%${q}%,empresa.ilike.%${q}%,razon_social.ilike.%${q}%,nit.ilike.%${q}%`);
      } else {
        // Multiple words: AND match each word in nombre (primary), OR try full query in other fields
        // Use two queries and merge results for best coverage
        for (const word of words) {
          query = query.ilike('nombre', `%${word}%`);
        }
      }
      const { data, error } = await query.limit(5);

      // If no results with AND on nombre and multi-word, try OR across other fields
      if (!data?.length && words.length > 1) {
        const { data: fallback } = await db.from('clientes').select(selectCols)
          .or(`email.ilike.%${q}%,empresa.ilike.%${q}%,razon_social.ilike.%${q}%,nit.ilike.%${q}%`)
          .limit(5);
        if (fallback?.length) {
          const lines = fallback.map((c: any) =>
            `- **${c.nombre}** (id: ${c.id}, código: ${c.codigo ?? 'N/A'}, tipo: ${c.tipo ?? 'N/A'})\n  Email: ${c.email ?? 'N/A'} | Tel: ${c.telefono ?? 'N/A'} | DPI: ${c.dpi ?? 'N/A'} | NIT: ${c.nit ?? 'N/A'}\n  Empresa: ${c.empresa ?? 'N/A'} | Rep. legal: ${c.representante_legal ?? 'N/A'} | Dir: ${c.direccion ?? 'N/A'}\n  Razón social: ${c.razon_social ?? 'N/A'} | NIT fact: ${c.nit_facturacion ?? 'N/A'} | Dir fact: ${c.direccion_facturacion ?? 'N/A'}${c.notas ? `\n  Notas: ${c.notas}` : ''}`
          );
          return `${fallback.length} cliente(s) encontrado(s):\n${lines.join('\n\n')}`;
        }
      }

      if (error) throw new Error(`Error al buscar: ${error.message}`);
      if (!data?.length) return `No se encontraron clientes con "${busqueda}".`;

      const lines = data.map((c: any) =>
        `- **${c.nombre}** (id: ${c.id}, código: ${c.codigo ?? 'N/A'}, tipo: ${c.tipo ?? 'N/A'})\n  Email: ${c.email ?? 'N/A'} | Tel: ${c.telefono ?? 'N/A'} | DPI: ${c.dpi ?? 'N/A'} | NIT: ${c.nit ?? 'N/A'}\n  Empresa: ${c.empresa ?? 'N/A'} | Rep. legal: ${c.representante_legal ?? 'N/A'} | Dir: ${c.direccion ?? 'N/A'}\n  Razón social: ${c.razon_social ?? 'N/A'} | NIT fact: ${c.nit_facturacion ?? 'N/A'} | Dir fact: ${c.direccion_facturacion ?? 'N/A'}${c.notas ? `\n  Notas: ${c.notas}` : ''}`
      );
      return `${data.length} cliente(s) encontrado(s):\n${lines.join('\n\n')}`;
    }

    case 'actualizar': {
      if (!clienteId) throw new Error('Se requiere cliente_id (UUID) para actualizar');
      if (!datos || Object.keys(datos).length === 0) throw new Error('Se requiere al menos un campo en datos para actualizar');

      const allowed = ['nombre', 'email', 'telefono', 'nit', 'dpi', 'empresa', 'direccion', 'razon_social', 'representante_legal', 'nit_facturacion', 'direccion_facturacion', 'notas', 'tipo', 'estado', 'fuente'];
      const payload: any = {};
      for (const key of allowed) {
        if (datos[key] !== undefined) payload[key] = datos[key];
      }

      if (Object.keys(payload).length === 0) throw new Error('Ningún campo válido para actualizar');

      const { data, error } = await db
        .from('clientes')
        .update(payload)
        .eq('id', clienteId)
        .select('id, codigo, nombre, email, telefono, dpi, nit, empresa, representante_legal, direccion, razon_social, nit_facturacion, direccion_facturacion')
        .single();

      if (error) throw new Error(`Error al actualizar: ${error.message}`);
      if (!data) throw new Error('Cliente no encontrado');

      const cambios = Object.keys(payload).map((k: string) => `${k}: ${payload[k]}`).join(', ');
      return `Cliente actualizado: **${data.nombre}** — Cambios: ${cambios}`;
    }

    case 'crear': {
      if (!datos?.nombre?.trim()) throw new Error('Se requiere al menos el nombre del cliente');

      const allowed = ['nombre', 'email', 'telefono', 'nit', 'dpi', 'empresa', 'direccion', 'razon_social', 'representante_legal', 'nit_facturacion', 'direccion_facturacion', 'notas', 'tipo', 'fuente'];
      const payload: any = {};
      for (const key of allowed) {
        if (datos[key] !== undefined) payload[key] = datos[key];
      }

      const { data, error } = await db
        .from('clientes')
        .insert(payload)
        .select('id, codigo, nombre, email, telefono, nit')
        .single();

      if (error) throw new Error(`Error al crear cliente: ${error.message}`);
      return `Cliente creado: **${data.nombre}** (id: ${data.id}, código: ${data.codigo ?? 'N/A'}) — Email: ${data.email ?? 'N/A'}, Tel: ${data.telefono ?? 'N/A'}, NIT: ${data.nit ?? 'N/A'}`;
    }

    default:
      throw new Error(`Acción no reconocida: ${accion}. Acciones válidas: buscar, actualizar, crear`);
  }
}

// ── Gestionar cobros ─────────────────────────────────────────────────────

async function handleGestionarCobros(
  accion: string,
  datos: any,
): Promise<string> {
  const db = createAdminClient();

  switch (accion) {
    case 'crear_cobro': {
      // Resolve client name → ID
      let clienteId = datos.cliente_id;
      if (clienteId && !/^[0-9a-f]{8}-/i.test(clienteId)) {
        const contactos = await buscarContacto(db, clienteId, 1);
        if (contactos.length) {
          clienteId = contactos[0].id;
        } else {
          throw new CobroError(`Contacto no encontrado: "${datos.cliente_id}"`);
        }
      }

      const cobro = await crearCobro({
        cliente_id: clienteId,
        concepto: datos.concepto,
        monto: datos.monto,
        descripcion: datos.descripcion,
        dias_credito: datos.dias_credito,
        expediente_id: datos.expediente_id,
        notas: datos.notas,
      });

      // Auto-send solicitud de pago
      let emailResult = '';
      try {
        emailResult = await enviarSolicitudPago(cobro.id);
        emailResult = ` ${emailResult}`;
      } catch (_) {
        emailResult = ' (No se pudo enviar email — cliente sin email o error de envío)';
      }

      return `Cobro creado: COB-${cobro.numero_cobro} — Q${cobro.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} — ${datos.concepto}.${emailResult}`;
    }

    case 'listar_cobros': {
      const result = await listarCobros({
        estado: datos.estado,
        cliente_id: datos.cliente_id,
        busqueda: datos.busqueda,
        limit: 20,
      });

      if (result.data.length === 0) {
        return 'No se encontraron cobros con esos filtros.';
      }

      const lines = result.data.map((c: any) => {
        const cliente = c.cliente?.nombre ?? 'Sin cliente';
        const venc = c.fecha_vencimiento ?? 'sin vencimiento';
        return `- **COB-${c.numero_cobro}** ${cliente} — ${c.concepto} — Q${c.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (pagado: Q${c.monto_pagado.toLocaleString('es-GT', { minimumFractionDigits: 2 })}, saldo: Q${c.saldo_pendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })}) — ${c.estado} — vence: ${venc} (id: ${c.id})`;
      });

      return `${result.total} cobro(s) encontrado(s):\n${lines.join('\n')}`;
    }

    case 'registrar_pago': {
      if (!datos.cobro_id) throw new CobroError('Se requiere cobro_id para registrar pago');
      if (!datos.monto || datos.monto <= 0) throw new CobroError('Se requiere monto mayor a 0');

      const { pago, cobro } = await registrarPagoCobro({
        cobro_id: datos.cobro_id,
        monto: datos.monto,
        metodo: datos.metodo ?? 'transferencia_gyt',
        referencia_bancaria: datos.referencia_bancaria,
        fecha_pago: datos.fecha_pago,
        notas: datos.notas,
      });

      return `Pago registrado: Q${datos.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })} en COB-${cobro.numero_cobro}. Nuevo saldo: Q${cobro.saldo_pendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })}. Estado: ${cobro.estado}.`;
    }

    case 'enviar_recordatorio': {
      if (!datos.cobro_id) throw new CobroError('Se requiere cobro_id para enviar recordatorio');
      const result = await enviarSolicitudPago(datos.cobro_id);
      return result;
    }

    case 'resumen_cobros': {
      const r = await resumenCobros();
      return `Resumen de cobros:
- **Total pendiente**: Q${r.total_pendiente.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${r.count_pendientes} cobros)
- **Vencidos**: Q${r.total_vencido.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${r.count_vencidos} cobros)
- **Por vencer (7 días)**: Q${r.por_vencer_7d.toLocaleString('es-GT', { minimumFractionDigits: 2 })} (${r.count_por_vencer} cobros)
- **Cobrado este mes**: Q${r.cobrado_mes.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
    }

    default:
      throw new CobroError(`Acción no reconocida: ${accion}. Acciones válidas: crear_cobro, listar_cobros, registrar_pago, enviar_recordatorio, resumen_cobros`);
  }
}

// ── Crear cotización completa (BD + PDF + email) ──────────────────────────

async function handleCrearCotizacionCompleta(
  clienteId: string,
  items: Array<{ servicio: string; cantidad: number; precio_unitario: number }>,
  notas?: string,
  enviarPorCorreo?: boolean,
): Promise<string> {
  const db = createAdminClient();

  // 1. Resolve client
  let cliente: any;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);

  if (isUUID) {
    const { data, error } = await db.from('clientes').select('id, nombre, email, nit').eq('id', clienteId).single();
    if (error || !data) throw new Error(`Cliente no encontrado con ID: ${clienteId}`);
    cliente = data;
  } else {
    const contactos = await buscarContacto(db, clienteId, 1);
    if (!contactos.length) throw new Error(`Contacto no encontrado: "${clienteId}"`);
    cliente = contactos[0];
    cliente.nit = await fetchContactoNit(db, cliente);
  }

  // 2. Create cotizacion in DB (reuses existing service: numero, IVA, anticipo, conditions)
  const cotizacionItems = items.map((item, idx) => ({
    descripcion: item.servicio,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
    orden: idx,
  }));

  const cotizacion = await crearCotizacion({
    cliente_id: cliente.id,
    items: cotizacionItems,
    notas_internas: notas ?? null,
  });

  console.log('[AI] Cotización creada:', cotizacion.numero, '— cliente:', cliente.nombre);

  // 3. Fetch full cotizacion with client join + items (for PDF)
  const cotizacionCompleta = await obtenerCotizacion(cotizacion.id);
  const config = await obtenerConfigCotizacion();

  // 4. Generate PDF
  const pdfBuffer = await generarPDFCotizacion(cotizacionCompleta, config);
  console.log('[AI] PDF generado:', (pdfBuffer.length / 1024).toFixed(0), 'KB');

  // 5. Upload to Storage
  const storage = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const storagePath = `cotizaciones/${cotizacion.numero}.pdf`;

  const { error: uploadError } = await storage.storage
    .from('documentos')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw new Error(`Error al subir PDF: ${uploadError.message}`);
  console.log('[AI] PDF subido:', storagePath);

  // 6. Update pdf_url
  await db.from('cotizaciones').update({
    pdf_url: storagePath,
    updated_at: new Date().toISOString(),
  }).eq('id', cotizacion.id);

  // 7. Generate signed URL for Molly's response
  const { data: signedData } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);
  const downloadUrl = signedData?.signedUrl ?? '';

  // 8. If enviar_por_correo: send email + mark as enviada
  let emailInfo = '';
  if (enviarPorCorreo) {
    if (!cliente.email) {
      emailInfo = ' ADVERTENCIA: el cliente no tiene email registrado, no se envió.';
    } else {
      const serviciosEmail = cotizacionCompleta.items.map((item: any) => ({
        descripcion: item.descripcion,
        monto: item.total,
      }));

      let logoBase64: string | undefined;
      try {
        const LOGO_FILE = 'Logo_Amanda_Santizo_2021_Full_Color.png';
        const logoPath = path.resolve(process.cwd(), 'public', LOGO_FILE);
        // Path traversal guard: ensure resolved path stays inside public/
        if (!logoPath.startsWith(path.resolve(process.cwd(), 'public'))) {
          throw new Error('Invalid logo path');
        }
        logoBase64 = fs.readFileSync(logoPath).toString('base64');
      } catch { /* fallback to text */ }

      const emailTemplate = emailCotizacion({
        clienteNombre: cliente.nombre,
        servicios: serviciosEmail,
        subtotal: cotizacionCompleta.subtotal,
        iva: cotizacionCompleta.iva_monto,
        total: cotizacionCompleta.total,
        anticipo: cotizacionCompleta.anticipo_monto,
        vigencia: cotizacionCompleta.fecha_vencimiento,
        numeroCotizacion: cotizacion.numero,
        fechaEmision: cotizacionCompleta.fecha_emision,
        anticipoPorcentaje: cotizacionCompleta.anticipo_porcentaje,
        condiciones: cotizacionCompleta.condiciones ?? undefined,
        configuracion: config,
        logoBase64,
      });

      const pdfBase64 = pdfBuffer.toString('base64');

      await sendMail({
        from: emailTemplate.from,
        to: cliente.email,
        subject: `Cotización de Servicios No. ${cotizacion.numero} — Amanda Santizo Despacho Jurídico`,
        htmlBody: emailTemplate.html,
        cc: 'amanda@papeleo.legal',
        attachments: [{
          name: `${cotizacion.numero}.pdf`,
          contentType: 'application/pdf',
          contentBytes: pdfBase64,
        }],
      });

      // Mark as enviada
      await db.from('cotizaciones').update({
        estado: 'enviada',
        enviada_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', cotizacion.id);

      const emailMask = cliente.email.replace(/(.{2}).+(@.+)/, '$1***$2');
      emailInfo = ` Email enviado a ${cliente.nombre} (${emailMask}) desde contador@papeleo.legal con PDF adjunto.`;
      console.log('[AI] Cotización enviada por email a', emailMask);
    }
  }

  // 9. Return summary
  const totalFmt = `Q${cotizacionCompleta.total.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;
  const anticipoFmt = `Q${cotizacionCompleta.anticipo_monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

  let result = `Cotización creada: **${cotizacion.numero}** — Total: ${totalFmt} (anticipo ${cotizacionCompleta.anticipo_porcentaje}%: ${anticipoFmt}) — Cliente: ${cliente.nombre}. PDF generado.`;
  if (downloadUrl) {
    result += `\nDescargar PDF: ${downloadUrl}`;
  }
  result += emailInfo;
  return result;
}

// ── Consultar catálogo, plantillas y configuración ────────────────────────

// ── Búsqueda semántica de jurisprudencia ────────────────────────────────

async function handleBuscarJurisprudencia(
  consulta: string,
  limite: number = 10,
): Promise<string> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return 'Error: OPENAI_API_KEY no configurada en el servidor.';
  }

  // 1. Generate embedding for the query
  console.log('[AI] Jurisprudencia: generando embedding para', consulta.slice(0, 80));
  const embResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: consulta,
      dimensions: 1536,
    }),
  });

  if (!embResponse.ok) {
    const errText = await embResponse.text();
    console.error('[AI] OpenAI embedding error:', errText);
    return `Error generando embedding: ${embResponse.status}`;
  }

  const embData = await embResponse.json();
  const queryEmbedding = embData.data[0].embedding;

  // 2. Call Supabase RPC for semantic search
  const db = createAdminClient();
  // @ts-ignore
  const { data, error } = await db.schema('public').rpc('buscar_jurisprudencia', {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: limite,
    match_threshold: 0.3,
  });

  if (error) {
    console.error('[AI] Jurisprudencia RPC error:', error.message);
    return `Error buscando jurisprudencia: ${error.message}`;
  }

  if (!data?.length) {
    return `No se encontraron fragmentos de jurisprudencia relevantes para: "${consulta}". Es posible que los tomos aún no hayan sido procesados.`;
  }

  // 3. Format results
  let result = `Se encontraron ${data.length} fragmento(s) relevantes:\n\n`;
  for (let i = 0; i < data.length; i++) {
    const frag = data[i];
    const similarity = (frag.similarity * 100).toFixed(1);
    result += `### Resultado ${i + 1} (${similarity}% relevancia)\n`;
    result += `**Tomo:** ${frag.tomo_nombre} | **Páginas:** ${frag.pagina_inicio}-${frag.pagina_fin}\n\n`;
    result += `${frag.contenido}\n\n---\n\n`;
  }

  return result;
}

// ── Buscar emails en buzón ─────────────────────────────────────────────────

async function handleBuscarEmails(
  cuenta: MailboxAlias,
  busqueda: string,
  dias: number = 7,
): Promise<string> {
  console.log(`[AI] buscar_emails: cuenta=${cuenta}, q="${busqueda}", dias=${dias}`);
  const results = await searchEmails(cuenta, busqueda, dias);

  if (!results.length) {
    return JSON.stringify({
      mensaje: `No se encontraron emails en ${cuenta} con "${busqueda}" en los últimos ${dias} días.`,
      resultados: [],
    });
  }

  const formatted = results.map((m: any) => ({
    de: m.from?.emailAddress?.name
      ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
      : m.from?.emailAddress?.address ?? 'desconocido',
    asunto: m.subject ?? '(Sin asunto)',
    fecha: m.receivedDateTime?.substring(0, 16) ?? '',
    preview: (m.bodyPreview ?? '').substring(0, 200),
    conversationId: m.conversationId ?? null,
    tieneAdjuntos: m.hasAttachments ?? false,
  }));

  return JSON.stringify({
    mensaje: `${results.length} email(s) encontrados en ${cuenta}.`,
    resultados: formatted,
  });
}

// ── Leer hilo de email completo ───────────────────────────────────────────

async function handleLeerHiloEmail(
  cuenta: MailboxAlias,
  conversationId: string,
): Promise<string> {
  console.log(`[AI] leer_hilo_email: cuenta=${cuenta}, convId=${conversationId.substring(0, 30)}...`);
  const messages = await getConversationThread(cuenta, conversationId);

  if (!messages.length) {
    return JSON.stringify({
      mensaje: 'No se encontraron mensajes en este hilo.',
      mensajes: [],
    });
  }

  const formatted = messages.map((m: any) => {
    const bodyText = m.body?.content
      ? stripHtmlToText(m.body.content).substring(0, 2000)
      : m.bodyPreview ?? '';

    return {
      de: m.from?.emailAddress?.name
        ? `${m.from.emailAddress.name} <${m.from.emailAddress.address}>`
        : m.from?.emailAddress?.address ?? 'desconocido',
      para: (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address).join(', '),
      cc: (m.ccRecipients ?? []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(', ') || undefined,
      asunto: m.subject ?? '(Sin asunto)',
      fecha: m.receivedDateTime?.substring(0, 16) ?? '',
      texto: bodyText,
      tieneAdjuntos: m.hasAttachments ?? false,
    };
  });

  return JSON.stringify({
    mensaje: `Hilo con ${messages.length} mensaje(s). Asunto: "${messages[0].subject ?? '(Sin asunto)'}"`,
    mensajes: formatted,
  });
}

// ── Consultas legales (expedientes, mercantil, laboral, tribunales, etc.) ──

async function handleConsultarLegal(
  consulta: string,
  params: any,
): Promise<string> {
  const db = createAdminClient();

  // Helper: resolve client name → ID
  async function resolveClienteId(clienteRef: string): Promise<string | null> {
    if (/^[0-9a-f]{8}-/i.test(clienteRef)) return clienteRef;
    const contactos = await buscarContacto(db, clienteRef, 1);
    return contactos.length ? contactos[0].id : null;
  }

  switch (consulta) {
    // ── EXPEDIENTES ──────────────────────────────────────────────────────

    case 'expedientes_cliente': {
      let query = db
        .from('expedientes')
        .select('*, cliente:clientes!expedientes_cliente_id_fkey(id, codigo, nombre)')
        .order('updated_at', { ascending: false })
        .limit(25);

      if (params.cliente_id) {
        const cid = await resolveClienteId(params.cliente_id);
        if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;
        query = query.eq('cliente_id', cid);
      }
      if (params.estado) query = query.eq('estado', params.estado);
      if (params.origen) query = query.eq('origen', params.origen);
      if (params.tipo_proceso) query = query.eq('tipo_proceso', params.tipo_proceso);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No se encontraron expedientes con esos filtros.';

      const lines = data.map((e: any) => {
        const num = e.numero_expediente ?? e.numero_mp ?? e.numero_administrativo ?? 'S/N';
        const cliente = e.cliente?.nombre ?? 'Sin cliente';
        return `- **${num}** (${e.origen}) ${e.tipo_proceso} — ${e.fase_actual} — Estado: ${e.estado} — ${cliente}${e.tribunal_nombre ? ` — ${e.tribunal_nombre}` : ''}${e.departamento ? ` (${e.departamento})` : ''}`;
      });
      return `${data.length} expediente(s) encontrado(s):\n${lines.join('\n')}`;
    }

    case 'expedientes_buscar': {
      const q = params.busqueda?.trim();
      if (!q) return 'Se requiere parámetro busqueda.';

      // Search by number or text across multiple fields
      const { data, error } = await db
        .from('expedientes')
        .select('*, cliente:clientes!expedientes_cliente_id_fkey(id, codigo, nombre)')
        .or(`numero_expediente.ilike.%${q}%,numero_mp.ilike.%${q}%,numero_administrativo.ilike.%${q}%,descripcion.ilike.%${q}%,tribunal_nombre.ilike.%${q}%,actor.ilike.%${q}%,demandado.ilike.%${q}%,departamento.ilike.%${q}%,fiscalia.ilike.%${q}%,entidad_administrativa.ilike.%${q}%`)
        .order('updated_at', { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);
      if (!data?.length) return `No se encontraron expedientes para: "${q}".`;

      const lines = data.map((e: any) => {
        const num = e.numero_expediente ?? e.numero_mp ?? e.numero_administrativo ?? 'S/N';
        const cliente = e.cliente?.nombre ?? 'Sin cliente';
        return `- **${num}** (${e.origen}) ${e.tipo_proceso} — ${e.fase_actual} — ${e.estado} — ${cliente}${e.tribunal_nombre ? ` — ${e.tribunal_nombre}` : ''}${e.departamento ? ` (${e.departamento})` : ''}`;
      });
      return `${data.length} expediente(s) encontrado(s):\n${lines.join('\n')}`;
    }

    case 'plazos_proximos': {
      const dias = params.dias ?? 7;
      const hoy = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

      let query = db
        .from('plazos_procesales')
        .select('*, expediente:expedientes!plazos_procesales_expediente_id_fkey(id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, cliente:clientes!expedientes_cliente_id_fkey(nombre))')
        .eq('estado', 'pendiente')
        .gte('fecha_vencimiento', hoy)
        .lte('fecha_vencimiento', limite)
        .order('fecha_vencimiento', { ascending: true })
        .limit(30);

      if (params.cliente_id) {
        const cid = await resolveClienteId(params.cliente_id);
        if (cid) {
          // Filter through expediente's cliente_id
          const { data: expIds } = await db.from('expedientes').select('id').eq('cliente_id', cid);
          if (expIds?.length) {
            query = query.in('expediente_id', expIds.map((e: any) => e.id));
          } else {
            return `No se encontraron expedientes del cliente "${params.cliente_id}".`;
          }
        }
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return `No hay plazos pendientes en los próximos ${dias} días.`;

      const lines = data.map((p: any) => {
        const exp = p.expediente;
        const num = exp?.numero_expediente ?? exp?.numero_mp ?? exp?.numero_administrativo ?? 'S/N';
        const cliente = exp?.cliente?.nombre ?? '';
        const diasRestantes = Math.ceil((new Date(p.fecha_vencimiento).getTime() - Date.now()) / 86400000);
        return `- **${p.fecha_vencimiento}** (${diasRestantes}d) — ${p.tipo_plazo}: ${p.descripcion} — Exp: ${num}${cliente ? ` (${cliente})` : ''}`;
      });
      return `${data.length} plazo(s) pendiente(s) en los próximos ${dias} días:\n${lines.join('\n')}`;
    }

    case 'actuaciones_expediente': {
      if (!params.expediente_id) return 'Se requiere expediente_id.';
      const { data, error } = await db
        .from('actuaciones_procesales')
        .select('*')
        .eq('expediente_id', params.expediente_id)
        .order('fecha', { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);
      if (!data?.length) return 'No hay actuaciones registradas para este expediente.';

      const lines = data.map((a: any) =>
        `- **${a.fecha}** [${a.sede}] ${a.tipo} — ${a.descripcion} (${a.realizado_por})`
      );
      return `${data.length} actuación(es):\n${lines.join('\n')}`;
    }

    case 'expedientes_vinculados': {
      if (!params.expediente_id) return 'Se requiere expediente_id.';
      const { data, error } = await db
        .from('expedientes_vinculados')
        .select('*, expediente_destino:expedientes!expedientes_vinculados_expediente_destino_id_fkey(id, numero_expediente, numero_mp, numero_administrativo, origen, tipo_proceso, estado)')
        .eq('expediente_origen_id', params.expediente_id)
        .limit(20);

      if (error) throw new Error(error.message);
      if (!data?.length) return 'No hay expedientes vinculados.';

      const lines = data.map((v: any) => {
        const dest = v.expediente_destino;
        const num = dest?.numero_expediente ?? dest?.numero_mp ?? dest?.numero_administrativo ?? 'S/N';
        return `- ${v.tipo_vinculo}: **${num}** (${dest?.origen}) ${dest?.tipo_proceso} — ${dest?.estado}${v.descripcion ? ` — ${v.descripcion}` : ''}`;
      });
      return `${data.length} expediente(s) vinculado(s):\n${lines.join('\n')}`;
    }

    case 'expedientes_resumen': {
      const [byEstado, byOrigen, byTipo, total] = await Promise.all([
        db.from('expedientes').select('estado'),
        db.from('expedientes').select('origen'),
        db.from('expedientes').select('tipo_proceso'),
        db.from('expedientes').select('id', { count: 'exact', head: true }),
      ]);

      const estados: Record<string, number> = {};
      for (const r of byEstado.data ?? []) estados[r.estado] = (estados[r.estado] ?? 0) + 1;
      const origenes: Record<string, number> = {};
      for (const r of byOrigen.data ?? []) origenes[r.origen] = (origenes[r.origen] ?? 0) + 1;
      const tipos: Record<string, number> = {};
      for (const r of byTipo.data ?? []) tipos[r.tipo_proceso] = (tipos[r.tipo_proceso] ?? 0) + 1;

      let result = `**Total expedientes:** ${total.count ?? 0}\n\n`;
      result += `**Por estado:**\n${Object.entries(estados).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
      result += `**Por origen:**\n${Object.entries(origenes).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
      result += `**Por tipo de proceso:**\n${Object.entries(tipos).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
      return result;
    }

    // ── MERCANTIL ────────────────────────────────────────────────────────

    case 'mercantil_cliente': {
      let query = db
        .from('tramites_mercantiles')
        .select('*, cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre)')
        .order('updated_at', { ascending: false })
        .limit(25);

      if (params.cliente_id) {
        const cid = await resolveClienteId(params.cliente_id);
        if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;
        query = query.eq('cliente_id', cid);
      }
      if (params.categoria) query = query.eq('categoria', params.categoria);
      if (params.estado) query = query.eq('estado', params.estado);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No se encontraron trámites mercantiles con esos filtros.';

      const lines = data.map((t: any) => {
        const cliente = t.cliente?.nombre ?? 'Sin cliente';
        return `- **${t.categoria}** ${t.subtipo ? `(${t.subtipo})` : ''} — Estado: ${t.estado} — ${cliente}${t.numero_registro ? ` — Reg: ${t.numero_registro}` : ''}${t.fecha_vencimiento ? ` — Vence: ${t.fecha_vencimiento}` : ''}`;
      });
      return `${data.length} trámite(s) mercantil(es):\n${lines.join('\n')}`;
    }

    case 'mercantil_por_vencer': {
      const dias = params.dias ?? 30;
      const hoy = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

      const { data, error } = await db
        .from('tramites_mercantiles')
        .select('*, cliente:clientes!tramites_mercantiles_cliente_id_fkey(id, codigo, nombre)')
        .in('estado', ['vigente', 'inscrito'])
        .not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', hoy)
        .lte('fecha_vencimiento', limite)
        .order('fecha_vencimiento', { ascending: true });

      if (error) throw new Error(error.message);
      if (!data?.length) return `No hay trámites mercantiles por vencer en los próximos ${dias} días.`;

      const lines = data.map((t: any) => {
        const diasR = Math.ceil((new Date(t.fecha_vencimiento).getTime() - Date.now()) / 86400000);
        return `- **${t.categoria}** — ${t.cliente?.nombre} — Vence: ${t.fecha_vencimiento} (${diasR}d)${t.numero_registro ? ` — Reg: ${t.numero_registro}` : ''}`;
      });
      return `${data.length} trámite(s) mercantil(es) por vencer:\n${lines.join('\n')}`;
    }

    case 'mercantil_asambleas_pendientes': {
      const anio = new Date().getFullYear();
      const inicioAnio = `${anio}-01-01`;
      const finAnio = `${anio}-12-31`;

      // Get all companies (type empresa)
      const { data: empresas } = await db
        .from('clientes')
        .select('id, nombre, codigo')
        .eq('tipo', 'empresa')
        .eq('estado', 'activo');

      if (!empresas?.length) return 'No hay empresas activas registradas.';

      // Get companies that HAVE had an asamblea_ordinaria this year
      const { data: conAsamblea } = await db
        .from('tramites_mercantiles')
        .select('cliente_id')
        .eq('categoria', 'asamblea_ordinaria')
        .gte('fecha_tramite', inicioAnio)
        .lte('fecha_tramite', finAnio);

      const clientesConAsamblea = new Set((conAsamblea ?? []).map((t: any) => t.cliente_id));
      const sinAsamblea = empresas.filter((e: any) => !clientesConAsamblea.has(e.id));

      if (!sinAsamblea.length) return `Todas las empresas activas ya celebraron asamblea ordinaria en ${anio}.`;

      const lines = sinAsamblea.map((e: any) => `- **${e.nombre}** (${e.codigo})`);
      return `${sinAsamblea.length} empresa(s) SIN asamblea ordinaria en ${anio}:\n${lines.join('\n')}`;
    }

    case 'mercantil_resumen': {
      const [byEstado, byCategoria, total] = await Promise.all([
        db.from('tramites_mercantiles').select('estado'),
        db.from('tramites_mercantiles').select('categoria'),
        db.from('tramites_mercantiles').select('id', { count: 'exact', head: true }),
      ]);

      const estados: Record<string, number> = {};
      for (const r of byEstado.data ?? []) estados[r.estado] = (estados[r.estado] ?? 0) + 1;
      const categorias: Record<string, number> = {};
      for (const r of byCategoria.data ?? []) categorias[r.categoria] = (categorias[r.categoria] ?? 0) + 1;

      const hoy = new Date().toISOString().slice(0, 10);
      const limite30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { count: porVencer } = await db.from('tramites_mercantiles').select('id', { count: 'exact', head: true })
        .in('estado', ['vigente', 'inscrito']).not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', hoy).lte('fecha_vencimiento', limite30);
      const { count: vencidos } = await db.from('tramites_mercantiles').select('id', { count: 'exact', head: true })
        .not('fecha_vencimiento', 'is', null).lt('fecha_vencimiento', hoy).in('estado', ['vigente', 'inscrito']);

      let result = `**Total trámites mercantiles:** ${total.count ?? 0}\n`;
      result += `**Por vencer (30d):** ${porVencer ?? 0} | **Vencidos:** ${vencidos ?? 0}\n\n`;
      result += `**Por estado:**\n${Object.entries(estados).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
      result += `**Por categoría:**\n${Object.entries(categorias).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
      return result;
    }

    // ── LABORAL ──────────────────────────────────────────────────────────

    case 'laboral_cliente': {
      let query = db
        .from('tramites_laborales')
        .select('*, cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre)')
        .order('updated_at', { ascending: false })
        .limit(25);

      if (params.cliente_id) {
        const cid = await resolveClienteId(params.cliente_id);
        if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;
        query = query.eq('cliente_id', cid);
      }
      if (params.categoria) query = query.eq('categoria', params.categoria);
      if (params.estado) query = query.eq('estado', params.estado);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No se encontraron trámites laborales con esos filtros.';

      const lines = data.map((t: any) => {
        const cliente = t.cliente?.nombre ?? 'Sin cliente';
        return `- **${t.categoria}** — ${cliente}${t.nombre_empleado ? ` — ${t.nombre_empleado}` : ''}${t.puesto ? ` (${t.puesto})` : ''} — Estado: ${t.estado}${t.fecha_fin ? ` — Vence: ${t.fecha_fin}` : ''}${t.numero_registro_igt ? ` — IGT: ${t.numero_registro_igt}` : ''}`;
      });
      return `${data.length} trámite(s) laboral(es):\n${lines.join('\n')}`;
    }

    case 'laboral_por_vencer': {
      const dias = params.dias ?? 30;
      const hoy = new Date().toISOString().slice(0, 10);
      const limite = new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

      const { data, error } = await db
        .from('tramites_laborales')
        .select('*, cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre)')
        .in('estado', ['vigente', 'registrado', 'firmado'])
        .not('fecha_fin', 'is', null)
        .gte('fecha_fin', hoy)
        .lte('fecha_fin', limite)
        .order('fecha_fin', { ascending: true });

      if (error) throw new Error(error.message);
      if (!data?.length) return `No hay contratos laborales por vencer en los próximos ${dias} días.`;

      const lines = data.map((t: any) => {
        const diasR = Math.ceil((new Date(t.fecha_fin).getTime() - Date.now()) / 86400000);
        return `- **${t.categoria}** — ${t.cliente?.nombre}${t.nombre_empleado ? ` — ${t.nombre_empleado}` : ''} — Vence: ${t.fecha_fin} (${diasR}d)`;
      });
      return `${data.length} contrato(s) por vencer:\n${lines.join('\n')}`;
    }

    case 'laboral_pendientes_igt': {
      let query = db
        .from('tramites_laborales')
        .select('*, cliente:clientes!tramites_laborales_cliente_id_fkey(id, codigo, nombre)')
        .in('categoria', ['contrato_individual', 'contrato_temporal', 'registro_contrato_igt', 'reglamento_interno'])
        .is('numero_registro_igt', null)
        .not('estado', 'in', '("cancelado","vencido")')
        .order('created_at', { ascending: false });

      if (params.cliente_id) {
        const cid = await resolveClienteId(params.cliente_id);
        if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;
        query = query.eq('cliente_id', cid);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No hay contratos pendientes de registro en la IGT.';

      const lines = data.map((t: any) =>
        `- **${t.categoria}** — ${t.cliente?.nombre}${t.nombre_empleado ? ` — ${t.nombre_empleado}` : ''} — Estado: ${t.estado}`
      );
      return `${data.length} contrato(s) pendiente(s) de registro IGT:\n${lines.join('\n')}`;
    }

    case 'laboral_reglamento_vigente': {
      if (!params.cliente_id) return 'Se requiere cliente_id.';
      const cid = await resolveClienteId(params.cliente_id);
      if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;

      const { data, error } = await db
        .from('tramites_laborales')
        .select('*')
        .eq('cliente_id', cid)
        .eq('categoria', 'reglamento_interno')
        .in('estado', ['vigente', 'registrado'])
        .limit(1);

      if (error) throw new Error(error.message);
      if (!data?.length) return `La empresa NO tiene reglamento interno vigente registrado.`;
      const r = data[0];
      return `La empresa SÍ tiene reglamento interno vigente. Estado: ${r.estado}${r.numero_registro_igt ? ` — Registro IGT: ${r.numero_registro_igt}` : ''}${r.fecha_registro_igt ? ` — Registrado: ${r.fecha_registro_igt}` : ''}`;
    }

    case 'laboral_libro_salarios': {
      if (!params.cliente_id) return 'Se requiere cliente_id.';
      const cid = await resolveClienteId(params.cliente_id);
      if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;

      const { data, error } = await db
        .from('tramites_laborales')
        .select('*')
        .eq('cliente_id', cid)
        .eq('categoria', 'libro_salarios')
        .in('estado', ['vigente', 'registrado'])
        .limit(1);

      if (error) throw new Error(error.message);
      if (!data?.length) return `La empresa NO tiene libro de salarios autorizado registrado.`;
      const r = data[0];
      return `La empresa SÍ tiene libro de salarios autorizado. Estado: ${r.estado}${r.numero_registro_igt ? ` — Registro: ${r.numero_registro_igt}` : ''}`;
    }

    case 'laboral_resumen': {
      const [byEstado, byCategoria, total] = await Promise.all([
        db.from('tramites_laborales').select('estado'),
        db.from('tramites_laborales').select('categoria'),
        db.from('tramites_laborales').select('id', { count: 'exact', head: true }),
      ]);

      const estados: Record<string, number> = {};
      for (const r of byEstado.data ?? []) estados[r.estado] = (estados[r.estado] ?? 0) + 1;
      const categorias: Record<string, number> = {};
      for (const r of byCategoria.data ?? []) categorias[r.categoria] = (categorias[r.categoria] ?? 0) + 1;

      const hoy = new Date().toISOString().slice(0, 10);
      const limite30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const { count: porVencer } = await db.from('tramites_laborales').select('id', { count: 'exact', head: true })
        .in('estado', ['vigente', 'registrado', 'firmado']).not('fecha_fin', 'is', null)
        .gte('fecha_fin', hoy).lte('fecha_fin', limite30);
      const { count: vencidos } = await db.from('tramites_laborales').select('id', { count: 'exact', head: true })
        .not('fecha_fin', 'is', null).lt('fecha_fin', hoy).in('estado', ['vigente', 'registrado', 'firmado']);

      let result = `**Total trámites laborales:** ${total.count ?? 0}\n`;
      result += `**Por vencer (30d):** ${porVencer ?? 0} | **Vencidos:** ${vencidos ?? 0}\n\n`;
      result += `**Por estado:**\n${Object.entries(estados).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\n`;
      result += `**Por categoría:**\n${Object.entries(categorias).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
      return result;
    }

    // ── TRIBUNALES ───────────────────────────────────────────────────────

    case 'tribunales_buscar': {
      let query = db.from('tribunales_oj').select('*').limit(20);

      if (params.busqueda) query = query.ilike('nombre', `%${params.busqueda}%`);
      if (params.departamento) query = query.ilike('departamento', `%${params.departamento}%`);
      if (params.tipo) query = query.eq('tipo', params.tipo);
      if (params.ramo) query = query.ilike('ramo', `%${params.ramo}%`);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No se encontraron tribunales con esos filtros.';

      const lines = data.map((t: any) =>
        `- **${t.nombre}** (${t.tipo}) — ${t.departamento}${t.municipio ? `, ${t.municipio}` : ''}${t.ramo ? ` — Ramo: ${t.ramo}` : ''}${t.telefono ? ` — Tel: ${t.telefono}` : ''}${t.direccion ? ` — Dir: ${t.direccion}` : ''}`
      );
      return `${data.length} tribunal(es) encontrado(s):\n${lines.join('\n')}`;
    }

    // ── FISCALÍAS ────────────────────────────────────────────────────────

    case 'fiscalias_buscar': {
      let query = db.from('fiscalias_mp').select('*').limit(20);

      if (params.busqueda) query = query.ilike('nombre', `%${params.busqueda}%`);
      if (params.departamento) query = query.ilike('departamento', `%${params.departamento}%`);
      if (params.tipo) query = query.ilike('tipo', `%${params.tipo}%`);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return 'No se encontraron fiscalías con esos filtros.';

      const lines = data.map((f: any) =>
        `- **${f.nombre}** — ${f.departamento}${f.municipio ? `, ${f.municipio}` : ''}${f.tipo ? ` — Tipo: ${f.tipo}` : ''}${f.telefono_extension ? ` — Tel/Ext: ${f.telefono_extension}` : ''}${f.direccion ? ` — Dir: ${f.direccion}` : ''}`
      );
      return `${data.length} fiscalía(s) encontrada(s):\n${lines.join('\n')}`;
    }

    // ── REPRESENTANTES Y GRUPO EMPRESARIAL ───────────────────────────────

    case 'representantes_empresa': {
      if (!params.cliente_id) return 'Se requiere cliente_id.';
      const cid = await resolveClienteId(params.cliente_id);
      if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;

      const { data, error } = await db
        .from('empresa_representante')
        .select('*, representante:representantes_legales!empresa_representante_representante_id_fkey(id, nombre_completo, email, telefono)')
        .eq('empresa_id', cid);

      if (error) throw new Error(error.message);
      if (!data?.length) return 'No hay representantes legales registrados para esta empresa.';

      const CARGO_MAP: Record<string, string> = {
        administrador_unico: 'Administrador Único',
        presidente_consejo: 'Presidente del Consejo',
        gerente_general: 'Gerente General',
        gerente_operativo: 'Gerente Operativo',
      };

      const lines = data.map((er: any) => {
        const r = er.representante;
        return `- **${r.nombre_completo}** — ${CARGO_MAP[er.cargo] ?? er.cargo}${r.email ? ` — ${r.email}` : ''}${r.telefono ? ` — ${r.telefono}` : ''}`;
      });
      return `${data.length} representante(s) legal(es):\n${lines.join('\n')}`;
    }

    case 'grupo_empresarial': {
      if (!params.cliente_id) return 'Se requiere cliente_id.';
      const cid = await resolveClienteId(params.cliente_id);
      if (!cid) return `No se encontró cliente: "${params.cliente_id}"`;

      // Check if client has grupo_empresarial_id
      const { data: cliente } = await db.from('clientes').select('id, nombre, grupo_empresarial_id').eq('id', cid).single();
      if (!cliente) return 'Cliente no encontrado.';

      if (cliente.grupo_empresarial_id) {
        // Get all companies in the same group
        const { data: grupo } = await db.from('grupo_empresarial').select('id, nombre').eq('id', cliente.grupo_empresarial_id).single();
        const { data: empresas } = await db.from('clientes').select('id, codigo, nombre').eq('grupo_empresarial_id', cliente.grupo_empresarial_id);

        if (empresas?.length) {
          const lines = empresas.map((e: any) => `- **${e.nombre}** (${e.codigo})`);
          return `Grupo empresarial: **${grupo?.nombre ?? 'Sin nombre'}**\n${empresas.length} empresa(s):\n${lines.join('\n')}`;
        }
      }

      // Fallback: find companies sharing representatives
      const { data: reps } = await db
        .from('empresa_representante')
        .select('representante_id')
        .eq('empresa_id', cid);

      if (!reps?.length) return 'Esta empresa no tiene representantes legales registrados ni grupo empresarial asignado.';

      const repIds = reps.map((r: any) => r.representante_id);
      const { data: otrasEmpresas } = await db
        .from('empresa_representante')
        .select('empresa:clientes!empresa_representante_empresa_id_fkey(id, codigo, nombre), representante:representantes_legales!empresa_representante_representante_id_fkey(nombre_completo), cargo')
        .in('representante_id', repIds);

      if (!otrasEmpresas?.length) return 'No se encontraron otras empresas que compartan representante legal.';

      // Deduplicate by empresa
      const empresasMap = new Map<string, { nombre: string; codigo: string; reps: string[] }>();
      for (const er of otrasEmpresas) {
        const emp = (er as any).empresa;
        if (!emp) continue;
        if (!empresasMap.has(emp.id)) empresasMap.set(emp.id, { nombre: emp.nombre, codigo: emp.codigo, reps: [] });
        empresasMap.get(emp.id)!.reps.push((er as any).representante?.nombre_completo ?? '');
      }

      const lines = Array.from(empresasMap.values()).map(e =>
        `- **${e.nombre}** (${e.codigo}) — Rep: ${[...new Set(e.reps)].join(', ')}`
      );
      return `${empresasMap.size} empresa(s) vinculada(s) por representante legal:\n${lines.join('\n')}`;
    }

    case 'empresas_representante': {
      if (!params.busqueda) return 'Se requiere busqueda (nombre del representante).';
      const { data, error } = await db
        .from('representantes_legales')
        .select('id, nombre_completo')
        .ilike('nombre_completo', `%${params.busqueda}%`)
        .limit(3);

      if (error) throw new Error(error.message);
      if (!data?.length) return `No se encontró representante: "${params.busqueda}"`;

      let result = '';
      for (const rep of data) {
        const { data: empresas } = await db
          .from('empresa_representante')
          .select('cargo, empresa:clientes!empresa_representante_empresa_id_fkey(id, codigo, nombre)')
          .eq('representante_id', rep.id);

        const CARGO_MAP: Record<string, string> = {
          administrador_unico: 'Administrador Único',
          presidente_consejo: 'Presidente del Consejo',
          gerente_general: 'Gerente General',
          gerente_operativo: 'Gerente Operativo',
        };

        if (empresas?.length) {
          const lines = empresas.map((er: any) => `  - ${(er as any).empresa?.nombre} (${(er as any).empresa?.codigo}) — ${CARGO_MAP[er.cargo] ?? er.cargo}`);
          result += `**${rep.nombre_completo}** — ${empresas.length} empresa(s):\n${lines.join('\n')}\n\n`;
        }
      }
      return result || 'No se encontraron empresas para ese representante.';
    }

    // ── BIBLIOTECA LEGAL ─────────────────────────────────────────────────

    case 'biblioteca_buscar': {
      let query = db.from('biblioteca_legal').select('*').limit(15);

      if (params.busqueda) query = query.or(`titulo.ilike.%${params.busqueda}%,descripcion.ilike.%${params.busqueda}%,tags.ilike.%${params.busqueda}%`);
      if (params.categoria) query = query.eq('categoria', params.categoria);

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return `No se encontraron documentos para: "${params.busqueda ?? 'todos'}".`;

      const lines = data.map((d: any) =>
        `- **${d.titulo}** (${d.categoria}) ${d.descripcion ? `— ${d.descripcion}` : ''}${d.storage_path ? ' [archivo disponible]' : ''}`
      );
      return `${data.length} documento(s) encontrado(s):\n${lines.join('\n')}`;
    }

    default:
      return `Consulta no reconocida: ${consulta}. Consultas disponibles: expedientes_cliente, expedientes_buscar, plazos_proximos, actuaciones_expediente, expedientes_vinculados, expedientes_resumen, mercantil_cliente, mercantil_por_vencer, mercantil_asambleas_pendientes, mercantil_resumen, laboral_cliente, laboral_por_vencer, laboral_pendientes_igt, laboral_reglamento_vigente, laboral_libro_salarios, laboral_resumen, tribunales_buscar, fiscalias_buscar, representantes_empresa, grupo_empresarial, empresas_representante, biblioteca_buscar`;
  }
}

async function handleConsultarCatalogo(
  consulta: 'catalogo_servicios' | 'plantilla_cotizacion' | 'plantilla_recordatorio_audiencia' | 'configuracion',
): Promise<string> {
  const db = createAdminClient();

  switch (consulta) {
    case 'catalogo_servicios': {
      const { data, error } = await db
        .from('catalogo_servicios')
        .select('codigo, categoria, servicio, precio_base, unidad, descripcion')
        .eq('activo', true)
        .order('categoria')
        .order('servicio');
      if (error) throw new Error(`Error consultando catálogo: ${error.message}`);
      if (!data?.length) return 'No hay servicios activos en el catálogo.';
      const byCategoria: Record<string, any[]> = {};
      for (const s of data) {
        const cat = s.categoria ?? 'Sin categoría';
        if (!byCategoria[cat]) byCategoria[cat] = [];
        byCategoria[cat].push(s);
      }
      let result = `Catálogo de servicios (${data.length} servicios activos):\n`;
      for (const [cat, servicios] of Object.entries(byCategoria)) {
        result += `\n### ${cat}\n`;
        for (const s of servicios) {
          result += `- **${s.servicio}** (${s.codigo}) — Q${Number(s.precio_base).toLocaleString('es-GT', { minimumFractionDigits: 2 })}${s.unidad ? ` / ${s.unidad}` : ''}${s.descripcion ? ` — ${s.descripcion}` : ''}\n`;
        }
      }
      return result;
    }

    case 'plantilla_cotizacion': {
      const { data, error } = await db
        .from('plantillas')
        .select('id, nombre, descripcion, campos, contenido')
        .eq('tipo', 'cotizacion')
        .eq('activa', true)
        .limit(1)
        .single();
      if (error || !data) return 'No hay plantilla de cotización activa.';
      return JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        descripcion: data.descripcion,
        campos: data.campos,
        contenido: data.contenido,
      });
    }

    case 'plantilla_recordatorio_audiencia': {
      const { data, error } = await db
        .from('plantillas')
        .select('id, nombre, descripcion, campos, contenido')
        .eq('tipo', 'recordatorio_audiencia')
        .eq('activa', true)
        .limit(1)
        .single();
      if (error || !data) return 'No hay plantilla de recordatorio de audiencia activa.';
      return JSON.stringify({
        id: data.id,
        nombre: data.nombre,
        descripcion: data.descripcion,
        campos: data.campos,
        contenido: data.contenido,
      });
    }

    case 'configuracion': {
      const { data, error } = await db
        .from('configuracion')
        .select('banco, tipo_cuenta, numero_cuenta, cuenta_nombre, email_contador, iva_porcentaje, direccion_despacho, telefono_despacho')
        .limit(1)
        .single();
      if (error || !data) return 'No se encontró configuración del despacho.';
      return JSON.stringify(data);
    }

    default:
      return `Consulta no reconocida: ${consulta}. Opciones: catalogo_servicios, plantilla_cotizacion, plantilla_recordatorio_audiencia, configuracion`;
  }
}

// ── API route ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages, attachment } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages array required' }, { status: 400 });
    }

    // If there's an attachment, enrich the last user message with file context
    if (attachment?.storagePath && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'user') {
        const sizeKB = Math.round((attachment.fileSize ?? 0) / 1024);
        let prefix = `[Archivo adjunto: ${attachment.fileName} (${sizeKB} KB) — Storage: ${attachment.storagePath}]`;
        if (attachment.textoExtraido) {
          prefix += `\n\nTexto extraído del PDF:\n${attachment.textoExtraido}`;
        }
        last.content = `${prefix}\n\n${last.content}`;
      }
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const tools: Anthropic.Tool[] = [
      {
        name: 'consultar_base_datos',
        description: 'Consulta datos del sistema IURISLEX. Queries disponibles: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_contacto:[nombre] (busca clientes Y proveedores)',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Tipo de consulta: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_contacto:[nombre] (busca en clientes y proveedores)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'generar_documento',
        description: 'Genera un documento legal en formato Word (.docx). Usa "tipo" para plantillas integradas o "plantilla_id" para plantillas personalizadas.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tipo: {
              type: 'string',
              enum: ['arrendamiento', 'laboral', 'agot', 'acta_notarial_certificacion', 'amparo', 'rendicion_cuentas', 'sumario_nulidad', 'oposicion_desestimacion'],
              description: 'Tipo de documento integrado (omitir si se usa plantilla_id)'
            },
            plantilla_id: {
              type: 'string',
              description: 'UUID de una plantilla personalizada (omitir si se usa tipo)'
            },
            datos: {
              type: 'object',
              description: 'Datos específicos para el documento. Los campos varían según el tipo o plantilla.'
            }
          },
          required: ['datos']
        }
      },
      {
        name: 'enviar_email',
        description: 'Envía un email usando los templates del despacho. Puede enviar a un cliente registrado (cliente_id) O a cualquier email (email_directo). El remitente se determina automáticamente según el tipo.',
        input_schema: {
          type: 'object' as const,
          properties: {
            tipo_email: {
              type: 'string',
              enum: [
                'confirmacion_cita',
                'recordatorio_cita',
                'solicitud_pago',
                'comprobante_pago',
                'cotizacion',
                'estado_cuenta',
                'factura',
                'documentos_disponibles',
                'actualizacion_expediente',
                'bienvenida_cliente',
                'solicitud_documentos',
                'aviso_audiencia',
                'personalizado',
              ],
              description: 'Tipo de email a enviar',
            },
            cliente_id: {
              type: 'string',
              description: 'UUID del cliente o nombre para buscar en la BD. Opcional si se usa email_directo.',
            },
            email_directo: {
              type: 'string',
              description: 'Email del destinatario (para personas no registradas como clientes). Opcional si se usa cliente_id.',
            },
            nombre_destinatario: {
              type: 'string',
              description: 'Nombre del destinatario (usado cuando se envía por email_directo). Opcional.',
            },
            datos: {
              type: 'object',
              description: 'Datos dinámicos según el tipo: monto, concepto, documentos, fecha, etc.',
            },
          },
          required: ['tipo_email'],
        },
      },
      {
        name: 'enviar_email_con_adjunto',
        description: 'Envía un email con un archivo adjunto (PDF, DOCX, imagen) desde asistente@papeleo.legal. Usar cuando Amanda pide enviar un archivo que adjuntó al chat.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cliente_id: {
              type: 'string',
              description: 'UUID del cliente o nombre para buscar en la BD. Opcional si se usa email_directo.',
            },
            email_directo: {
              type: 'string',
              description: 'Email del destinatario. Opcional si se usa cliente_id.',
            },
            nombre_destinatario: {
              type: 'string',
              description: 'Nombre del destinatario (cuando se usa email_directo).',
            },
            asunto: {
              type: 'string',
              description: 'Asunto del email.',
            },
            contenido_html: {
              type: 'string',
              description: 'Contenido HTML del email (opcional, se envuelve en template del despacho).',
            },
            archivo_url: {
              type: 'string',
              description: 'Ruta del archivo en Storage (molly-temp/...). Se obtiene del contexto del mensaje adjunto.',
            },
          },
          required: ['asunto', 'archivo_url'],
        },
      },
      {
        name: 'confirmar_pago',
        description: 'Registra y confirma un pago de un cliente en la base de datos, y envía comprobante de pago por email desde contador@papeleo.legal.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cliente_id: {
              type: 'string',
              description: 'UUID del cliente o nombre para buscar en la BD.',
            },
            monto: {
              type: 'number',
              description: 'Monto del pago en Quetzales.',
            },
            concepto: {
              type: 'string',
              description: 'Concepto o descripción del pago (ej: "Consulta legal", "Anticipo constitución de sociedad").',
            },
            metodo_pago: {
              type: 'string',
              enum: ['transferencia', 'deposito', 'efectivo', 'cheque'],
              description: 'Método de pago. Default: transferencia.',
            },
            referencia_bancaria: {
              type: 'string',
              description: 'Número de referencia o boleta del depósito/transferencia.',
            },
            fecha_pago: {
              type: 'string',
              description: 'Fecha del pago en formato YYYY-MM-DD. Default: hoy.',
            },
          },
          required: ['cliente_id', 'monto', 'concepto'],
        },
      },
      {
        name: 'gestionar_tareas',
        description: 'Gestiona la agenda/tareas del despacho (Bullet Journal). Acciones: crear, listar, completar, migrar.',
        input_schema: {
          type: 'object' as const,
          properties: {
            accion: {
              type: 'string',
              enum: ['crear', 'listar', 'completar', 'migrar'],
              description: 'Acción a realizar.',
            },
            datos: {
              type: 'object',
              description: 'Datos según la acción. Crear: titulo, descripcion, tipo, prioridad, fecha_limite, cliente_id, categoria, asignado_a, notas, accion_automatica. Para emails programados, accion_automatica DEBE incluir: {tipo:"enviar_email", template:"solicitud_pago|documentos_disponibles|aviso_audiencia|solicitud_documentos|personalizado", cliente_id:"UUID", email_directo:"email", nombre_destinatario:"nombre", datos:{campos obligatorios del template}}. Para template personalizado, datos DEBE incluir asunto (string) y contenido (string HTML del email). NUNCA dejar asunto o contenido vacíos. Listar: estado, prioridad, categoria, asignado_a, fecha ("hoy"), busqueda. Completar: tarea_id. Migrar: tarea_id, nueva_fecha.',
            },
          },
          required: ['accion', 'datos'],
        },
      },
      {
        name: 'gestionar_cobros',
        description: 'Gestiona cuentas por cobrar del despacho. Acciones: crear_cobro, listar_cobros, registrar_pago, enviar_recordatorio, resumen_cobros.',
        input_schema: {
          type: 'object' as const,
          properties: {
            accion: {
              type: 'string',
              enum: ['crear_cobro', 'listar_cobros', 'registrar_pago', 'enviar_recordatorio', 'resumen_cobros'],
              description: 'Acción a realizar.',
            },
            datos: {
              type: 'object',
              description: 'Datos según la acción. crear_cobro: cliente_id, concepto, monto, descripcion, dias_credito, expediente_id. listar_cobros: estado, cliente_id, busqueda. registrar_pago: cobro_id, monto, metodo, referencia_bancaria, fecha_pago. enviar_recordatorio: cobro_id. resumen_cobros: sin datos.',
            },
          },
          required: ['accion'],
        },
      },
      {
        name: 'gestionar_clientes',
        description: 'Buscar, actualizar y crear clientes en el sistema. Usar para cualquier operación con datos de clientes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            accion: {
              type: 'string',
              enum: ['buscar', 'actualizar', 'crear'],
              description: 'Acción a realizar.',
            },
            cliente_id: {
              type: 'string',
              description: 'UUID del cliente (requerido para actualizar).',
            },
            busqueda: {
              type: 'string',
              description: 'Texto para buscar en nombre, email, empresa, razon_social o NIT.',
            },
            datos: {
              type: 'object',
              description: 'Datos a actualizar o crear: nombre, email, telefono, nit, dpi, empresa, direccion, razon_social, representante_legal, nit_facturacion, direccion_facturacion, notas, tipo, estado, fuente.',
            },
          },
          required: ['accion'],
        },
      },
      {
        name: 'transcribir_documento',
        description: 'Transcribe un documento PDF a DOCX usando IA. Puede buscar el documento o transcribir por ID. Solo funciona con PDFs.',
        input_schema: {
          type: 'object' as const,
          properties: {
            accion: {
              type: 'string',
              enum: ['transcribir', 'buscar_pendientes'],
              description: 'transcribir: transcribe un PDF específico a DOCX. buscar_pendientes: lista PDFs disponibles para transcribir.',
            },
            documento_id: {
              type: 'string',
              description: 'UUID del documento a transcribir (para accion=transcribir).',
            },
            busqueda: {
              type: 'string',
              description: 'Texto para buscar el documento por nombre o título (alternativa a documento_id).',
            },
            formato: {
              type: 'string',
              enum: ['exacta', 'corregida', 'profesional'],
              description: 'exacta: palabra por palabra sin cambios. corregida: con corrección ortográfica. profesional: formateado profesionalmente. Default: exacta.',
            },
          },
          required: ['accion'],
        },
      },
      {
        name: 'consultar_catalogo',
        description: 'Consulta el catálogo de servicios, plantillas de documentos y configuración del despacho desde la base de datos. SIEMPRE usa esta herramienta antes de generar cotizaciones para obtener precios actualizados y datos bancarios correctos.',
        input_schema: {
          type: 'object' as const,
          properties: {
            consulta: {
              type: 'string',
              enum: ['catalogo_servicios', 'plantilla_cotizacion', 'plantilla_recordatorio_audiencia', 'configuracion'],
              description: 'Qué consultar: catalogo_servicios (precios y servicios del bufete), plantilla_cotizacion (estructura de cotización), plantilla_recordatorio_audiencia (plantilla para recordatorios), configuracion (datos bancarios, IVA, dirección del despacho).',
            },
          },
          required: ['consulta'],
        },
      },
      {
        name: 'crear_cotizacion_completa',
        description: 'Crea una cotización completa: registro en BD con número secuencial, cálculo de IVA y anticipo, generación de PDF profesional, y opcionalmente envío por correo electrónico con el PDF adjunto. SIEMPRE consulta consultar_catalogo("catalogo_servicios") ANTES de usar esta herramienta para obtener precios actualizados.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cliente_id: {
              type: 'string',
              description: 'UUID del cliente o nombre parcial para buscar. Si es nombre, se busca el cliente por coincidencia.',
            },
            items: {
              type: 'array',
              description: 'Lista de servicios a cotizar. Los precios son SIN IVA (el sistema agrega IVA 12% automáticamente).',
              items: {
                type: 'object',
                properties: {
                  servicio: { type: 'string', description: 'Nombre/descripción del servicio.' },
                  cantidad: { type: 'number', description: 'Cantidad de unidades. Default: 1.' },
                  precio_unitario: { type: 'number', description: 'Precio unitario SIN IVA en quetzales.' },
                },
                required: ['servicio', 'precio_unitario'],
              },
            },
            notas: {
              type: 'string',
              description: 'Notas internas opcionales para la cotización.',
            },
            enviar_por_correo: {
              type: 'boolean',
              description: 'Si es true, envía la cotización por correo electrónico al cliente con el PDF adjunto.',
            },
          },
          required: ['cliente_id', 'items'],
        },
      },
      {
        name: 'buscar_jurisprudencia',
        description: 'Busca en la base de jurisprudencia del despacho usando búsqueda semántica por embeddings. Devuelve fragmentos relevantes de tomos de jurisprudencia con referencias a tomo y páginas. Usar cuando Amanda pregunte sobre jurisprudencia, precedentes, criterios de tribunales o leyes.',
        input_schema: {
          type: 'object' as const,
          properties: {
            consulta: {
              type: 'string',
              description: 'La pregunta o tema a buscar en la jurisprudencia. Ej: "prescripción en materia mercantil", "nulidad de contrato por error".',
            },
            limite: {
              type: 'number',
              description: 'Máximo de fragmentos a devolver (default: 10).',
            },
          },
          required: ['consulta'],
        },
      },
      {
        name: 'buscar_emails',
        description: 'Busca emails en el buzón del despacho. Busca por texto libre, remitente, asunto, etc. Retorna lista de emails con preview (sin cuerpo completo). Usa leer_hilo_email para ver el hilo completo.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cuenta: {
              type: 'string',
              enum: ['asistente@papeleo.legal', 'contador@papeleo.legal', 'amanda@papeleo.legal'],
              description: 'Cuenta de email donde buscar.',
            },
            busqueda: {
              type: 'string',
              description: 'Texto de búsqueda. Puede ser texto libre, nombre de remitente, asunto, etc.',
            },
            dias: {
              type: 'number',
              description: 'Buscar en los últimos N días (default: 7).',
            },
          },
          required: ['cuenta', 'busqueda'],
        },
      },
      {
        name: 'leer_hilo_email',
        description: 'Lee el hilo completo de un email usando su conversationId. Retorna todos los mensajes del hilo con cuerpo completo en texto plano. Usar después de buscar_emails para ver el detalle.',
        input_schema: {
          type: 'object' as const,
          properties: {
            cuenta: {
              type: 'string',
              enum: ['asistente@papeleo.legal', 'contador@papeleo.legal', 'amanda@papeleo.legal'],
              description: 'Cuenta de email donde está el hilo.',
            },
            conversation_id: {
              type: 'string',
              description: 'El conversationId del email (obtenido de buscar_emails).',
            },
          },
          required: ['cuenta', 'conversation_id'],
        },
      },
      {
        name: 'consultar_legal',
        description: 'Consulta los módulos legales del sistema: expedientes judiciales/fiscales/administrativos, cumplimiento mercantil, cumplimiento laboral, directorios de tribunales y fiscalías, representantes legales, grupo empresarial, y biblioteca legal.',
        input_schema: {
          type: 'object' as const,
          properties: {
            consulta: {
              type: 'string',
              enum: [
                'expedientes_cliente', 'expedientes_buscar', 'plazos_proximos',
                'actuaciones_expediente', 'expedientes_vinculados', 'expedientes_resumen',
                'mercantil_cliente', 'mercantil_por_vencer', 'mercantil_asambleas_pendientes', 'mercantil_resumen',
                'laboral_cliente', 'laboral_por_vencer', 'laboral_pendientes_igt',
                'laboral_reglamento_vigente', 'laboral_libro_salarios', 'laboral_resumen',
                'tribunales_buscar', 'fiscalias_buscar',
                'representantes_empresa', 'grupo_empresarial', 'empresas_representante',
                'biblioteca_buscar',
              ],
              description: 'Tipo de consulta legal a realizar.',
            },
            params: {
              type: 'object',
              description: 'Parámetros de la consulta. Varían según el tipo: cliente_id (UUID o nombre), estado, origen, tipo_proceso, busqueda, dias, expediente_id, categoria, departamento, tipo, ramo.',
            },
          },
          required: ['consulta'],
        },
      },
    ];

    // ── Inyectar fecha actual al system prompt ──────────────────────────
    const hoyGT = new Date().toLocaleDateString('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const isoHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }); // YYYY-MM-DD

    // ── Inyectar plantillas custom al system prompt ─────────────────────
    let dynamicPrompt = SYSTEM_PROMPT + `\n\n## FECHA ACTUAL\nHoy es ${hoyGT} (${isoHoy}). Usa SIEMPRE esta fecha como referencia para calcular "mañana", "la próxima semana", fechas límite, vencimientos, etc. El año actual es ${new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' }).slice(0, 4)}.`;
    try {
      const customPlantillas = await listarPlantillasActivas();
      if (customPlantillas.length > 0) {
        dynamicPrompt += '\n\n## PLANTILLAS PERSONALIZADAS\nAdemás de las plantillas integradas, puedes generar documentos con estas plantillas personalizadas usando generar_documento con plantilla_id (en vez de tipo):\n\n';
        for (const p of customPlantillas) {
          const camposList = (p.campos as any[]).map((c: any) => c.label || c.id).join(', ');
          dynamicPrompt += `- **${p.nombre}** (plantilla_id: "${p.id}") — ${p.descripcion || 'Sin descripción'}. Campos: ${camposList}\n`;
        }
      }
    } catch (err: any) {
      console.error('[AI] Error cargando plantillas custom:', err.message);
    }

    // ── Tool use loop ───────────────────────────────────────────────────
    let conversationMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await callAnthropicWithRetry(anthropic, {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: dynamicPrompt,
      tools,
      messages: conversationMessages,
    });

    const MAX_ROUNDS = 5;
    let rounds = 0;

    while (response.stop_reason === 'tool_use' && rounds < MAX_ROUNDS) {
      rounds++;
      console.log('[AI] Tool use round', rounds);

      // Procesar todos los tool_use blocks
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log('[AI] Tool:', block.name, ', input:', JSON.stringify(block.input).slice(0, 200));
          let result: string;
          try {
            if (block.name === 'consultar_base_datos') {
              result = await queryDatabase((block.input as any).query);
            } else if (block.name === 'generar_documento') {
              const input = block.input as any;
              if (input.plantilla_id) {
                result = await generateCustomDocument(input.plantilla_id, input.datos);
              } else {
                result = await generateDocument(input.tipo, input.datos);
              }
            } else if (block.name === 'enviar_email') {
              const input = block.input as any;
              result = await handleEnviarEmail(input.tipo_email, input.cliente_id, input.datos, input.email_directo, input.nombre_destinatario);
            } else if (block.name === 'enviar_email_con_adjunto') {
              const input = block.input as any;
              result = await handleEnviarEmailConAdjunto(input.cliente_id, input.email_directo, input.nombre_destinatario, input.asunto, input.contenido_html ?? '', input.archivo_url);
            } else if (block.name === 'confirmar_pago') {
              const input = block.input as any;
              result = await handleConfirmarPago(input.cliente_id, input.monto, input.concepto, input.metodo_pago, input.referencia_bancaria, input.fecha_pago);
            } else if (block.name === 'gestionar_tareas') {
              const input = block.input as any;
              result = await handleGestionarTareas(input.accion, input.datos ?? {});
            } else if (block.name === 'gestionar_cobros') {
              const input = block.input as any;
              result = await handleGestionarCobros(input.accion, input.datos ?? {});
            } else if (block.name === 'gestionar_clientes') {
              const input = block.input as any;
              result = await handleGestionarClientes(input.accion, input.cliente_id, input.busqueda, input.datos ?? {});
            } else if (block.name === 'consultar_catalogo') {
              const input = block.input as any;
              result = await handleConsultarCatalogo(input.consulta);
            } else if (block.name === 'crear_cotizacion_completa') {
              const input = block.input as any;
              result = await handleCrearCotizacionCompleta(input.cliente_id, input.items, input.notas, input.enviar_por_correo);
            } else if (block.name === 'transcribir_documento') {
              const input = block.input as any;
              if (input.accion === 'buscar_pendientes') {
                const dbq = createAdminClient();
                const { data: pdfs } = await dbq
                  .from('documentos')
                  .select('id, nombre_archivo, titulo, estado, cliente:clientes!cliente_id(nombre, codigo)')
                  .ilike('nombre_archivo', '%.pdf')
                  .order('created_at', { ascending: false })
                  .limit(20);
                result = JSON.stringify({
                  mensaje: `${pdfs?.length ?? 0} documentos PDF encontrados.`,
                  documentos: (pdfs ?? []).map((d: any) => ({
                    id: d.id, nombre: d.nombre_archivo, titulo: d.titulo,
                    estado: d.estado, cliente: d.cliente?.nombre ?? 'Sin cliente',
                  })),
                });
              } else if (input.accion === 'transcribir') {
                let docId = input.documento_id;
                if (!docId && input.busqueda) {
                  const dbq = createAdminClient();
                  const { data: found } = await dbq
                    .from('documentos')
                    .select('id, nombre_archivo')
                    .or(`titulo.ilike.%${input.busqueda}%,nombre_archivo.ilike.%${input.busqueda}%`)
                    .ilike('nombre_archivo', '%.pdf')
                    .limit(1)
                    .single();
                  if (found) docId = found.id;
                }
                if (!docId) {
                  result = JSON.stringify({ error: 'No encontré un documento PDF que coincida.' });
                } else {
                  const { transcribirDocumento } = await import('@/lib/services/transcripcion.service');
                  const res = await transcribirDocumento(docId, input.formato ?? 'exacta');
                  result = JSON.stringify({
                    exito: true,
                    mensaje: `Transcripción completada: ${res.transcripcion.paginas} páginas.`,
                    documento_id: res.transcripcion.id,
                    nombre_archivo: res.transcripcion.nombre_archivo,
                    download_url: res.transcripcion.download_url,
                  });
                }
              } else {
                result = JSON.stringify({ error: 'Acción no reconocida. Use: transcribir o buscar_pendientes.' });
              }
            } else if (block.name === 'buscar_jurisprudencia') {
              const input = block.input as any;
              result = await handleBuscarJurisprudencia(input.consulta, input.limite ?? 10);
            } else if (block.name === 'buscar_emails') {
              const input = block.input as any;
              result = await handleBuscarEmails(input.cuenta, input.busqueda, input.dias ?? 7);
            } else if (block.name === 'leer_hilo_email') {
              const input = block.input as any;
              result = await handleLeerHiloEmail(input.cuenta, input.conversation_id);
            } else if (block.name === 'consultar_legal') {
              const input = block.input as any;
              result = await handleConsultarLegal(input.consulta, input.params ?? {});
            } else {
              result = `Herramienta desconocida: ${block.name}`;
            }
          } catch (err: any) {
            console.error('[AI] Tool error (' + block.name + '):', err.message);
            console.error('[AI] Stack:', err.stack);
            result = `Error al ejecutar ${block.name}: ${err.message}. Muestra este error exacto al usuario para que pueda reportarlo.`;
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Follow-up con resultados
      conversationMessages = [
        ...conversationMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ];

      response = await callAnthropicWithRetry(anthropic, {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: dynamicPrompt,
        tools,
        messages: conversationMessages,
      });
    }

    const textBlock = response.content.find((b: any) => b.type === 'text') as any;
    return Response.json({
      role: 'assistant',
      content: textBlock?.text ?? 'No pude generar una respuesta.',
    });
  } catch (error: any) {
    console.error('AI Error:', error);
    if (error instanceof AnthropicOverloadedError) {
      return Response.json({
        role: 'assistant',
        content: 'El asistente está ocupado en este momento, intenta de nuevo en unos segundos.',
      });
    }
    return Response.json({ error: error.message ?? 'Error interno del asistente' }, { status: 500 });
  }
}
