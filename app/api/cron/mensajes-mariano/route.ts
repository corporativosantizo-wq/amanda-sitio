// ============================================================================
// GET /api/cron/mensajes-mariano
// Cron job: envía mensajes diarios al grupo de Mariano según la hora GT.
// Vercel cron: 0 14,18,21 * * 1-5  (8 AM, 12 PM, 3 PM Guatemala, lun-vie)
//   - 14:00 UTC = 08:00 GT  → buenos días + revisar OJ
//   - 18:00 UTC = 12:00 GT  → ¿a qué hora almuerza?
//   - 21:00 UTC = 15:00 GT  → recordatorio tarde de revisar OJ
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/auth/cron-auth';
import { sendTelegramMessage } from '@/lib/molly/telegram';

const FRASES_MOTIVANTES = [
  'Cada trámite resuelto hoy es un cliente más tranquilo mañana.',
  'La constancia en los detalles es lo que distingue a los grandes profesionales.',
  'Un día bien organizado vale por tres días corriendo.',
  'La excelencia es un hábito, no un acto aislado.',
  'Tu trabajo silencioso sostiene victorias visibles.',
  'Hoy es un buen día para sorprender con eficiencia.',
  'La disciplina de la mañana define los resultados de la tarde.',
  'Cada notificación revisada a tiempo es un riesgo evitado.',
  'Lo que se mide se mejora; lo que se atiende se resuelve.',
  'El profesionalismo se construye un caso a la vez.',
  'La diligencia de hoy es la reputación de mañana.',
  'Un buen abogado nunca improvisa; siempre verifica.',
  'La puntualidad es la cortesía silenciosa de los expedientes.',
  'Los detalles que otros pasan por alto son los que tú dominas.',
  'El éxito es la suma de pequeños esfuerzos repetidos cada día.',
  'Hoy tienes la oportunidad de ser mejor que ayer.',
  'La paciencia y la precisión son aliadas inseparables del derecho.',
  'No hay tarea pequeña cuando se hace con responsabilidad.',
  'La organización es la antesala de la tranquilidad.',
  'Cada plazo cumplido es una promesa honrada.',
  'El ritmo lo marcas tú; la calidad la define tu enfoque.',
  'La preparación silenciosa vence a la prisa ruidosa.',
  'Un proceso bien llevado habla por sí solo.',
  'La integridad se nota en lo que haces cuando nadie está mirando.',
  'Hoy es buen día para dejar todo un paso adelante.',
];

function getGtHour(): number {
  return parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Guatemala',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
    10,
  );
}

function fraseAleatoria(): string {
  return FRASES_MOTIVANTES[Math.floor(Math.random() * FRASES_MOTIVANTES.length)];
}

function buildMensaje(hour: number): string | null {
  if (hour === 8) {
    const frase = fraseAleatoria();
    return (
      `<b>Buenos días, Mariano!</b> ☀️\n\n` +
      `<i>${frase}</i>\n\n` +
      `📋 <b>Recordatorio:</b> Revisa las notificaciones del casillero electrónico del OJ ` +
      `(<a href="https://ojvirtual.oj.gob.gt">ojvirtual.oj.gob.gt</a>) y reporta cualquier novedad a la Licda. Amanda.`
    );
  }

  if (hour === 12) {
    return (
      `🕛 <b>Mariano</b>, ¿a qué hora vas a almorzar hoy? ` +
      `Avísame para coordinar la cobertura.`
    );
  }

  if (hour === 15) {
    return (
      `⏰ <b>Mariano</b>, recordatorio de la tarde: revisa nuevamente las notificaciones del casillero electrónico del OJ ` +
      `y reporta novedades a la Licda. Amanda.`
    );
  }

  return null;
}

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  if (!groupChatId) {
    console.error('[mensajes-mariano] TELEGRAM_GROUP_CHAT_ID no está configurado');
    return NextResponse.json(
      { error: 'TELEGRAM_GROUP_CHAT_ID no configurado' },
      { status: 500 },
    );
  }

  const hour = getGtHour();
  const text = buildMensaje(hour);

  if (!text) {
    console.log(`[mensajes-mariano] Hora GT=${hour}: sin mensaje programado, skip`);
    return NextResponse.json({ ok: true, sent: false, hour });
  }

  try {
    await sendTelegramMessage(text, { parse_mode: 'HTML', chatId: groupChatId });
    console.log(`[mensajes-mariano] Mensaje enviado a grupo (hora GT=${hour})`);
    return NextResponse.json({ ok: true, sent: true, hour });
  } catch (err: any) {
    console.error('[mensajes-mariano] Error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Error interno' },
      { status: 500 },
    );
  }
}
