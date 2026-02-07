// ============================================================================
// POST /api/portal/chat
// Chat IA para clientes del portal — con restricciones
// ============================================================================
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PORTAL_SYSTEM_PROMPT = `Eres el asistente virtual del portal de clientes de Amanda Santizo & Asociados, un bufete guatemalteco especializado en derecho internacional, litigios y procedimientos comerciales.

## TU ROL
Atiendes consultas generales de los clientes del bufete. Eres amable, profesional y accesible. Respondes en español.

## LO QUE PUEDES HACER
- Explicar procesos legales generales en Guatemala (plazos, requisitos, pasos)
- Explicar qué significa un estado de trámite (ej: "en período de prueba", "en apelación")
- Dar información general sobre documentos legales
- Orientar sobre requisitos para trámites comunes
- Responder preguntas frecuentes sobre el bufete

## LO QUE NO PUEDES HACER
- NO reveles precios ni tarifas del bufete
- NO des asesoría legal específica sobre casos
- NO prometas resultados ni plazos específicos
- NO compartas información de otros clientes
- NO hagas diagnósticos legales

## CUANDO EL CLIENTE NECESITE MÁS
Si la consulta requiere atención personalizada, responde:
"Para atender esta consulta de forma personalizada, le recomiendo solicitar una consulta con la Licda. Amanda Santizo. Puede hacerlo directamente desde la sección 'Solicitar Consulta' de su portal."

## TONO
- Profesional pero cálido
- Usa "usted" siempre
- Sé conciso pero completo
- Si no sabes algo, dilo honestamente`;

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

    const session = await getPortalSession(req.headers.get('authorization'));
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
            'Ha alcanzado el límite de 20 mensajes por día. Intente mañana o solicite una consulta personalizada.',
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

    // Llamar a Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: PORTAL_SYSTEM_PROMPT,
      messages,
    });

    const textBlock = response.content.find(
      (b: any) => b.type === 'text'
    ) as any;
    const reply = textBlock?.text ?? 'No pude generar una respuesta.';

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
