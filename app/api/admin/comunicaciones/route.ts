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
  actualizarCorreo,
  enviarCorreoAhora,
  cancelarCorreo,
} from '@/lib/services/comunicaciones.service';
import { handleApiError } from '@/lib/api-error';

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
  } catch (err) {
    return handleApiError(err, 'comunicaciones/GET');
  }
}

export async function POST(req: NextRequest) {
  // Rate limit email sending: 10/min per user
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  const { checkEmailRateLimit } = await import('@/lib/rate-limit');
  const rl = checkEmailRateLimit(session.userId);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Límite de envío alcanzado. Intenta en un minuto.' },
      { status: 429 }
    );
  }

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
        adjuntos: body.adjuntos ?? [],
        estado: accion === 'programar' ? 'programado' : 'borrador',
        programado_para: body.programado_para,
      });

      // If crear + enviar_ahora, send immediately
      if (body.enviar_ahora) {
        await enviarCorreoAhora(correo.id);

        // Plantilla seguimiento-proveedor: registrar un seguimiento via='email'
        // por cada gestión incluida en el correo. Se hace aquí (server-side) y no
        // con una segunda petición del cliente para que sea atómico con el envío
        // y no dependa de otra ruta API.
        const gestionIds: string[] = Array.isArray(body.seguimiento_gestion_ids)
          ? body.seguimiento_gestion_ids.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        if (gestionIds.length > 0) {
          try {
            const { crearSeguimientosBulk } = await import('@/lib/services/gestiones-proveedor.service');
            await crearSeguimientosBulk(gestionIds, {
              descripcion: body.seguimiento_descripcion?.trim()
                || `Seguimiento enviado por correo: ${body.asunto ?? ''}`.trim(),
              via: 'email',
            });
          } catch (segErr) {
            // El correo ya se envió; no bloquear por un fallo al registrar el
            // seguimiento, solo dejar traza.
            console.error('[comunicaciones] No se registraron los seguimientos de proveedor:', segErr);
          }
        }
      }

      return NextResponse.json(correo);
    }

    if (accion === 'actualizar') {
      const correo = await actualizarCorreo(body.id, {
        destinatario_email: body.destinatario_email,
        destinatario_nombre: body.destinatario_nombre,
        cc_emails: body.cc_emails,
        cuenta_envio: body.cuenta_envio,
        asunto: body.asunto,
        cuerpo: body.cuerpo,
        adjuntos: body.adjuntos,
        programado_para: body.programado_para,
      });
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
  } catch (err) {
    return handleApiError(err, 'comunicaciones/POST');
  }
}
