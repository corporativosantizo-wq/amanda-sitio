// ============================================================================
// GET /api/portal/datos?tipo=resumen|cotizaciones|facturas
// Obtener datos del cliente autenticado
// ============================================================================
import { createAdminClient } from '@/lib/supabase/admin';
import { getPortalSession, SECURITY_HEADERS } from '@/lib/portal/auth';
import { checkRateLimit } from '@/lib/portal/rate-limit';

export async function GET(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { allowed } = checkRateLimit(`datos:${ip}`, 60, 60_000);
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

  const url = new URL(req.url);
  const tipo = url.searchParams.get('tipo');
  const db = createAdminClient();

  try {
    switch (tipo) {
      case 'resumen': {
        // Dashboard: resumen de cotizaciones, facturas, documentos
        const [cotRes, facRes, escRes, tesRes] = await Promise.all([
          db
            .from('cotizaciones')
            .select('id, total, estado')
            .eq('cliente_id', session.clienteId),
          db
            .from('facturas')
            .select('id, total, estado')
            .eq('cliente_id', session.clienteId),
          db
            .from('escrituras')
            .select('id')
            .eq('cliente_id', session.clienteId)
            .not('pdf_escritura_url', 'is', null),
          db
            .from('testimonios')
            .select('id, escritura_id')
            .not('pdf_url', 'is', null),
        ]);

        const cotizaciones = cotRes.data ?? [];
        const facturas = facRes.data ?? [];
        const escrituras = escRes.data ?? [];

        // Filtrar testimonios que pertenezcan a escrituras del cliente
        const escrituraIds = new Set(
          (
            (
              await db
                .from('escrituras')
                .select('id')
                .eq('cliente_id', session.clienteId)
            ).data ?? []
          ).map((e: any) => e.id)
        );
        const testimonios = (tesRes.data ?? []).filter((t: any) =>
          escrituraIds.has(t.escritura_id)
        );

        const cotActivas = cotizaciones.filter(
          (c: any) => c.estado === 'enviada' || c.estado === 'aceptada'
        );
        const facPendientes = facturas.filter(
          (f: any) => f.estado === 'pendiente' || f.estado === 'parcial'
        );

        return Response.json(
          {
            cotizaciones_activas: cotActivas.length,
            cotizaciones_monto: cotActivas.reduce(
              (s: number, c: any) => s + (c.total ?? 0),
              0
            ),
            facturas_pendientes: facPendientes.length,
            facturas_monto: facPendientes.reduce(
              (s: number, f: any) => s + (f.total ?? 0),
              0
            ),
            documentos_disponibles: escrituras.length + testimonios.length,
          },
          { headers: SECURITY_HEADERS }
        );
      }

      case 'cotizaciones': {
        const { data } = await db
          .from('cotizaciones')
          .select('id, numero, fecha_emision, total, estado, condiciones, notas_internas')
          .eq('cliente_id', session.clienteId)
          .order('fecha_emision', { ascending: false });

        // No exponer notas_internas al cliente
        const cleaned = (data ?? []).map((c: any) => ({
          id: c.id,
          numero: c.numero,
          fecha_emision: c.fecha_emision,
          total: c.total,
          estado: c.estado,
          condiciones: c.condiciones,
        }));

        return Response.json({ cotizaciones: cleaned }, { headers: SECURITY_HEADERS });
      }

      case 'cotizacion_detalle': {
        const cotId = url.searchParams.get('id');
        if (!cotId) {
          return Response.json(
            { error: 'ID requerido' },
            { status: 400, headers: SECURITY_HEADERS }
          );
        }

        const { data: cot } = await db
          .from('cotizaciones')
          .select(
            'id, numero, fecha_emision, fecha_vencimiento, total, subtotal, iva_monto, estado, condiciones'
          )
          .eq('id', cotId)
          .eq('cliente_id', session.clienteId)
          .single();

        if (!cot) {
          return Response.json(
            { error: 'No encontrada' },
            { status: 404, headers: SECURITY_HEADERS }
          );
        }

        const { data: items } = await db
          .from('cotizacion_items')
          .select('descripcion, cantidad, precio_unitario, total, orden')
          .eq('cotizacion_id', cotId)
          .order('orden', { ascending: true });

        return Response.json(
          { cotizacion: cot, items: items ?? [] },
          { headers: SECURITY_HEADERS }
        );
      }

      case 'facturas': {
        const { data } = await db
          .from('facturas')
          .select(
            'id, numero, fecha_emision, total, estado, fel_numero_dte, fel_serie'
          )
          .eq('cliente_id', session.clienteId)
          .order('fecha_emision', { ascending: false });

        return Response.json(
          { facturas: data ?? [] },
          { headers: SECURITY_HEADERS }
        );
      }

      default:
        return Response.json(
          { error: 'Tipo de dato no válido' },
          { status: 400, headers: SECURITY_HEADERS }
        );
    }
  } catch (error: any) {
    console.error('[Portal Datos] Error:', error);
    return Response.json(
      { error: 'Error al obtener datos' },
      { status: 500, headers: SECURITY_HEADERS }
    );
  }
}
