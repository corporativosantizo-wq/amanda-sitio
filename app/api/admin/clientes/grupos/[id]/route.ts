// ============================================================================
// app/api/admin/clientes/grupos/[id]/route.ts
// GET: Detalle grupo · PATCH: Agregar/remover empresa
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerGrupo, agregarEmpresaAGrupo, removerEmpresaDeGrupo, GrupoError,
} from '@/lib/services/grupos.service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const grupo = await obtenerGrupo(id);
    return NextResponse.json({ grupo });
  } catch (err) {
    const msg = err instanceof GrupoError ? err.message : 'Error interno';
    const status = msg.includes('no encontrado') ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.agregar_empresa_id) {
      await agregarEmpresaAGrupo(id, body.agregar_empresa_id);
    }

    if (body.remover_empresa_id) {
      await removerEmpresaDeGrupo(body.remover_empresa_id);
    }

    const grupo = await obtenerGrupo(id);
    return NextResponse.json({ grupo });
  } catch (err) {
    const msg = err instanceof GrupoError ? err.message : 'Error al actualizar grupo';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
