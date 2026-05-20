// ============================================================================
// GET /api/admin/contabilidad/cotizaciones/[id]/seguimiento
// Devuelve los datos necesarios para armar el email de seguimiento:
// cliente, número, asunto (primer item), trámites con avances.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listarTramitesDeCotizacion } from '@/lib/services/tramites.service';
import { requireAdmin } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await ctx.params;
    const db = createAdminClient();

    const { data: cot, error } = await db
      .from('cotizaciones')
      .select(`
        id, numero, fecha_emision, total,
        items:cotizacion_items!cotizacion_id (id, descripcion, orden),
        cliente:clientes!cliente_id (id, nombre, email, nit)
      `)
      .eq('id', id)
      .single();

    if (error || !cot) {
      return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
    }

    const items = ((cot.items ?? []) as Array<{ descripcion: string | null; orden: number | null }>)
      .slice()
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const asunto = items[0]?.descripcion?.trim() ?? 'Servicios profesionales';

    const tramites = await listarTramitesDeCotizacion(id);

    return NextResponse.json({
      cotizacion: {
        id: cot.id,
        numero: cot.numero,
        fecha_emision: cot.fecha_emision,
        asunto,
        cliente: cot.cliente,
      },
      tramites: tramites.map(t => ({
        id: t.id,
        nombre: t.nombre,
        estado: t.estado,
        avances: t.avances.map(a => ({
          id: a.id,
          fecha: a.fecha,
          descripcion: a.descripcion,
        })),
      })),
    });
  } catch (err) {
    return handleApiError(err, 'cotizaciones/seguimiento');
  }
}
