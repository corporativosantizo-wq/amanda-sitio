// ============================================================================
// app/api/admin/notariado/testimonios/[id]/acciones/route.ts
// POST → generar | firmar | entregar | regenerar_texto
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  generarTestimonio,
  firmarTestimonio,
  entregarTestimonio,
  regenerarTextoRazon,
  TestimonioError,
} from '@/lib/services/testimonios.service';

type RouteParams = { params: Promise<{ id: string }> };

type Accion = 'generar' | 'firmar' | 'entregar' | 'regenerar_texto';
const ACCIONES_VALIDAS: Accion[] = ['generar', 'firmar', 'entregar', 'regenerar_texto'];

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const accion = body.accion as Accion;

    if (!accion || !ACCIONES_VALIDAS.includes(accion)) {
      return NextResponse.json(
        { error: `Acción inválida. Usar: ${ACCIONES_VALIDAS.join(', ')}` },
        { status: 400 }
      );
    }

    let resultado;

    switch (accion) {
      case 'generar':
        // Requiere PDF de escritura subido (validado por trigger + servicio)
        resultado = await generarTestimonio(id);
        break;

      case 'firmar':
        resultado = await firmarTestimonio(id);
        break;

      case 'entregar':
        // El trigger auto-avanza la escritura a 'con_testimonio'
        resultado = await entregarTestimonio(id, body.fecha_entrega);
        break;

      case 'regenerar_texto':
        // Sobrescribe texto manual con plantilla
        resultado = await regenerarTextoRazon(id);
        break;
    }

    return NextResponse.json({
      success: true,
      accion,
      data: resultado,
    });
  } catch (error) {
    if (error instanceof TestimonioError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }
    console.error('Error en acción de testimonio:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
