// ============================================================================
// GET /api/cron/recordatorios-cobro
// Cron job: envía recordatorios automáticos de cobros pendientes/vencidos
// Vercel cron: 0 14 * * 1-5 (8am Guatemala, lun-vie)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { registrarRecordatorio } from '@/lib/services/cobros.service';
import { sendMail } from '@/lib/services/outlook.service';
import { emailRecordatorioCobro } from '@/lib/templates/emails';
import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const db = createAdminClient();
  const hoy = new Date().toISOString().split('T')[0];
  const resultados: { cobro_id: string; tipo: string; ok: boolean; detalle: string }[] = [];

  try {
    // Get all cobros with pending balance
    const { data: cobros } = await db
      .from('cobros')
      .select(`
        *,
        cliente:clientes!cliente_id (id, nombre, email)
      `)
      .in('estado', ['pendiente', 'parcial', 'vencido'])
      .gt('saldo_pendiente', 0);

    if (!cobros?.length) {
      return NextResponse.json({ ok: true, total: 0, message: 'No hay cobros pendientes' });
    }

    // Get existing recordatorios for all cobros
    const cobroIds = cobros.map((c: any) => c.id);
    const { data: recordatoriosExistentes } = await db
      .from('recordatorios_cobro')
      .select('cobro_id, tipo')
      .in('cobro_id', cobroIds)
      .eq('email_enviado', true);

    // Build set of "cobro_id:tipo" already sent
    const enviados = new Set(
      (recordatoriosExistentes ?? []).map((r: any) => `${r.cobro_id}:${r.tipo}`)
    );

    for (const cobro of cobros) {
      if (!cobro.cliente?.email) continue;

      const diasDesdeEmision = Math.floor(
        (new Date(hoy).getTime() - new Date(cobro.fecha_emision).getTime()) / (1000 * 60 * 60 * 24)
      );
      const esVencido = cobro.fecha_vencimiento && cobro.fecha_vencimiento < hoy;

      // Determine which tipo to send
      let tipo: 'primer_aviso' | 'segundo_aviso' | 'tercer_aviso' | null = null;

      if (esVencido && !enviados.has(`${cobro.id}:tercer_aviso`)) {
        tipo = 'tercer_aviso';
      } else if (diasDesdeEmision >= 7 && !enviados.has(`${cobro.id}:segundo_aviso`)) {
        tipo = 'segundo_aviso';
      } else if (diasDesdeEmision >= 3 && !enviados.has(`${cobro.id}:primer_aviso`)) {
        tipo = 'primer_aviso';
      }

      if (!tipo) continue;

      try {
        const template = emailRecordatorioCobro({
          clienteNombre: cobro.cliente.nombre,
          concepto: cobro.concepto,
          monto: cobro.monto,
          saldoPendiente: cobro.saldo_pendiente,
          fechaVencimiento: cobro.fecha_vencimiento ?? undefined,
          tipo,
          numeroCobro: cobro.numero_cobro,
        });

        await sendMail({
          from: template.from,
          to: cobro.cliente.email,
          subject: template.subject,
          htmlBody: template.html,
        });

        await registrarRecordatorio(cobro.id, tipo, true, `Email enviado a ${cobro.cliente.email}`);

        // Auto-mark as vencido if past due date
        if (esVencido && cobro.estado !== 'vencido') {
          await db.from('cobros').update({ estado: 'vencido' }).eq('id', cobro.id);
        }

        const maskedEmail = (cobro.cliente.email as string).replace(/(.{2}).+(@.+)/, '$1***$2');
        resultados.push({
          cobro_id: cobro.id,
          tipo,
          ok: true,
          detalle: `${tipo} enviado a ${maskedEmail}`,
        });

        console.log(`[Cron Cobros] ${tipo} enviado: COB-${cobro.numero_cobro} → ${maskedEmail}`);
      } catch (err: any) {
        await registrarRecordatorio(cobro.id, tipo, false, err.message);
        resultados.push({ cobro_id: cobro.id, tipo, ok: false, detalle: err.message });
        console.error(`[Cron Cobros] Error COB-${cobro.numero_cobro}:`, err.message);
      }
    }

    const exitosas = resultados.filter((r: any) => r.ok).length;
    console.log(`[Cron Cobros] Resultado: ${exitosas}/${resultados.length} exitosos de ${cobros.length} cobros evaluados`);

    return NextResponse.json({
      ok: true,
      total_cobros: cobros.length,
      recordatorios_enviados: exitosas,
      resultados,
    });
  } catch (err: any) {
    console.error('[Cron Cobros] Error:', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
