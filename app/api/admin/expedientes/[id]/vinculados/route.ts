// ============================================================================
// app/api/admin/expedientes/[id]/vinculados/route.ts
// POST: Crear vínculo · DELETE: Eliminar vínculo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  crearVinculo, eliminarVinculo, ExpedienteError,
} from '@/lib/services/expedientes.service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    if (!body.expediente_destino_id) {
      return NextResponse.json({ error: 'expediente_destino_id es obligatorio' }, { status: 400 });
    }

    const vinculo = await crearVinculo({
      expediente_origen_id: id,
      expediente_destino_id: body.expediente_destino_id,
      tipo_vinculo: body.tipo_vinculo ?? 'relacionado',
      descripcion: body.descripcion ?? null,
    });
    return NextResponse.json({ vinculo }, { status: 201 });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error al vincular';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.vinculo_id) {
      return NextResponse.json({ error: 'vinculo_id es obligatorio' }, { status: 400 });
    }
    await eliminarVinculo(body.vinculo_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof ExpedienteError ? err.message : 'Error al eliminar vínculo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
