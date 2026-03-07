// ============================================================================
// app/api/admin/contabilidad/cotizaciones/masivo/route.ts
// POST → Acciones masivas sobre cotizaciones (enviar, aceptar)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  enviarCotizacionMasivo,
  aceptarCotizacionesMasivo,
  CotizacionError,
} from '@/lib/services/cotizaciones.service';

type Accion = 'enviar_masivo' | 'aceptar_masivo';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accion = body.accion as Accion;

    if (accion === 'enviar_masivo') {
      const { ids, from, subject_template, mensaje_template } = body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 });
      }
      if (!mensaje_template) {
        return NextResponse.json({ error: 'Se requiere mensaje_template' }, { status: 400 });
      }

      const resultado = await enviarCotizacionMasivo({
        ids,
        from: from || 'amanda@papeleo.legal',
        subjectTemplate: subject_template || 'Cotización {numero} — Despacho Jurídico Amanda Santizo',
        mensajeTemplate: mensaje_template,
      });

      return NextResponse.json({ success: true, accion, data: resultado });
    }

    if (accion === 'aceptar_masivo') {
      const { ids } = body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'Se requiere un array de IDs' }, { status: 400 });
      }

      const resultado = await aceptarCotizacionesMasivo(ids);
      return NextResponse.json({ success: true, accion, data: resultado });
    }

    return NextResponse.json(
      { error: 'Acción inválida. Usar: enviar_masivo, aceptar_masivo' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof CotizacionError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en acción masiva de cotizaciones:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
