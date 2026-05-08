// ============================================================================
// /api/admin/config/mensajes-telegram
// GET  → listar mensajes programados
// POST → crear nuevo mensaje
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/api-auth';
import {
  listarMensajes,
  crearMensaje,
  MensajeTelegramError,
} from '@/lib/services/mensajes-telegram.service';
import { handleApiError } from '@/lib/api-error';

export async function GET() {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const data = await listarMensajes();
    return NextResponse.json({ data });
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return handleApiError(err, 'config/mensajes-telegram/GET');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const data = await crearMensaje({
      nombre: body.nombre,
      destino: body.destino,
      hora_envio: body.hora_envio,
      dias_semana: body.dias_semana,
      mensaje_template: body.mensaje_template,
      usar_frase_motivante: body.usar_frase_motivante,
      activo: body.activo,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    if (err instanceof MensajeTelegramError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return handleApiError(err, 'config/mensajes-telegram/POST');
  }
}
