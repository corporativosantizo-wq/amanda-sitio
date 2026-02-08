// ============================================================================
// GET /api/public/disponibilidad
// Slots disponibles para agendamiento público
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDisponibilidad, CitaError } from '@/lib/services/citas.service';
import { HORARIOS, TipoCita } from '@/lib/types';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const fecha = sp.get('fecha');
  const tipo = sp.get('tipo') as TipoCita | null;

  if (!fecha || !tipo) {
    return NextResponse.json(
      { error: 'Parámetros requeridos: fecha, tipo' },
      { status: 400 }
    );
  }

  if (!HORARIOS[tipo]) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
  }

  try {
    const slots = await obtenerDisponibilidad(fecha, tipo);

    // For consulta_nueva: aggregate 30-min slots into 60-min hourly slots
    // A 1-hour slot at HH:00 is available only if both HH:00 and HH:30 are free
    if (tipo === 'consulta_nueva') {
      const slotSet = new Set(slots.map((s: any) => s.hora_inicio));
      const hourlySlots: { hora_inicio: string; hora_fin: string; duracion_minutos: number }[] = [];

      for (let h = 7; h <= 11; h++) {
        const horaStr = `${String(h).padStart(2, '0')}:00`;
        const halfStr = `${String(h).padStart(2, '0')}:30`;

        if (slotSet.has(horaStr) && slotSet.has(halfStr)) {
          hourlySlots.push({
            hora_inicio: horaStr,
            hora_fin: `${String(h + 1).padStart(2, '0')}:00`,
            duracion_minutos: 60,
          });
        }
      }

      return NextResponse.json({ slots: hourlySlots });
    }

    // For seguimiento: return 15-min slots as-is
    return NextResponse.json({
      slots: slots.map((s: any) => ({
        hora_inicio: s.hora_inicio,
        hora_fin: s.hora_fin,
        duracion_minutos: s.duracion_minutos,
      })),
    });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al obtener disponibilidad';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
