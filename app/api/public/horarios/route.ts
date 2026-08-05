// ============================================================================
// GET /api/public/horarios
// Días ofrecidos al público por tipo/modalidad de cita, desde
// legal.config_horarios. El formulario /agendar filtra su calendario con esto
// (antes los días vivían hardcodeados en el cliente).
// ============================================================================

import { NextResponse } from 'next/server';
import { diasPublicos } from '@/lib/services/horarios.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dias = await diasPublicos();
    return NextResponse.json({ dias });
  } catch (err) {
    console.error('[Horarios] Error en /api/public/horarios:', err);
    // El cliente tiene defaults propios: ante error devolvemos mapa vacío.
    return NextResponse.json({ dias: {} });
  }
}
