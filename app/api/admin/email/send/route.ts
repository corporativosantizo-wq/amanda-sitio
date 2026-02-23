// ============================================================================
// POST /api/admin/email/send
// Ejecutor de tareas de email pendientes — llamado por Edge Functions via pg_cron
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import { marcarTareaEjecutada } from '@/lib/services/tareas.service';

import { requireCronAuth } from '@/lib/auth/cron-auth';

export async function POST(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { to, subject, htmlBody, tarea_id, from } = body;

    if (!to || !subject || !htmlBody) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: to, subject, htmlBody' },
        { status: 400 }
      );
    }

    const maskedTo = to.replace(/(.{2}).+(@.+)/, '$1***$2');
    console.log(`[Email/Send] Enviando email a ${maskedTo} — asunto: ${subject}`);
    if (tarea_id) console.log(`[Email/Send] tarea_id: ${tarea_id}`);

    // sendMail usa app token (client_credentials) — no requiere token delegado
    const mailFrom: MailboxAlias = from || 'asistente@papeleo.legal';
    await sendMail({ from: mailFrom, to, subject, htmlBody, cc: 'amanda@papeleo.legal' });

    console.log(`[Email/Send] Email enviado exitosamente a ${maskedTo}`);

    // Marcar tarea como ejecutada si se proporcionó tarea_id
    if (tarea_id) {
      try {
        await marcarTareaEjecutada(tarea_id, `Email enviado a ${maskedTo}`);
        console.log(`[Email/Send] Tarea ${tarea_id} marcada como ejecutada`);
      } catch (err: any) {
        // No fallar el request si la tarea no se pudo marcar
        console.error(`[Email/Send] Error marcando tarea ${tarea_id}:`, err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      to: maskedTo,
      subject,
      tarea_id: tarea_id ?? null,
    });
  } catch (err: any) {
    console.error('[Email/Send] Error:', err.message);
    return NextResponse.json(
      { error: 'Error al enviar email' },
      { status: 500 }
    );
  }
}
