// ============================================================================
// POST /api/admin/contabilidad/ai
// Asistente IA Contable — chat para panel de contabilidad
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/services/outlook.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { solicitarFacturaRE } from '@/lib/services/factura-re.service';
import { listarPagos, resumenPagos } from '@/lib/services/pagos.service';
import { listarCobros, resumenCobros } from '@/lib/services/cobros.service';
import { listarCotizaciones } from '@/lib/services/cotizaciones.service';

export const maxDuration = 120;

const anthropic = getAnthropicClient();
const db = () => createAdminClient();

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente contable del Despacho Jurídico Boutique de Amanda Santizo. Tu función es ayudar con la gestión financiera del despacho.

EQUIPO CONTABLE:
- Daniel Herrera — Contador del despacho (contador@papeleo.legal)
- RE Contadores — Servicio freelance de contabilidad que genera las facturas FEL
  - contabilidad@re.com.gt
  - veronica.zoriano@re.com.gt
  - joaquin.sandoval@re.com.gt

FUNCIONES:
1. Solicitar facturas a RE Contadores cuando se registren pagos
2. Consultar estado de cobros y pagos
3. Consultar cotizaciones y su estado de pago
4. Generar reportes de ingresos/egresos
5. Recordatorios de cobros vencidos

REGLAS:
- Moneda: Quetzales (Q), formato Q1,500.00
- IVA: 12% (solo en factura final, no anticipos)
- ISR retención: 5% (<Q30,000), 7% (>=Q30,000)
- Enviar solicitudes de factura desde contador@papeleo.legal
- SIEMPRE incluir NIT del cliente (buscar en BD, si no tiene usar CF)
- NUNCA enviar emails sin confirmación de Amanda
- Tono formal con RE Contadores
- Responde en español Guatemala
- Sé conciso y directo`;

// ── Tool Definitions ────────────────────────────────────────────────────────

const CONTABLE_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: 'solicitar_factura',
    description: 'Solicita la emisión de factura a RE Contadores. Envía email con datos del pago y marca el pago como factura_solicitada. Requiere confirmación previa de Amanda.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pago_id: { type: 'string', description: 'UUID del pago' },
        cliente_nombre: { type: 'string', description: 'Nombre completo del cliente' },
        cliente_nit: { type: 'string', description: 'NIT del cliente (o "CF" si no tiene)' },
        concepto: { type: 'string', description: 'Descripción del servicio/pago' },
        monto: { type: 'number', description: 'Monto del pago en Quetzales' },
        fecha_pago: { type: 'string', description: 'Fecha del pago YYYY-MM-DD' },
        referencia_bancaria: { type: 'string', description: 'Número de boleta/transferencia (opcional)' },
      },
      required: ['pago_id', 'cliente_nombre', 'cliente_nit', 'concepto', 'monto', 'fecha_pago'],
    },
  },
  {
    name: 'consultar_pagos',
    description: 'Consulta pagos registrados. Puede filtrar por cliente, estado, fecha, etc. También puede obtener un resumen general.',
    input_schema: {
      type: 'object' as const,
      properties: {
        accion: { type: 'string', enum: ['listar', 'resumen'], description: 'listar: buscar pagos, resumen: totales generales' },
        cliente_id: { type: 'string', description: 'UUID del cliente para filtrar' },
        estado: { type: 'string', enum: ['registrado', 'confirmado', 'rechazado'], description: 'Filtrar por estado' },
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        busqueda: { type: 'string', description: 'Buscar cliente por nombre (se resuelve a UUID)' },
      },
      required: ['accion'],
    },
  },
  {
    name: 'consultar_cobros',
    description: 'Consulta cobros (cuentas por cobrar). Puede filtrar por estado (pendiente, vencido, parcial, pagado) o por cliente. También obtiene resumen de cobros.',
    input_schema: {
      type: 'object' as const,
      properties: {
        accion: { type: 'string', enum: ['listar', 'resumen'], description: 'listar: buscar cobros, resumen: totales generales' },
        estado: { type: 'string', enum: ['pendiente', 'vencido', 'parcial', 'pagado', 'vencidos'], description: 'Filtrar por estado' },
        cliente_id: { type: 'string', description: 'UUID del cliente' },
        busqueda: { type: 'string', description: 'Buscar por concepto o nombre de cliente' },
      },
      required: ['accion'],
    },
  },
  {
    name: 'consultar_cotizaciones',
    description: 'Consulta cotizaciones. Puede buscar por número (COT-XXXXX), nombre de cliente, o estado.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busqueda: { type: 'string', description: 'Buscar por número de cotización (COT-XXXXX) o nombre de cliente' },
        estado: { type: 'string', enum: ['borrador', 'enviada', 'aceptada', 'rechazada', 'vencida'], description: 'Filtrar por estado' },
        cliente_id: { type: 'string', description: 'UUID del cliente' },
      },
    },
  },
  {
    name: 'enviar_email',
    description: 'Envía un email desde contador@papeleo.legal. SIEMPRE muestra borrador a Amanda antes de enviar. Para solicitudes de factura a RE, usa solicitar_factura en su lugar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        to: { type: 'string', description: 'Destinatario(s), separados por coma' },
        subject: { type: 'string', description: 'Asunto del email' },
        htmlBody: { type: 'string', description: 'Cuerpo del email en HTML' },
        cc: { type: 'string', description: 'CC opcional' },
      },
      required: ['to', 'subject', 'htmlBody'],
    },
  },
];

// ── Tool Handlers ───────────────────────────────────────────────────────────

async function handleTool(name: string, input: any): Promise<string> {
  switch (name) {
    case 'solicitar_factura':
      return handleSolicitarFactura(input);
    case 'consultar_pagos':
      return handleConsultarPagos(input);
    case 'consultar_cobros':
      return handleConsultarCobros(input);
    case 'consultar_cotizaciones':
      return handleConsultarCotizaciones(input);
    case 'enviar_email':
      return handleEnviarEmail(input);
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

async function handleSolicitarFactura(input: any): Promise<string> {
  try {
    await solicitarFacturaRE({
      pago_id: input.pago_id,
      cliente_nombre: input.cliente_nombre,
      cliente_nit: input.cliente_nit || 'CF',
      concepto: input.concepto,
      monto: input.monto,
      fecha_pago: input.fecha_pago,
      referencia_bancaria: input.referencia_bancaria || null,
    });
    return JSON.stringify({
      exito: true,
      mensaje: `Factura solicitada a RE Contadores para ${input.cliente_nombre} — Q${input.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function handleConsultarPagos(input: any): Promise<string> {
  try {
    if (input.accion === 'resumen') {
      const resumen = await resumenPagos();
      return JSON.stringify(resumen);
    }

    // Resolver nombre de cliente a UUID si es necesario
    let clienteId = input.cliente_id;
    if (!clienteId && input.busqueda) {
      clienteId = await resolverClienteId(input.busqueda);
    }

    const result = await listarPagos({
      cliente_id: clienteId,
      estado: input.estado,
      desde: input.desde,
      hasta: input.hasta,
      limit: 20,
    });

    return JSON.stringify({
      total: result.total,
      pagos: result.data.map((p: any) => ({
        id: p.id,
        numero: p.numero,
        cliente: p.cliente?.nombre,
        monto: p.monto,
        estado: p.estado,
        metodo: p.metodo,
        fecha_pago: p.fecha_pago,
        referencia: p.referencia_bancaria,
        factura: p.factura?.numero ?? null,
        factura_solicitada: p.factura_solicitada ?? false,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function handleConsultarCobros(input: any): Promise<string> {
  try {
    if (input.accion === 'resumen') {
      const resumen = await resumenCobros();
      return JSON.stringify(resumen);
    }

    let clienteId = input.cliente_id;
    if (!clienteId && input.busqueda) {
      // Intentar resolver como nombre de cliente
      const id = await resolverClienteId(input.busqueda);
      if (id) clienteId = id;
    }

    const result = await listarCobros({
      estado: input.estado,
      cliente_id: clienteId,
      busqueda: !clienteId ? input.busqueda : undefined,
      limit: 30,
    });

    return JSON.stringify({
      total: result.total,
      cobros: result.data.map((c: any) => ({
        id: c.id,
        numero_cobro: c.numero_cobro,
        cliente: c.cliente?.nombre,
        concepto: c.concepto,
        monto: c.monto,
        monto_pagado: c.monto_pagado,
        saldo_pendiente: c.saldo_pendiente,
        estado: c.estado,
        fecha_emision: c.fecha_emision,
        fecha_vencimiento: c.fecha_vencimiento,
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function handleConsultarCotizaciones(input: any): Promise<string> {
  try {
    let clienteId = input.cliente_id;
    if (!clienteId && input.busqueda) {
      // Si es un número de cotización, buscar directo
      if (!input.busqueda.startsWith('COT-')) {
        const id = await resolverClienteId(input.busqueda);
        if (id) clienteId = id;
      }
    }

    const result = await listarCotizaciones({
      estado: input.estado,
      cliente_id: clienteId,
      busqueda: input.busqueda,
      limit: 20,
    });

    return JSON.stringify({
      total: result.total,
      cotizaciones: result.data.map((c: any) => ({
        id: c.id,
        numero: c.numero,
        cliente: c.cliente?.nombre,
        estado: c.estado,
        subtotal: c.subtotal,
        iva_monto: c.iva_monto,
        total: c.total,
        anticipo_monto: c.anticipo_monto,
        fecha_emision: c.fecha_emision,
        fecha_vencimiento: c.fecha_vencimiento,
        items: c.items?.map((i: any) => ({
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          total: i.total,
        })),
      })),
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function handleEnviarEmail(input: any): Promise<string> {
  try {
    await sendMail({
      from: 'contador@papeleo.legal',
      to: input.to,
      subject: input.subject,
      htmlBody: input.htmlBody,
      cc: input.cc,
    });
    return JSON.stringify({ exito: true, mensaje: `Email enviado a ${input.to}` });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function resolverClienteId(busqueda: string): Promise<string | undefined> {
  const { data } = await db()
    .from('clientes')
    .select('id')
    .ilike('nombre', `%${busqueda}%`)
    .limit(1)
    .single();

  return data?.id;
}

// ── Retry wrapper ───────────────────────────────────────────────────────────

async function callWithRetry(
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: any) {
      const status = err?.status ?? err?.error?.status;
      if (status === 529 && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
        continue;
      }
      throw err;
    }
  }
  throw new Error('Asistente contable ocupado, intenta de nuevo.');
}

// ── POST Handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body as { messages: Array<{ role: string; content: string }> };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: 'Mensajes requeridos' }, { status: 400 });
    }

    // Convert to Anthropic format
    const anthropicMessages: Anthropic.Messages.MessageParam[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Initial call
    let response = await callWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: CONTABLE_TOOLS,
      messages: anthropicMessages,
    });

    // Tool use loop
    let conversationMessages: any[] = [...anthropicMessages];
    const MAX_ROUNDS = 5;
    let rounds = 0;

    while (response.stop_reason === 'tool_use' && rounds < MAX_ROUNDS) {
      rounds++;
      const toolResults: any[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`[ContableAI] Tool: ${block.name}`, JSON.stringify(block.input).substring(0, 200));
          const result = await handleTool(block.name, block.input);
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

      response = await callWithRetry({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: CONTABLE_TOOLS,
        messages: conversationMessages,
      });
    }

    // Extract text response
    const textBlock = response.content.find((b) => b.type === 'text') as Anthropic.Messages.TextBlock | undefined;
    const reply = textBlock?.text ?? 'No pude procesar la consulta. Intenta de nuevo.';

    return Response.json({ role: 'assistant', content: reply });
  } catch (error: any) {
    console.error('[ContableAI] Error:', error);

    if (error?.status === 529) {
      return Response.json(
        { error: 'El asistente contable está ocupado. Intenta de nuevo en unos segundos.' },
        { status: 503 },
      );
    }

    return Response.json(
      { error: 'Error interno del asistente contable' },
      { status: 500 },
    );
  }
}
