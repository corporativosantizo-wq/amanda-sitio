// ============================================================================
// GET /api/admin/documentos/reporte — Estadísticas de escaneo de documentos
// Query params: desde, hasta, tipo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const tipo = s.get('tipo') || undefined;

    // Default: last 30 days
    const ahora = new Date();
    const defaultDesde = new Date(ahora);
    defaultDesde.setDate(defaultDesde.getDate() - 29);

    const desde = s.get('desde') || defaultDesde.toISOString().split('T')[0];
    const hasta = s.get('hasta') || ahora.toISOString().split('T')[0];

    // 1. Fetch all documents in range
    let query = db()
      .from('documentos')
      .select('id, created_at, cliente_id, tipo, paginas, estado, clasificado_por_ia')
      .gte('created_at', `${desde}T00:00:00`)
      .lte('created_at', `${hasta}T23:59:59`)
      .order('created_at', { ascending: true });

    if (tipo) query = query.eq('tipo', tipo);

    const { data: docs, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const documentos = docs ?? [];

    // 2. Total count (all time)
    const { count: totalGlobal } = await db()
      .from('documentos')
      .select('*', { count: 'exact', head: true });

    // 3. Group by day
    const porDia: Record<string, {
      fecha: string;
      documentos: number;
      paginas: number;
      clientes: Set<string>;
      clasificados_ia: number;
    }> = {};

    // Initialize all days in range
    const d = new Date(desde + 'T12:00:00');
    const fin = new Date(hasta + 'T12:00:00');
    while (d <= fin) {
      const key = d.toISOString().split('T')[0];
      porDia[key] = { fecha: key, documentos: 0, paginas: 0, clientes: new Set(), clasificados_ia: 0 };
      d.setDate(d.getDate() + 1);
    }

    // Fill data
    for (const doc of documentos) {
      const key = doc.created_at.split('T')[0];
      if (!porDia[key]) continue;
      porDia[key].documentos++;
      porDia[key].paginas += doc.paginas ?? 0;
      if (doc.cliente_id) porDia[key].clientes.add(doc.cliente_id);
      if (doc.clasificado_por_ia) porDia[key].clasificados_ia++;
    }

    // Convert to array
    const diasArray = Object.values(porDia).map((d: any) => ({
      fecha: d.fecha,
      documentos: d.documentos,
      paginas: d.paginas,
      clientes_distintos: d.clientes.size,
      clasificados_ia: d.clasificados_ia,
    }));

    // 4. Group by type
    const porTipo: Record<string, number> = {};
    for (const doc of documentos) {
      const t = doc.tipo || 'sin_tipo';
      porTipo[t] = (porTipo[t] ?? 0) + 1;
    }
    const tiposArray = Object.entries(porTipo)
      .map(([tipo, cantidad]) => ({ tipo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // 5. Compute metrics
    const totalRango = documentos.length;
    const diasConDatos = diasArray.filter((d: any) => d.documentos > 0).length;
    const promedioDiario = diasConDatos > 0 ? Math.round((totalRango / diasConDatos) * 10) / 10 : 0;

    // Today
    const hoyStr = ahora.toISOString().split('T')[0];
    const hoyData = porDia[hoyStr];
    const escaneadosHoy = hoyData?.documentos ?? 0;

    // This week (Monday to now)
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
    const inicioSemanaStr = inicioSemana.toISOString().split('T')[0];
    const estaSemana = diasArray
      .filter((d: any) => d.fecha >= inicioSemanaStr)
      .reduce((s: number, d: any) => s + d.documentos, 0);

    const totalPaginas = documentos.reduce((s: number, d: any) => s + (d.paginas ?? 0), 0);

    return NextResponse.json({
      metricas: {
        total_global: totalGlobal ?? 0,
        total_rango: totalRango,
        escaneados_hoy: escaneadosHoy,
        promedio_diario: promedioDiario,
        esta_semana: estaSemana,
        total_paginas: totalPaginas,
      },
      por_dia: diasArray,
      por_tipo: tiposArray,
      desde,
      hasta,
    });
  } catch (err: any) {
    console.error('[Documentos Reporte] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
