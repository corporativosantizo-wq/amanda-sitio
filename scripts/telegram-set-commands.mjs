// ============================================================================
// scripts/telegram-set-commands.mjs
// Configura el menú nativo de comandos del bot de Telegram (setMyCommands).
// Uso: node scripts/telegram-set-commands.mjs   (lee TELEGRAM_BOT_TOKEN de .env.local)
// Es idempotente: correrlo de nuevo reemplaza la lista completa.
// ============================================================================

import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
// El valor puede venir entre comillas en .env.local — quitarlas
const raw = env.match(/^TELEGRAM_BOT_TOKEN=(.+)$/m)?.[1]?.trim();
const token = raw?.replace(/^["']|["']$/g, '');

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN no encontrado en .env.local');
  process.exit(1);
}

// Nombres de comando: solo a-z, 0-9 y _ (por eso /manana sin ñ — el webhook acepta ambos)
const commands = [
  { command: 'menu', description: 'Mostrar el teclado de botones' },
  { command: 'tareas', description: 'Ver mis tareas pendientes' },
  { command: 'tarea', description: 'Crear tarea rápida (ej: /tarea Llamar a Juan)' },
  { command: 'hoy', description: 'Agenda de hoy' },
  { command: 'manana', description: 'Agenda de mañana' },
  { command: 'semana', description: 'Vista de la semana' },
  { command: 'libre', description: 'Espacios libres de los próximos días' },
  { command: 'disponibilidad', description: 'Horarios libres de un día específico' },
  { command: 'crear', description: 'Crear evento en el calendario' },
  { command: 'cancelar', description: 'Cancelar un evento de hoy' },
  { command: 'buscar', description: 'Buscar archivos y correos (ej: /buscar contrato)' },
  { command: 'habitos', description: 'Hábitos de hoy' },
  { command: 'racha', description: 'Rachas de hábitos' },
  { command: 'pendientes', description: 'Borradores de email pendientes' },
  { command: 'stats', description: 'Estadísticas de Molly Mail' },
  { command: 'x', description: 'Cancelar el flujo activo' },
];

async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`${method}: ok=${json.ok}${json.ok ? '' : ` — ${json.description}`}`);
  if (!json.ok) process.exitCode = 1;
}

await tg('setMyCommands', { commands });
// Botón "Menú" azul junto al campo de texto → despliega la lista de comandos
await tg('setChatMenuButton', { menu_button: { type: 'commands' } });
