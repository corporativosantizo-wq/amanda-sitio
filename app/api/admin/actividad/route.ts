// ============================================================================
// POST /api/admin/actividad — Register user activity
// GET /api/admin/actividad — Get activity for productivity dashboard
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase/admin';

const db = () => createAdminClient();

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (!email) return NextResponse.json({ error: 'No auth' }, { status: 401 });

    const { accion, modulo, detalle } = await req.json();
    if (!accion) return NextResponse.json({ error: 'accion requerida' }, { status: 400 });

    const now = new Date();
    const fecha = now.toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

    await db().from('actividad_usuario').insert({
      usuario_email: email,
      fecha,
      hora: now.toISOString(),
      accion,
      modulo: modulo ?? null,
      detalle: detalle ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[Actividad] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const s = req.nextUrl.searchParams;
    const email = s.get('email') || 'contador@papeleo.legal';
    const fecha = s.get('fecha');
    const desde = s.get('desde');
    const hasta = s.get('hasta');

    if (fecha) {
      // Single day detail
      const { data, error } = await db()
        .from('actividad_usuario')
        .select('*')
        .eq('usuario_email', email)
        .eq('fecha', fecha)
        .order('hora', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // Also get docs uploaded that day
      const { data: docs } = await db()
        .from('documentos')
        .select('id, titulo, created_at')
        .eq('created_by', email)
        .gte('created_at', `${fecha}T00:00:00`)
        .lte('created_at', `${fecha}T23:59:59`);

      // Get break schedules
      const { data: descansos } = await db()
        .from('horarios_descanso')
        .select('*')
        .eq('usuario_email', email)
        .eq('activo', true);

      return NextResponse.json({
        actividad: data ?? [],
        documentos: docs ?? [],
        descansos: descansos ?? [],
      });
    }

    // Weekly summary
    const rangeStart = desde || new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const rangeEnd = hasta || new Date().toISOString().slice(0, 10);

    // Get activity grouped by date
    const { data: actividad } = await db()
      .from('actividad_usuario')
      .select('fecha, hora, accion')
      .eq('usuario_email', email)
      .gte('fecha', rangeStart)
      .lte('fecha', rangeEnd)
      .order('hora', { ascending: true });

    // Get docs per day
    const { data: docs } = await db()
      .from('documentos')
      .select('id, created_at')
      .eq('created_by', email)
      .gte('created_at', `${rangeStart}T00:00:00`)
      .lte('created_at', `${rangeEnd}T23:59:59`);

    // Get break schedules
    const { data: descansos } = await db()
      .from('horarios_descanso')
      .select('*')
      .eq('usuario_email', email)
      .eq('activo', true);

    return NextResponse.json({
      actividad: actividad ?? [],
      documentos: docs ?? [],
      descansos: descansos ?? [],
    });
  } catch (err: any) {
    console.error('[Actividad GET] Error:', err.message);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
