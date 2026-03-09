// ============================================================================
// /api/admin/comunicaciones
// GET  → plantillas + pies de confidencialidad
// POST → crear/enviar correo
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  listarPlantillas,
  listarPiesConfidencialidad,
  listarCorreos,
  crearCorreo,
  enviarCorreoAhora,
  cancelarCorreo,
} from '@/lib/services/comunicaciones.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tipo = searchParams.get('tipo');

    if (tipo === 'plantillas') {
      const plantillas = await listarPlantillas();
      const pies = await listarPiesConfidencialidad();
      return NextResponse.json({ plantillas, pies });
    }

    if (tipo === 'correos') {
      const estado = searchParams.get('estado') ?? undefined;
      const page = parseInt(searchParams.get('page') ?? '1');
      const limit = parseInt(searchParams.get('limit') ?? '30');
      const result = await listarCorreos({ estado, limit, offset: (page - 1) * limit });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'tipo requerido: plantillas | correos' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { accion } = body;

    if (accion === 'crear' || accion === 'programar') {
      const correo = await crearCorreo({
        plantilla_id: body.plantilla_id,
        cliente_id: body.cliente_id,
        destinatario_email: body.destinatario_email,
        destinatario_nombre: body.destinatario_nombre,
        cc_emails: body.cc_emails,
        cuenta_envio: body.cuenta_envio || 'amanda@papeleo.legal',
        asunto: body.asunto,
        cuerpo: body.cuerpo,
        estado: accion === 'programar' ? 'programado' : 'borrador',
        programado_para: body.programado_para,
      });

      // If crear + enviar_ahora, send immediately
      if (body.enviar_ahora) {
        await enviarCorreoAhora(correo.id);
      }

      return NextResponse.json(correo);
    }

    if (accion === 'enviar') {
      await enviarCorreoAhora(body.id);
      return NextResponse.json({ ok: true });
    }

    if (accion === 'cancelar') {
      await cancelarCorreo(body.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
