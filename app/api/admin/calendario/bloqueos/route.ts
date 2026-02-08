// ============================================================================
// GET, POST, DELETE /api/admin/calendario/bloqueos
// CRUD de bloqueos de disponibilidad
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarBloqueos,
  crearBloqueo,
  eliminarBloqueo,
  CitaError,
} from '@/lib/services/citas.service';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const bloqueos = await listarBloqueos({
      fecha_inicio: sp.get('fecha_inicio') ?? undefined,
      fecha_fin: sp.get('fecha_fin') ?? undefined,
    });
    return NextResponse.json({ bloqueos });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al listar bloqueos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.fecha || !body.hora_inicio || !body.hora_fin) {
      return NextResponse.json(
        { error: 'Se requieren: fecha, hora_inicio, hora_fin' },
        { status: 400 }
      );
    }

    const bloqueo = await crearBloqueo(body);
    return NextResponse.json(bloqueo, { status: 201 });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al crear bloqueo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Se requiere parámetro: id' }, { status: 400 });
    }

    await eliminarBloqueo(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof CitaError ? err.message : 'Error al eliminar bloqueo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
