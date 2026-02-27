// ============================================================================
// GET /api/cron/resumen-semanal
// Cron job: envía resumen semanal de productividad por Telegram
// Vercel cron: 0 1 * * 1 (domingo 7 PM GT = lunes 01:00 UTC)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { sendTelegramMessage } from '@/lib/molly/telegram';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const summary = await buildWeeklySummary();
    await sendTelegramMessage(summary, { parse_mode: 'HTML' });

    return NextResponse.json({ ok: true, sent: true });
  } catch (err: any) {
    console.error('[Cron resumen-semanal] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 });
  }
}

async function buildWeeklySummary(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const hoy = now.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
  const inicioSemana = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

  // ── Task stats
  const [completadas, creadas, vencidas, enProgreso] = await Promise.all([
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'completada')
      .gte('fecha_completada', `${inicioSemana}T00:00:00`),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .gte('created_at', `${inicioSemana}T00:00:00`),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')
      .lt('fecha_limite', hoy),
    db().from('tareas').select('id', { count: 'exact', head: true })
      .eq('estado', 'en_progreso'),
  ]);

  const tareasCompletadas = completadas.count ?? 0;
  const tareasCreadas = creadas.count ?? 0;
  const tareasVencidas = vencidas.count ?? 0;
  const tareasEnProgreso = enProgreso.count ?? 0;

  // ── Habit stats
  const { data: habits } = await db()
    .from('habits')
    .select('id, nombre, emoji')
    .eq('activo', true);

  let habitSection = '';
  let totalLogs = 0;
  const totalPossible = (habits?.length ?? 0) * 7;

  if (habits && habits.length > 0) {
    const { data: weekLogs } = await db()
      .from('habit_logs')
      .select('habit_id, fecha')
      .gte('fecha', inicioSemana)
      .lte('fecha', hoy);

    totalLogs = weekLogs?.length ?? 0;
    const pct = totalPossible > 0 ? Math.round((totalLogs / totalPossible) * 100) : 0;

    // Count per habit
    const habitCounts: Record<string, number> = {};
    for (const log of weekLogs ?? []) {
      habitCounts[log.habit_id] = (habitCounts[log.habit_id] ?? 0) + 1;
    }

    habitSection = `\n\n\uD83C\uDFAF <b>H\u00e1bitos</b> (${pct}% completado)\n`;
    for (const h of habits) {
      const count = habitCounts[h.id] ?? 0;
      const bar = '\u2588'.repeat(count) + '\u2591'.repeat(7 - count);
      habitSection += `${h.emoji} ${bar} ${count}/7\n`;
    }
  }

  // ── Email stats
  const { count: emailsProcessed } = await db()
    .from('email_threads')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', `${inicioSemana}T00:00:00`);

  const { count: draftsApproved } = await db()
    .from('email_drafts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'enviado')
    .gte('sent_at', `${inicioSemana}T00:00:00`);

  // ── Build message
  const completionRate = tareasCreadas > 0
    ? Math.round((tareasCompletadas / tareasCreadas) * 100)
    : 0;

  let msg = `\uD83D\uDCCA <b>Resumen Semanal</b>\n${inicioSemana} \u2014 ${hoy}\n`;

  msg += `\n\uD83D\uDCCB <b>Tareas</b>\n`;
  msg += `\u2705 Completadas: <b>${tareasCompletadas}</b>\n`;
  msg += `\uD83D\uDCDD Creadas: ${tareasCreadas}\n`;
  msg += `\uD83D\uDD04 En progreso: ${tareasEnProgreso}\n`;
  if (tareasVencidas > 0) {
    msg += `\uD83D\uDD34 Vencidas: <b>${tareasVencidas}</b>\n`;
  }
  msg += `\uD83D\uDCC8 Tasa de completado: ${completionRate}%`;

  msg += habitSection;

  msg += `\n\n\uD83D\uDCE7 <b>Email</b>\n`;
  msg += `Hilos procesados: ${emailsProcessed ?? 0}\n`;
  msg += `Respuestas enviadas: ${draftsApproved ?? 0}`;

  // Motivational note based on completion rate
  msg += '\n\n';
  if (completionRate >= 80) {
    msg += '\uD83C\uDF1F Excelente semana. \u00a1Sigue as\u00ed!';
  } else if (completionRate >= 50) {
    msg += '\uD83D\uDCAA Buena semana. \u00a1A mejorar la pr\u00f3xima!';
  } else {
    msg += '\uD83C\uDFAF Semana con oportunidades de mejora. \u00a1T\u00fa puedes!';
  }

  return msg;
}
