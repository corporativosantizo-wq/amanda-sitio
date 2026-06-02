// ============================================================================
// app/api/admin/gestiones-proveedor/seguimientos-bulk/route.ts
// POST: registra un seguimiento idéntico para varias gestiones a la vez.
// Usado al enviar el correo de seguimiento a un proveedor (un seguimiento por
// gestión incluida en el correo). Actualiza ultimo_seguimiento de cada gestión.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearSeguimientosBulk, GestionError } from '@/lib/services/gestiones-proveedor.service';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gestionIds: string[] = Array.isArray(body.gestion_ids) ? body.gestion_ids : [];
    const registrados = await crearSeguimientosBulk(gestionIds, {
      fecha: body.fecha ?? null,
      descripcion: body.descripcion,
      via: body.via ?? 'email',
      respuesta: body.respuesta ?? null,
    });
    return NextResponse.json({ ok: true, registrados });
  } catch (err) {
    const msg = err instanceof GestionError ? err.message : 'Error al registrar seguimientos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
