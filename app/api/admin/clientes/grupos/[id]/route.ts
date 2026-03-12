// ============================================================================
// app/api/admin/clientes/grupos/[id]/route.ts
// GET: Detalle grupo · PATCH: Agregar/remover empresa
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerGrupo, agregarEmpresaAGrupo, removerEmpresaDeGrupo, GrupoError,
} from '@/lib/services/grupos.service';
import { handleApiError } from '@/lib/api-error';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const grupo = await obtenerGrupo(id);
    return NextResponse.json({ grupo });
  } catch (err) {
    if (err instanceof GrupoError) {
      const status = err.message.includes('no encontrado') ? 404 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return handleApiError(err, 'clientes/grupos/[id]/GET');
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
    if (err instanceof GrupoError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'clientes/grupos/[id]/PATCH');
  }
}
