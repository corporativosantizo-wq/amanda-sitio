// ============================================================================
// POST /api/admin/notariado/testimonios/backfill
// Genera texto_razon para todos los testimonios que no lo tienen
// ============================================================================

import { NextResponse } from 'next/server';
import {
  backfillTextoRazon,
  TestimonioError,
} from '@/lib/services/testimonios.service';

export async function POST() {
  try {
    const resultado = await backfillTextoRazon();
    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof TestimonioError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error en backfill:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
