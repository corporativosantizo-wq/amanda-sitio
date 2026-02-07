// ============================================================================
// app/api/admin/notariado/protocolo/route.ts
// GET → Dashboard del protocolo notarial del año
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  dashboardProtocolo,
  EscrituraError,
} from '@/lib/services/escrituras.service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const anio = searchParams.get('anio')
      ? parseInt(searchParams.get('anio')!)
      : undefined;

    const dashboard = await dashboardProtocolo(anio);
    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof EscrituraError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en dashboard protocolo:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
