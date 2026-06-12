// ============================================================================
// GET  /api/admin/llamadas   — listar llamadas programadas
// POST /api/admin/llamadas   — agendar una llamada
// Protegido por el middleware admin (proxy.ts → /api/admin*).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { listarLlamadas, crearLlamada, LlamadaError } from '@/lib/services/llamadas.service';

export async function GET() {
  try {
    const data = await listarLlamadas();
    return NextResponse.json({ data });
  } catch (err) {
    const msg = err instanceof LlamadaError ? err.message : 'Error al listar llamadas';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.nombre_contacto?.trim() || !body.email_contacto?.trim() || !body.fecha || !body.hora || !body.asunto?.trim()) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: nombre, email, fecha, hora y asunto.' },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email_contacto.trim())) {
      return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
    }

    const emailsCc = Array.isArray(body.emails_cc)
      ? body.emails_cc.map((e: string) => String(e).trim()).filter(Boolean)
      : [];

    const llamada = await crearLlamada({
      cliente_id: body.cliente_id ?? null,
      nombre_contacto: body.nombre_contacto.trim(),
      email_contacto: body.email_contacto.trim().toLowerCase(),
      telefono_contacto: body.telefono_contacto?.trim() || null,
      emails_cc: emailsCc,
      fecha: body.fecha,
      hora: body.hora,
      duracion_minutos: body.duracion_minutos ? Number(body.duracion_minutos) : 30,
      asunto: body.asunto.trim(),
      notas: body.notas?.trim() || null,
    });

    return NextResponse.json(llamada, { status: 201 });
  } catch (err) {
    const msg = err instanceof LlamadaError ? err.message : 'Error al agendar llamada';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
