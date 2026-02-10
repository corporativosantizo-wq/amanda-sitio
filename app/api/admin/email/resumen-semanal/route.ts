// ============================================================================
// POST /api/admin/email/resumen-semanal
// Resumen semanal de audiencias — llamado por Edge Functions via pg_cron
// cada lunes a las 6 AM Guatemala
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCalendarEvents } from '@/lib/services/outlook.service';
import { sendMail } from '@/lib/services/outlook.service';

// Palabras clave para filtrar eventos de audiencias
const KEYWORDS_AUDIENCIA = [
  'audiencia',
  'declaracion',
  'declaración',
  'juicio',
  'conciliacion',
  'conciliación',
  'vista',
];

function esAudiencia(subject: string): boolean {
  const lower = subject.toLowerCase();
  return KEYWORDS_AUDIENCIA.some((kw) => lower.includes(kw));
}

// Nombres de día en español
const DIAS_SEMANA: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

function getLunesViernes(): { lunes: string; viernes: string; lunesFmt: string; viernesFmt: string } {
  // Calcular lunes y viernes de la semana actual en zona Guatemala
  const now = new Date();
  // Obtener fecha en Guatemala
  const gtNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Guatemala' }));
  const dayOfWeek = gtNow.getDay(); // 0=dom, 1=lun, ..., 6=sab
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const lunes = new Date(gtNow);
  lunes.setDate(gtNow.getDate() + diffToMonday);
  lunes.setHours(0, 0, 0, 0);

  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  viernes.setHours(23, 59, 59, 0);

  const fmt = (d: Date) => d.toLocaleDateString('es-GT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Guatemala',
  });

  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  return {
    lunes: `${iso(lunes)}T00:00:00`,
    viernes: `${iso(viernes)}T23:59:59`,
    lunesFmt: fmt(lunes),
    viernesFmt: fmt(viernes),
  };
}

function formatHora(dateTime: string): string {
  // dateTime viene como "2025-06-09T14:30:00.0000000" (timezone ya Guatemala por Prefer header)
  const timePart = dateTime.split('T')[1];
  if (!timePart) return '';
  const [h, m] = timePart.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatDia(dateTime: string): string {
  const datePart = dateTime.split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DIAS_SEMANA[date.getDay()] ?? '';
  return `${dayName} ${d}/${m}`;
}

function generarEmailResumen(params: {
  audiencias: { subject: string; start: string; end: string; location?: string }[];
  lunesFmt: string;
  viernesFmt: string;
}): string {
  const { audiencias, lunesFmt, viernesFmt } = params;

  let contenido: string;

  if (audiencias.length === 0) {
    contenido = `
      <div style="text-align:center;padding:32px 16px;">
        <p style="font-size:48px;margin:0 0 16px;">&#9989;</p>
        <p style="font-size:16px;color:#475569;font-weight:600;">No hay audiencias programadas esta semana</p>
        <p style="font-size:14px;color:#94a3b8;margin-top:8px;">Periodo: ${lunesFmt} al ${viernesFmt}</p>
      </div>`;
  } else {
    const filas = audiencias
      .map((a) => `
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1E3A8A;font-weight:600;white-space:nowrap;">
            ${formatDia(a.start)}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0F172A;white-space:nowrap;">
            ${formatHora(a.start)}${a.end ? ` – ${formatHora(a.end)}` : ''}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#334155;">
            ${a.subject}
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">
            ${a.location || '—'}
          </td>
        </tr>`)
      .join('');

    contenido = `
      <p style="color:#475569;font-size:14px;line-height:1.6;margin-bottom:16px;">
        Se encontraron <strong>${audiencias.length}</strong> audiencia${audiencias.length !== 1 ? 's' : ''} programada${audiencias.length !== 1 ? 's' : ''} para esta semana.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1E3A8A;">
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">D\u00eda</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">Hora</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">Evento</th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#ffffff;text-transform:uppercase;letter-spacing:0.05em;">Ubicaci\u00f3n</th>
          </tr>
        </thead>
        <tbody>
          ${filas}
        </tbody>
      </table>`;
  }

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1E3A8A,#3B82F6);padding:28px 32px;">
            <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8);">&#128203; Resumen Semanal</p>
            <h1 style="margin:8px 0 0;font-size:22px;font-weight:700;color:#ffffff;">
              Audiencias del ${lunesFmt} al ${viernesFmt}
            </h1>
          </td>
        </tr>
        <!-- Content -->
        <tr><td style="padding:28px 32px;">${contenido}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;background:#0F172A;text-align:center;">
            <p style="margin:0;color:#22D3EE;font-size:13px;font-weight:600;">Amanda Santizo \u2014 Despacho Jur\u00eddico</p>
            <p style="margin:4px 0 0;color:#64748b;font-size:12px;">amandasantizo.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  // Verificar secret
  const cronSecret = req.headers.get('x-cron-secret');
  const expectedSecret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedSecret) {
    console.error('[Resumen Semanal] SUPABASE_SERVICE_ROLE_KEY no configurada');
    return NextResponse.json({ error: 'Secret no configurado' }, { status: 500 });
  }

  if (cronSecret !== expectedSecret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const to = body.to || 'amanda@papeleo.legal';

    console.log(`[Resumen Semanal] Generando resumen para ${to}`);

    // Calcular rango lunes-viernes
    const { lunes, viernes, lunesFmt, viernesFmt } = getLunesViernes();
    console.log(`[Resumen Semanal] Rango: ${lunes} → ${viernes}`);

    // Leer eventos del calendario (usa token delegado con auto-refresh)
    const eventos = await getCalendarEvents(lunes, viernes);
    console.log(`[Resumen Semanal] Total eventos calendario: ${eventos.length}`);

    // Filtrar audiencias
    const audiencias = eventos
      .filter((ev) => !ev.isAllDay && esAudiencia(ev.subject))
      .map((ev) => ({
        subject: ev.subject,
        start: ev.start.dateTime,
        end: ev.end.dateTime,
        location: ev.bodyPreview?.match(/(?:juzgado|tribunal|sala|ubicaci[oó]n)[:\s]+([^\n]+)/i)?.[1]?.trim() || '',
      }))
      .sort((a, b) => a.start.localeCompare(b.start));

    console.log(`[Resumen Semanal] Audiencias encontradas: ${audiencias.length}`);

    // Generar HTML
    const html = generarEmailResumen({ audiencias, lunesFmt, viernesFmt });

    // Enviar email
    const subject = `\uD83D\uDCCB Resumen Semanal \u2014 Audiencias del ${lunesFmt} al ${viernesFmt}`;
    await sendMail({
      from: 'asistente@papeleo.legal',
      to,
      subject,
      htmlBody: html,
    });

    const maskedTo = to.replace(/(.{2}).+(@.+)/, '$1***$2');
    console.log(`[Resumen Semanal] Email enviado a ${maskedTo}`);

    return NextResponse.json({
      ok: true,
      to: maskedTo,
      rango: { desde: lunesFmt, hasta: viernesFmt },
      total_eventos: eventos.length,
      audiencias_encontradas: audiencias.length,
      audiencias: audiencias.map((a) => ({
        dia: formatDia(a.start),
        hora: formatHora(a.start),
        evento: a.subject,
      })),
    });
  } catch (err: any) {
    console.error('[Resumen Semanal] Error:', err.message);
    return NextResponse.json(
      { error: err.message ?? 'Error al generar resumen semanal' },
      { status: 500 }
    );
  }
}
