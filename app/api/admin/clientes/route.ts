// ============================================================================
// app/api/admin/clientes/route.ts
// GET: Listar/buscar clientes · POST: Crear cliente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarClientes, crearCliente, ClienteError } from '@/lib/services/clientes.service';
import { sincronizarRepresentantes } from '@/lib/services/representantes.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleApiError } from '@/lib/api-error';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarClientes({
      busqueda: s.get('q') ?? undefined,
      tipo: (s.get('tipo') as 'persona' | 'empresa') ?? undefined,
      activo: s.has('activo') ? s.get('activo') === 'true' : undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '20'),
    });

    // Enrich with representantes and grupo names for list view
    const db = createAdminClient();
    const enriched = await Promise.all(
      result.data.map(async (c: any) => {
        let administrador_unico_nombre: string | null = null;
        let gerente_general_nombre: string | null = null;
        let grupo_empresarial: { id: string; nombre: string } | null = null;

        if (c.tipo === 'empresa') {
          // Get representantes for this empresa
          const { data: vinculos } = await db
            .from('empresa_representante')
            .select('cargo, representante_id')
            .eq('empresa_id', c.id);

          if (vinculos && vinculos.length > 0) {
            const repIds = vinculos.map((v: any) => v.representante_id);
            const { data: reps } = await db
              .from('representantes_legales')
              .select('id, nombre_completo')
              .in('id', repIds);

            for (const v of vinculos) {
              const rep = (reps ?? []).find((r: any) => r.id === v.representante_id);
              if (!rep) continue;
              if (v.cargo === 'administrador_unico' || v.cargo === 'presidente_consejo') {
                administrador_unico_nombre = rep.nombre_completo;
              }
              if (v.cargo === 'gerente_general' || v.cargo === 'gerente_operativo') {
                gerente_general_nombre = rep.nombre_completo;
              }
            }
          }

          // Get grupo
          if (c.grupo_empresarial_id) {
            const { data: grupo } = await db
              .from('grupos_empresariales')
              .select('id, nombre')
              .eq('id', c.grupo_empresarial_id)
              .maybeSingle();
            grupo_empresarial = grupo ?? null;
          }
        }

        return {
          ...c,
          administrador_unico_nombre,
          gerente_general_nombre,
          grupo_empresarial,
        };
      })
    );

    return NextResponse.json({ ...result, data: enriched });
  } catch (err) {
    if (err instanceof ClienteError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'clientes/GET');
  }
}

export async function POST(req: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }

    // Extract representantes from body
    const { representantes, ...clienteData } = body;

    const cliente = await crearCliente(clienteData);

    // Sync representantes if provided
    if (Array.isArray(representantes) && representantes.length > 0) {
      await sincronizarRepresentantes(cliente.id, representantes);
    }

    return NextResponse.json(cliente, { status: 201 });
  } catch (err) {
    if (err instanceof ClienteError) {
      const status = err.message.includes('Ya existe') ? 409 : 500;
      return NextResponse.json({ error: err.message }, { status });
    }
    return handleApiError(err, 'clientes/POST');
  }
}
