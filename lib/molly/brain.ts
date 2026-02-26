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

// ── Classify email ─────────────────────────────────────────────────────────

const CLASSIFY_PROMPT = `Eres Molly, asistente de email IA para Amanda Santizo — papeleo.legal, un despacho jurídico en Guatemala.

Clasifica el siguiente email y responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks, sin texto adicional):

{
  "tipo": "legal|administrativo|financiero|spam|personal|urgente",
  "urgencia": 0,
  "resumen": "resumen de 1-2 oraciones",
  "cliente_probable": "nombre del cliente probable o null",
  "requiere_respuesta": true,
  "confianza": 0.85
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
- requiere_respuesta = true para: preguntas directas, solicitudes, citas, asuntos legales`;

export async function classifyEmail(
  fromEmail: string,
  subject: string,
  bodyText: string,
  knownContact?: string | null,
): Promise<MollyClassification> {
  const client = getClient();

  const contactInfo = knownContact ? `\nContacto conocido: ${knownContact}` : '';
  const userMessage = `De: ${fromEmail}${contactInfo}\nAsunto: ${subject}\n\nCuerpo:\n${bodyText.substring(0, 3000)}`;

  console.log('[molly-brain] Clasificando email de', fromEmail, '| asunto:', subject.substring(0, 60));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    messages: [
      { role: 'user', content: `${CLASSIFY_PROMPT}\n\n---\n\n${userMessage}` },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<MollyClassification>(text);

  console.log('[molly-brain] Clasificación:', result.tipo, '| urgencia:', result.urgencia, '| respuesta:', result.requiere_respuesta);
  return result;
}

// ── Generate draft response ────────────────────────────────────────────────

const DRAFT_PROMPT = `Eres Molly, asistente de email IA para Amanda Santizo — papeleo.legal, un despacho jurídico en Guatemala.

Genera un borrador de respuesta profesional al email recibido. Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks):

{
  "subject": "Re: asunto original",
  "body_text": "texto plano del borrador",
  "body_html": "<p>versión HTML del borrador</p>",
  "tone": "formal|semiformal|cordial"
}

Reglas:
- Detecta el idioma del email y responde en el mismo idioma (español o inglés)
- Tono profesional pero amable, apropiado para un despacho jurídico
- No inventes información legal, plazos o montos
- Si hay una pregunta, proporciona una respuesta general y sugiere coordinar detalles
- Firma siempre: "Amanda Santizo | papeleo.legal"
- En HTML usa etiquetas simples: <p>, <br>, <strong>
- No incluyas "Estimado/a" genérico — usa el nombre si está disponible
- Mantén la respuesta concisa (máximo 3-4 párrafos)
- IMPORTANTE: Si el email solicita reunión, consulta, cita, meeting o appointment, NUNCA sugieras horarios específicos. Incluye el link de agendamiento: https://amandasantizo.com/agendar
  Hay dos tipos de cita (sugiere el correcto según el contexto):
  * "Consulta Legal" — para asuntos nuevos, hasta 1 hora, Q500, virtual por Teams, disponible lunes/miércoles/viernes. Sugerir si el remitente NO es cliente existente o si plantea un asunto nuevo.
  * "Seguimiento de Caso" — para clientes con caso activo, 15 min, sin costo, virtual por Teams, disponible martes/miércoles. Sugerir si el remitente es cliente existente con expediente activo.
  Si no es claro, menciona ambas opciones brevemente.`;

export async function generateDraft(
  email: EmailMessage,
  threadSubject: string,
  clientContext?: string | null,
  recentMessages?: Array<{ from: string; body: string }>,
): Promise<MollyDraftResult> {
  const client = getClient();

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

  console.log('[molly-brain] Generando borrador para', email.from_email, '| asunto:', threadSubject.substring(0, 60));

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    messages: [
      { role: 'user', content: `${DRAFT_PROMPT}\n\n---\n\n${context}` },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const result = parseJsonResponse<MollyDraftResult>(text);

  console.log('[molly-brain] Borrador generado | tone:', result.tone, '| length:', result.body_text.length);
  return result;
}
