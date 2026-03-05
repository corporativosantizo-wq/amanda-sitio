// ============================================================================
// GET /api/admin/calendario/disponibilidad
// Slots disponibles para una fecha y tipo
// Para reunion/evento_libre: usa findFreeSlots() (Bullet Journal rules)
// Para audiencia/bloqueo_personal: retorna [] (UI usa time picker libre)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDisponibilidad, CitaError } from '@/lib/services/citas.service';
import { findFreeSlots } from '@/lib/molly/calendar';
import type { TipoCita } from '@/lib/types';
import { ADMIN_ONLY_TIPOS } from '@/lib/types';

// Types that use findFreeSlots() for smart suggestions
const SMART_SLOT_TIPOS = new Set(['reunion', 'evento_libre']);

export async function GET(req: NextRequest) {
  try {
    const fecha = req.nextUrl.searchParams.get('fecha');
    const tipo = req.nextUrl.searchParams.get('tipo') as TipoCita | null;
    const duracion = req.nextUrl.searchParams.get('duracion');

    if (!fecha || !tipo) {
      return NextResponse.json(
        { error: 'Se requieren parámetros: fecha (YYYY-MM-DD) y tipo' },
        { status: 400 }
      );
    }

    // Audiencia / bloqueo_personal: time picker libre, no suggestions
    if (ADMIN_ONLY_TIPOS.has(tipo) && !SMART_SLOT_TIPOS.has(tipo)) {
      return NextResponse.json({ slots: [], mode: 'free' });
    }

    // Reunion / evento_libre: use findFreeSlots() with Bullet Journal rules
    if (SMART_SLOT_TIPOS.has(tipo)) {
      const durationMin = duracion ? Number(duracion) : 30;
      const date = new Date(fecha + 'T12:00:00');
      const freeSlots = await findFreeSlots(date, durationMin);

      // Convert FreeSlot[] to SlotDisponible-compatible format
      const slots = freeSlots.map((s) => {
        const startTime = s.start.substring(11, 16); // HH:mm from ISO
        const endTime = s.end.substring(11, 16);
        return {
          hora_inicio: startTime,
          hora_fin: endTime,
          duracion_minutos: s.durationMin,
          preferred: s.preferred,
        };
      });

      return NextResponse.json({ slots, mode: 'suggested' });
    }

    // consulta_nueva / seguimiento: existing slot-based availability
    const slots = await obtenerDisponibilidad(fecha, tipo);
    return NextResponse.json({ slots, mode: 'fixed' });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener disponibilidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
