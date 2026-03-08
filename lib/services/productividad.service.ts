// ============================================================================
// lib/services/productividad.service.ts
// Break notifications + productivity calculations
// ============================================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramMessage } from '@/lib/molly/telegram';

const db = () => createAdminClient();
const TZ = 'America/Guatemala';

const NOMBRE_TRABAJADOR: Record<string, string> = {
  'contador@papeleo.legal': 'Brandon (Asistente)',
};

/** Guatemala current time parts */
function gtNow() {
  const now = new Date();
  const fecha = now.toLocaleDateString('en-CA', { timeZone: TZ });
  const hora = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(now), 10);
  const minuto = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: TZ, minute: 'numeric' }).format(now), 10);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  return { fecha, hora, minuto, weekday, totalMin: hora * 60 + minuto };
}

/**
 * Check notificaciones_programadas and send break reminders via Telegram.
 * Only on weekdays. Matches if current GT time is within 2 min of hora_envio.
 * Sends to Amanda's Telegram with note to notify the worker.
 */
export async function checkDescansoNotifications(): Promise<number> {
  const { fecha, totalMin, weekday } = gtNow();

  // Only weekdays
  if (weekday === 'Sat' || weekday === 'Sun') return 0;

  const { data: notifs, error } = await db()
    .from('notificaciones_programadas')
    .select('*')
    .eq('activo', true);

  if (error || !notifs) return 0;

  let sent = 0;
  for (const n of notifs) {
    // Check if already sent today
    if (n.ultima_enviada === fecha) continue;

    // Parse hora_envio (HH:MM:SS)
    const [h, m] = (n.hora_envio as string).split(':').map(Number);
    const envioMin = h * 60 + m;

    // Match within 2-minute window
    if (Math.abs(totalMin - envioMin) > 2) continue;

    const nombre = NOMBRE_TRABAJADOR[n.usuario_email] ?? n.usuario_email;
    const msg = `${n.mensaje}\n\n<i>Notificar a ${nombre}</i>`;

    try {
      await sendTelegramMessage(msg, { parse_mode: 'HTML' });

      // Mark as sent today
      await db()
        .from('notificaciones_programadas')
        .update({ ultima_enviada: fecha })
        .eq('id', n.id);

      sent++;
    } catch (err: any) {
      console.error(`[Descanso] Error sending ${n.tipo}:`, err.message);
    }
  }

  return sent;
}
