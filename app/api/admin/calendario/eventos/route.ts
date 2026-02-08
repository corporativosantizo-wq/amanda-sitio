// ============================================================================
// GET, POST /api/admin/calendario/eventos
// Listar citas locales + eventos Outlook, y crear citas
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarCitas,
  crearCita,
  CitaError,
} from '@/lib/services/citas.service';
import {
  isOutlookConnected,
  getCalendarEvents,
} from '@/lib/services/outlook.service';
import type { TipoCita, EstadoCita } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const fechaInicio = sp.get('fecha_inicio') ?? undefined;
    const fechaFin = sp.get('fecha_fin') ?? undefined;

    // 1. Fetch local citas from DB
    const result = await listarCitas({
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      estado: (sp.get('estado') as EstadoCita) ?? undefined,
      tipo: (sp.get('tipo') as TipoCita) ?? undefined,
      cliente_id: sp.get('cliente_id') ?? undefined,
      page: sp.get('page') ? Number(sp.get('page')) : undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });

    // 2. Fetch Outlook events if connected
    let outlookEvents: any[] = [];
    try {
      const connected = await isOutlookConnected();
      if (connected && fechaInicio && fechaFin) {
        // Graph API calendarView needs ISO 8601 datetimes
        const startISO = `${fechaInicio}T00:00:00`;
        const endISO = `${fechaFin}T23:59:59`;

        console.log(`[Calendario] Fetching Outlook events: ${startISO} → ${endISO}`);
        const graphEvents = await getCalendarEvents(startISO, endISO);
        console.log(`[Calendario] Outlook returned ${graphEvents.length} events`);

        // Build set of outlook_event_ids that already have local citas
        const linkedIds = new Set(
          result.data
            .filter((c: any) => c.outlook_event_id)
            .map((c: any) => c.outlook_event_id)
        );

        // Convert Outlook events that don't have a local cita into display items
        for (const ev of graphEvents) {
          if (linkedIds.has(ev.id)) continue; // already in local citas

          const startDT = ev.start?.dateTime ?? '';
          const endDT = ev.end?.dateTime ?? '';
          const isAllDay = ev.isAllDay ?? false;

          // Extract date and time from ISO string (Graph returns "2026-02-07T14:00:00.0000000")
          const fecha = startDT.substring(0, 10);
          const horaInicio = isAllDay ? '00:00' : startDT.substring(11, 16);
          const horaFin = isAllDay ? '23:59' : endDT.substring(11, 16);

          // Calculate duration
          const [sh, sm] = horaInicio.split(':').map(Number);
          const [eh, em] = horaFin.split(':').map(Number);
          const duracion = (eh * 60 + em) - (sh * 60 + sm);

          // Determine tipo based on Outlook categories
          let tipo = 'outlook';
          const cats = (ev.categories ?? []).map((c: string) => c.toLowerCase());
          if (cats.includes('azul') || cats.includes('blue category')) tipo = 'consulta_nueva';
          else if (cats.includes('verde') || cats.includes('green category')) tipo = 'seguimiento';

          outlookEvents.push({
            id: `outlook_${ev.id}`,
            outlook_event_id: ev.id,
            tipo,
            titulo: ev.subject || '(Sin título)',
            descripcion: ev.bodyPreview || null,
            fecha,
            hora_inicio: horaInicio,
            hora_fin: horaFin,
            duracion_minutos: duracion > 0 ? duracion : 30,
            estado: 'outlook',
            costo: 0,
            teams_link: ev.onlineMeeting?.joinUrl ?? null,
            notas: null,
            cliente: null,
            _source: 'outlook',
            isAllDay,
          });
        }

        console.log(`[Calendario] ${outlookEvents.length} Outlook-only events (not linked to local citas)`);
      }
    } catch (outlookErr) {
      console.warn('[Calendario] Error fetching Outlook events:', outlookErr);
    }

    // 3. Merge and sort by date + hora_inicio
    const merged = [...result.data, ...outlookEvents].sort((a: any, b: any) => {
      const cmp = a.fecha.localeCompare(b.fecha);
      if (cmp !== 0) return cmp;
      return a.hora_inicio.localeCompare(b.hora_inicio);
    });

    return NextResponse.json({
      data: merged,
      total: result.total + outlookEvents.length,
    });
  } catch (err) {
    console.error('[Calendario] Error:', err);
    const msg = err instanceof CitaError ? err.message : 'Error al listar citas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.tipo || !body.titulo || !body.fecha || !body.hora_inicio || !body.hora_fin || !body.duracion_minutos) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: tipo, titulo, fecha, hora_inicio, hora_fin, duracion_minutos' },
        { status: 400 }
      );
    }

    const cita = await crearCita(body);
    return NextResponse.json(cita, { status: 201 });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al crear cita';
    const status = msg.includes('no está disponible') || msg.includes('Límite') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
