// ============================================================================
// GET /api/cron/recordatorios
// Cron job: envía recordatorios 24h/1h, auto-completa citas pasadas,
//           + recordatorios de clases universitarias 15 min antes
//           + notificaciones de descanso del trabajador
// Vercel cron: cada 15 minutos
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { enviarRecordatorios } from '@/lib/services/citas.service';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { checkClassReminders } from '@/lib/molly/telegram-calendar';
import { checkDescansoNotifications } from '@/lib/services/productividad.service';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const [result, classReminders, descansoNotifs] = await Promise.all([
      enviarRecordatorios(),
      checkClassReminders().catch((err: any) => {
        console.error('[Cron Recordatorios] Error en class reminders:', err.message);
        return 0;
      }),
      checkDescansoNotifications().catch((err: any) => {
        console.error('[Cron Recordatorios] Error en descanso notifs:', err.message);
        return 0;
      }),
    ]);

    return NextResponse.json({ ok: true, ...result, classReminders, descansoNotifs });
  } catch (err: any) {
    console.error('[Cron Recordatorios] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}
