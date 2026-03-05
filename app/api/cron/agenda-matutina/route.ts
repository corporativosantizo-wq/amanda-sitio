// ============================================================================
// GET /api/cron/agenda-matutina
// Cron job: envía agenda del día por Telegram a las 7:30 AM Guatemala
// + Auto-genera tareas de preparación para citas del día
// Vercel cron: 30 13 * * 1-5 (7:30 AM GT = 13:30 UTC, lun-vie)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { getAgenda } from '@/lib/services/molly.service';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { getCalendarEvents, getDayBounds } from '@/lib/molly/calendar';
import { getAppToken } from '@/lib/services/outlook.service';
import { crearTarea, listarTareas } from '@/lib/services/tareas.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { CategoriaTarea } from '@/lib/types';

// Event types that warrant auto-generated preparation tasks
const PREP_KEYWORDS: Array<{ keywords: string[]; prefix: string; categoria: CategoriaTarea }> = [
  { keywords: ['consulta', 'consulta nueva'], prefix: 'Preparar expediente:', categoria: CategoriaTarea.SEGUIMIENTO },
  { keywords: ['seguimiento'], prefix: 'Revisar avances:', categoria: CategoriaTarea.SEGUIMIENTO },
  { keywords: ['audiencia'], prefix: 'Preparar audiencia:', categoria: CategoriaTarea.AUDIENCIAS },
  { keywords: ['reunión', 'reunion', 'meeting'], prefix: 'Preparar para:', categoria: CategoriaTarea.TRAMITES },
];

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    // 0. Azure health check — alert if token fails
    try {
      await getAppToken();
    } catch (azureErr: any) {
      const isExpired = azureErr.message?.includes('AADSTS7000215') ||
        azureErr.details?.includes?.('expired') ||
        azureErr.details?.includes?.('invalid_client');
      const alert = isExpired
        ? '\u{1F6A8} <b>CRITICAL: Azure client secret EXPIRED</b>\nMolly Mail, calendario y email est\u00E1n ca\u00EDdos.\nRota el secret en Azure Portal AHORA.'
        : `\u26A0\uFE0F <b>Azure token error</b>\n${azureErr.message}`;
      await sendTelegramMessage(alert, { parse_mode: 'HTML' }).catch(() => {});
    }

    // 1. Send morning agenda
    const msg = await getAgenda('hoy');
    await sendTelegramMessage(
      `\u2615 <b>Buenos d\u00edas, Amanda</b>\n\n${msg}`,
      { parse_mode: 'HTML' },
    );

    // 2. Auto-generate tasks from today's calendar events
    const tasksCreated = await autoGenerateTasksFromCalendar();

    if (tasksCreated > 0) {
      await sendTelegramMessage(
        `\uD83E\uDD16 ${tasksCreated} tarea(s) de preparaci\u00f3n creada(s) autom\u00e1ticamente.\nUsa /tareas para verlas.`,
      );
    }

    // 3. Financial summary — cobros pendientes y vencidos
    const cobrosDigest = await buildCobrosDigest();
    await sendTelegramMessage(cobrosDigest.text, {
      parse_mode: 'HTML',
      ...(cobrosDigest.buttons ? { reply_markup: { inline_keyboard: cobrosDigest.buttons } } : {}),
    });

    return NextResponse.json({ ok: true, sent: true, tasksCreated });
  } catch (err: any) {
    console.error('[Cron agenda-matutina] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

// ── Financial digest: cobros pendientes y vencidos ──────────────────────────

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://papeleo.legal';

const fmtQ = (n: number) => `<code>Q${n.toLocaleString('es-GT', { minimumFractionDigits: 2 })}</code>`;

function diasEntre(fecha: string, hoy: string): number {
  const a = new Date(fecha + 'T00:00:00');
  const b = new Date(hoy + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

interface CobrosDigest {
  text: string;
  buttons?: Array<Array<{ text: string; url?: string; callback_data?: string }>>;
}

async function buildCobrosDigest(): Promise<CobrosDigest> {
  try {
    const db = createAdminClient();
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
    const en3dias = new Date();
    en3dias.setDate(en3dias.getDate() + 3);
    const en3diasStr = en3dias.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

    // Single query: all non-closed cobros with client name
    const { data: cobros } = await db
      .from('cobros')
      .select('concepto, saldo_pendiente, fecha_vencimiento, estado, cliente:clientes!cliente_id (nombre)')
      .not('estado', 'in', '("pagado","cancelado")')
      .gt('saldo_pendiente', 0)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false });

    if (!cobros || cobros.length === 0) {
      return { text: '\u{1F4B0} <b>Cobros:</b> Todo al d\u00eda \u2705' };
    }

    const vencidos: typeof cobros = [];
    const hoyList: typeof cobros = [];
    const proximos: typeof cobros = [];
    let totalPendiente = 0;

    for (const c of cobros) {
      const fv = c.fecha_vencimiento;
      totalPendiente += c.saldo_pendiente ?? 0;

      if (c.estado === 'vencido' || (fv && fv < hoy)) {
        vencidos.push(c);
      } else if (fv === hoy) {
        hoyList.push(c);
      } else if (fv && fv > hoy && fv <= en3diasStr) {
        proximos.push(c);
      }
    }

    // Nothing urgent → short summary
    if (vencidos.length === 0 && hoyList.length === 0 && proximos.length === 0) {
      return { text: `\u{1F4B0} <b>Cobros:</b> Todo al d\u00eda \u2705\n\u{1F4CA} Total pendiente: ${fmtQ(totalPendiente)}` };
    }

    const lines: string[] = ['\u{1F4B0} <b>Cobros pendientes</b>'];

    // Vencidos
    if (vencidos.length > 0) {
      const sumaVencidos = vencidos.reduce((s: number, c: any) => s + (c.saldo_pendiente ?? 0), 0);
      lines.push('');
      lines.push(`\u{1F534} <b>Vencidos (${vencidos.length}):</b> ${fmtQ(sumaVencidos)}`);
      for (const c of vencidos.slice(0, 5)) {
        const cliente = (c.cliente as any)?.nombre ?? 'Sin cliente';
        const dias = diasEntre(c.fecha_vencimiento ?? hoy, hoy);
        lines.push(`  \u2022 ${cliente} \u2014 ${c.concepto} \u2014 ${fmtQ(c.saldo_pendiente)} (hace ${dias}d)`);
      }
      if (vencidos.length > 5) lines.push(`  <i>...y ${vencidos.length - 5} m\u00e1s</i>`);
    }

    // Vencen HOY
    if (hoyList.length > 0) {
      const sumaHoy = hoyList.reduce((s: number, c: any) => s + (c.saldo_pendiente ?? 0), 0);
      lines.push('');
      lines.push(`\u{1F7E1} <b>Vencen HOY (${hoyList.length}):</b> ${fmtQ(sumaHoy)}`);
      for (const c of hoyList.slice(0, 5)) {
        const cliente = (c.cliente as any)?.nombre ?? 'Sin cliente';
        lines.push(`  \u2022 ${cliente} \u2014 ${c.concepto} \u2014 ${fmtQ(c.saldo_pendiente)}`);
      }
    }

    // Proximos 3 dias
    if (proximos.length > 0) {
      const sumaProx = proximos.reduce((s: number, c: any) => s + (c.saldo_pendiente ?? 0), 0);
      lines.push('');
      lines.push(`\u{1F7E0} <b>Pr\u00f3ximos 3 d\u00edas (${proximos.length}):</b> ${fmtQ(sumaProx)}`);
      for (const c of proximos.slice(0, 5)) {
        const cliente = (c.cliente as any)?.nombre ?? 'Sin cliente';
        const dias = diasEntre(hoy, c.fecha_vencimiento!);
        const label = dias === 1 ? 'ma\u00f1ana' : `en ${dias}d`;
        lines.push(`  \u2022 ${cliente} \u2014 ${c.concepto} \u2014 ${fmtQ(c.saldo_pendiente)} (${label})`);
      }
    }

    // Total
    lines.push('');
    lines.push(`\u{1F4CA} <b>Total pendiente:</b> ${fmtQ(totalPendiente)}`);

    // Inline buttons when there are vencidos
    const buttons: Array<Array<{ text: string; url?: string; callback_data?: string }>> | undefined =
      vencidos.length > 0
        ? [[
            { text: '\u{1F4CB} Ver cobros vencidos', url: `${SITE_URL}/admin/contabilidad` },
            { text: '\u{1F4E8} Enviar recordatorios', callback_data: 'cobros_recordar' },
          ]]
        : undefined;

    return { text: lines.join('\n'), buttons };
  } catch (err) {
    console.error('[agenda-matutina] Error building cobros digest:', err);
    return { text: '\u{1F4B0} <b>Cobros:</b> Error al consultar \u26A0\uFE0F' };
  }
}

// ── Auto-generate tasks from calendar ───────────────────────────────────────

async function autoGenerateTasksFromCalendar(): Promise<number> {
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  try {
    const { start, end } = getDayBounds(new Date());
    const events = await getCalendarEvents(start, end);

    // Filter timed events only (skip all-day)
    const timed = events.filter((e) => !e.isAllDay);
    if (timed.length === 0) return 0;

    // Get existing tasks for today to avoid duplicates
    const { data: existing } = await listarTareas({
      fecha_desde: hoy,
      fecha_hasta: hoy,
      limit: 100,
    });
    const existingTitles = new Set(existing.map((t) => t.titulo.toLowerCase()));

    let created = 0;

    for (const event of timed) {
      const subject = event.subject.toLowerCase();

      // Find matching prep keyword
      const match = PREP_KEYWORDS.find((p) =>
        p.keywords.some((k) => subject.includes(k)),
      );

      if (!match) continue;

      const titulo = `${match.prefix} ${event.subject}`;

      // Skip if already exists
      if (existingTitles.has(titulo.toLowerCase())) continue;

      // Extract event time for the task description
      const eventTime = event.start.substring(11, 16);

      await crearTarea({
        titulo,
        descripcion: `Tarea auto-generada para evento a las ${eventTime}`,
        categoria: match.categoria,
        prioridad: 'media',
        fecha_limite: hoy,
        notas: '[auto-generada]',
      });

      created++;
    }

    return created;
  } catch (err) {
    console.error('[agenda-matutina] Error auto-generating tasks:', err);
    return 0;
  }
}
