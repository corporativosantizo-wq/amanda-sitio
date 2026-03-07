// ============================================================================
// GET /api/admin/documentos/reporte — Estadísticas de escaneo de documentos
// Query params: desde, hasta, tipo
// Uses legal.reporte_documentos() RPC for aggregation (no row limit issues)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const tipo = s.get('tipo') || null;
    const usuario = s.get('usuario') || null;

    // Default: last 30 days
    const ahora = new Date();
    const defaultDesde = new Date(ahora);
    defaultDesde.setDate(defaultDesde.getDate() - 29);

    const desde = s.get('desde') || defaultDesde.toISOString().split('T')[0];
    const hasta = s.get('hasta') || ahora.toISOString().split('T')[0];

    // Call the legal.reporte_documentos RPC (no schema switching needed)
    const { data, error } = await db().rpc('reporte_documentos', {
      p_desde: desde,
      p_hasta: hasta,
      p_tipo: tipo,
      p_usuario: usuario,
    });

    if (error) throw new Error(`RPC error: ${error.message}`);
    if (!data) throw new Error('RPC returned null');

    const porDiaData: any[] = data.por_dia ?? [];
    const porTipoData: any[] = data.por_tipo ?? [];
    const porUsuarioData: any[] = data.por_usuario ?? [];
    const totalGlobal: number = data.total_global ?? 0;
    const usuarios: string[] = data.usuarios ?? [];

    // Fill in missing days (days with 0 documents)
    const porDiaMap = new Map(porDiaData.map((d: any) => [d.fecha, d]));
    const diasArray: any[] = [];
    const d = new Date(desde + 'T12:00:00');
    const fin = new Date(hasta + 'T12:00:00');
    while (d <= fin) {
      const key = d.toISOString().split('T')[0];
      diasArray.push(porDiaMap.get(key) ?? {
        fecha: key,
        documentos: 0,
        paginas: 0,
        clientes_distintos: 0,
        clasificados_ia: 0,
      });
      d.setDate(d.getDate() + 1);
    }

    // Compute metrics
    const totalRango = diasArray.reduce((s: number, x: any) => s + x.documentos, 0);
    const diasConDatos = diasArray.filter((x: any) => x.documentos > 0).length;
    const promedioDiario = diasConDatos > 0
      ? Math.round((totalRango / diasConDatos) * 10) / 10
      : 0;

    // Today (Guatemala timezone)
    const hoyGT = new Date(ahora.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
    const hoyStr = [
      hoyGT.getFullYear(),
      String(hoyGT.getMonth() + 1).padStart(2, '0'),
      String(hoyGT.getDate()).padStart(2, '0'),
    ].join('-');
    const escaneadosHoy = diasArray.find((x: any) => x.fecha === hoyStr)?.documentos ?? 0;

    // This week (Monday to now)
    const diaSemana = (hoyGT.getDay() + 6) % 7;
    const inicioSemana = new Date(hoyGT);
    inicioSemana.setDate(hoyGT.getDate() - diaSemana);
    const inicioSemanaStr = [
      inicioSemana.getFullYear(),
      String(inicioSemana.getMonth() + 1).padStart(2, '0'),
      String(inicioSemana.getDate()).padStart(2, '0'),
    ].join('-');
    const estaSemana = diasArray
      .filter((x: any) => x.fecha >= inicioSemanaStr)
      .reduce((s: number, x: any) => s + x.documentos, 0);

    const totalPaginas = diasArray.reduce((s: number, x: any) => s + x.paginas, 0);

    return NextResponse.json({
      metricas: {
        total_global: totalGlobal,
        total_rango: totalRango,
        escaneados_hoy: escaneadosHoy,
        promedio_diario: promedioDiario,
        esta_semana: estaSemana,
        total_paginas: totalPaginas,
      },
      por_dia: diasArray,
      por_tipo: porTipoData,
      por_usuario: porUsuarioData,
      usuarios,
      desde,
      hasta,
    });
  } catch (err: any) {
    console.error('[Documentos Reporte] Error:', err.message);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
