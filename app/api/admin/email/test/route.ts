// ============================================================================
// GET /api/admin/email/test
// Envía un email de prueba desde asistente@papeleo.legal a amanda@papeleo.legal
// para aislar si sendMail funciona independiente de /agendar
// ============================================================================

import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/services/outlook.service';
import { emailWrapper } from '@/lib/templates/emails';

export async function GET() {
  const timestamp = new Date().toLocaleString('es-GT', { timeZone: 'America/Guatemala' });

  console.log(`[EmailTest] ── INICIO test de email ── ${timestamp}`);

  try {
    const html = emailWrapper(`
      <h2 style="color:#1E40AF;margin:0 0 16px;">Test IURISLEX</h2>
      <p style="color:#334155;">Este es un email de prueba enviado desde el endpoint <code>/api/admin/email/test</code>.</p>
      <p style="color:#334155;">Si recibes este email, <strong>sendMail funciona correctamente</strong> con Mail.Send.Shared desde asistente@papeleo.legal.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#475569;">Timestamp</td><td style="padding:8px;border:1px solid #e2e8f0;color:#334155;">${timestamp}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#475569;">From</td><td style="padding:8px;border:1px solid #e2e8f0;color:#334155;">asistente@papeleo.legal</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#475569;">To</td><td style="padding:8px;border:1px solid #e2e8f0;color:#334155;">amanda@papeleo.legal</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#475569;">Endpoint</td><td style="padding:8px;border:1px solid #e2e8f0;color:#334155;">POST /users/asistente@papeleo.legal/sendMail</td></tr>
        <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;color:#475569;">Auth</td><td style="padding:8px;border:1px solid #e2e8f0;color:#334155;">Delegated (amanda@papeleo.legal) + Mail.Send.Shared</td></tr>
      </table>
    `);

    await sendMail({
      from: 'asistente@papeleo.legal',
      to: 'amanda@papeleo.legal',
      subject: `Test IURISLEX — ${timestamp}`,
      htmlBody: html,
    });

    console.log(`[EmailTest] ── ÉXITO ──`);
    return NextResponse.json({
      success: true,
      message: 'Email de prueba enviado exitosamente',
      from: 'asistente@papeleo.legal',
      to: 'amanda@papeleo.legal',
      timestamp,
    });
  } catch (err: any) {
    console.error(`[EmailTest] ── ERROR ──`);
    console.error(`[EmailTest] message: ${err.message}`);
    console.error(`[EmailTest] statusCode: ${err.statusCode ?? 'N/A'}`);
    console.error(`[EmailTest] code: ${err.code ?? 'N/A'}`);
    console.error(`[EmailTest] body: [REDACTED — check Vercel logs for details]`);

    return NextResponse.json({
      success: false,
      error: err.message,
      statusCode: err.statusCode ?? null,
      code: err.code ?? null,
      hint: err.statusCode === 403
        ? 'Permiso denegado. Verifica: (1) Mail.Send.Shared está en el app registration, (2) Admin consent otorgado, (3) asistente@papeleo.legal tiene buzón con licencia en Microsoft 365'
        : err.statusCode === 404
        ? 'Buzón no encontrado. Verifica que asistente@papeleo.legal tiene un buzón con licencia asignada en Microsoft 365 Admin Center'
        : err.statusCode === 401
        ? 'Token inválido o expirado. Reconecta Outlook desde /admin/calendario'
        : 'Revisa los logs de Vercel para más detalles',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
