// ============================================================================
// POST /api/admin/molly/salientes/generar
// Redacta un correo NUEVO con IA a partir de una instrucción libre y lo deja
// como borrador saliente (status 'pendiente'). NUNCA envía — Amanda revisa,
// edita si quiere, y recién ahí aprueba/envía desde "Correos salientes".
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import { generateOutgoingEmail } from '@/lib/molly/brain';
import { crearBorradorIA, SalienteError } from '@/lib/services/salientes.service';
import { createAdminClient } from '@/lib/supabase/admin';

// La redacción con IA (Anthropic) tarda varios segundos; el default de Vercel
// (~10-15s) no alcanza y la función se corta con un timeout (HTML) en vez de
// devolver JSON. Subimos el límite como el resto de endpoints de IA.
export const maxDuration = 120;

function splitEmails(input: unknown): string[] {
  if (Array.isArray(input)) return input.map((s) => String(s).trim()).filter(Boolean);
  if (typeof input === 'string') return input.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const instruccion = String(body?.instruccion ?? '').trim();
    const account = String(body?.account ?? '').trim();
    if (!instruccion) return NextResponse.json({ error: 'Falta la instrucción para la IA.' }, { status: 400 });
    if (!account) return NextResponse.json({ error: 'Falta la cuenta de envío.' }, { status: 400 });

    const to = splitEmails(body?.to_emails ?? body?.to);
    const cc = splitEmails(body?.cc_emails ?? body?.cc);
    const clienteId: string | null = body?.cliente_id ?? null;

    // Contexto del cliente (opcional) para que la IA personalice el correo.
    let clientContext: string | null = null;
    if (clienteId) {
      const db = createAdminClient();
      const { data: cli } = await db
        .from('clientes')
        .select('nombre, tipo')
        .eq('id', clienteId)
        .maybeSingle();
      if (cli?.nombre) clientContext = `Cliente: ${cli.nombre}${cli.tipo ? ` (${cli.tipo})` : ''}`;
    }

    // 1) La IA redacta SOLO el cuerpo + asunto según la instrucción.
    const draft = await generateOutgoingEmail(instruccion, account, clientContext);

    // 2) Cae como borrador saliente 'pendiente' (editable, no se envía solo).
    const borrador = await crearBorradorIA({
      account,
      subject: draft.subject,
      body_text: draft.body_text,
      body_html: draft.body_html ?? null,
      to_emails: to,
      cc_emails: cc.length ? cc : null,
      cliente_id: clienteId,
    });

    return NextResponse.json({ data: borrador }, { status: 201 });
  } catch (err) {
    const msg = err instanceof SalienteError ? err.message
      : err instanceof Error ? err.message
      : 'Error al redactar el correo con IA';
    const status = err instanceof SalienteError ? 400 : 500;
    console.error('[salientes/generar] Error:', msg);
    return NextResponse.json({ error: msg }, { status });
  }
}
