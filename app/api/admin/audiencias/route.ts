// ============================================================================
// GET /api/admin/audiencias
// Audiencias judiciales del mes desde Outlook Calendar
// Filtra eventos con "[AUD" o "audiencia" en el título
// ============================================================================

import { NextResponse } from 'next/server';
import { getCalendarEvents } from '@/lib/services/outlook.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Rango: primer y último día del mes actual
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

    const events = await getCalendarEvents(startDate, endDate);

    // Filtrar audiencias: título contiene "[AUD" o "audiencia" (case-insensitive)
    const audiencias = events
      .filter((ev) => {
        const title = (ev.subject ?? '').toLowerCase();
        return title.includes('[aud') || title.includes('audiencia');
      })
      .map((ev) => {
        const title = ev.subject ?? '';

        // Intentar extraer tipo de proceso del título
        // Patrones comunes: [AUD-Civil], [AUD-Penal], "audiencia civil", etc.
        let tipo = 'General';
        const tipoMatch = title.match(/\[AUD[- ]?(Civil|Penal|Laboral|Familia|Mercantil)\]/i)
          || title.match(/audiencia\s+(civil|penal|laboral|familia|mercantil)/i);
        if (tipoMatch) tipo = tipoMatch[1].charAt(0).toUpperCase() + tipoMatch[1].slice(1).toLowerCase();

        // Extraer tribunal del bodyPreview o título
        let tribunal = '';
        const juzgadoMatch = (ev.bodyPreview ?? title).match(
          /(juzgado|tribunal|sala|corte)[^,.;\n]*/i
        );
        if (juzgadoMatch) tribunal = juzgadoMatch[0].trim();

        // Extraer cliente — patrón "— Nombre" o "- Nombre" al final del título
        let cliente = '';
        const clienteMatch = title.match(/[—–-]\s*([^[\]]+)$/);
        if (clienteMatch) cliente = clienteMatch[1].trim();

        return {
          id: ev.id,
          titulo: title,
          fecha: ev.start.dateTime,
          fecha_fin: ev.end.dateTime,
          todo_dia: ev.isAllDay,
          tipo,
          tribunal,
          cliente,
          descripcion: ev.bodyPreview ?? '',
        };
      })
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

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
