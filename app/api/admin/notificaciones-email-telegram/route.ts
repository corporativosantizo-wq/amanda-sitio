// ============================================================================
// app/api/admin/notificaciones-email-telegram/route.ts
// GET: listar reglas · POST: crear regla
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarNotificaciones,
  crearNotificacion,
  NotificacionError,
} from '@/lib/services/notificaciones-email-telegram.service';

export async function GET() {
  try {
    const data = await listarNotificaciones();
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof NotificacionError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const regla = await crearNotificacion(body);
    return NextResponse.json(regla, { status: 201 });
  } catch (err) {
    const msg = err instanceof NotificacionError ? err.message : 'Error al crear regla';
    const status = err instanceof NotificacionError && msg.includes('obligatori') ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
