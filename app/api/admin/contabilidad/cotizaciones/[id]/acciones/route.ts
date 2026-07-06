import { requireAdmin } from '@/lib/auth/api-auth';
// ============================================================================
// app/api/admin/contabilidad/cotizaciones/[id]/acciones/route.ts
// POST → Ejecutar acciones sobre una cotización
//   body: { accion: 'enviar' | 'aceptar' | 'rechazar' | 'duplicar' }
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  enviarCotizacion,
  aceptarCotizacion,
  rechazarCotizacion,
  duplicarCotizacion,
  programarEnvio,
  cancelarEnvioProgramado,
  reenviarCotizacion,
  programarReenvioCotizacion,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';
import { handleApiError } from '@/lib/api-error';

type RouteParams = { params: Promise<{ id: string }> };

type Accion = 'enviar' | 'aceptar' | 'rechazar' | 'duplicar' | 'programar_envio' | 'cancelar_envio' | 'reenviar' | 'programar_reenvio';

const ACCIONES_VALIDAS: Accion[] = ['enviar', 'aceptar', 'rechazar', 'duplicar', 'programar_envio', 'cancelar_envio', 'reenviar', 'programar_reenvio'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  const __adminGuard = await requireAdmin();
  if (__adminGuard instanceof NextResponse) return __adminGuard;

  try {
    const { id } = await params;
    const body = await request.json();
    const accion = body.accion as Accion;

    if (!accion || !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json(
        {
          error: `Acción inválida. Usar: ${ACCIONES_VALIDAS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    let resultado;

    switch (accion) {
      case 'enviar':
        // cc = SOLO lo que Amanda marcó/tipeó en el modal (puede venir vacío →
        // va solo al principal). Nunca se agrega cliente.emails_cc automático.
        resultado = await enviarCotizacion(id, Array.isArray(body.cc) ? body.cc : []);
        break;

      case 'aceptar':
        resultado = await aceptarCotizacion(id);
        break;

      case 'rechazar':
        resultado = await rechazarCotizacion(id);
        break;

      case 'duplicar':
        resultado = await duplicarCotizacion(id, body.nuevo_cliente_id);
        break;

      case 'programar_envio': {
        const fecha = body.fecha;
        if (!fecha || isNaN(Date.parse(fecha)) || new Date(fecha) <= new Date()) {
          return NextResponse.json(
            { error: 'Se requiere una fecha futura válida en formato ISO' },
            { status: 400 }
          );
        }
        resultado = await programarEnvio(id, fecha);
        break;
      }

      case 'cancelar_envio':
        resultado = await cancelarEnvioProgramado(id);
        break;

      case 'reenviar': {
        if (!body.to || !body.subject || !body.mensaje) {
          return NextResponse.json(
            { error: 'Se requieren campos: to, subject, mensaje' },
            { status: 400 }
          );
        }
        await reenviarCotizacion(id, {
          to: body.to,
          subject: body.subject,
          mensaje: body.mensaje,
          from: body.from,
          cc: Array.isArray(body.cc) ? body.cc : [],
        });
        resultado = { enviado: true };
        break;
      }

      case 'programar_reenvio': {
        if (!body.to || !body.subject || !body.mensaje || !body.programado_para) {
          return NextResponse.json(
            { error: 'Se requieren campos: to, subject, mensaje, programado_para' },
            { status: 400 }
          );
        }
        if (isNaN(Date.parse(body.programado_para)) || new Date(body.programado_para) <= new Date()) {
          return NextResponse.json(
            { error: 'Se requiere una fecha futura válida en formato ISO' },
            { status: 400 }
          );
        }
        await programarReenvioCotizacion(id, {
          to: body.to,
          subject: body.subject,
          mensaje: body.mensaje,
          from: body.from,
          programadoPara: body.programado_para,
        });
        resultado = { programado: true };
        break;
      }
    }

    return NextResponse.json({
      success: true,
      accion,
      data: resultado,
    });
  } catch (error) {
    if (error instanceof CotizacionError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    return handleApiError(error, 'contabilidad/cotizaciones/acciones');
  }
}
