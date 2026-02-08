// ============================================================================
// POST /api/public/agendar
// Agendamiento público de citas (sin auth)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { crearCita, obtenerDisponibilidad, CitaError } from '@/lib/services/citas.service';
import { createAdminClient } from '@/lib/supabase/admin';
import { HORARIOS, TipoCita } from '@/lib/types';

// ── Rate limiting (in-memory, per serverless instance) ─────────────────────

const ipCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipCounts.set(ip, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Intenta de nuevo en 1 hora.' },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { tipo, fecha, hora, nombre, email, telefono, empresa, asunto, numero_caso, _hp } = body;

    // Honeypot — bots fill hidden fields, humans don't
    if (_hp) {
      // Fake success to not alert the bot
      return NextResponse.json({ success: true, cita_id: 'ok', teams_link: null });
    }

    // Validate required fields
    if (
      !tipo || !fecha || !hora ||
      !nombre?.trim() || !email?.trim() ||
      !telefono?.trim() || !asunto?.trim()
    ) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben completarse.' },
        { status: 400 }
      );
    }

    const tipoCita = tipo as TipoCita;
    if (!HORARIOS[tipoCita]) {
      return NextResponse.json({ error: 'Tipo de cita inválido.' }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const config = HORARIOS[tipoCita];

    // Double-check availability
    const slots = await obtenerDisponibilidad(fecha, tipoCita);

    // For consulta_nueva the public page sends the hour; match to a slot
    let matchedSlot: { hora_inicio: string; hora_fin: string; duracion_minutos: number } | null = null;

    if (tipoCita === 'consulta_nueva') {
      // Need both HH:00 and HH:30 free to book a 1-hour slot
      const hasStart = slots.some((s: any) => s.hora_inicio === hora);
      const halfHour = hora.replace(':00', ':30');
      const hasHalf = slots.some((s: any) => s.hora_inicio === halfHour);

      if (hasStart && hasHalf) {
        const [h] = hora.split(':').map(Number);
        matchedSlot = {
          hora_inicio: hora,
          hora_fin: `${String(h + 1).padStart(2, '0')}:00`,
          duracion_minutos: 60,
        };
      }
    } else {
      // Seguimiento — exact 15-min slot
      const found = slots.find((s: any) => s.hora_inicio === hora);
      if (found) matchedSlot = found;
    }

    if (!matchedSlot) {
      return NextResponse.json(
        { error: 'El horario seleccionado ya no está disponible. Por favor elige otro.' },
        { status: 409 }
      );
    }

    // Find or create client
    const db = createAdminClient();
    let clienteId: string;

    const { data: existing } = await db
      .from('clientes')
      .select('id')
      .ilike('email', email.trim())
      .limit(1)
      .single();

    if (existing) {
      clienteId = existing.id;
    } else {
      const codigo = `CLI-${Date.now().toString(36).toUpperCase()}`;
      const { data: nuevo, error: createErr } = await db
        .from('clientes')
        .insert({
          codigo,
          nombre: nombre.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim(),
          empresa: empresa?.trim() || null,
          tipo_persona: 'individual',
          estado: 'activo',
        })
        .select('id')
        .single();

      if (createErr) {
        console.error('[Agendar] Error al crear cliente:', createErr);
        return NextResponse.json(
          { error: 'Error al procesar datos del cliente.' },
          { status: 500 }
        );
      }
      clienteId = nuevo.id;
    }

    // Build title
    const tipoLabel = tipoCita === 'consulta_nueva' ? 'Consulta' : 'Seguimiento';
    const titulo = `${tipoLabel} — ${nombre.trim()}`;

    // Create cita (handles Outlook event + confirmation email automatically)
    const cita = await crearCita({
      tipo: tipoCita,
      titulo,
      descripcion: asunto.trim(),
      fecha,
      hora_inicio: matchedSlot.hora_inicio,
      hora_fin: matchedSlot.hora_fin,
      duracion_minutos: matchedSlot.duracion_minutos,
      cliente_id: clienteId,
      costo: config.costo,
      notas: numero_caso ? `Caso/referencia: ${numero_caso}` : undefined,
    });

    console.log(`[Agendar] Cita creada: ${cita.id} — ${titulo} — ${fecha} ${matchedSlot.hora_inicio}`);

    return NextResponse.json(
      {
        success: true,
        cita_id: cita.id,
        teams_link: cita.teams_link,
        fecha: cita.fecha,
        hora_inicio: cita.hora_inicio,
        hora_fin: cita.hora_fin,
        tipo: cita.tipo,
        costo: cita.costo,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[Agendar] Error:', err);
    const msg = err instanceof CitaError ? err.message : 'Error al agendar cita.';
    const status = msg.includes('no está disponible') ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
