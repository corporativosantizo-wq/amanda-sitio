// ============================================================================
// POST /api/admin/email/send
// Ejecutor de tareas de email pendientes — llamado por Edge Functions via pg_cron
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { sendMail } from '@/lib/services/outlook.service';
import type { MailboxAlias } from '@/lib/services/outlook.service';
import { marcarTareaEjecutada } from '@/lib/services/tareas.service';

export async function POST(req: NextRequest) {
  // Verificar secret
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.SUPABASE_SERVICE_KEY;

  if (!expectedSecret) {
    console.error('[Email/Send] SUPABASE_SERVICE_KEY no configurada');
    return NextResponse.json({ error: 'Secret no configurado' }, { status: 500 });
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

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
    await sendMail({ from: mailFrom, to, subject, htmlBody });

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
      { error: err.message ?? 'Error al enviar email' },
      { status: 500 }
    );
  }
}
