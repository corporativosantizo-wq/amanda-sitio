// ============================================================================
// GET, PATCH, DELETE /api/admin/calendario/eventos/[id]
// Detalle, actualizar, cancelar cita
// Soporta IDs locales (UUID) y de Outlook (outlook_xxx)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCita,
  actualizarCita,
  cancelarCita,
  completarCita,
  CitaError,
} from '@/lib/services/citas.service';
import {
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/services/outlook.service';

type RouteParams = { params: Promise<{ id: string }> };

/** Returns the Graph event ID if the id has the outlook_ prefix, otherwise null */
function getOutlookEventId(id: string): string | null {
  return id.startsWith('outlook_') ? id.slice('outlook_'.length) : null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const cita = await obtenerCita(id);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener cita';
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await req.json();
    const outlookId = getOutlookEventId(id);

    // Outlook-only event: update directly via Graph API
    if (outlookId) {
      const patch: Record<string, unknown> = {};
      if (body.titulo) patch.subject = body.titulo;
      if (body.descripcion !== undefined) patch.body = body.descripcion ?? '';
      if (body.fecha && body.hora_inicio && body.hora_fin) {
        patch.startDateTime = `${body.fecha}T${body.hora_inicio}:00`;
        patch.endDateTime = `${body.fecha}T${body.hora_fin}:00`;
      }
      await updateCalendarEvent(outlookId, patch as any);
      return NextResponse.json({ ok: true, outlook_event_id: outlookId });
    }

    // Local cita: handle actions
    if (body.accion === 'completar') {
      const cita = await completarCita(id);
      return NextResponse.json(cita);
    }

    if (body.accion === 'cancelar') {
      const cita = await cancelarCita(id);
      return NextResponse.json(cita);
    }

    const cita = await actualizarCita(id, body);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al actualizar cita';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const outlookId = getOutlookEventId(id);

    // Outlook-only event: delete directly via Graph API
    if (outlookId) {
      await deleteCalendarEvent(outlookId);
      return NextResponse.json({ ok: true, deleted: outlookId });
    }

    // Local cita: cancel (marks as cancelled + deletes Outlook event if linked)
    const cita = await cancelarCita(id);
    return NextResponse.json(cita);
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al cancelar cita';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
