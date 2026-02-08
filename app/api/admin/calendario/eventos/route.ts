// ============================================================================
// GET, POST /api/admin/calendario/eventos
// Listar y crear citas
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarCitas,
  crearCita,
  CitaError,
} from '@/lib/services/citas.service';
import type { TipoCita, EstadoCita } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const result = await listarCitas({
      fecha_inicio: sp.get('fecha_inicio') ?? undefined,
      fecha_fin: sp.get('fecha_fin') ?? undefined,
      estado: (sp.get('estado') as EstadoCita) ?? undefined,
      tipo: (sp.get('tipo') as TipoCita) ?? undefined,
      cliente_id: sp.get('cliente_id') ?? undefined,
      page: sp.get('page') ? Number(sp.get('page')) : undefined,
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
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
