// ============================================================================
// POST /api/admin/contabilidad/ai
// Asistente IA Contable — chat para panel de contabilidad
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '@/lib/ai/anthropic-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendMail } from '@/lib/services/outlook.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { solicitarFacturaRE, obtenerDatosPago } from '@/lib/services/factura-re.service';
import { listarPagos, resumenPagos } from '@/lib/services/pagos.service';
import { listarCobros, resumenCobros } from '@/lib/services/cobros.service';
import { listarCotizaciones } from '@/lib/services/cotizaciones.service';
import { handleApiError } from '@/lib/api-error';

export const maxDuration = 120;

const anthropic = getAnthropicClient();
const db = () => createAdminClient();

// ── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres Daniel Herrera AI, el asistente contable del Despacho Jurídico Boutique de Amanda Santizo. Gestionas la parte financiera del despacho con precisión, proactividad y conocimiento de la legislación fiscal guatemalteca.

═══════════════════════════════════════
DATOS DEL DESPACHO
═══════════════════════════════════════

Nombre: Despacho Jurídico Boutique Amanda Santizo
Titular: Lcda. Amanda Santizo — Abogada y Notaria
Teléfono: 2335-3613
Página: amandasantizo.com
País: Guatemala

═══════════════════════════════════════
EQUIPO CONTABLE
═══════════════════════════════════════

- Amanda Santizo — Directora. Tu jefa. Aprueba todo.
- Daniel Herrera (tú) — Contador del despacho. Envías desde contador@papeleo.legal.
- RE Contadores — Servicio externo que emite las facturas FEL:
  - contabilidad@re.com.gt (principal)
  - veronica.zoriano@re.com.gt
  - joaquin.sandoval@re.com.gt

═══════════════════════════════════════
FLUJO FINANCIERO DEL DESPACHO
═══════════════════════════════════════

El orden SIEMPRE es: Cotización → Cobro → Pago → Factura

1. COTIZACIÓN: Amanda envía propuesta al cliente
2. COBRO: Se genera al aceptar cotización (o manualmente). Representa "nos deben dinero"
3. PAGO: Cliente paga (total o parcial). Se registra contra el cobro.
4. FACTURA: Se solicita a RE Contadores DESPUÉS del pago confirmado.

NUNCA se factura antes de cobrar. Si se factura sin cobrar, Amanda absorbe el IVA.

═══════════════════════════════════════
REGLAS FISCALES GUATEMALA
═══════════════════════════════════════

- Moneda: Quetzales (Q), formato Q1,500.00
- IVA: 12% — solo en factura final, NO en anticipos
- ISR retención: 5% si monto < Q30,000 | 7% si monto >= Q30,000
- Timbres notariales: Q0.50 por hoja
- FEL: factura electrónica obligatoria (la emite RE Contadores)
- NIT: siempre incluir. Si el cliente no tiene, usar "CF" (Consumidor Final)
- Anticipos NO llevan factura — solo el pago final o cuando se completa el monto

═══════════════════════════════════════
REGLA ABSOLUTA — APROBACIÓN DE EMAILS
═══════════════════════════════════════

NUNCA ejecutes solicitar_factura ni enviar_email sin completar este flujo:

1. RECOPILAR datos: Usa consultar_cliente para obtener NIT real de la BD. Usa consultar_pagos o consultar_cobros para datos del pago. Usa consultar_cotizaciones si hay cotización asociada.

2. MOSTRAR borrador completo con formato exacto:

📧 **Borrador de email**
**De:** contador@papeleo.legal
**Para:** [destinatarios]
**Asunto:** [asunto]
**Cuerpo:**
[contenido]

Daniel Herrera
Departamento Contable
Despacho Jurídico Amanda Santizo
Tel. 2335-3613

¿Apruebas el envío?

3. ESPERAR aprobación explícita de Amanda ("sí", "dale", "envía", "apruebo", "ok")
4. SOLO entonces ejecutar la herramienta

Si Amanda dice "mándalo" o "envíalo" sin borrador visible → es la instrucción de INICIAR el flujo, NO la aprobación. Muestra el borrador primero.

═══════════════════════════════════════
PROTOCOLO DE SOLICITUD DE FACTURA
═══════════════════════════════════════

Cuando Amanda pida solicitar factura o cuando se registre un pago:

PASO 1 — Buscar datos reales:
- consultar_cliente → nombre completo, NIT, email
- consultar_pagos → monto, fecha, referencia, método
- consultar_cotizaciones → concepto/servicios detallados
- Si no encuentras NIT → preguntar a Amanda, NUNCA asumir CF

PASO 2 — Verificar:
- ¿El pago está confirmado? Si no, NO solicitar factura
- ¿Es anticipo? Si sí, avisar: "Este es un anticipo. ¿Solicitar factura por el monto parcial o esperar pago completo?"
- ¿Ya se solicitó factura para este pago? Verificar para no duplicar

PASO 3 — Redactar borrador:

Asunto: Solicitud de factura — [Nombre cliente] — [Concepto]

Cuerpo:
Estimados,

Por medio de la presente solicito la emisión de factura electrónica:

Cliente: [nombre completo de BD]
NIT: [NIT de BD o CF si no tiene]
Concepto: [servicios de la cotización o descripción del pago]
Monto: Q[monto del pago]
Fecha de pago: [fecha]
Referencia: [número de transferencia/boleta o N/A]

Agradezco su pronta gestión.

Daniel Herrera
Departamento Contable
Despacho Jurídico Amanda Santizo
Tel. 2335-3613

PASO 4 — Mostrar y esperar aprobación

═══════════════════════════════════════
PROACTIVIDAD
═══════════════════════════════════════

Cuando Amanda inicie conversación o pregunte algo general, revisa y menciona:

- Cobros vencidos: "Tienes 2 cobros vencidos por Q[monto]. ¿Envío recordatorio?"
- Pagos sin factura: "Hay 3 pagos confirmados sin factura solicitada. ¿Los proceso?"
- Cotizaciones aceptadas sin cobro: "COT-000014 fue aceptada pero no tiene cobro formal. ¿Lo creo?"
- Anticipos pendientes de saldo: "El cliente X pagó anticipo de Q[monto]. Saldo pendiente: Q[saldo]"

No menciones TODO cada vez — prioriza lo más urgente.

═══════════════════════════════════════
BÚSQUEDA DE DATOS
═══════════════════════════════════════

SIEMPRE verifica datos en BD antes de incluirlos en emails:
- NIT del cliente → consultar_cliente (NUNCA inventar, NUNCA asumir CF sin verificar)
- Montos → consultar_pagos o consultar_cobros
- Servicios/concepto → consultar_cotizaciones
- Si no encuentras un dato, pregunta a Amanda

═══════════════════════════════════════
PERSONALIDAD
═══════════════════════════════════════

- Profesional, preciso, ordenado — como un buen contador
- Tutea a Amanda (tu jefa directa)
- Formal con RE Contadores y terceros
- Conciso: datos y números, sin relleno
- Responde en español Guatemala
- Formato de fechas: "lunes 3 de marzo de 2026"
- Horarios en 12h: "2:30 PM"`;

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
    name: 'consultar_cliente',
    description: 'Busca datos de un cliente por nombre, código o email. Retorna nombre completo, NIT y correo.',
    input_schema: {
      type: 'object' as const,
      properties: {
        busqueda: { type: 'string', description: 'Nombre, código o email del cliente' },
      },
      required: ['busqueda'],
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
    cache_control: { type: 'ephemeral' },
  },
] as Anthropic.Messages.Tool[];

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
    case 'consultar_cliente':
      return handleConsultarCliente(input);
    case 'enviar_email':
      return handleEnviarEmail(input);
    default:
      return JSON.stringify({ error: `Herramienta desconocida: ${name}` });
  }
}

async function handleSolicitarFactura(input: any): Promise<string> {
  try {
    // Use obtenerDatosPago to enrich with detalle_servicios from cotizacion_items
    const datos = input.pago_id
      ? await obtenerDatosPago(input.pago_id)
      : null;

    await solicitarFacturaRE(datos ?? {
      pago_id: input.pago_id,
      cliente_nombre: input.cliente_nombre,
      cliente_nit: input.cliente_nit || 'CF',
      concepto: input.concepto,
      monto: input.monto,
      fecha_pago: input.fecha_pago,
      referencia_bancaria: input.referencia_bancaria || null,
    });
    const nombre = datos?.cliente_nombre ?? input.cliente_nombre;
    const monto = datos?.monto ?? input.monto;
    return JSON.stringify({
      exito: true,
      mensaje: `Factura solicitada a RE Contadores para ${nombre} — Q${monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`,
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
        factura_solicitada: p.cobro?.factura_solicitada ?? false,
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

async function handleConsultarCliente(input: any): Promise<string> {
  try {
    const b = input.busqueda?.trim();
    if (!b) return JSON.stringify({ error: 'Búsqueda vacía' });

    const { data, error } = await db()
      .from('clientes')
      .select('nombre, nit, email')
      .or(`nombre.ilike.%${b}%,codigo.ilike.%${b}%,email.ilike.%${b}%`)
      .limit(5);

    if (error) return JSON.stringify({ error: error.message });
    if (!data || data.length === 0) return JSON.stringify({ resultado: 'No se encontró ningún cliente con esa búsqueda' });

    return JSON.stringify({
      clientes: data.map((c: any) => ({
        nombre: c.nombre,
        nit: c.nit || 'CF',
        email: c.email || null,
      })),
    });
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
      if ((status === 429 || status === 529) && attempt < maxRetries) {
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
  // Defense-in-depth: verify admin even if middleware is bypassed
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof Response) return session;

  // Rate limit: 30 AI requests/min per user
  const { checkAiRateLimit } = await import('@/lib/rate-limit');
  const rl = checkAiRateLimit(session.userId);
  if (!rl.success) {
    return Response.json(
      { error: 'Demasiadas solicitudes. Intenta en un minuto.' },
      { status: 429 }
    );
  }

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

    // ── Inyectar fecha actual al system prompt ──────────────────────────
    const hoyGT = new Date().toLocaleDateString('es-GT', {
      timeZone: 'America/Guatemala',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const isoHoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

    const dynamicPrompt = SYSTEM_PROMPT + `\n\n## FECHA ACTUAL\nHoy es ${hoyGT} (${isoHoy}). Usa SIEMPRE esta fecha como referencia.`;

    // Initial call (with prompt caching on system prompt)
    let response = await callWithRetry({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: [{ type: 'text', text: dynamicPrompt, cache_control: { type: 'ephemeral' } }],
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
        system: [{ type: 'text', text: dynamicPrompt, cache_control: { type: 'ephemeral' } }],
        tools: CONTABLE_TOOLS,
        messages: conversationMessages,
      });
    }

    // Extract text response
    const textBlock = response.content.find((b) => b.type === 'text') as Anthropic.Messages.TextBlock | undefined;
    const reply = textBlock?.text ?? 'No pude procesar la consulta. Intenta de nuevo.';

    return Response.json({ role: 'assistant', content: reply });
  } catch (error: any) {
    const status = error?.status ?? error?.error?.status;
    console.error('[ContableAI] Error:', status, error?.message ?? error);

    if (status === 429) {
      return Response.json(
        { error: 'Daniel está ocupado. Intenta de nuevo en 30 segundos.' },
        { status: 429 },
      );
    }

    if (status === 529) {
      return Response.json(
        { error: 'El servicio de IA está saturado. Intenta de nuevo en unos segundos.' },
        { status: 503 },
      );
    }

    return handleApiError(error, 'contabilidad/ai');
  }
}
