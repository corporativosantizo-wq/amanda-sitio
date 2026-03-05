// ============================================================================
// app/api/admin/clientes/grupos/route.ts
// GET: Listar grupos · POST: Crear grupo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarGrupos, crearGrupo, GrupoError } from '@/lib/services/grupos.service';

export async function GET() {
  try {
    const grupos = await listarGrupos();
    return NextResponse.json({ grupos });
  } catch (err) {
    const msg = err instanceof GrupoError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre del grupo es obligatorio' }, { status: 400 });
    }

    const grupo = await crearGrupo(body.nombre, body.empresa_ids ?? []);
    return NextResponse.json({ grupo }, { status: 201 });
  } catch (err) {
    const msg = err instanceof GrupoError ? err.message : 'Error al crear grupo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
