// ============================================================================
// POST /api/admin/contabilidad/solicitar-factura
// Solicita factura a RE Contadores para un pago confirmado
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { obtenerDatosPago, solicitarFacturaRE } from '@/lib/services/factura-re.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { handleApiError } from '@/lib/api-error';

export async function POST(request: NextRequest) {
  const { requireAdmin } = await import('@/lib/auth/api-auth');
  const session = await requireAdmin();
  if (session instanceof NextResponse) return session;

  try {
    const body = await request.json();
    const { pago_id } = body;

    if (!pago_id) {
      return NextResponse.json({ error: 'pago_id requerido' }, { status: 400 });
    }

    const datos = await obtenerDatosPago(pago_id);
    if (!datos) {
      return NextResponse.json(
        { error: 'Pago no encontrado o sin cliente asociado' },
        { status: 404 },
      );
    }

    await solicitarFacturaRE(datos);

    const montoFmt = `Q${datos.monto.toLocaleString('es-GT', { minimumFractionDigits: 2 })}`;

    // Notify via Telegram
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
