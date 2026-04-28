// ============================================================================
// GET /api/admin/cobros/recordatorios?cobro_ids=uuid1,uuid2,...
// Devuelve agregado por cobro: ultimo_envio (MAX) + total_envios (COUNT)
// solo para registros con email_enviado = true.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('cobro_ids');
  if (!raw) {
    return NextResponse.json({ data: [] });
  }

  const cobroIds = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (cobroIds.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const db = createAdminClient();

  // PostgREST no soporta GROUP BY directamente; traemos las filas relevantes
  // (orden DESC por fecha_envio) y agrupamos en memoria. N suele ser <= 100.
  const { data, error } = await db
    .from('recordatorios_cobro')
    .select('cobro_id, fecha_envio')
    .in('cobro_id', cobroIds)
    .eq('email_enviado', true)
    .order('fecha_envio', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byId = new Map<string, { ultimo_envio: string; total_envios: number }>();
  for (const r of data ?? []) {
    const existing = byId.get(r.cobro_id);
    if (!existing) {
      byId.set(r.cobro_id, { ultimo_envio: r.fecha_envio, total_envios: 1 });
    } else {
      // ultimo_envio ya es correcto porque vienen ordenados DESC
      existing.total_envios++;
    }
  }

  const out = Array.from(byId.entries()).map(([cobro_id, v]) => ({
    cobro_id,
    ultimo_envio: v.ultimo_envio,
    total_envios: v.total_envios,
  }));

  return NextResponse.json({ data: out });
}
