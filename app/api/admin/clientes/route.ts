// ============================================================================
// app/api/admin/clientes/route.ts
// GET: Listar/buscar clientes · POST: Crear cliente
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarClientes, crearCliente, ClienteError } from '@/lib/services/clientes.service';

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
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof ClienteError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const cliente = await crearCliente(body);
    return NextResponse.json(cliente, { status: 201 });
  } catch (err) {
    console.error('ERROR CREAR CLIENTE:', err); const msg = err instanceof ClienteError ? err.message : 'Error al crear cliente';
    const status = msg.includes('Ya existe') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
