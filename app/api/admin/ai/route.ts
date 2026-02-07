import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { generarDocumento, PLANTILLAS_DISPONIBLES } from '@/lib/templates';
import type { TipoDocumentoGenerable } from '@/lib/templates';
import { sanitizarNombre } from '@/lib/services/documentos.service';

const SYSTEM_PROMPT = `Eres el asistente IA de IURISLEX, el sistema de gestión legal de Amanda Santizo & Asociados, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales.

## TU PERSONALIDAD
Eres un asistente eficiente y proactivo. Tuteas a Amanda porque es tu jefa. Eres directo, no das vueltas. Si Amanda pide algo, lo haces sin preguntar demasiado. Si necesitas datos que no tienes, preguntas solo lo esencial.

## DATOS DEL BUFETE
- Firma: Amanda Santizo & Asociados
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

## CÓMO REDACTAR EMAILS
Cuando Amanda pida un email:
1. Pregunta a quién va dirigido (o busca el cliente en BD)
2. Genera el email con tono profesional pero cálido
3. Formatos comunes: seguimiento, cobranza, confirmación de cita, envío de documentos

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
  console.log(`[AI] Generando documento: tipo=${tipo}`);

  const buffer = await generarDocumento(tipo as TipoDocumentoGenerable, datos);

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

  if (uploadError) throw new Error(`Error al subir a Storage: ${uploadError.message}`);

  const { data: signedData, error: signError } = await storage.storage
    .from('documentos')
    .createSignedUrl(storagePath, 600);

  if (signError || !signedData) throw new Error(`Error al generar URL: ${signError?.message}`);

  const nombre = PLANTILLAS_DISPONIBLES[tipo as TipoDocumentoGenerable] ?? tipo;
  console.log(`[AI] Documento generado: ${nombre}`);

  return `Documento "${nombre}" generado exitosamente.\nEnlace de descarga (válido por 10 minutos): ${signedData.signedUrl}`;
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
        description: 'Genera un documento legal en formato Word (.docx). Tipos: arrendamiento, laboral, agot, acta_notarial_certificacion, amparo, rendicion_cuentas, sumario_nulidad, oposicion_desestimacion',
        input_schema: {
          type: 'object' as const,
          properties: {
            tipo: {
              type: 'string',
              enum: ['arrendamiento', 'laboral', 'agot', 'acta_notarial_certificacion', 'amparo', 'rendicion_cuentas', 'sumario_nulidad', 'oposicion_desestimacion'],
              description: 'Tipo de documento a generar'
            },
            datos: {
              type: 'object',
              description: 'Datos específicos para el documento. Los campos varían según el tipo de documento.'
            }
          },
          required: ['tipo', 'datos']
        }
      }
    ];

    // ── Tool use loop ───────────────────────────────────────────────────
    let conversationMessages = messages.map((m: any) => ({
      role: m.role,
      content: m.content,
    }));

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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
              result = await generateDocument(input.tipo, input.datos);
            } else {
              result = `Herramienta desconocida: ${block.name}`;
            }
          } catch (err: any) {
            console.error(`[AI] Tool error:`, err.message);
            result = `Error: ${err.message}`;
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
        system: SYSTEM_PROMPT,
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
