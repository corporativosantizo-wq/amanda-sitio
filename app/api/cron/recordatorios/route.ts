// ============================================================================
// GET /api/cron/recordatorios
// Cron job: envía recordatorios 24h/1h, auto-completa citas pasadas,
//           + recordatorios de clases universitarias 15 min antes
// Vercel cron: cada 15 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarRecordatorios } from '@/lib/services/citas.service';
import { enviarRecordatoriosLlamadas } from '@/lib/services/llamadas.service';
import { procesarRecordatoriosAudiencias } from '@/lib/services/audiencias-recordatorios.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { checkClassReminders } from '@/lib/molly/telegram-calendar';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const [result, classReminders, llamadas, audiencias] = await Promise.all([
      enviarRecordatorios(),
      checkClassReminders().catch((err: any) => {
        console.error('[Cron Recordatorios] Error en class reminders:', err.message);
        return 0;
      }),
      enviarRecordatoriosLlamadas().catch((err: any) => {
        console.error('[Cron Recordatorios] Error en recordatorios de llamadas:', err.message);
        return { llamadas: 0 };
      }),
      procesarRecordatoriosAudiencias().catch((err: any) => {
        console.error('[Cron Recordatorios] Error en recordatorios de audiencias:', err.message);
        return { enviados: 0, fallidos: 0, sin_destinatario: 0 };
      }),
    ]);

    return NextResponse.json({ ok: true, ...result, classReminders, llamadas: llamadas.llamadas, audiencias });
  } catch (err: any) {
    console.error('[Cron Recordatorios] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
