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
import { crearTarea, listarTareas } from '@/lib/services/tareas.service';
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

    return NextResponse.json({ ok: true, sent: true, tasksCreated });
  } catch (err: any) {
    console.error('[Cron agenda-matutina] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

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
