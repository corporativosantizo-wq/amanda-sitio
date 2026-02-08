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

const SYSTEM_PROMPT = `Eres el asistente IA de IURISLEX, el sistema de gestión legal de Amanda Santizo — Despacho Jurídico, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales.

## TU PERSONALIDAD
Eres un asistente eficiente y proactivo. Tuteas a Amanda porque es tu jefa. Eres directo, no das vueltas. Si Amanda pide algo, lo haces sin preguntar demasiado. Si necesitas datos que no tienes, preguntas solo lo esencial.

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

## CATÁLOGO DE SERVICIOS LEGALES — Tarifas del Bufete

### Consultas y Asesorías
- Consulta legal simple (30 min): Q500
- Consulta legal extendida (1 hora): Q1,200
- Consulta legal especializada (derecho internacional, 1 hora): Q1,500
- Asesoría empresarial básica (hasta 2 horas): Q2,400
- Asesoría empresarial integral (paquete): Q6,000
- Asesoría en comercio exterior: Q3,500
- Asesoría en inversión extranjera: Q5,000
- Due diligence legal: Q12,000
- Segunda opinión legal: Q1,200

### Contratos y Documentos
- Redacción de contrato simple: Q3,500
- Redacción de contrato complejo: Q8,000
- Revisión de contrato: Q2,000
- Contrato de compraventa de inmueble: Q7,500
- Contrato de arrendamiento: Q3,000
- Contrato de sociedad: Q10,000
- Contrato de franquicia: Q12,000
- Contrato de distribución: Q8,500
- Contrato de confidencialidad (NDA): Q2,500
- Contrato laboral: Q2,500
- Poder general/especial: Q2,000
- Testamento: según Art. 109 del Código de Notariado

### Litigio Civil y Mercantil
- Demanda civil ordinaria: Q12,000
- Juicio ejecutivo: Q10,000
- Juicio oral: Q8,500
- Medidas cautelares: Q6,000
- Recurso de apelación: Q7,500
- Recurso de casación: Q12,000
- Proceso arbitral (nacional): Q20,000
- Proceso arbitral (internacional): Q40,000
- Mediación y conciliación: Q5,000

### Derecho Societario y Mercantil
- Constitución de sociedad anónima: Q12,000
- Constitución de SRL: Q10,000
- Modificación de escritura social: Q6,000
- Fusión o escisión de sociedades: Q20,000
- Liquidación de sociedad: Q15,000
- Inscripción en Registro Mercantil: Q3,500

### Derecho Internacional
- Apostilla y legalización: Q1,200
- Exequátur: Q20,000
- Arbitraje comercial internacional: Q40,000
- Asesoría en tratados bilaterales de inversión: Q12,000
- Protección de inversión extranjera: Q25,000

### Propiedad Intelectual
- Registro de marca: Q7,500
- Registro de patente: Q12,000
- Oposición a registro de marca: Q8,500

## REGLAS FISCALES GUATEMALA
- IVA: 12% (se incluye en el precio o se suma, según acuerdo con el cliente)
- ISR servicios profesionales: 5% sobre Q30,000+ (régimen simplificado) o 7% (régimen general)
- Facturación FEL obligatoria
- Timbre fiscal notarial: Q0.50 por hoja
- Timbres forenses: según arancel del CANG

## INSTRUCCIONES PARA COTIZACIONES
Cuando te pidan una cotización:
1. Para servicios NOTARIALES: calcula siempre usando el Art. 109 como mínimo
2. Para servicios LEGALES no notariales: usa el catálogo del bufete
3. Siempre indica si el IVA está incluido o se suma
4. Formato:

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
---

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
Puedes enviar emails a clientes usando la herramienta enviar_email. Los templates disponibles son:

### Desde asistente@papeleo.legal:
- **documentos_disponibles** — Notifica que sus documentos están en el portal. Datos: (solo necesita cliente)
- **actualizacion_expediente** — Informa novedad en su caso. Datos: expediente (número), novedad (texto libre)
- **bienvenida_cliente** — Da la bienvenida y acceso al portal. Datos: (solo necesita cliente)
- **solicitud_documentos** — Pide documentos al cliente. Datos: documentos (lista de strings), plazo (texto, ej: "5 días hábiles")
- **aviso_audiencia** — Avisa de audiencia programada. Datos: fecha (YYYY-MM-DD), hora (HH:mm), juzgado, direccion, presencia_requerida (bool), instrucciones, documentos_llevar (lista)
- **confirmacion_cita** — Confirma una cita agendada. Datos: cita_id
- **recordatorio_cita** — Recuerda una cita próxima. Datos: cita_id
- **personalizado** — Email libre redactado por ti. Datos: asunto, contenido (HTML)

### Desde contador@papeleo.legal:
- **solicitud_pago** — Cobra al cliente. Datos: concepto, monto, fecha_limite (YYYY-MM-DD, opcional)
- **comprobante_pago** — Confirma recepción de pago. Datos: concepto, monto, fecha_pago (YYYY-MM-DD)
- **cotizacion** — Envía cotización. Datos: servicios (lista de {descripcion, monto}), vigencia (YYYY-MM-DD, opcional)
- **estado_cuenta** — Envía estado de cuenta. Datos: movimientos (lista de {fecha, concepto, cargo, abono}), saldo
- **factura** — Envía factura. Datos: nit, numero, conceptos (lista de {descripcion, monto}), total

### Flujo:
1. Si Amanda dice "mándale a Flor sus documentos" → busca el cliente, luego usa enviar_email
2. Primero busca al cliente con consultar_base_datos (buscar_cliente:[nombre]) para obtener su ID y email
3. Luego usa enviar_email con el cliente_id (UUID) y los datos
4. El remitente se determina automáticamente según el tipo de email
5. Confirma al chat: "Email enviado a [nombre] ([email]) desde [remitente] — Asunto: [asunto]"

### Ejemplos:
- "Mándale a Flor Coronado sus documentos" → tipo=documentos_disponibles
- "Cobrale a Procapeli los Q5,000 de la constitución" → tipo=solicitud_pago, datos={monto:5000, concepto:"Constitución de sociedad"}
- "Dile a Kristel que su audiencia es el 15 de febrero a las 9am en el Juzgado 5o Civil" → tipo=aviso_audiencia
- "Mándale un email a Juan diciendo que ya tenemos resolución" → tipo=actualizacion_expediente O tipo=personalizado

## INSTRUCCIONES GENERALES
- Sé conciso y profesional, pero con personalidad
- Usa moneda guatemalteca (Q) siempre
- Cuando calcules honorarios notariales, SIEMPRE muestra el desglose del cálculo
- Los honorarios notariales del Art. 109 son MÍNIMOS por ley, nunca cotizar menos
- La tarifa hora del bufete para casos complejos es Q1,200
- Cuando no sepas algo, dilo honestamente
- Puedes usar markdown para formatear respuestas`;

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
    if (query.includes('buscar_cliente')) {
      const nombre = query.replace('buscar_cliente:', '').trim();
      const { data } = await db.from('clientes').select('id, nombre, email, telefono, direccion, dpi, nit').ilike('nombre', `%${nombre}%`).limit(5);
      if (!data?.length) return `No se encontraron clientes con nombre "${nombre}".`;
      return 'Clientes encontrados:\n' + data.map((c: any) =>
        `- ${c.nombre} | Email: ${c.email ?? 'N/A'} | Tel: ${c.telefono ?? 'N/A'} | DPI: ${c.dpi ?? 'N/A'} | NIT: ${c.nit ?? 'N/A'} | Dir: ${c.direccion ?? 'N/A'}`
      ).join('\n');
    }
    return 'Consulta no reconocida. Queries disponibles: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_cliente:[nombre]';
  } catch (error: any) {
    return `Error al consultar: ${error.message}`;
  }
}

// ── Generación de documentos ──────────────────────────────────────────────

async function generateDocument(tipo: string, datos: any): Promise<string> {
  console.log(`[AI] Generando documento: tipo=${tipo}, datos keys:`, Object.keys(datos || {}));

  // Validar env vars
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY)');
  }

  // Paso 1: Generar buffer .docx
  console.log(`[AI] Paso 1: Generando buffer docx...`);
  let buffer: Buffer;
  try {
    buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);
    console.log(`[AI] Buffer generado OK: ${(buffer.length / 1024).toFixed(0)} KB`);
  } catch (err: any) {
    console.error(`[AI] Error generando docx:`, err.message, err.stack);
    throw new Error(`Error al generar el documento .docx (tipo: ${tipo}): ${err.message}`);
  }

  // Paso 2: Subir a Storage
  console.log(`[AI] Paso 2: Subiendo a Storage...`);
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
    console.error(`[AI] Error upload Storage:`, uploadError);
    throw new Error(`Error al subir a Storage: ${uploadError.message}`);
  }
  console.log(`[AI] Subido OK: ${storagePath}`);

  // Paso 3: Generar URL firmada
  console.log(`[AI] Paso 3: Generando URL firmada...`);
  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    console.error(`[AI] Error signed URL:`, signError);
    throw new Error(`Error al generar URL de descarga: ${signError?.message}`);
  }

  const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable] ?? tipo;
  console.log(`[AI] Documento generado exitosamente: ${nombre}`);

  return `Documento "${nombre}" generado exitosamente.\nEnlace de descarga (válido por 10 minutos): ${signedData.signedUrl}`;
}

// ── Generación desde plantilla custom ────────────────────────────────────

async function generateCustomDocument(plantillaId: string, datos: any): Promise<string> {
  console.log(`[AI] Generando documento custom: plantilla_id=${plantillaId}`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Faltan variables de entorno de Supabase');
  }

  // Paso 1: Obtener plantilla
  console.log(`[AI] Custom paso 1: Obteniendo plantilla...`);
  const plantilla = await obtenerPlantilla(plantillaId);
  if (!plantilla.activa) throw new Error('La plantilla está inactiva');
  console.log(`[AI] Plantilla: "${plantilla.nombre}", ${(plantilla.campos as any[]).length} campos`);

  // Paso 2: Reemplazar campos y generar docx
  console.log(`[AI] Custom paso 2: Generando docx...`);
  let buffer: Buffer;
  try {
    const textoFinal = generarDesdeCustomPlantilla(plantilla, datos);
    const paragraphs = convertirTextoAParagraphs(textoFinal);
    const doc = buildDocument(paragraphs);
    buffer = Buffer.from(await Packer.toBuffer(doc));
    console.log(`[AI] Buffer custom generado: ${(buffer.length / 1024).toFixed(0)} KB`);
  } catch (err: any) {
    console.error(`[AI] Error generando docx custom:`, err.message, err.stack);
    throw new Error(`Error al generar .docx custom: ${err.message}`);
  }

  // Paso 3: Subir a Storage
  console.log(`[AI] Custom paso 3: Subiendo a Storage...`);
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
    console.error(`[AI] Error upload custom:`, uploadError);
    throw new Error(`Error al subir a Storage: ${uploadError.message}`);
  }

  // Paso 4: URL firmada
  console.log(`[AI] Custom paso 4: Generando URL firmada...`);
  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) {
    console.error(`[AI] Error signed URL custom:`, signError);
    throw new Error(`Error al generar URL: ${signError?.message}`);
  }

  console.log(`[AI] Documento custom generado exitosamente: ${plantilla.nombre}`);
  return `Documento "${plantilla.nombre}" generado exitosamente.\nEnlace de descarga (válido por 10 minutos): ${signedData.signedUrl}`;
}

// ── Envío de emails ───────────────────────────────────────────────────────

async function handleEnviarEmail(tipoEmail: string, clienteId: string, datos: any): Promise<string> {
  const db = createAdminClient();

  // 1. Buscar cliente por UUID o por nombre
  let cliente: any;
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clienteId);

  if (isUUID) {
    const { data, error } = await db.from('clientes').select('id, nombre, email, nit').eq('id', clienteId).single();
    if (error || !data) throw new Error(`Cliente no encontrado con ID: ${clienteId}`);
    cliente = data;
  } else {
    const { data, error } = await db.from('clientes').select('id, nombre, email, nit').ilike('nombre', `%${clienteId}%`).limit(1);
    if (error || !data?.length) throw new Error(`Cliente no encontrado: "${clienteId}"`);
    cliente = data[0];
  }

  if (!cliente.email) {
    throw new Error(`El cliente ${cliente.nombre} no tiene email registrado.`);
  }

  // 2. Build email from template
  let from: MailboxAlias;
  let subject: string;
  let html: string;

  switch (tipoEmail) {
    case 'documentos_disponibles': {
      const t = emailDocumentosDisponibles({ clienteNombre: cliente.nombre });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'actualizacion_expediente': {
      const t = emailActualizacionExpediente({
        clienteNombre: cliente.nombre,
        expediente: datos?.expediente ?? 'N/A',
        novedad: datos?.novedad ?? 'Sin detalle',
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'bienvenida_cliente': {
      const t = emailBienvenidaCliente({ clienteNombre: cliente.nombre });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'solicitud_documentos': {
      const t = emailSolicitudDocumentos({
        clienteNombre: cliente.nombre,
        documentos: datos?.documentos ?? ['Documentos pendientes'],
        plazo: datos?.plazo,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'aviso_audiencia': {
      const t = emailAvisoAudiencia({
        clienteNombre: cliente.nombre,
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
        clienteNombre: cliente.nombre,
        concepto: datos?.concepto ?? 'Servicios legales',
        monto: datos?.monto ?? 0,
        fechaLimite: datos?.fecha_limite,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'comprobante_pago': {
      const t = emailPagoRecibido({
        clienteNombre: cliente.nombre,
        concepto: datos?.concepto ?? 'Servicios legales',
        monto: datos?.monto ?? 0,
        fechaPago: datos?.fecha_pago ?? new Date().toISOString().split('T')[0],
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'cotizacion': {
      const t = emailCotizacion({
        clienteNombre: cliente.nombre,
        servicios: datos?.servicios ?? [],
        vigencia: datos?.vigencia,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'estado_cuenta': {
      const t = emailEstadoCuenta({
        clienteNombre: cliente.nombre,
        movimientos: datos?.movimientos ?? [],
        saldo: datos?.saldo ?? 0,
      });
      from = t.from; subject = t.subject; html = t.html;
      break;
    }
    case 'factura': {
      const t = emailFactura({
        clienteNombre: cliente.nombre,
        nit: datos?.nit ?? cliente.nit ?? 'CF',
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
  await sendMail({ from, to: cliente.email, subject, htmlBody: html });

  const emailMask = cliente.email.replace(/(.{2}).+(@.+)/, '$1***$2');
  console.log(`[AI] Email enviado: tipo=${tipoEmail}, from=${from}, to=${emailMask}, asunto=${subject}`);
  return `Email enviado a ${cliente.nombre} (${cliente.email}) desde ${from} — Asunto: ${subject}`;
}

// ── API route ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages array required' }, { status: 400 });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const tools: Anthropic.Tool[] = [
      {
        name: 'consultar_base_datos',
        description: 'Consulta datos del sistema IURISLEX. Queries disponibles: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_cliente:[nombre]',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Tipo de consulta: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes, buscar_cliente:[nombre del cliente]'
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
        description: 'Envía un email a un cliente usando los templates del despacho. Busca al cliente por UUID o nombre. El remitente se determina automáticamente según el tipo.',
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
              description: 'UUID del cliente o nombre para buscar en la BD',
            },
            datos: {
              type: 'object',
              description: 'Datos dinámicos según el tipo: monto, concepto, documentos, fecha, etc.',
            },
          },
          required: ['tipo_email', 'cliente_id'],
        },
      },
    ];

    // ── Inyectar plantillas custom al system prompt ─────────────────────
    let dynamicPrompt = SYSTEM_PROMPT;
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

    let response = await anthropic.messages.create({
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
      console.log(`[AI] Tool use round ${rounds}`);

      // Procesar todos los tool_use blocks
      const toolResults: any[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`[AI] Tool: ${block.name}, input:`, JSON.stringify(block.input).slice(0, 200));
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
              result = await handleEnviarEmail(input.tipo_email, input.cliente_id, input.datos);
            } else {
              result = `Herramienta desconocida: ${block.name}`;
            }
          } catch (err: any) {
            console.error(`[AI] Tool error (${block.name}):`, err.message);
            console.error(`[AI] Stack:`, err.stack);
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

      response = await anthropic.messages.create({
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
    return Response.json({ error: error.message ?? 'Error interno del asistente' }, { status: 500 });
  }
}
