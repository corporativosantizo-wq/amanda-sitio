// ============================================================================
// GET /api/admin/catalogo-servicios
// Devuelve los servicios activos del catálogo (legal.catalogo_servicios),
// mapeados a la forma usada por el frontend (nombre, precioBase).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/api-auth';
import { handleApiError } from '@/lib/api-error';

export async function GET(_req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('catalogo_servicios')
      .select('codigo, categoria, servicio, descripcion, precio_base, unidad, activo')
      .eq('activo', true)
      .order('categoria', { ascending: true })
      .order('codigo', { ascending: true });

    if (error) {
      console.error('[catalogo-servicios] Error:', error.message);
      return NextResponse.json({ error: 'Error al cargar catálogo' }, { status: 500 });
    }

    const servicios = (data ?? []).map((row: any) => ({
      codigo: row.codigo,
      categoria: row.categoria,
      nombre: row.servicio,
      descripcion: row.descripcion ?? '',
      precioBase: Number(row.precio_base),
      unidad: row.unidad,
      activo: row.activo,
    }));

    return NextResponse.json({ data: servicios });
  } catch (err) {
    return handleApiError(err, 'catalogo-servicios');
  }
}
