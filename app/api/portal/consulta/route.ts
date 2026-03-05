// ============================================================================
// /api/portal/consulta
// POST: Crear solicitud de consulta extra (Q500)
// GET: Listar consultas del cliente
// ============================================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

const ASUNTOS_VALIDOS = [
  'Consulta legal general',
  'Revisión de contrato',
  'Asesoría empresarial',
  'Trámite notarial',
  'Litigio o demanda',
  'Propiedad intelectual',
  'Derecho internacional',
  'Otro',
];

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const { allowed } = checkRateLimit(`consulta:${ip}`, 10, 60_000);
    if (!allowed) {
      return Response.json(
        { error: 'Demasiadas solicitudes.' },
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

    const body = await req.json();
    const asunto = (body.asunto ?? '').trim().slice(0, 200);
    const descripcion = (body.descripcion ?? '').trim().slice(0, 2000);
    const fechaPreferida = body.fecha_preferida ?? null;

    if (!asunto) {
      return Response.json(
        { error: 'El asunto es requerido.' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    // Validar asunto
    if (
      !ASUNTOS_VALIDOS.includes(asunto) &&
      !asunto.startsWith('Otro:')
    ) {
      return Response.json(
        { error: 'Asunto no válido.' },
        { status: 400, headers: SECURITY_HEADERS }
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from('consultas_extra')
      .insert({
        cliente_id: session.clienteId,
        asunto,
        descripcion: descripcion || null,
        fecha_programada: fechaPreferida || null,
        monto: 500.0,
      })
      .select('id, asunto, estado, monto, fecha_solicitada')
      .single();

    if (error) {
      console.error('[Portal Consulta] Insert error:', error);
      return Response.json(
        { error: 'Error al crear la solicitud.' },
        { status: 500, headers: SECURITY_HEADERS }
      );
    }

    return Response.json(
      {
        success: true,
        consulta: data,
        message:
          'Su solicitud ha sido recibida. Nos comunicaremos para confirmar la cita.',
      },
      { status: 201, headers: SECURITY_HEADERS }
    );
  } catch (error: any) {
    console.error('[Portal Consulta] Error:', error);
    return Response.json(
      { error: 'Error interno del servidor.' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}

export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`consulta-list:${ip}`, 60, 60_000);
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
    .from('consultas_extra')
    .select(
      'id, asunto, descripcion, estado, monto, fecha_solicitada, fecha_programada'
    )
    .eq('cliente_id', session.clienteId)
    .order('fecha_solicitada', { ascending: false });

  return Response.json(
    { consultas: data ?? [] },
    { headers: SECURITY_HEADERS }
  );
}
