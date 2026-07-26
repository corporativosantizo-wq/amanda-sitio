// ============================================================================
// GET /api/admin/audiencias
// Tarjeta "Audiencias Judiciales" del dashboard — fuente híbrida:
//   1) legal.audiencias (el registro formal) como fuente primaria, con estado.
//   2) Eventos de Outlook del mes con "audiencia" en el título que NO casen
//      contra el registro por outlook_event_id → discrepancia visible
//      ("En calendario, sin registro"), nunca como audiencia normal.
// El cruce vive en lib/services/audiencias-cruce.ts (implementación única).
// ============================================================================

import { NextResponse } from 'next/server';
import { getCalendarEvents, type OutlookEvent } from '@/lib/services/outlook.service';
import { listarAudiencias } from '@/lib/services/audiencias.service';
import { cruzarAudienciasConOutlook } from '@/lib/services/audiencias-cruce';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Rango: primer y último día del mes actual
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    // 1) Registro formal (excluye canceladas por defecto)
    const { data: registro } = await listarAudiencias({
      desde: startDate,
      hasta: endDate,
      limit: 100,
    });

    // 2) Outlook best-effort: si Graph falla, la tarjeta vive con el registro.
    let events: OutlookEvent[] = [];
    try {
      events = await getCalendarEvents(startDate, endDate);
    } catch (err) {
      console.error('[Audiencias] Outlook no disponible, tarjeta solo-registro:', (err as Error)?.message ?? err);
    }

    const audiencias = cruzarAudienciasConOutlook(registro, events);

    return NextResponse.json({
      audiencias,
      total: audiencias.length,
      mes: now.toLocaleString('es-GT', { month: 'long', year: 'numeric' }),
    });
  } catch (err: any) {
    console.error('[Audiencias] Error:', err.message);
    return NextResponse.json(
      { error: err.message ?? 'Error al obtener audiencias' },
      { status: 500 },
    );
  }
}
