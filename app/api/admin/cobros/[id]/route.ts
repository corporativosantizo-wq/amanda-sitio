// ============================================================================
// GET    /api/admin/cobros/[id] — Obtener cobro con pagos y recordatorios
// PATCH  /api/admin/cobros/[id] — Actualizar cobro
// DELETE /api/admin/cobros/[id] — Cancelar cobro
// POST   /api/admin/cobros/[id] — Acciones: registrar_pago, enviar_recordatorio
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  obtenerCobro,
  actualizarCobro,
  registrarPagoCobro,
  enviarSolicitudPago,
  enviarComprobantePago,
  obtenerRecordatorios,
  CobroError,
} from '@/lib/services/cobros.service';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const cobro = await obtenerCobro(id);

    // Get pagos linked to this cobro
    const db = createAdminClient();
    const { data: pagos } = await db
      .from('pagos')
      .select('*')
      .eq('cobro_id', id)
      .order('fecha_pago', { ascending: false });

    // Get recordatorios
    const recordatorios = await obtenerRecordatorios(id);

    return NextResponse.json({ ...cobro, pagos: pagos ?? [], recordatorios });
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const cobro = await actualizarCobro(id, body);
    return NextResponse.json(cobro);
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error al actualizar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await actualizarCobro(id, { estado: 'cancelado' } as any);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error al cancelar';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const accion = body.accion;

    if (accion === 'registrar_pago') {
      const { pago, cobro } = await registrarPagoCobro({
        cobro_id: id,
        monto: body.monto,
        metodo: body.metodo ?? 'transferencia_gyt',
        referencia_bancaria: body.referencia_bancaria,
        fecha_pago: body.fecha_pago,
        notas: body.notas,
      });

      // Send comprobante
      try {
        await enviarComprobantePago(id, body.monto);
      } catch (_) { /* non-blocking */ }

      return NextResponse.json({ pago, cobro });
    }

    if (accion === 'enviar_recordatorio') {
      const result = await enviarSolicitudPago(id);
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof CobroError ? err.message : 'Error en acción';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
