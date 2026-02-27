// ============================================================================
// lib/molly/brain.ts
// Molly Brain — clasificación y generación de borradores con Claude
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import type { MollyClassification, MollyDraftResult, EmailMessage } from '@/lib/types/molly';

// ── Singleton Anthropic client ─────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return anthropicClient;
}

// ── Parse JSON from Claude response (with markdown fence cleanup) ──────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(cleaned);
}

// ── Account-specific config ─────────────────────────────────────────────────

interface AccountClassifyConfig {
  hint: string;
}

interface AccountDraftConfig {
  firma: string;
  tono: string;
}

const ACCOUNT_CLASSIFY: Record<string, AccountClassifyConfig> = {
  'contador@papeleo.legal': {
    hint: 'Cuenta destino: contador@papeleo.legal — departamento contable. Emails financieros (facturas, pagos, retenciones, SAT, constancias) deben clasificarse como "financiero". Priorizar este tipo para esta cuenta. IMPORTANTE: scheduling_intent SIEMPRE debe ser false para esta cuenta — los emails contables no agendan citas.',
  },
  'asistente@papeleo.legal': {
    hint: 'Cuenta destino: asistente@papeleo.legal — asistencia general. Recibe consultas nuevas, solicitudes de información, agendamiento. Clasificar según contenido normalmente.',
  },
  'amanda@papeleo.legal': {
    hint: 'Cuenta destino: amanda@papeleo.legal — cuenta personal de la abogada. Emails de clientes VIP, juzgados, colegas abogados. IMPORTANTE: sumar +1 a la urgencia base (mínimo urgencia 1 para esta cuenta).',
  },
};

const ACCOUNT_DRAFT: Record<string, AccountDraftConfig> = {
  'contador@papeleo.legal': {
    firma: 'Departamento Contable | papeleo.legal',
    tono: 'Tono contable y profesional. Respuestas técnicas sobre facturas, pagos, retenciones fiscales. No mencionar servicios legales ni citas.',
  },
  'asistente@papeleo.legal': {
    firma: 'Amanda Santizo | papeleo.legal',
    tono: 'Tono cordial y profesional. Respuestas amables para consultas generales y agendamiento.',
  },
  'amanda@papeleo.legal': {
    firma: 'Lcda. Amanda Santizo | IURISLEX',
    tono: 'Tono personal y directo, de abogada a colega o cliente VIP. Más breve y cercano que las otras cuentas.',
  },
};

// ── Classify email ─────────────────────────────────────────────────────────

const CLASSIFY_PROMPT_BASE = `Eres Molly, asistente de email IA para Amanda Santizo — papeleo.legal, un despacho jurídico en Guatemala.
Hoy es ${new Date().toISOString().substring(0, 10)}.

Clasifica el siguiente email y responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto adicional):

{
  "tipo": "legal|administrativo|financiero|spam|personal|urgente",
  "urgencia": 0,
  "resumen": "resumen de 1-2 oraciones",
  "cliente_probable": "nombre del cliente probable o null",
  "requiere_respuesta": true,
  "confianza": 0.85,
  "scheduling_intent": false,
  "suggested_date": null,
  "suggested_time": null,
  "event_type": null
}

Reglas de urgencia (0-3):
- 0: informativo, newsletters, notificaciones automáticas
- 1: normal, requiere respuesta pero no inmediata
- 2: importante, plazos legales, citas próximas, clientes prioritarios
- 3: urgente, audiencias inminentes, notificaciones judiciales, emergencias

Reglas de tipo:
- "legal": relacionado a casos, expedientes, juzgados, audiencias, contratos
- "administrativo": citas, reuniones, trámites internos, registros
- "financiero": facturas, pagos, cobros, cotizaciones, honorarios
- "spam": marketing, newsletters no solicitados, phishing
- "personal": asuntos personales no laborales
- "urgente": requiere atención inmediata (también marcar urgencia >= 2)

Reglas de respuesta:
- requiere_respuesta = false para: spam, newsletters, notificaciones automáticas, emails donde Amanda es CC
- requiere_respuesta = true para: preguntas directas, solicitudes, citas, asuntos legales

Reglas de intención de cita (scheduling_intent):
- scheduling_intent = true si el email solicita, propone o pregunta por: cita, reunión, consulta, meeting, appointment, agendar, disponibilidad, horario, "cuándo podemos vernos", "me gustaría agendar"
- scheduling_intent = false para: confirmaciones de citas ya agendadas, recordatorios, cancelaciones, y emails que NO solicitan agendar algo nuevo
- suggested_date: si mencionan una fecha específica, convertirla a formato YYYY-MM-DD. Si dicen "mañana", "el lunes", "la próxima semana", calcular la fecha real a partir de hoy. Si no mencionan fecha, null.
- suggested_time: si mencionan hora específica ("a las 3", "por la tarde", "10 AM"), convertir a formato HH:mm en 24h. Si dicen "por la tarde" usar "14:00". Si no mencionan hora, null.
- event_type: "consulta_nueva" si es un asunto nuevo, remitente desconocido, o primera consulta. "seguimiento" si es un cliente existente con caso activo que pide reunión de seguimiento. null si scheduling_intent es false.`;

export async function classifyEmail(
  fromEmail: string,
  subject: string,
  bodyText: string,
  knownContact?: string | null,
  account?: string,
): Promise<MollyClassification> {
  const client = getClient();

  // Build account-aware prompt
  const accountHint = account && ACCOUNT_CLASSIFY[account]
    ? `\n\n${ACCOUNT_CLASSIFY[account].hint}`
    : '';
  const prompt = CLASSIFY_PROMPT_BASE + accountHint;

  const contactInfo = knownContact ? `\nContacto conocido: ${knownContact}` : '';
  const userMessage = `De: ${fromEmail}${contactInfo}\nAsunto: ${subject}\n\nCuerpo:\n${bodyText.substring(0, 3000)}`;

  console.log('[molly-brain] Clasificando email de', fromEmail, '| cuenta:', account ?? 'n/a', '| asunto:', subject.substring(0, 60));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      { role: 'user', content: `${prompt}\n\n---\n\n${userMessage}` },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<MollyClassification>(text);

  console.log('[molly-brain] Clasificación:', result.tipo, '| urgencia:', result.urgencia, '| cuenta:', account ?? 'n/a');
  return result;
}

// ── Generate draft response ────────────────────────────────────────────────

const DRAFT_PROMPT_BASE = `Eres Molly, asistente de email IA para Amanda Santizo — papeleo.legal, un despacho jurídico en Guatemala.

Genera un borrador de respuesta profesional al email recibido. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks):

{
  "subject": "Re: asunto original",
  "body_text": "texto plano del borrador",
  "body_html": "<p>versión HTML del borrador</p>",
  "tone": "formal|semiformal|cordial"
}

Reglas:
- Detecta el idioma del email y responde en el mismo idioma (español o inglés)
- No inventes información legal, plazos o montos
- Si hay una pregunta, proporciona una respuesta general y sugiere coordinar detalles
- En HTML usa etiquetas simples: <p>, <br>, <strong>
- No incluyas "Estimado/a" genérico — usa el nombre si está disponible
- Mantén la respuesta concisa (máximo 3-4 párrafos)
- IMPORTANTE: Si el email solicita reunión, consulta, cita, meeting o appointment, NUNCA sugieras horarios específicos. Incluye el link de agendamiento: https://amandasantizo.com/agendar
  Hay dos tipos de cita (sugiere el correcto según el contexto):
  * "Consulta Legal" — para asuntos nuevos, hasta 1 hora, Q500, virtual por Teams. Sugerir si el remitente NO es cliente existente o si plantea un asunto nuevo.
  * "Seguimiento de Caso" — para clientes con caso activo, 15 min, sin costo, virtual por Teams. Sugerir si el remitente es cliente existente con expediente activo.
  Si no es claro, menciona ambas opciones brevemente.`;

function buildDraftPrompt(account?: string): string {
  const config = account && ACCOUNT_DRAFT[account]
    ? ACCOUNT_DRAFT[account]
    : ACCOUNT_DRAFT['asistente@papeleo.legal'];

  return DRAFT_PROMPT_BASE +
    `\n- Firma siempre: "${config.firma}"` +
    `\n- ${config.tono}`;
}

export async function generateDraft(
  email: EmailMessage,
  threadSubject: string,
  clientContext?: string | null,
  recentMessages?: Array<{ from: string; body: string }>,
  account?: string,
): Promise<MollyDraftResult> {
  const client = getClient();

  const prompt = buildDraftPrompt(account);

  let context = `Email a responder:\nDe: ${email.from_name || email.from_email} <${email.from_email}>\nAsunto: ${email.subject}\n\nCuerpo:\n${(email.body_text || '').substring(0, 4000)}`;

  if (clientContext) {
    context += `\n\nContexto del cliente:\n${clientContext}`;
  }

  if (recentMessages?.length) {
    context += '\n\nMensajes recientes del hilo:';
    for (const msg of recentMessages.slice(-3)) {
      context += `\n---\nDe: ${msg.from}\n${msg.body.substring(0, 500)}`;
    }
  }

  console.log('[molly-brain] Generando borrador para', email.from_email, '| cuenta:', account ?? 'n/a', '| asunto:', threadSubject.substring(0, 60));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: `${prompt}\n\n---\n\n${context}` },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<MollyDraftResult>(text);

  console.log('[molly-brain] Borrador generado | tone:', result.tone, '| cuenta:', account ?? 'n/a');
  return result;
}
