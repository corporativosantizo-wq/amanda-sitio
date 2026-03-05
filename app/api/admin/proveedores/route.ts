// ============================================================================
// app/api/admin/proveedores/route.ts
// GET: Listar/buscar proveedores · POST: Crear proveedor
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarProveedores, crearProveedor, ProveedorError } from '@/lib/services/proveedores.service';
import type { TipoProveedor } from '@/lib/types';

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const result = await listarProveedores({
      busqueda: s.get('q') ?? undefined,
      tipo: (s.get('tipo') as TipoProveedor) ?? undefined,
      activo: s.has('activo') ? s.get('activo') === 'true' : undefined,
      page: parseInt(s.get('page') ?? '1'),
      limit: parseInt(s.get('limit') ?? '20'),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof ProveedorError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    const proveedor = await crearProveedor(body);
    return NextResponse.json(proveedor, { status: 201 });
  } catch (err) {
    console.error('ERROR CREAR PROVEEDOR:', err);
    const msg = err instanceof ProveedorError ? err.message : 'Error al crear proveedor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
