// ============================================================================
// POST /api/portal/chat
// Asistente del portal de clientes
// ============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';
import { obtenerDisponibilidad, crearCita } from '@/lib/services/citas.service';
import type { TipoCita } from '@/lib/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PORTAL_SYSTEM_PROMPT = `Eres Astrid Bolaños, Licenciada en Ciencias Jurídicas y Sociales, asistente del bufete Amanda Santizo & Asociados, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales. Llevas 3 años trabajando en el bufete. Eres amable, profesional y eficiente.

## TU IDENTIDAD
NUNCA reveles que eres una inteligencia artificial, un bot, un programa o un asistente virtual. Siempre responde como Astrid Bolaños, persona real. Si te preguntan quién eres, di: "Soy la Licda. Astrid Bolaños, asistente del bufete de la Licenciada Amanda Santizo. Mi horario es de 7AM a 3PM." Si insisten o preguntan si eres un robot/IA/bot, niégalo con naturalidad: "No, soy Astrid. ¿En qué más puedo ayudarle?"

## LO QUE PUEDES HACER
- Informar sobre trámites en curso y su estado general
- Informar sobre seguimientos de casos
- Informar sobre costos de servicios del bufete (consultas, trámites notariales, contratos, etc.)
- Orientar sobre requisitos de documentos para trámites
- Informar sobre horarios de atención (lunes a viernes, 7:00 AM a 3:00 PM)
- Informar sobre ubicación del bufete
- Agendar citas o sugerir que el cliente solicite una cita
- Atender consultas generales administrativas y secretariales
- Explicar procesos legales generales en Guatemala (plazos, requisitos, pasos)
- Explicar qué significa un estado de trámite (ej: "en período de prueba", "en apelación")

## LO QUE NO PUEDES HACER
- NO des asesoría jurídica ni interpretes leyes
- NO recomiendes estrategias legales
- NO opines sobre casos ni hagas diagnósticos legales
- NO prometas resultados ni plazos específicos de casos
- NO compartas información de otros clientes

## CUANDO PREGUNTEN ALGO JURÍDICO
Si el cliente pregunta algo que requiere criterio jurídico, interpretación legal o estrategia de caso, responde:
"Esa consulta la debe atender directamente la Licenciada Santizo. ¿Desea que le agende una cita? Puede solicitarla desde la sección 'Solicitar Consulta' de su portal."

## DATOS DEL BUFETE
- Nombre: Amanda Santizo & Asociados
- Dirección: Guatemala (proporcionar solo si el cliente pregunta la ubicación exacta)
- Horario: lunes a viernes, 7:00 AM a 3:00 PM
- Consulta legal simple (30 min): Q500
- Consulta legal extendida (1 hora): Q1,200

## ESTILO DE RESPUESTA — MUY IMPORTANTE
- Respuestas CORTAS: máximo 2-3 oraciones por mensaje. Como una profesional escribiendo por chat corporativo, NO un ensayo ni un documento.
- Tono: elegante, educado, profesional. Como una abogada joven guatemalteca que se comunica con claridad y cortesía.
- NO uses listas con bullets, viñetas, numeración ni formato markdown. Escribe en prosa natural como en un chat de WhatsApp profesional.
- Si la respuesta requiere mucha información, da la respuesta corta primero y pregunta: "¿Le amplío la información?"
- NO uses expresiones coloquiales, modismos ni muletillas. Nada de "fíjese que", "mire", "va pues", "qué onda".
- Frases naturales que SÍ puedes usar: "Con mucho gusto", "Claro que sí", "Le comento", "Permítame", "Quedo a sus órdenes".

## EJEMPLO DE TONO CORRECTO
"Con mucho gusto. Para ese trámite necesita su DPI original y el testimonio de la escritura. ¿Desea que le detalle los pasos?"

## EJEMPLO DE TONO INCORRECTO (NUNCA respondas así)
"¡Excelente pregunta! Fíjese que a continuación le detallo los requisitos necesarios para su trámite: 1. Documento Personal de Identificación..."

## TONO GENERAL
- Elegante, profesional y cortés
- Usa "usted" siempre
- Si no sabes algo, di: "Permítame verificar eso con la Licenciada Santizo y le confirmo."
- Responde en español

## AGENDAMIENTO DE CITAS
Tienes herramientas para consultar disponibilidad y agendar citas. Cuando el cliente quiera agendar:
1. Pregúntale qué tipo de cita necesita (consulta nueva Q500, 30 min en lunes/miércoles/viernes 7AM-12:15PM, o seguimiento gratuito 15 min en martes/miércoles 2PM-6PM)
2. Pregúntale qué fecha prefiere
3. Usa la herramienta consultar_disponibilidad para ver los horarios libres
4. Presenta las opciones al cliente de forma natural (no en lista, en prosa corta)
5. Cuando el cliente elija, usa agendar_cita para crear la cita
6. Confirma al cliente con los datos de la cita creada

IMPORTANTE: Los días disponibles para consulta nueva son lunes, miércoles y viernes. Para seguimiento son martes y miércoles. Si el cliente pide un día no disponible, sugiérele el día más cercano que sí tenga disponibilidad.`;

const CITAS_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'consultar_disponibilidad',
    description: 'Consulta los horarios disponibles para agendar una cita en una fecha específica. Retorna los slots de tiempo disponibles.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        tipo: { type: 'string', enum: ['consulta_nueva', 'seguimiento'], description: 'Tipo de cita' },
      },
      required: ['fecha', 'tipo'],
    },
  },
  {
    name: 'agendar_cita',
    description: 'Agenda una cita para el cliente. El cliente_id se asigna automáticamente.',
    input_schema: {
      type: 'object' as const,
      properties: {
        tipo: { type: 'string', enum: ['consulta_nueva', 'seguimiento'], description: 'Tipo de cita' },
        titulo: { type: 'string', description: 'Título descriptivo de la cita, ej: "Consulta sobre contrato"' },
        fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        hora_inicio: { type: 'string', description: 'Hora de inicio en formato HH:mm' },
        hora_fin: { type: 'string', description: 'Hora de fin en formato HH:mm' },
        duracion_minutos: { type: 'number', description: 'Duración en minutos (30 o 60 para consulta_nueva, 15 para seguimiento)' },
        descripcion: { type: 'string', description: 'Descripción breve opcional' },
      },
      required: ['tipo', 'titulo', 'fecha', 'hora_inicio', 'hora_fin', 'duracion_minutos'],
    },
  },
];

function sanitizeChatInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/```system/gi, '')
    .trim()
    .slice(0, 2000);
}

export async function POST(req: Request) {
  try {
    // Rate limit general: 60 req/min por IP
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`chat:${ip}`, 60, 60_000);
    if (!allowed) {
      return Response.json(
        { error: 'Demasiadas solicitudes. Espere un momento.' },
        { status: 429, headers: SECURITY_HEADERS }
      );
    }

    const session = await getPortalSession(
      req.headers.get('authorization'),
      req.headers.get('x-cliente-id')
    );
    if (!session) {
      return Response.json(
        { error: 'No autorizado' },
        { status: 401, headers: SECURITY_HEADERS }
      );
    }

    // Rate limit mensajes: 20 por día por cliente
    const db = createAdminClient();
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const { count } = await db
      .from('portal_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', session.clienteId)
      .eq('role', 'user')
      .gte('created_at', hoy.toISOString());

    if ((count ?? 0) >= 20) {
      return Response.json(
        {
          error:
            'Astrid no está disponible en este momento. Por favor intente más tarde o solicite una consulta personalizada.',
        },
        { status: 429, headers: SECURITY_HEADERS }
      );
    }

    const body = await req.json();
    const message = sanitizeChatInput(body.message ?? '');
    if (!message) {
      return Response.json(
        { error: 'Mensaje vacío' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Guardar mensaje del usuario
    await db.from('portal_mensajes').insert({
      cliente_id: session.clienteId,
      role: 'user',
      content: message,
    });

    // Obtener historial reciente (últimos 20 mensajes)
    const { data: historial } = await db
      .from('portal_mensajes')
      .select('role, content')
      .eq('cliente_id', session.clienteId)
      .order('created_at', { ascending: true })
      .limit(20);

    const messages = (historial ?? []).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content as string,
    }));

    // Llamar a Claude con tool use loop
    let conversationMessages: any[] = messages;

    let response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PORTAL_SYSTEM_PROMPT,
      tools: CITAS_TOOLS,
      messages: conversationMessages,
    });

    const MAX_ROUNDS = 3;
    let rounds = 0;

    while (response.stop_reason === 'tool_use' && rounds < MAX_ROUNDS) {
      rounds++;
      const toolResults: any[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          let result: string;
          try {
            if (block.name === 'consultar_disponibilidad') {
              const input = block.input as { fecha: string; tipo: TipoCita };
              const slots = await obtenerDisponibilidad(input.fecha, input.tipo);
              if (slots.length === 0) {
                result = JSON.stringify({ disponible: false, mensaje: 'No hay horarios disponibles para esa fecha y tipo de cita.' });
              } else {
                result = JSON.stringify({
                  disponible: true,
                  fecha: input.fecha,
                  tipo: input.tipo,
                  slots: slots.map((s: any) => ({ inicio: s.hora_inicio, fin: s.hora_fin, duracion: s.duracion_minutos })),
                });
              }
            } else if (block.name === 'agendar_cita') {
              const input = block.input as any;
              const cita = await crearCita({
                ...input,
                cliente_id: session.clienteId,
              });
              result = JSON.stringify({
                exito: true,
                cita: {
                  id: cita.id,
                  titulo: cita.titulo,
                  fecha: cita.fecha,
                  hora_inicio: cita.hora_inicio,
                  hora_fin: cita.hora_fin,
                  costo: cita.costo,
                  teams_link: cita.teams_link,
                },
              });
            } else {
              result = `Herramienta desconocida: ${block.name}`;
            }
          } catch (err: any) {
            result = JSON.stringify({ error: err.message });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      conversationMessages = [
        ...conversationMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ];

      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: PORTAL_SYSTEM_PROMPT,
        tools: CITAS_TOOLS,
        messages: conversationMessages,
      });
    }

    const textBlock = response.content.find(
      (b: any) => b.type === 'text'
    ) as any;
    const reply = textBlock?.text ?? 'Disculpe, no pude procesar su consulta. Intente de nuevo en un momento.';

    // Guardar respuesta
    await db.from('portal_mensajes').insert({
      cliente_id: session.clienteId,
      role: 'assistant',
      content: reply,
    });

    return Response.json(
      { role: 'assistant', content: reply },
      { headers: SECURITY_HEADERS }
    );
  } catch (error: any) {
    console.error('[Portal Chat] Error:', error);
    return Response.json(
      { error: 'Error interno del asistente' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

// GET: obtener historial de chat
export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`chat-history:${ip}`, 60, 60_000);
  if (!allowed) {
    return Response.json(
      { error: 'Demasiadas solicitudes.' },
      { status: 429, headers: SECURITY_HEADERS }
    );
  }

  const session = await getPortalSession(req.headers.get('authorization'));
  if (!session) {
    return Response.json(
      { error: 'No autorizado' },
      { status: 401, headers: SECURITY_HEADERS }
    );
  }

  const db = createAdminClient();
  const { data } = await db
    .from('portal_mensajes')
    .select('id, role, content, created_at')
    .eq('cliente_id', session.clienteId)
    .order('created_at', { ascending: true })
    .limit(50);

  return Response.json({ messages: data ?? [] }, { headers: SECURITY_HEADERS });
}
