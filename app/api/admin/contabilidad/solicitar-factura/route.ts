// ============================================================================
// POST /api/admin/contabilidad/solicitar-factura
// Solicita factura a RE Contadores para un pago confirmado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDatosPago, solicitarFacturaRE } from '@/lib/services/factura-re.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleApiError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { pago_id: pagoIdInput, cotizacion_id } = body;

    if (!pagoIdInput && !cotizacion_id) {
      return NextResponse.json(
        { error: 'pago_id o cotizacion_id requerido' },
        { status: 400 },
      );
    }

    let pagoId: string | undefined = pagoIdInput;

    if (!pagoId && cotizacion_id) {
      const db = createAdminClient();
      const { data: pagos } = await db
        .from('pagos')
        .select('id, es_anticipo, cobro:cobros!cobro_id (factura_solicitada)')
        .eq('cotizacion_id', cotizacion_id)
        .eq('estado', 'confirmado')
        .order('fecha_pago', { ascending: false });

      const eligible = (pagos ?? []).find(
        (p: any) => !p.es_anticipo && !p.cobro?.factura_solicitada,
      );

      if (!eligible) {
        const tienePagos = (pagos ?? []).length > 0;
        return NextResponse.json(
          {
            error: tienePagos
              ? 'Esta cotización solo tiene anticipos o ya tiene factura solicitada. Registra el pago final antes de solicitar la factura.'
              : 'Esta cotización aún no tiene pagos confirmados. Registra el pago antes de solicitar la factura.',
          },
          { status: 400 },
        );
      }

      pagoId = eligible.id;
    }

    const datos = await obtenerDatosPago(pagoId!);
    if (!datos) {
      return NextResponse.json(
        { error: 'Pago no encontrado o sin cliente asociado' },
        { status: 404 },
      );
    }

    await solicitarFacturaRE(datos);

    const montoFmt = `Q${datos.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

    try {
      await sendTelegramMessage(
        `📄 Factura solicitada a RE para <b>${escapeHtml(datos.cliente_nombre)}</b> — ${montoFmt}`,
        { parse_mode: 'HTML' },
      );
    } catch {
      // Non-critical
    }

    return NextResponse.json({
      success: true,
      mensaje: `Solicitud de factura enviada a RE para ${datos.cliente_nombre}`,
    });
  } catch (error) {
    return handleApiError(error, 'solicitar-factura');
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
