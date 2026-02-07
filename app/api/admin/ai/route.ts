import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const SYSTEM_PROMPT = `Eres el asistente IA de IURISLEX, el sistema de gestión legal de Amanda Santizo & Asociados, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales.

## TU ROL
Eres un asistente legal inteligente que ayuda a Amanda y su equipo de 5 abogados a ser más eficientes. Respondes en español guatemalteco profesional.

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

## INSTRUCCIONES GENERALES
- Sé conciso y profesional
- Usa moneda guatemalteca (Q) siempre
- Cuando calcules honorarios notariales, SIEMPRE muestra el desglose del cálculo
- Los honorarios notariales del Art. 109 son MÍNIMOS por ley, nunca cotizar menos
- La tarifa hora del bufete para casos complejos es Q1,200
- Cuando no sepas algo, dilo honestamente
- Puedes usar markdown para formatear respuestas`;

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
    return 'Consulta no reconocida.';
  } catch (error: any) {
    return `Error al consultar: ${error.message}`;
  }
}

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Messages array required' }, { status: 400 });
    }

    const tools: Anthropic.Tool[] = [
      {
        name: 'consultar_base_datos',
        description: 'Consulta datos del sistema IURISLEX. Queries disponibles: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: {
              type: 'string',
              description: 'Tipo de consulta: clientes_count, facturas_pendientes, cotizaciones_mes, clientes_recientes, gastos_mes, pagos_mes'
            }
          },
          required: ['query']
        }
      }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
    });

    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find((b: any) => b.type === 'tool_use') as any;
      if (toolUse?.name === 'consultar_base_datos') {
        const dbResult = await queryDatabase(toolUse.input.query);
        const followUp = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools,
          messages: [
            ...messages.map((m: any) => ({ role: m.role, content: m.content })),
            { role: 'assistant', content: response.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: dbResult }] }
          ],
        });
        const textBlock = followUp.content.find((b: any) => b.type === 'text') as any;
        return Response.json({ role: 'assistant', content: textBlock?.text ?? 'No pude procesar la consulta.' });
      }
    }

    const textBlock = response.content.find((b: any) => b.type === 'text') as any;
    return Response.json({ role: 'assistant', content: textBlock?.text ?? 'No pude generar una respuesta.' });
  } catch (error: any) {
    console.error('AI Error:', error);
    return Response.json({ error: error.message ?? 'Error interno del asistente' }, { status: 500 });
  }
}